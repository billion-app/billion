import type { TypeFilter } from "~/lib/browse-params";

/**
 * Loading, failure and empty states. The copy is the phone's, because each
 * one says something true about the data: a state has bills but no courts or
 * orders yet; a failed load has not changed your scope.
 */

export function ListSkeleton() {
  return (
    <div aria-label="Loading results" role="progressbar" className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-10">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="border-rule animate-pulse border-b py-[18px]">
          <div className="mb-3 h-[10px] w-24 rounded bg-[rgba(247,244,238,0.08)]" />
          <div className="mb-2 h-5 w-[90%] rounded bg-[rgba(247,244,238,0.10)]" />
          <div className="mb-3 h-5 w-[60%] rounded bg-[rgba(247,244,238,0.10)]" />
          <div className="h-3 w-[75%] rounded bg-[rgba(247,244,238,0.06)]" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  name,
  onRetry,
  onFederal,
}: {
  name: string;
  onRetry: () => void;
  onFederal?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
      <p className="font-display text-ink-night text-[18px] font-bold">
        {name} didn’t load
      </p>
      <p className="text-quiet font-sans text-[14px] leading-5">
        Your scope hasn’t changed. Try this jurisdiction again.
      </p>
      <ActionPill onClick={onRetry}>Try again</ActionPill>
      {onFederal ? (
        <button
          type="button"
          onClick={onFederal}
          className="text-ink-night mt-1 cursor-pointer font-sans text-[13px] font-semibold hover:underline"
        >
          Browse Federal instead
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  scopeName,
  isState,
  type,
  query,
  onShowBills,
}: {
  scopeName: string;
  isState: boolean;
  type: TypeFilter;
  query?: string;
  onShowBills: () => void;
}) {
  const title =
    isState && type === "court_case"
      ? `No ${scopeName} court cases yet`
      : isState
        ? `No ${scopeName} ${type === "all" ? "bills" : "records"} found`
        : query
          ? `No match for “${query}”`
          : "Nothing found";
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
      <EmptyMark />
      <p className="font-display text-ink-night mt-2 text-[18px] font-bold">{title}</p>
      <p className="text-quiet max-w-[360px] font-sans text-[14px] leading-5">
        {isState
          ? `${scopeName} legislature only — courts and orders aren’t in yet.`
          : "Try a different search."}
      </p>
      {isState && type !== "bill" && type !== "all" ? (
        <ActionPill onClick={onShowBills}>Show {scopeName} bills</ActionPill>
      ) : null}
    </div>
  );
}

function ActionPill({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-card-border bg-pill-on text-ink-night mt-[10px] cursor-pointer rounded-full border px-[18px] py-[10px] font-sans text-[13px] font-semibold hover:brightness-125"
    >
      {children}
    </button>
  );
}

/** A quiet magnifier over ruled lines — the phone's empty-search mark, simplified. */
function EmptyMark() {
  return (
    <svg width="88" height="64" viewBox="0 0 88 64" fill="none" aria-hidden>
      <path d="M8 18h44M8 30h32M8 42h38" stroke="rgba(247,244,238,0.16)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="62" cy="34" r="13" stroke="var(--digest-digest-spark)" strokeWidth="2.2" />
      <path d="m71.5 43.5 9 9" stroke="var(--digest-digest-spark)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
