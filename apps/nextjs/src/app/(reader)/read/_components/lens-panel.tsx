import { lensColors } from "@acme/ui/digest-tokens";

import { Icon } from "../../_components/icon";

/** Mirrors the phone's `LensData` (`apps/expo/src/components/ui/DualLens.tsx`). */
interface LensPoint {
  text: string;
  example?: string | { fact: string; relevance: string };
  sourceIds: number[];
}
export interface LensData {
  framing?: "proponent_opponent" | "left_right";
  left: { stance: string; points: (LensPoint | string)[] };
  right: { stance: string; points: (LensPoint | string)[] };
  sources?: { id: number; title: string; url: string }[];
}

const toPoint = (p: LensPoint | string): LensPoint =>
  typeof p === "string" ? { text: p, sourceIds: [] } : p;

function sideLabels(data: LensData) {
  if (data.framing === "left_right") {
    return [
      { kicker: "PROPONENTS", stance: "Proponents argue" },
      { kicker: "OPPONENTS", stance: "Opponents counter" },
    ];
  }
  const kicker = (stance: string, fallback: string) =>
    /^proponents?\b/i.test(stance)
      ? "PROPONENTS"
      : /^opponents?\b/i.test(stance)
        ? "OPPONENTS"
        : fallback;
  return [
    { kicker: kicker(data.left.stance, "PROPONENTS"), stance: data.left.stance },
    { kicker: kicker(data.right.stance, "OPPONENTS"), stance: data.right.stance },
  ];
}

/**
 * Dual-Lens: both sides, side by side. On a phone the columns stack; on a
 * desktop they finally get to sit next to each other, which is the point.
 */
export function LensPanel({ data }: { data: LensData }) {
  const labels = sideLabels(data);
  const sources = data.sources ?? [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return (
    <section className="bg-slate border-hair-1 rounded-[16px] border p-4 md:p-5" aria-label="Dual-Lens">
      <div className="mb-4 flex items-center gap-3">
        <span className="bg-surface flex h-9 w-9 items-center justify-center rounded-[10px]">
          <Icon name="scale" size={18} />
        </span>
        <div>
          <p className="font-sans text-[15px] font-bold">Dual-Lens</p>
          <p className="text-quiet font-sans text-[12.5px]">Competing cases, with sources.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(["left", "right"] as const).map((side, index) => {
          const accent = index === 0 ? lensColors.proponents : lensColors.opponents;
          const label = labels[index];
          return (
            <div
              key={side}
              className="rounded-[12px] border-l-[3px] p-[14px]"
              style={{ borderLeftColor: accent, backgroundColor: `${accent}10` }}
            >
              <p className="font-sans text-[10.5px] font-bold tracking-[0.12em]" style={{ color: accent }}>
                {label?.kicker}
              </p>
              <p className="font-editorial mt-1 mb-3 text-[16px] leading-[21px] font-bold">
                {label?.stance}
              </p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {data[side].points.map(toPoint).map((point, i) => {
                  const example =
                    typeof point.example === "string"
                      ? { fact: point.example, relevance: undefined }
                      : point.example;
                  return (
                    <li key={i} className="flex flex-col gap-2">
                      <div className="flex gap-[9px]">
                        <span
                          className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full"
                          style={{ backgroundColor: accent }}
                          aria-hidden
                        />
                        <p className="font-sans text-[14px] leading-[21px] text-white/[0.86]">
                          {point.text}
                          {point.sourceIds.map((id) => {
                            const source = sourceById.get(id);
                            return source ? (
                              <a
                                key={id}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={source.title}
                                className="ml-1 align-super text-[10px] font-bold no-underline hover:underline"
                                style={{ color: accent }}
                              >
                                [{id}]
                              </a>
                            ) : null;
                          })}
                        </p>
                      </div>
                      {example ? (
                        <div
                          className="ml-[15px] flex gap-2 rounded-[10px] border p-[10px]"
                          style={{ borderColor: `${accent}55`, backgroundColor: `${accent}0D` }}
                        >
                          <span style={{ color: accent }} className="mt-[2px]">
                            <Icon name="pin" size={13} />
                          </span>
                          <div className="font-sans text-[13px] leading-[19px]">
                            <p className="text-[10px] font-bold tracking-[0.1em]" style={{ color: accent }}>
                              REAL-WORLD EXAMPLE
                            </p>
                            <p className="text-white/[0.82]">{example.fact}</p>
                            {example.relevance ? (
                              <>
                                <p className="mt-2 text-[10px] font-bold tracking-[0.1em]" style={{ color: accent }}>
                                  WHAT IT SHOWS
                                </p>
                                <p className="text-quiet">{example.relevance}</p>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {sources.length > 0 ? (
        <details className="group mt-4">
          <summary className="text-quiet flex cursor-pointer list-none items-center gap-1 font-sans text-[12px] font-semibold">
            {sources.length} {sources.length === 1 ? "source" : "sources"}
            <Icon name="chevD" size={13} className="transition-transform group-open:rotate-180" />
          </summary>
          <ol className="mt-2 flex list-none flex-col gap-1 p-0">
            {sources.map((source) => (
              <li key={source.id} className="font-sans text-[12.5px]">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-quiet hover:text-ink-night">
                  [{source.id}] {source.title}
                </a>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
