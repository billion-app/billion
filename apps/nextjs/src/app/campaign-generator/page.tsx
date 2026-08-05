import type { Metadata } from "next";

import { CAMPAIGN_CODES } from "../r/campaigns";
import { FlyerSheet } from "./flyer";
import { PrintButton } from "./print-button";
import { buildQr } from "./qr";

export const metadata: Metadata = {
  title: "Campaign flyer generator — Billion",
  description: "Generate a printable flyer sheet for a campaign code.",
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

/** Matches the sanitising in `campaignFor`, so the preview cannot lie. */
function sanitize(raw: string): string {
  return /^[a-z0-9_-]{1,32}$/i.test(raw) ? raw : "";
}

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

export default async function CampaignGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const requested = (p ?? "neighborhood").trim();
  const code = sanitize(requested) || "neighborhood";
  const rejected = requested !== "" && sanitize(requested) === "";
  const mapped = Object.hasOwn(CAMPAIGN_CODES, code);

  const waitlistUrl = `${SITE}/r?dest=home&p=${code}`;
  const betaUrl = `${SITE}/r?dest=tf&p=${code}`;
  const waitlist = buildQr(waitlistUrl, "H");
  const beta = buildQr(betaUrl, "M");

  return (
    <>
      <div className="mx-auto max-w-[760px] px-6 py-12 print:hidden">
        <span className="tracking-label text-muted-foreground mb-2 block font-sans text-[12px] font-medium uppercase">
          Internal tool
        </span>
        <h1 className="text-foreground mb-4 text-[32px] leading-[1.15] font-bold tracking-[-0.02em]">
          Campaign flyer generator
        </h1>
        <p className="text-muted-foreground mb-8 max-w-[60ch] font-sans text-[15px] leading-[1.7]">
          Both QR codes below carry the campaign code, so each stack reports
          separately. Print one run per code &mdash; a stack can only carry one.
        </p>

        <form method="get" className="mb-8 flex flex-wrap items-end gap-3">
          <label className="flex-1">
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
