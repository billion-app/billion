import { load } from "cheerio";
import { chromium } from "playwright";
import { z } from "zod/v4";

import type { CampaignRenderArchive } from "@acme/api/lib/campaign-render-archive";
import type { ResearchSource } from "@acme/validators";
import {
  campaignArchiveHash,
  encodeCampaignRenderSources,
} from "@acme/api/lib/campaign-render-archive";
import { htmlSourceText } from "@acme/api/lib/campaign-source-html";
import { campaignBrowserContract } from "@acme/validators";

import { publicSourceAddresses } from "./pages.js";
import { requestPublicSource } from "./transport.js";

export class CampaignRendererUnavailable extends Error {}
export interface CampaignBrowserConfiguration {
  baseUrl: string;
  token: string;
}
export interface CampaignRenderBudget {
  request(): void;
  bytes(amount: number): void;
}
const leaseSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  endpoint: z.url(),
  expiresAt: z.iso.datetime(),
  protocol: z.literal(campaignBrowserContract.protocol),
  image: z.literal(campaignBrowserContract.image),
  playwrightVersion: z.literal(campaignBrowserContract.playwrightVersion),
  browserVersion: z.string(),
  seccompHash: z.literal(campaignBrowserContract.seccompHash),
  sandbox: z.string().max(4000),
});
export function admittedCampaignShell(source: ResearchSource) {
  if (
    source.format !== "html" ||
    !source.binaryBase64 ||
    !source.httpObservation ||
    source.acquisition
  )
    return false;
  const responses = source.httpObservation.responses,
    final = responses.at(-1)!;
  const bytes = Buffer.from(source.binaryBase64, "base64");
  if (
    final.status !== 200 ||
    !/text\/html/i.test(final.mime) ||
    final.url !== source.url ||
    campaignArchiveHash(bytes) !== source.byteHash ||
    bytes.length !== final.bodyBytes
  )
    return false;
  const html = bytes.toString("utf8"),
    $ = load(html);
  if (
    htmlSourceText(html).length >= 20 ||
    /captcha|verify (?:you are|that you are) human|access denied|checking your browser|sign in|log in/i.test(
      html,
    ) ||
    $('meta[name="robots"]')
      .toArray()
      .some((element) =>
        /noai|none|noindex|nofollow/i.test($(element).attr("content") ?? ""),
      )
  )
    return false;
  const scripts = $(
    'script[type="module"][src],link[rel="modulepreload"][href]',
  ).toArray();
  return (
    scripts.length > 0 &&
    scripts.length <= 12 &&
    scripts.every((element) => {
      try {
        return (
          new URL(
            $(element).attr("src") ?? $(element).attr("href")!,
            source.url,
          ).origin === new URL(source.url).origin
        );
      } catch {
        return false;
      }
    })
  );
}
export async function renderCampaignSource(input: {
  initial: ResearchSource;
  candidateId: string;
  ownershipDigest: string;
  configuration?: CampaignBrowserConfiguration;
  budget: CampaignRenderBudget;
  transport?: typeof requestPublicSource;
  addresses?: typeof publicSourceAddresses;
}): Promise<ResearchSource[]> {
  if (!admittedCampaignShell(input.initial))
    throw new Error(
      "Only an owned successful thin module shell can be rendered",
    );
  const configuration = input.configuration;
  if (!configuration?.token || configuration.token.length < 32)
    throw new CampaignRendererUnavailable(
      "A sandboxed campaign renderer is not configured",
    );
  const base = new URL(configuration.baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    !["127.0.0.1", "localhost", "host.docker.internal"].includes(
      base.hostname,
    ) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new CampaignRendererUnavailable(
      "Renderer must use the configured private host capability",
    );
  const authorization = { authorization: `Bearer ${configuration.token}` };
  let lease: z.infer<typeof leaseSchema> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.connect>> | undefined;
  let failure: Error | undefined;
  const origin = new URL(input.initial.url).origin;
  const initial = input.initial.httpObservation!.responses;
  const archive: CampaignRenderArchive = {
    version: 1,
    kind: "network_none_campaign_archive",
    candidateId: input.candidateId,
    ownershipDigest: input.ownershipDigest,
    origin,
    requestedUrl: input.initial.retrievalUrls![0]!,
    renderer: { ...campaignBrowserContract, browserVersion: "", sandbox: "" },
    initialResponseCount: initial.length,
    responses: [],
    bodies: {},
    pages: [],
    blocked: [],
  };
  let bytes = 0,
    requests = initial.length;
  for (const response of initial) {
    const encoded = response.bodyBase64 ?? input.initial.binaryBase64!;
    const body = Buffer.from(encoded, "base64");
    if (
      body.length !== response.bodyBytes ||
      campaignArchiveHash(body) !== response.bodyHash
    )
      throw new Error("Initial campaign response archive does not replay");
    bytes += body.length;
    const { bodyBase64: _body, ...metadata } = response;
    archive.responses.push({ ...metadata, kind: "document" });
    archive.bodies[response.bodyHash] = encoded;
  }
  const stop = AbortSignal.timeout(90_000);
  try {
    const allocation = await fetch(new URL("/v1/browsers", base), {
      method: "POST",
      headers: authorization,
      signal: stop,
    });
    if (allocation.status !== 201)
      throw new CampaignRendererUnavailable(
        "Sandboxed campaign renderer refused the bounded job",
      );
    lease = leaseSchema.parse(await allocation.json());
    const endpoint = new URL(lease.endpoint);
    if (
      !["ws:", "wss:"].includes(endpoint.protocol) ||
      endpoint.hostname !== base.hostname ||
      Date.parse(lease.expiresAt) <= Date.now() ||
      Date.parse(lease.expiresAt) > Date.now() + 120_000
    )
      throw new CampaignRendererUnavailable(
        "Renderer lease endpoint or deadline is invalid",
      );
    archive.renderer = {
      protocol: lease.protocol,
      image: lease.image,
      playwrightVersion: lease.playwrightVersion,
      browserVersion: lease.browserVersion,
      seccompHash: lease.seccompHash,
      sandbox: lease.sandbox,
    };
    browser = await chromium.connect(lease.endpoint, { timeout: 15_000 });
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    let initialServed = false;
    const expectedDocuments = new Set([input.initial.url]);
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        kind = request.resourceType();
      const reason =
        request.method() !== "GET"
          ? "non-GET"
          : url.origin !== origin || url.protocol !== "https:"
            ? "outside-approved-HTTPS-origin"
            : !["document", "script", "stylesheet"].includes(kind)
              ? "unsupported-resource-kind"
              : /^\/(?:~|__l5e|analytics|favicon)/.test(url.pathname)
                ? "auxiliary-tracking"
                : kind === "document" &&
                    (!expectedDocuments.has(url.href) ||
                      request.frame().parentFrame())
                  ? "unobserved-document"
                  : undefined;
      if (reason) {
        if (archive.blocked.length >= 1000)
          failure = new Error(
            "Campaign renderer exceeded its blocked-request ledger bound",
          );
        else archive.blocked.push({ url: url.href, reason });
        await route.abort("blockedbyclient");
        return;
      }
      try {
        if (stop.aborted) throw new Error("Campaign render deadline exceeded");
        if (
          !initialServed &&
          kind === "document" &&
          url.href === input.initial.url
        ) {
          initialServed = true;
          await route.fulfill({
            status: 200,
            contentType: initial.at(-1)!.mime,
            body: Buffer.from(input.initial.binaryBase64!, "base64"),
          });
          return;
        }
        if (requests >= 30)
          throw new Error(
            "Campaign renderer exceeded thirty actual source requests",
          );
        requests++;
        input.budget.request();
        const startedAt = new Date().toISOString();
        const response = await (input.transport ?? requestPublicSource)(
          url.href,
          await (input.addresses ?? publicSourceAddresses)(url.href),
          stop,
          {
            "User-Agent": "Mozilla/5.0 (compatible; BillionResearch/1.0)",
            Accept: request.headers().accept ?? "*/*",
          },
        );
        const chunks: Buffer[] = [],
          reader = response.body?.getReader();
        if (reader)
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            input.budget.bytes(part.value.byteLength);
            if (bytes > 10_000_000) {
              await reader.cancel();
              throw new Error(
                "Campaign renderer exceeded received-body byte budget",
              );
            }
            chunks.push(Buffer.from(part.value));
          }
        const body = Buffer.concat(chunks),
          hash = campaignArchiveHash(body),
          location = response.headers.get("location");
        if (
          !response.ok &&
          ![301, 302, 303, 307, 308].includes(response.status)
        )
          throw new Error("A required campaign render resource failed");
        if (location && new URL(location, url).origin !== origin)
          throw new Error("Campaign asset redirected outside approved origin");
        if (response.headers.get("content-disposition")?.includes("attachment"))
          throw new Error("Campaign source attempted a download");
        archive.responses.push({
          url: url.href,
          kind: kind as "document" | "script" | "stylesheet",
          status: response.status,
          mime: response.headers.get("content-type") ?? "",
          location,
          bodyHash: hash,
          bodyBytes: body.length,
          startedAt,
          completedAt: new Date().toISOString(),
        });
        archive.bodies[hash] = body.toString("base64");
        const headers = Object.fromEntries(response.headers);
        for (const key of ["connection", "transfer-encoding", "content-length"])
          delete headers[key];
        await route.fulfill({ status: response.status, headers, body });
      } catch (error) {
        failure =
          error instanceof Error
            ? error
            : new Error("Campaign source acquisition failed");
        await route.abort("failed").catch(() => undefined);
      }
    });
    const page = await context.newPage();
    page.on("download", (download) => {
      failure = new Error("Campaign page attempted a download");
      void download.cancel();
    });
    page.on("pageerror", () => {
      failure = new Error("Campaign module execution failed");
    });
    const capture = async (url: string) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      if (failure) throw failure;
      await page.waitForFunction(
        '(document.querySelector("main")?.textContent?.length ?? 0) > 180',
        undefined,
        { timeout: 15_000 },
      );
      const mainObservations = await page.evaluate<
        Array<{ text: string; scrollY: number; capturedAt: string }>
      >(`(async () => {
        const limit = 50000;
        if (document.documentElement.scrollHeight > limit) throw new Error('Campaign document exceeds scroll coverage bound');
        const observations = [];
        const observe = () => observations.push({text:document.querySelector('main')?.innerText ?? '',scrollY:window.scrollY,capturedAt:new Date().toISOString()});
        observe();
        let height = document.documentElement.scrollHeight;
        for (let y=0; y <= height; y += 600) {
          window.scrollTo(0,y);
          await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
          observe();
          height = document.documentElement.scrollHeight;
          if (height > limit) throw new Error('Campaign document exceeds scroll coverage bound');
        }
        window.scrollTo(0,0);
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        observe();
        return observations;
      })()`);
      if (failure || stop.aborted)
        throw failure ?? new Error("Campaign render deadline exceeded");
      const value = await page.evaluate(() => {
        type VisibleNode = {
          tagName: string;
          textContent: string;
          outerHTML: string;
          innerText: string;
          href: string;
          cloneNode(deep: boolean): VisibleNode;
          querySelectorAll(selector: string): Iterable<VisibleNode>;
          hasAttribute(name: string): boolean;
          getAttribute(name: string): string | null;
          remove(): void;
          prepend(text: string): void;
          append(text: string): void;
        };
        const browser = globalThis as unknown as {
          document: {
            documentElement: VisibleNode;
            body: VisibleNode;
            querySelectorAll(selector: string): Iterable<VisibleNode>;
          };
          getComputedStyle(node: VisibleNode): {
            display: string;
            visibility: string;
          };
        };
        const clone = browser.document.documentElement.cloneNode(true);
        const originals = [
          ...browser.document.documentElement.querySelectorAll("*"),
        ];
        const copies = [...clone.querySelectorAll("*")];
        for (let index = originals.length - 1; index >= 0; index--) {
          const original = originals[index]!,
            copy = copies[index]!;
          const style = browser.getComputedStyle(original);
          if (
            original.tagName === "FOOTER" ||
            original.getAttribute("role") === "contentinfo"
          ) {
            copy.textContent = original.innerText;
            continue;
          }
          if (
            [
              "SCRIPT",
              "STYLE",
              "NOSCRIPT",
              "SVG",
              "IMG",
              "CANVAS",
              "IFRAME",
            ].includes(original.tagName) ||
            style.display === "none" ||
            style.visibility === "hidden"
          )
            copy.remove();
          else if (
            /^(P|DIV|SECTION|ADDRESS|LI|H[1-6]|MAIN|FOOTER|NAV|BUTTON|LABEL|FORM|A|TD|TH|DT|DD)$/.test(
              original.tagName,
            ) ||
            /^(?:block|flex|grid|table|list-item)/.test(style.display)
          ) {
            copy.prepend(" ");
            copy.append(" ");
          }
        }
        return {
          domHtml: browser.document.documentElement.outerHTML,
          evidenceDomHtml: clone.outerHTML,
          visibleText: browser.document.body.innerText,
          links: [...browser.document.querySelectorAll("a[href]")].map(
            (anchor) => ({ text: anchor.innerText.trim(), url: anchor.href }),
          ),
        };
      });
      const capturedDocument = archive.responses
        .slice()
        .reverse()
        .find(
          (response) =>
            response.url === url &&
            response.kind === "document" &&
            response.status === 200,
        );
      if (!capturedDocument)
        throw new Error("Rendered DOM lacks its actual document response");
      archive.pages.push({
        url,
        initialBodyHash: capturedDocument.bodyHash,
        domHtml: value.domHtml,
        evidenceDomHtml: value.evidenceDomHtml,
        visibleText: value.visibleText,
        capturedAt: new Date().toISOString(),
        mainObservations,
      });
      return value.links;
    };
    const links = await capture(input.initial.url);
    const candidates = links.filter((link) => {
      try {
        const url = new URL(link.url);
        return (
          url.origin === origin &&
          !url.hash &&
          !url.search &&
          /plan|priorit|issues|about|meet[ -]/i.test(
            link.text + " " + url.pathname,
          ) &&
          !/donat|volunteer|privacy|news|endorse/i.test(
            link.text + " " + url.pathname,
          )
        );
      } catch {
        return false;
      }
    });
    const unique = [
      ...new Map(candidates.map((link) => [link.url, link])).values(),
    ].sort(
      (a, b) =>
        Number(
          !/plan|priorit|issues/i.test(a.text + " " + new URL(a.url).pathname),
        ) -
        Number(
          !/plan|priorit|issues/i.test(b.text + " " + new URL(b.url).pathname),
        ),
    );
    for (const link of unique.slice(0, 2)) {
      expectedDocuments.add(link.url);
      await capture(link.url);
    }
    if (failure) throw failure;
    return encodeCampaignRenderSources(archive);
  } finally {
    await browser?.close().catch(() => undefined);
    if (lease) {
      const removal = await fetch(new URL(`/v1/browsers/${lease.id}`, base), {
        method: "DELETE",
        headers: authorization,
        signal: AbortSignal.timeout(15_000),
      });
      if (removal.status !== 200)
        throw new CampaignRendererUnavailable(
          "Renderer cleanup could not be verified",
        );
    }
  }
}
