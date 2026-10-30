import type { CandidateBrief } from "@acme/validators";

import type { EvidenceOpener } from "./ResearchUI";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { Brief } from "./Brief";
import { Finance } from "./Finance";
import { financeFilingSource } from "./finance-source";
import { Action, EvidenceAction, Panel, s, Segments } from "./ResearchUI";

export function CandidateResearchBody({
  brief,
  reviewedAt,
  reviewKind = "published",
  tab,
  onTab,
  donorId,
  onDonor,
  onPromise,
  onCompare,
  open,
}: {
  brief: CandidateBrief;
  reviewedAt: string;
  reviewKind?: "published" | "draft" | "example";
  tab: "brief" | "money" | "sources";
  onTab: (tab: string) => void;
  donorId?: string;
  onDonor: (id: string) => void;
  onPromise: (id: string) => void;
  onCompare: () => void;
  open: EvidenceOpener;
}) {
  const { t: tx, locale: appLocale } = useAppTranslation();
  return (
    <>
      {!donorId && (
        <Segments
          options={[
            { value: "brief", label: tx("The brief") },
            { value: "money", label: tx("Money") },
            { value: "sources", label: tx("Sources") },
          ]}
          value={tab}
          onChange={onTab}
        />
      )}
      {tab === "money" ? (
        <Finance
          finance={brief.research?.finance ?? null}
          gap={brief.research?.financeGap ?? null}
          filingSource={financeFilingSource(brief.evidence)}
          donorId={donorId}
          onDonor={onDonor}
          open={open}
        />
      ) : tab === "sources" ? (
        <>
          <Text style={s.muted}>
            {reviewKind === "draft"
              ? tx("Sources checked")
              : reviewKind === "example"
                ? tx("Example review")
                : tx("Reviewed")}{" "}
            {new Date(reviewedAt).toLocaleDateString(appLocale, {
              timeZone: "UTC",
            })}
          </Text>
          {brief.evidence.length ? (
            brief.evidence.map((evidence) => (
              <Panel key={evidence.id}>
                <Text style={s.eyebrow}>
                  {evidence.origin === "candidate"
                    ? tx("CANDIDATE SOURCE")
                    : evidence.origin === "primary_record"
                      ? tx("ORIGINAL RECORD")
                      : tx("INDEPENDENT REPORTING")}
                </Text>
                <Text style={s.heading}>
                  {evidence.title ?? evidence.publisher}
                </Text>
                <Text style={s.muted}>
                  {evidence.publisher} · {evidence.locator}
                </Text>
                <EvidenceAction
                  ids={[evidence.id]}
                  title={evidence.title ?? evidence.publisher}
                  label={tx("Read source passage")}
                  open={open}
                />
              </Panel>
            ))
          ) : (
            <Panel title={tx("Sources unavailable")}>
              <Text style={s.body}>
                {tx(
                  "No reviewed source passages are available for this candidate.",
                )}
              </Text>
            </Panel>
          )}
          <SourceLink
            label={tx("Report a correction")}
            url="https://billion-news.app/support"
          />
        </>
      ) : (
        <Brief brief={brief} open={open} onPromise={onPromise} />
      )}
      {!donorId && (
        <Action
          icon="users"
          label={tx("Compare the whole race")}
          onPress={onCompare}
        />
      )}
    </>
  );
}
