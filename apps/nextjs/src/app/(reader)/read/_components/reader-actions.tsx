"use client";

import { useState } from "react";

import { Icon } from "../../_components/icon";
import { SaveButton } from "../../_components/save-button";

/**
 * Save and copy-link. Copy hands out the share URL (`/b/…`) rather than this
 * page's, because that is the link with preview art and a page built for
 * someone who has not decided to read yet.
 */
export function ReaderActions({
  id,
  type,
  title,
  sharePath,
}: {
  id: string;
  type: string;
  title: string;
  sharePath: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <SaveButton id={id} type={type} title={title} variant="pill" />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            .writeText(`${window.location.origin}${sharePath}`)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
        }}
        className="border-card-border hover:bg-slate inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-[8px] font-sans text-[13px] font-semibold"
      >
        <Icon name={copied ? "check" : "link"} size={15} />
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
