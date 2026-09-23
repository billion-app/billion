"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@acme/ui";

import { useSavedIds } from "~/lib/reader-state";
import { Icon } from "./icon";

/**
 * The web reader's chrome. The phone's tab bar becomes a top bar: a browser
 * already has a back button and a scroll position, so what it needs from us
 * is a way home and a way to the saved list.
 */
export function SiteBar() {
  const pathname = usePathname();
  const { ids, ready } = useSavedIds();
  const onSaved = pathname.startsWith("/browse/saved");
  const onBrowse = !onSaved && pathname.startsWith("/browse");

  return (
    <header className="bg-night/90 border-chrome sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-4 md:px-8">
        <Link
          href="/browse"
          className="font-display text-ink-night text-[21px] font-bold tracking-[-0.02em] no-underline"
        >
          Billion
        </Link>
        <nav className="flex items-center gap-1" aria-label="Reader">
          <NavLink href="/browse" active={onBrowse}>
            Browse
          </NavLink>
          <NavLink href="/browse/saved" active={onSaved}>
            <Icon
              name={onSaved ? "bookmarkFill" : "bookmark"}
              size={15}
              className="md:hidden"
            />
            <span className="hidden md:inline">Saved</span>
            {ready && ids.length > 0 ? (
              <span className="bg-pill-on text-ink-night rounded-full px-[7px] py-px text-[11px] font-bold tabular-nums">
                {ids.length}
              </span>
            ) : null}
          </NavLink>
        </nav>
        <div className="flex-1" />
        <Link
          href="/"
          className="border-card-border text-ink-night hover:bg-slate rounded-full border px-4 py-[7px] font-sans text-[13px] font-semibold no-underline transition-colors"
        >
          Get the app
        </Link>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-[6px] rounded-[10px] px-3 py-[7px] font-sans text-[14px] font-semibold no-underline transition-colors",
        active
          ? "text-spark bg-[rgba(212,175,55,0.10)]"
          : "text-quiet hover:text-ink-night",
      )}
    >
      {children}
    </Link>
  );
}
