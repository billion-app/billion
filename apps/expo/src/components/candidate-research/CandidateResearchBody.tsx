import type { CandidateBrief } from "@acme/validators";

import type { EvidenceOpener } from "./ResearchUI";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { CandidateDisclosure } from "~/components/ballot-evidence/CandidateDisclosure";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { Brief } from "./Brief";
import { researchEvidenceAttribution } from "./evidence-attribution";
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
  judicial = false,
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
  judicial?: boolean;
  open: EvidenceOpener;
}) {
  const { t: tx, locale: appLocale } = useAppTranslation();
  return (
    <>
      {!donorId && (
        <Segments
          options={[
            {
              value: "brief",
              label: tx(judicial ? "Judicial record" : "The brief"),
            },
            { value: "money", label: tx("Money") },
            { value: "sources", label: tx("Sources") },
          ]}
          value={tab}
          onChange={onTab}
        />
      )}
      {brief.authorship.kind === "generated" ? (
        <Text style={s.muted}>{tx("AI-assisted Billion explanation")}</Text>
      ) : null}
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
          {brief.authorship.kind === "generated" ? (
            <CandidateDisclosure title={tx("About this research")}>
              <Text style={s.body}>
                {tx(
                  "Billion’s AI-assisted explanation is separate from the official record below.",
                )}
              </Text>
              <Text selectable style={s.muted}>
                {tx("Model: {value1} · Prompt: {value2}", {
                  value1: brief.authorship.model,
                  value2: brief.authorship.promptVersion,
                })}
              </Text>
            </CandidateDisclosure>
          ) : null}
          {brief.evidence.length ? (
            brief.evidence.map((evidence) => (
              <Panel key={evidence.id}>
                <Text style={s.eyebrow}>
                  {tx(researchEvidenceAttribution(evidence).label)}
                </Text>
                <Text style={s.heading}>
                  {evidence.title ?? evidence.publisher}
                </Text>
                <Text style={s.muted}>
                  {tx("Published by {publisher}", {
                    publisher: evidence.publisher,
                  })}{" "}
                  · {evidence.locator}
                </Text>
                {researchEvidenceAttribution(evidence).unresolved ? (
                  <Text style={s.muted}>
                    {tx("Speaker or author not established")}
                  </Text>
                ) : null}
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
        <Brief
          judicial={judicial}
          brief={brief}
          open={open}
          onPromise={onPromise}
        />
      )}
      {!donorId && !judicial && (
        <Action
          icon="users"
          label={tx("Compare the whole race")}
          onPress={onCompare}
        />
      )}
    </>
  );
}
