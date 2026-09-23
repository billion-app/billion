"use client";

import { useEffect, useRef, useState } from "react";

import { isSaveable } from "~/lib/content-card";
import { Icon } from "../../_components/icon";
import { SaveButton } from "../../_components/save-button";

/**
 * Save and copy-link. Copy hands out the share URL (`/b/…`) rather than this
 * page's, because that is the link with preview art and a page built for
 * someone who has not decided to read yet.
 *
 * The clipboard can refuse — an insecure origin, a denied permission, an old
 * browser. When it does, the link is shown selected in a field so the reader
 * can copy it themselves, rather than the button doing nothing.
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
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "manual") field.current?.select();
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    const link = `${window.location.origin}${sharePath}`;
    setUrl(link);
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      setState("manual");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {isSaveable(type) ? (
          <SaveButton id={id} type={type} title={title} variant="pill" />
        ) : null}
        <button
          type="button"
          onClick={() => void copy()}
          className="border-card-border hover:bg-slate inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-[8px] font-sans text-[13px] font-semibold"
        >
          <Icon name={state === "copied" ? "check" : "link"} size={15} />
          {state === "copied" ? "Link copied" : "Copy link"}
        </button>
      </div>
      {state === "manual" ? (
        <label className="flex flex-col gap-1">
          <span className="text-quiet font-sans text-[12px]">
            Your browser didn’t allow copying. Copy the link here:
          </span>
          <input
            ref={field}
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="bg-slate border-card-border text-ink-night w-full max-w-[520px] rounded-[10px] border px-3 py-2 font-mono text-[12.5px]"
          />
        </label>
      ) : null}
    </div>
  );
}
