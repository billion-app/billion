import { execFile } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import type { Browser, BrowserServer } from "playwright";
import { chromium } from "playwright";

export const campaignBrowserProtocol = "campaign-browser-network-none-v1";
export const campaignBrowserImage =
  "mcr.microsoft.com/playwright@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d";
export const campaignPlaywrightVersion = "1.58.2";
const execute = promisify(execFile);

interface RendererHostOptions {
  token: string;
  dockerPath: string;
  wrapperPath: string;
  browserHost?: string;
  advertisedHost?: string;
  leaseMilliseconds?: number;
}
interface InspectedContainer {
  Id: string;
  Config?: { User?: string; Image?: string; Labels?: Record<string, string> };
  HostConfig?: {
    NetworkMode?: string;
    ReadonlyRootfs?: boolean;
    Privileged?: boolean;
    CapAdd?: string[];
    CapDrop?: string[];
    SecurityOpt?: string[];
    PidsLimit?: number;
    Memory?: number;
    NanoCpus?: number;
  };
  Mounts?: unknown[];
}
interface BrowserLease {
  id: string;
  name: string;
  server?: BrowserServer;
  launch?: Promise<BrowserServer>;
  healthClient?: Browser;
  timer?: ReturnType<typeof setTimeout>;
  containerId?: string;
  cleanup?: Promise<void>;
  launchStarted?: boolean;
  expiresAt: string;
}

function authorized(value: string | undefined, token: string) {
  const hash = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(hash(value ?? ""), hash(`Bearer ${token}`));
}
function sandboxEnabled(text: string) {
  return (
    /Layer 1 Sandbox\s+Namespace/.test(text) &&
    ["PID namespaces", "Network namespaces", "Seccomp-BPF sandbox"].every(
      (label) => new RegExp(label + "\\s+Yes").test(text),
    )
  );
}
export function createCampaignBrowserHost(options: RendererHostOptions) {
  if (
    options.token.length < 32 ||
    !options.dockerPath.startsWith("/") ||
    !options.wrapperPath.startsWith("/")
  )
    throw new Error(
      "Private host token and absolute owned executables required",
    );
  if (
    createRequire(import.meta.url)("playwright/package.json").version !==
    campaignPlaywrightVersion
  )
    throw new Error("Matched host Playwright version required");
  const profile = JSON.parse(
    readFileSync(
      join(dirname(options.wrapperPath), "seccomp-browser.json"),
      "utf8",
    ),
  );
  if (profile.defaultAction !== "SCMP_ACT_ERRNO")
    throw new Error("Default-deny renderer seccomp required");
  const profileHash = createHash("sha256")
    .update(JSON.stringify(profile))
    .digest("hex");
  if (
    profileHash !==
    "428a062dfcc138999687d9922b61a8bc5cf0bce198198e4cf45c5e9b0289cb52"
  )
    throw new Error("Reviewed renderer syscall policy required");
  const duration = options.leaseMilliseconds ?? 120_000;
  if (!Number.isSafeInteger(duration) || duration < 1_000 || duration > 120_000)
    throw new Error("Browser lease must be bounded by two minutes");
  let active: BrowserLease | undefined;
  let quarantined = false;
  const docker = (...args: string[]) =>
    execute(options.dockerPath, args, { timeout: 10_000, maxBuffer: 100_000 });
  const inspect = async (name: string) => {
    try {
      const result = await docker("inspect", name);
      const rows = JSON.parse(result.stdout) as InspectedContainer[];
      return rows[0];
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "stderr" in error &&
        /No such (?:object|container)/i.test(String(error.stderr))
      )
        return undefined;
      throw error;
    }
  };
  const finishLaunchAndClose = async (lease: BrowserLease) => {
    const launched =
      lease.server ?? (await lease.launch?.catch(() => undefined));
    await Promise.race([
      launched?.close().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  };
  const stopOwnedDriver = async (lease: BrowserLease) => {
    const driver = lease.server?.process();
    if (!driver || driver.exitCode !== null || driver.signalCode !== null)
      return;
    await new Promise<void>((resolve, reject) => {
      const finished = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        driver.removeListener("exit", finished);
        reject(
          new Error(
            "Owned browser driver did not terminate after container cleanup",
          ),
        );
      }, 5_000);
      driver.once("exit", finished);
      driver.kill("SIGTERM");
    });
  };
  const cleanup = (lease: BrowserLease): Promise<void> => {
    if (lease.cleanup) return lease.cleanup;
    lease.cleanup = (async () => {
      clearTimeout(lease.timer);
      await finishLaunchAndClose(lease);
      const container = lease.launchStarted
        ? await inspect(lease.name)
        : undefined;
      if (container) {
        if (
          container.Config?.Labels?.["com.billion.service"] !==
            "campaign-renderer" ||
          (lease.containerId && container.Id !== lease.containerId)
        )
          throw new Error("Unknown container blocks renderer cleanup");
        await docker("rm", "--force", lease.name);
      }
      if (lease.launchStarted && (await inspect(lease.name)))
        throw new Error("Owned browser container remains after cleanup");
      await stopOwnedDriver(lease);
      if (active === lease) active = undefined;
    })().catch((error) => {
      quarantined = true;
      throw error;
    });
    return lease.cleanup;
  };
  const allocate = async () => {
    if (active || quarantined)
      throw new Error("Renderer busy or awaiting verified cleanup");
    const id = randomBytes(16).toString("hex");
    const lease: BrowserLease = {
      id,
      name: `billion-render-${id}`,
      expiresAt: new Date(Date.now() + duration).toISOString(),
    };
    active = lease;
    try {
      const remnants = await docker(
        "ps",
        "--all",
        "--filter",
        "label=com.billion.service=campaign-renderer",
        "--format",
        "{{.Names}}",
      );
      if (remnants.stdout.trim() || (await inspect(lease.name))) {
        quarantined = true;
        throw new Error(
          "Unknown renderer container requires owned operator cleanup",
        );
      }
      lease.timer = setTimeout(() => {
        void cleanup(lease).catch(() => undefined);
      }, duration);
      lease.launchStarted = true;
      lease.launch = chromium.launchServer({
        executablePath: options.wrapperPath,
        headless: true,
        chromiumSandbox: true,
        host: options.browserHost ?? "127.0.0.1",
        timeout: Math.min(duration, 20_000),
        env: {
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          HOME: process.env.HOME ?? "/tmp",
          BILLION_RENDER_CONTAINER: lease.name,
          BILLION_RENDER_DOCKER: options.dockerPath,
          ...(process.env.DOCKER_HOST
            ? { DOCKER_HOST: process.env.DOCKER_HOST }
            : {}),
          ...(process.env.DOCKER_CONTEXT
            ? { DOCKER_CONTEXT: process.env.DOCKER_CONTEXT }
            : {}),
        },
      });
      lease.server = await lease.launch;
      if (lease.cleanup || Date.now() >= Date.parse(lease.expiresAt))
        throw new Error("Renderer lease expired during startup");
      const container = await inspect(lease.name);
      if (
        !container ||
        container.Config?.User !== "pwuser" ||
        container.Config?.Image !== campaignBrowserImage ||
        container.HostConfig?.NetworkMode !== "none" ||
        !container.HostConfig?.ReadonlyRootfs ||
        container.HostConfig?.Privileged ||
        container.HostConfig?.CapAdd?.length ||
        !container.HostConfig?.CapDrop?.includes("ALL") ||
        container.Mounts?.length
      )
        throw new Error("Renderer container isolation is not active");
      const security = container.HostConfig.SecurityOpt ?? [];
      const installedProfile = security
        .find((value) => value.startsWith("seccomp="))
        ?.slice(8);
      if (
        !installedProfile ||
        createHash("sha256")
          .update(JSON.stringify(JSON.parse(installedProfile)))
          .digest("hex") !== profileHash ||
        !security.includes("no-new-privileges") ||
        container.HostConfig.PidsLimit !== 128 ||
        container.HostConfig.Memory !== 1073741824 ||
        container.HostConfig.NanoCpus !== 2000000000
      )
        throw new Error(
          "Renderer resource or syscall policy differs from fixed capability",
        );
      lease.containerId = container.Id;
      lease.healthClient = await chromium.connect(lease.server.wsEndpoint(), {
        timeout: 10_000,
      });
      const page = await lease.healthClient.newPage();
      await page.goto("chrome://sandbox");
      const sandbox = await page.locator("body").innerText();
      if (!sandboxEnabled(sandbox))
        throw new Error("Chromium sandbox capability is unavailable");
      await page.close();
      const endpoint = new URL(lease.server.wsEndpoint());
      if (options.advertisedHost) endpoint.hostname = options.advertisedHost;
      return {
        id,
        endpoint: endpoint.href,
        protocol: campaignBrowserProtocol,
        playwrightVersion: campaignPlaywrightVersion,
        image: campaignBrowserImage,
        browserVersion: lease.healthClient.version(),
        seccompHash: profileHash,
        sandbox,
        expiresAt: lease.expiresAt,
      };
    } catch (error) {
      await cleanup(lease);
      throw error;
    }
  };
  const server = createServer(async (request, response) => {
    const send = (status: number, body: unknown) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(body));
    };
    if (!authorized(request.headers.authorization, options.token)) {
      send(401, { error: "Unauthorized" });
      return;
    }
    if (request.method === "GET" && request.url === "/v1/capability") {
      send(200, {
        protocol: campaignBrowserProtocol,
        playwrightVersion: campaignPlaywrightVersion,
        image: campaignBrowserImage,
        available: !active && !quarantined,
      });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/browsers") {
      if (
        request.headers["transfer-encoding"] ||
        Number(request.headers["content-length"] ?? 0) !== 0
      ) {
        request.resume();
        send(400, { error: "Job options are not accepted" });
        return;
      }
      try {
        send(201, await allocate());
      } catch {
        send(503, { error: "Isolated browser capability unavailable" });
      }
      return;
    }
    const id = /^\/v1\/browsers\/([a-f0-9]{32})$/.exec(request.url ?? "")?.[1];
    if (request.method === "DELETE" && id && active?.id === id) {
      try {
        await cleanup(active);
        send(200, { removed: true });
      } catch {
        send(503, { error: "Owned cleanup could not be verified" });
      }
      return;
    }
    send(404, { error: "Unknown fixed renderer job" });
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 5_000;
  return {
    server,
    async close() {
      if (active) await cleanup(active);
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
