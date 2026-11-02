import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";

import {
  campaignBrowserImage,
  createCampaignBrowserHost,
} from "./campaign-browser-host";

test(
  "fixed host capability: authentication, sandbox, no IP sockets, cleanup",
  { skip: process.env.CAMPAIGN_BROWSER_LOCAL_SMOKE !== "1", timeout: 120_000 },
  async () => {
    const execute = promisify(execFile),
      docker = process.env.CAMPAIGN_BROWSER_DOCKER ?? "/usr/local/bin/docker";
    const wrapper = fileURLToPath(
      new URL(
        "../../../../deploy/big-mac/campaign-renderer/chromium-pipe.mjs",
        import.meta.url,
      ),
    );
    const token = "local-smoke-token-0123456789abcdef";
    const host = createCampaignBrowserHost({
      token,
      dockerPath: docker,
      wrapperPath: wrapper,
    });
    await new Promise<void>((resolve) =>
      host.server.listen(0, "127.0.0.1", resolve),
    );
    const address = host.server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const headers = { authorization: `Bearer ${token}` };
    try {
      assert.equal(
        (await fetch(base + "/v1/browsers", { method: "POST" })).status,
        401,
      );
      assert.equal(
        (
          await fetch(base + "/v1/browsers", {
            method: "POST",
            headers,
            body: '{"args":["--no-sandbox"]}',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await fetch(base + "/v1/browsers/" + "a".repeat(32), {
            method: "DELETE",
            headers,
          })
        ).status,
        404,
      );
      const response = await fetch(base + "/v1/browsers", {
        method: "POST",
        headers,
      });
      assert.equal(response.status, 201);
      const lease = (await response.json()) as {
        id: string;
        endpoint: string;
        sandbox: string;
      };
      assert.match(lease.sandbox, /Seccomp-BPF sandbox\s+Yes/);
      assert.equal(
        (await fetch(base + "/v1/browsers", { method: "POST", headers }))
          .status,
        503,
      );
      const browser = await chromium.connect(lease.endpoint);
      try {
        const page = await browser.newPage();
        await page.setContent("<main>Local pipe transport works</main>");
        assert.equal(
          await page.locator("main").innerText(),
          "Local pipe transport works",
        );
      } finally {
        await browser.close();
      }
      const name = `billion-render-${lease.id}`;
      const denied = await execute(docker, [
        "exec",
        name,
        "python3",
        "-c",
        'import socket,json; r=[]\nfor f,t in [(socket.AF_INET,socket.SOCK_STREAM),(socket.AF_INET6,socket.SOCK_STREAM),(socket.AF_INET,socket.SOCK_DGRAM),(socket.AF_INET6,socket.SOCK_DGRAM)]:\n try: socket.socket(f,t);r.append("UNSAFE")\n except PermissionError:r.append("denied")\nprint(json.dumps(r))',
      ]);
      assert.deepEqual(JSON.parse(denied.stdout), [
        "denied",
        "denied",
        "denied",
        "denied",
      ]);
      const allowed = await execute(docker, [
        "run",
        "--rm",
        "--network",
        "none",
        "--entrypoint",
        "python3",
        campaignBrowserImage,
        "-c",
        'import socket; [socket.socket(f,t) for f in [socket.AF_INET,socket.AF_INET6] for t in [socket.SOCK_STREAM,socket.SOCK_DGRAM]]; print("allowed")',
      ]);
      assert.equal(allowed.stdout.trim(), "allowed");
      assert.equal(
        (
          await fetch(base + `/v1/browsers/${lease.id}`, {
            method: "DELETE",
            headers,
          })
        ).status,
        200,
      );
      await assert.rejects(execute(docker, ["inspect", name]));
      const unknown = `billion-render-smoke-${process.pid}`;
      await execute(docker, [
        "create",
        "--name",
        unknown,
        "--label",
        "com.billion.service=campaign-renderer",
        "--entrypoint",
        "/bin/true",
        campaignBrowserImage,
      ]);
      try {
        assert.equal(
          (await fetch(base + "/v1/browsers", { method: "POST", headers }))
            .status,
          503,
        );
        await execute(docker, ["inspect", unknown]);
        const capability = (await (
          await fetch(base + "/v1/capability", { headers })
        ).json()) as { available: boolean };
        assert.equal(capability.available, false);
      } finally {
        await execute(docker, ["rm", unknown]);
      }
    } finally {
      await host.close();
    }
  },
);

test(
  "lease expiry during Chromium startup joins launch and leaves no orphan",
  { skip: process.env.CAMPAIGN_BROWSER_LOCAL_SMOKE !== "1", timeout: 120_000 },
  async () => {
    const docker =
        process.env.CAMPAIGN_BROWSER_DOCKER ?? "/usr/local/bin/docker",
      execute = promisify(execFile),
      token = "local-smoke-token-0123456789abcdef";
    const temporary = mkdtempSync(join(tmpdir(), "campaign-startup-smoke-"));
    const slowDocker = join(temporary, "docker.mjs");
    writeFileSync(
      slowDocker,
      '#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nif(process.argv[2]==="run") Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2500);\nconst r=spawnSync(' +
        JSON.stringify(docker) +
        ',process.argv.slice(2),{stdio:"inherit"});process.exit(r.status??1);\n',
      { mode: 0o700 },
    );
    const host = createCampaignBrowserHost({
      token,
      dockerPath: slowDocker,
      wrapperPath: fileURLToPath(
        new URL(
          "../../../../deploy/big-mac/campaign-renderer/chromium-pipe.mjs",
          import.meta.url,
        ),
      ),
      leaseMilliseconds: 1000,
    });
    await new Promise<void>((r) => host.server.listen(0, "127.0.0.1", r));
    const address = host.server.address();
    assert.ok(address && typeof address !== "string");
    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/v1/browsers`,
        { method: "POST", headers: { authorization: `Bearer ${token}` } },
      );
      assert.equal(response.status, 503);
    } finally {
      await host.close();
      rmSync(temporary, { recursive: true, force: true });
    }
    const remaining = await execute(docker, [
      "ps",
      "--all",
      "--filter",
      "label=com.billion.service=campaign-renderer",
      "--format",
      "{{.Names}}",
    ]);
    assert.equal(remaining.stdout.trim(), "");
  },
);

test(
  "actual browser broker rejects FEC asset redirects before any FEC DNS or transport",
  { skip: process.env.CAMPAIGN_BROWSER_LOCAL_SMOKE !== "1", timeout: 120_000 },
  async () => {
    const { renderCampaignSource } = await import("./campaign-browser");
    const { campaignArchiveHash } =
      await import("@acme/api/lib/campaign-render-archive");
    const { formatCampaignHtml } =
      await import("@acme/api/lib/campaign-source-html");
    const docker =
        process.env.CAMPAIGN_BROWSER_DOCKER ?? "/usr/local/bin/docker",
      token = "local-smoke-token-0123456789abcdef";
    const host = createCampaignBrowserHost({
      token,
      dockerPath: docker,
      wrapperPath: fileURLToPath(
        new URL(
          "../../../../deploy/big-mac/campaign-renderer/chromium-pipe.mjs",
          import.meta.url,
        ),
      ),
    });
    await new Promise<void>((r) => host.server.listen(0, "127.0.0.1", r));
    const address = host.server.address();
    assert.ok(address && typeof address !== "string");
    const url = "https://campaign.example/",
      raw = Buffer.from(
        '<html><head><script type="module" src="/app.js"></script></head><body><main></main></body></html>',
      ),
      hash = campaignArchiveHash(raw),
      time = "2026-01-01T00:00:00.000Z";
    const initial = {
      id: "root",
      url,
      retrievalUrls: [url],
      publisher: "offline fixture",
      format: "html" as const,
      text: formatCampaignHtml(raw.toString(), url).text,
      contentHash: campaignArchiveHash(
        formatCampaignHtml(raw.toString(), url).text,
      ),
      byteHash: hash,
      binaryBase64: raw.toString("base64"),
      fetchedAt: time,
      httpObservation: {
        kind: "campaign_http_document_v1" as const,
        responses: [
          {
            url,
            status: 200,
            mime: "text/html",
            location: null,
            bodyHash: hash,
            bodyBytes: raw.length,
            startedAt: time,
            completedAt: time,
          },
        ],
      },
    };
    try {
      for (const destination of [
        "https://api.open.fec.gov/v1/candidate/",
        "https://api.open.fec.gov./v1/candidate/",
      ]) {
        const dns: string[] = [],
          requests: string[] = [];
        await assert.rejects(
          renderCampaignSource({
            initial,
            candidateId: "offline-no-fec",
            ownershipDigest: "a".repeat(64),
            configuration: {
              baseUrl: `http://127.0.0.1:${address.port}`,
              token,
            },
            budget: { request() {}, bytes() {} },
            addresses: async (requested) => {
              dns.push(requested);
              return [{ address: "203.0.113.1", family: 4 }];
            },
            transport: async (requested) => {
              requests.push(requested);
              return new Response("", {
                status: 302,
                headers: {
                  location: destination,
                  "content-type": "text/javascript",
                },
              });
            },
          }),
        );
        assert.ok(requests.includes("https://campaign.example/app.js"));
        assert.equal(
          dns.some(
            (requested) =>
              new URL(requested).hostname.replace(/\.$/, "") ===
              "api.open.fec.gov",
          ),
          false,
        );
        assert.equal(
          requests.some(
            (requested) =>
              new URL(requested).hostname.replace(/\.$/, "") ===
              "api.open.fec.gov",
          ),
          false,
        );
      }
    } finally {
      await host.close();
    }
  },
);
