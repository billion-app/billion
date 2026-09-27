"use client";

import { useState } from "react";
import Link from "next/link";

import type { CardItem } from "~/lib/content-card";
import { isSaveable, relativeActivity, safeImageSrc } from "~/lib/content-card";
import { SaveButton } from "../../_components/save-button";

/**
 * A Browse / Saved result. The phone's rhythm, not a boxed tile: kicker,
 * serif title, a two-line gist, a quiet status line, and a hairline between
 * rows. Save sits on the kicker line exactly where the phone puts it.
 *
 * The whole card is clickable, but it is not one big link: a button inside a
 * link is invalid HTML and reads badly to screen readers. The title is the
 * link, stretched over the card with an overlay, and the save button sits
 * above that overlay as its sibling.
 */
export function ResultCard({ item }: { item: CardItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = safeImageSrc(item.imageUri);
  const status = [item.status, relativeActivity(item.activityAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group relative py-[18px]" data-testid="result-card">
      <div className="mb-[6px] flex items-center gap-2">
        <span className="text-quiet font-sans text-[11px] font-bold tracking-[0.15em] uppercase">
          <span style={{ color: item.color }} aria-hidden>
            ●{" "}
          </span>
          {item.typeLabel}
          {item.tag ? ` · ${item.tag}` : ""}
        </span>
        {item.jurisdictionCode ? (
          <span className="text-quiet border-rule rounded-[5px] border px-[5px] font-sans text-[10px] font-bold tracking-[0.08em]">
            {item.jurisdictionCode}
          </span>
        ) : null}
        <span className="flex-1" />
        {isSaveable(item.type) ? (
          <SaveButton
            id={item.id}
            type={item.type}
            title={item.title}
            className="relative z-10"
          />
        ) : null}
      </div>
      <div className="flex items-start gap-[14px]">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-ink-night line-clamp-3 text-[21px] leading-[26px] font-bold tracking-[-0.02em] group-hover:underline group-hover:decoration-[rgba(247,244,238,0.35)] group-hover:underline-offset-4 md:text-[22px]">
            <Link
              href={`/read/${item.id}`}
              className="text-inherit no-underline after:absolute after:inset-0 after:content-['']"
            >
              {item.title}
            </Link>
          </h3>
          {item.gist ? (
            <p className="text-quiet mt-1 line-clamp-2 font-sans text-[14px] leading-[20px]">
              {item.gist}
            </p>
          ) : null}
          {status ? (
            <p className="text-quiet mt-2 truncate font-sans text-[12px] leading-4 font-medium">
              {status}
            </p>
          ) : null}
        </div>
        {image && !imageFailed ? (
          // Often an inline data: URI from the pipeline; next/image cannot optimize it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="bg-slate h-14 w-14 shrink-0 rounded-[8px] object-cover md:h-[72px] md:w-[72px]"
          />
        ) : null}
      </div>
    </article>
  );
}
