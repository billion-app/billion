"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import type { ContentListItem } from "~/lib/content-card";
import { safeImageSrc, toCardItem } from "~/lib/content-card";
import { Icon } from "../../_components/icon";

/**
 * Featured bills. The one piece of the phone's rhythm that already reads as
 * a rail, so it stays horizontal at every width — with arrow buttons on a
 * desktop, where there is no swipe.
 */
export function FeaturedRail({
  items,
  loading,
}: {
  items: readonly ContentListItem[];
  loading: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  if (!loading && items.length === 0) return null;

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section aria-label="Featured bills" className="relative mt-2 mb-2">
      <div className="mb-3 flex items-end justify-between">
        <p className="text-quiet font-sans text-[10px] font-bold tracking-[0.21em] uppercase">
          Featured
        </p>
        {items.length > 2 ? (
          <div className="hidden gap-2 md:flex">
            <RailButton
              label="Previous featured bills"
              onClick={() => page(-1)}
              icon="chevL"
            />
            <RailButton
              label="Next featured bills"
              onClick={() => page(1)}
              icon="chevR"
            />
          </div>
        ) : null}
      </div>
      <div
        ref={scroller}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 md:mx-0 md:px-0"
      >
        {loading
          ? [0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-[280px] w-[84%] max-w-[380px] shrink-0 animate-pulse rounded-[24px] bg-[rgba(247,244,238,0.08)] md:w-[340px]"
                aria-hidden
              />
            ))
          : items.map((item) => <FeaturedCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function RailButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: "chevL" | "chevR";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="border-rule text-ink-night hover:bg-slate flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

function FeaturedCard({ item }: { item: ContentListItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const card = toCardItem(item, { showJurisdiction: true });
  const image = safeImageSrc(item.imageUri ?? item.thumbnailUrl);

  return (
    <Link
      href={`/read/${item.id}`}
      className="group bg-slate relative block h-[280px] w-[84%] max-w-[380px] shrink-0 snap-start overflow-hidden rounded-[24px] no-underline md:w-[340px]"
      data-testid="featured-card"
    >
      {image && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="bg-night absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[56px] font-bold text-[rgba(247,244,238,0.22)]">
            {item.jurisdictionCode ?? "US"}
          </span>
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 12%, rgba(14,21,48,0.2) 40%, rgba(14,21,48,0.78) 70%, var(--digest-planes-navy) 100%)",
        }}
      />
      <div className="absolute right-4 bottom-4 left-4">
        {card.tag ? (
          <p className="mb-[6px] truncate font-sans text-[11px] font-bold tracking-[0.15em] text-[rgba(247,244,238,0.88)] uppercase">
            {card.tag}
          </p>
        ) : null}
        <h3 className="font-display text-ink-night line-clamp-3 text-[26px] leading-[30px] font-bold tracking-[-0.02em] [text-shadow:0_1px_10px_rgba(14,21,48,0.85)]">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}
