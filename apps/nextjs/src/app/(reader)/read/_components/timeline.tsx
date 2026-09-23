import { Icon } from "../../_components/icon";

export interface TimelineAction {
  date: string;
  text: string;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
}

/**
 * "Where it stands" — the official legislative record, oldest first, with
 * the latest action marked. Long actions are shortened and expand in place.
 * Records without actions get the phone's generic stages, and no source line,
 * since there is no record behind them to cite.
 */
export function Timeline({
  actions,
  accent,
  sourceUrl,
  sourceLabel,
}: {
  actions: TimelineAction[];
  accent: string;
  sourceUrl?: string;
  sourceLabel: string;
}) {
  const real = actions.length > 0;
  const steps = real
    ? actions
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((a) => ({
          label: a.text.length > 80 ? `${a.text.slice(0, 77)}…` : a.text,
          full: a.text,
          date: a.date,
          done: true,
        }))
    : ["Introduced", "Committee review", "Latest action", "Becomes law"].map(
        (label, index) => ({ label, full: "", date: "", done: index < 3 }),
      );
  const current = real ? steps.length - 1 : 2;

  return (
    <section aria-label="Where it stands">
      <p className="text-quiet mb-3 font-sans text-[10px] font-bold tracking-[0.21em] uppercase">
        Where it stands
      </p>
      <div className="bg-slate border-hair-1 rounded-[16px] border p-4">
        <ol className="m-0 list-none p-0">
          {steps.map((step, index) => {
            const isCurrent = index === current;
            const expandable = !!step.full && step.full !== step.label;
            const label = (
              <span
                className="font-sans text-[13.5px] leading-[19px]"
                style={{
                  color: step.done ? "#fff" : "var(--digest-digest-quiet)",
                  fontWeight: isCurrent ? 700 : 500,
                }}
              >
                {step.label}
              </span>
            );
            return (
              <li key={index} className="flex gap-3">
                <div className="flex w-3 shrink-0 flex-col items-center pt-[5px]">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border-2"
                    style={{
                      borderColor: step.done ? accent : "var(--digest-hair-3)",
                      backgroundColor: isCurrent ? accent : "transparent",
                    }}
                  />
                  {index < steps.length - 1 ? (
                    <span
                      className="w-[2px] flex-1"
                      style={{ backgroundColor: step.done ? accent : "var(--digest-hair-2)", minHeight: 18 }}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  {step.date ? (
                    <p className="text-quiet font-sans text-[11px] font-semibold">{formatDate(step.date)}</p>
                  ) : null}
                  {expandable ? (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start gap-1">
                        <span className="group-open:hidden">{label}</span>
                        <span
                          className="hidden font-sans text-[13.5px] leading-[19px] text-white group-open:inline"
                          style={{ fontWeight: isCurrent ? 700 : 500 }}
                        >
                          {step.full}
                        </span>
                        <Icon name="chevD" size={13} className="text-quiet mt-[3px] shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                    </details>
                  ) : (
                    label
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {real && sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-quiet hover:text-ink-night border-hair-1 flex items-center gap-[6px] border-t pt-3 font-sans text-[12px] no-underline"
          >
            <Icon name="info" size={13} />
            Official record · {sourceLabel}
            <Icon name="chevR" size={12} />
          </a>
        ) : null}
      </div>
    </section>
  );
}
