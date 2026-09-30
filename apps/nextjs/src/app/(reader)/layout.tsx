import type { Metadata } from "next";

import { digestCssVariables } from "~/lib/digest-css";
import { SiteBar } from "./_components/site-bar";

export const metadata: Metadata = {
  title: "Browse — Billion",
  description:
    "Search bills, executive orders and court cases, and read each one in plain language with the source a click away.",
};

/**
 * The web reader: Browse, Saved and the full article reader.
 *
 * Everything under this group draws on the phone's Digest canvas rather than
 * the marketing site's theme, so the Digest tokens are emitted here, once, as
 * CSS custom properties that `globals.css` maps into Tailwind colour names.
 */
export default function ReaderLayout(props: { children: React.ReactNode }) {
  return (
    <div className="bg-night text-ink-night min-h-screen">
      {/* Static, generated from @acme/ui/digest-tokens at render time. */}
      <style dangerouslySetInnerHTML={{ __html: digestCssVariables() }} />
      <SiteBar />
      {props.children}
    </div>
  );
}
