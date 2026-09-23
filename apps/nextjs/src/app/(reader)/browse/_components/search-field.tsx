"use client";

import { Icon } from "../../_components/icon";

/** The phone's paper search pill. */
export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => event.preventDefault()}
    >
      <Icon
        name="search"
        size={19}
        className="text-quiet pointer-events-none absolute top-1/2 left-[18px] -translate-y-1/2"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search bills, orders and cases"
        aria-label="Search the archive"
        className="bg-paper text-ink-paper placeholder:text-[rgba(22,19,26,0.42)] h-[52px] w-full rounded-[26px] border-0 pr-12 pl-[48px] font-sans text-[16px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--digest-digest-primary)] md:h-[56px] md:rounded-[28px] md:text-[17px]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-ink-paper/60 hover:text-ink-paper absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer"
        >
          <Icon name="close" size={17} />
        </button>
      ) : null}
    </form>
  );
}
