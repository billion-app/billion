import type { Metadata } from "next";

import type { TrackedDestination } from "../r/destinations";
import type { QrCode } from "./qr";
import { CAMPAIGN_CODES, sanitizeCampaignCode } from "../r/campaigns";
import { isTrackedDestination, TRACKED_DESTINATIONS } from "../r/destinations";
import { FlyerSheet } from "./flyer";
import { PrintButton } from "./print-button";
import { buildQr } from "./qr";

export const metadata: Metadata = {
  title: "Tracked QR generator — Billion",
  description: "Generate tracked QR codes and printable campaign flyers.",
  robots: { index: false, follow: false },
};

const SITE = "https://billion-news.app";

/** Printed widths of the two codes, from flyer.module.css. */
const WAITLIST_INCHES = 1.45;
const BETA_INCHES = 1.02;

/**
 * Below roughly 0.5mm (1.42pt) a printed module stops surviving toner spread on
 * a cheap laser printer. Shown per code so a long campaign code cannot quietly
 * produce an unscannable stack.
 */
const MODULE_FLOOR_PT = 1.42;

function Readout({
  label,
  url,
  inches,
  modules,
}: {
  label: string;
  url: string;
  inches: number;
  modules: number;
}) {
  const perModule = (inches / modules) * 72;
  const tight = perModule < MODULE_FLOOR_PT;

  return (
    <div className="border-border rounded-xl border px-4 py-3">
      <div className="text-foreground mb-1 font-sans text-[13px] font-semibold">
        {label}
      </div>
      <div className="text-muted-foreground mb-2 font-mono text-[11.5px] break-all">
        {url}
      </div>
      <div className="font-sans text-[12px]">
        <span className="text-muted-foreground">
          {modules} modules across {inches}in &mdash;{" "}
        </span>
        <span
          className={
            tight ? "font-semibold text-red-500" : "text-muted-foreground"
          }
        >
          {perModule.toFixed(2)}pt per module
          {tight && " — too tight to print reliably"}
        </span>
      </div>
    </div>
  );
}

function QrPreview({ code, label }: { code: QrCode; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${code.size} ${code.size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className="h-auto w-full"
    >
      <path fill="#FFFFFF" d={`M0 0h${code.size}v${code.size}H0z`} />
      <path stroke="#0E1530" d={code.path} />
    </svg>
  );
}

export default async function CampaignGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ dest?: string; p?: string }>;
}) {
  const { dest, p } = await searchParams;
  const requested = (p ?? "neighborhood").trim();
  const code = sanitizeCampaignCode(requested) || "neighborhood";
  const rejected = requested !== "" && sanitizeCampaignCode(requested) === "";
  const mapped = Object.hasOwn(CAMPAIGN_CODES, code);
  const requestedDest = dest ?? "";
  const standaloneDest: TrackedDestination = isTrackedDestination(requestedDest)
    ? requestedDest
    : "app";

  const waitlistUrl = `${SITE}/r?dest=home&p=${code}`;
  const betaUrl = `${SITE}/r?dest=tf&p=${code}`;
  const waitlist = buildQr(waitlistUrl, "H");
  const beta = buildQr(betaUrl, "M");
  const standaloneUrl = `${SITE}/r?dest=${standaloneDest}&p=${code}`;
  const standalone = buildQr(standaloneUrl, "H");
  const downloadQuery = new URLSearchParams({
    dest: standaloneDest,
    p: code,
  });

  return (
    <>
      <div className="mx-auto max-w-[760px] px-6 py-12 print:hidden">
        <span className="tracking-label text-muted-foreground mb-2 block font-sans text-[12px] font-medium uppercase">
          Internal tool
        </span>
        <h1 className="text-foreground mb-4 text-[32px] leading-[1.15] font-bold tracking-[-0.02em]">
          Tracked QR generator
        </h1>
        <p className="text-muted-foreground mb-8 max-w-[60ch] font-sans text-[15px] leading-[1.7]">
          Make a standalone QR for a slide, sign, or handout. Every scan records
          the campaign and destination before sending the person onward.
        </p>

        <form method="get" className="mb-8 flex flex-wrap items-end gap-3">
          <label className="min-w-[260px] flex-1">
            <span className="text-foreground mb-1.5 block font-sans text-[13px] font-semibold">
              Campaign code
            </span>
            <input
              type="text"
              name="p"
              defaultValue={code}
              list="known-codes"
              className="border-border text-foreground min-h-11 w-full rounded-lg border bg-transparent px-3 font-mono text-[14px]"
            />
            <datalist id="known-codes">
              {Object.keys(CAMPAIGN_CODES).map((known) => (
                <option key={known} value={known} />
              ))}
            </datalist>
          </label>
          <label className="min-w-48">
            <span className="text-foreground mb-1.5 block font-sans text-[13px] font-semibold">
              Destination
            </span>
            <select
              name="dest"
              defaultValue={standaloneDest}
              className="border-border text-foreground min-h-11 w-full rounded-lg border bg-transparent px-3 font-sans text-[14px]"
            >
              {Object.entries(TRACKED_DESTINATIONS).map(
                ([value, destination]) => (
                  <option key={value} value={value} className="bg-background">
                    {destination.label}
                  </option>
                ),
              )}
            </select>
          </label>
          <button
            type="submit"
            className="border-border text-foreground min-h-11 rounded-full border px-5 font-sans text-[14px] font-semibold"
          >
            Update
          </button>
          <PrintButton />
        </form>

        {rejected && (
          <p className="mb-4 font-sans text-[13px] text-red-500">
            &ldquo;{requested}&rdquo; is not a usable code (letters, digits,
            underscore and hyphen only, up to 32 characters). Showing{" "}
            <code>{code}</code> instead.
          </p>
        )}

        {!mapped && !rejected && (
          <p className="text-muted-foreground mb-4 max-w-[60ch] font-sans text-[13px]">
            <strong className="text-foreground">
              <code>{code}</code> has no mapping yet.
            </strong>{" "}
            It still works &mdash; scans report <code>utm_campaign={code}</code>{" "}
            with no source or medium. Add it to <code>app/r/campaigns.ts</code>{" "}
            to set a full combination.
          </p>
        )}

        <section className="border-border mb-12 grid gap-6 rounded-2xl border p-5 sm:grid-cols-[220px_1fr] sm:p-6">
          <div className="overflow-hidden rounded-xl bg-white p-3">
            <QrPreview
              code={standalone}
              label={`${code} QR code for ${TRACKED_DESTINATIONS[standaloneDest].label}`}
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <span className="tracking-label text-muted-foreground mb-2 font-sans text-[11px] font-semibold uppercase">
              Standalone tracked QR
            </span>
            <h2 className="text-foreground mb-2 text-[23px] font-bold">
              {TRACKED_DESTINATIONS[standaloneDest].label}
            </h2>
            <p className="text-muted-foreground mb-5 font-mono text-[11.5px] break-all">
              {standaloneUrl}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/campaign-generator/download?${downloadQuery.toString()}&format=png`}
                download
                className="bg-accent text-accent-foreground inline-flex min-h-11 items-center rounded-full px-5 py-2.5 font-sans text-[14px] font-semibold transition-opacity hover:opacity-90"
              >
                Download PNG
              </a>
              <a
                href={`/campaign-generator/download?${downloadQuery.toString()}&format=svg`}
                download
                className="border-border text-foreground inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 font-sans text-[14px] font-semibold"
              >
                Download SVG
              </a>
            </div>
            <p className="text-muted-foreground mt-4 font-sans text-[12px] leading-[1.6]">
              Use PNG in slides and documents. Use SVG when a printer or
              designer needs a code that stays sharp at any size.
            </p>
          </div>
        </section>

        <h2 className="text-foreground mb-2 text-[25px] font-bold">
          Printable flyer sheet
        </h2>
        <p className="text-muted-foreground mb-6 max-w-[60ch] font-sans text-[13px] leading-[1.6]">
          The sheet carries two tracked codes for the same campaign. Print one
          run per code so every physical stack reports separately.
        </p>

        <div className="mb-10 grid gap-3">
          <Readout
            label="Waitlist code (large)"
            url={waitlistUrl}
            inches={WAITLIST_INCHES}
            modules={waitlist.size}
          />
          <Readout
            label="Beta code (small)"
            url={betaUrl}
            inches={BETA_INCHES}
            modules={beta.size}
          />
        </div>

        <p className="text-muted-foreground mb-6 max-w-[60ch] font-sans text-[13px] leading-[1.6]">
          Print at <strong className="text-foreground">100% scale</strong> with
          margins set to <strong className="text-foreground">None</strong>. Scan
          both codes off the printed page before committing to a stack.
        </p>
      </div>

      <FlyerSheet waitlist={waitlist} beta={beta} />
    </>
  );
}
