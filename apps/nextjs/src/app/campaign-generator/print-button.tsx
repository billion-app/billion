"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-accent text-accent-foreground inline-flex min-h-11 items-center rounded-full px-5 py-2.5 font-sans text-[14px] font-semibold transition-opacity hover:opacity-90"
    >
      Print / Save as PDF
    </button>
  );
}
