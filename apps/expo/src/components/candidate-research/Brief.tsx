import { Pressable, View } from "react-native";

import type { CandidateBrief } from "@acme/validators";

import type { EvidenceOpener } from "./ResearchUI";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { CandidateDisclosure } from "~/components/ballot-evidence/CandidateDisclosure";
import { Icon } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { hair, DigestPalette as P } from "~/styles";
import { readBrief } from "./brief-reading";
import { researchEvidenceAttribution } from "./evidence-attribution";
import {
  Action,
  Emphasis,
  EvidenceAction,
  Panel,
  Point,
  s,
  Segments,
} from "./ResearchUI";

export const claimLabels = {
  promise: "Candidate promise",
  fact: "Documented fact",
  disputed: "Disputed claim",
  analysis: "Billion interpretation",
} as const;
export function Brief({
  brief,
  open,
  onPromise,
  judicial = false,
}: {
  brief: CandidateBrief;
  open: EvidenceOpener;
  onPromise: (id: string) => void;
  judicial?: boolean;
}) {
  const { t: tx, locale: appLocale } = useAppTranslation();

  const terms = brief.research?.terms;
  const { headline, record, chapters, hasPromises } = readBrief(
    brief,
    judicial,
  );
  const records = record?.claims ?? [];
  const recordGap = record?.missingEvidence;
  return (
    <>
      {brief.correction && (
        <Panel title={tx("Updated research")}>
          <Text style={s.body}>{brief.correction.reason}</Text>
        </Panel>
      )}
      {headline && (
        <Panel>
          <Text style={s.muted}>{tx(claimLabels[headline.kind])}</Text>
          <Emphasis
            terms={terms}
            text={headline.text}
            phrases={headline.emphasis}
          />
          <EvidenceAction
            ids={headline.evidenceIds}
            title={headline.text}
            open={open}
          />
        </Panel>
      )}
      <Text accessibilityRole="header" style={s.heading}>
        {tx(judicial ? "Judicial record" : "Record")}
      </Text>
      {records.length ? (
        records.map((claim) =>
          claim.kind === "promise" ? (
            <PromiseCard
              key={claim.id}
              brief={brief}
              claim={claim}
              onPromise={onPromise}
            />
          ) : (
            <View key={claim.id} style={[s.row, { paddingHorizontal: 8 }]}>
              <View
                style={s.tile}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                aria-hidden
              >
                <Icon name="doc" size={19} color={P.primary} />
              </View>
              <View
                style={[
                  s.grow,
                  {
                    borderLeftWidth: 1,
                    borderLeftColor: hair[3],
                    paddingLeft: 14,
                  },
                ]}
              >
                <Text style={s.muted}>{tx(claimLabels[claim.kind])}</Text>
                {(() => {
                  const date = brief.evidence.find(
                    (e) => claim.evidenceIds.includes(e.id) && e.documentDate,
                  )?.documentDate;
                  return date ? (
                    <Text style={s.muted}>
                      {tx("Source dated {date}", {
                        date: new Date(`${date}T12:00:00Z`).toLocaleDateString(
                          appLocale,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          },
                        ),
                      })}
                    </Text>
                  ) : null;
                })()}
                <Emphasis
                  terms={terms}
                  text={claim.text}
                  phrases={claim.emphasis}
                />
                <EvidenceAction
                  ids={claim.evidenceIds}
                  title={claim.text}
                  open={open}
                />
              </View>
            </View>
          ),
        )
      ) : (
        <Panel>
          <Text style={s.muted}>
            {recordGap ??
              tx(
                judicial
                  ? "No reviewed judicial record sources are available yet."
                  : "No reviewed record available.",
              )}
          </Text>
        </Panel>
      )}
      {!!records.length && !!recordGap && (
        <Panel>
          <Text style={s.muted}>{recordGap}</Text>
        </Panel>
      )}
      {!judicial && !hasPromises && (
        <Panel title={tx("Campaign promises")}>
          <Text style={s.body}>
            {tx("No reviewed campaign promises are available.")}
          </Text>
        </Panel>
      )}
      {!judicial &&
        brief.research &&
        brief.evidence.some((e) => e.origin === "candidate") && (
          <CandidateDisclosure title={tx("Statements and campaign material")}>
            {brief.evidence
              .filter((e) => e.origin === "candidate")
              .map((e) => (
                <View key={e.id} style={s.point}>
                  <Text style={s.eyebrow}>
                    {tx(researchEvidenceAttribution(e).label)}
                  </Text>
                  <Text style={s.label}>{e.title ?? e.publisher}</Text>
                  <Text style={s.muted}>
                    {tx("Published by {publisher}", { publisher: e.publisher })}{" "}
                    · {e.locator}
                  </Text>
                  {researchEvidenceAttribution(e).unresolved ? (
                    <Text style={s.muted}>
                      {tx("Speaker or author not established")}
                    </Text>
                  ) : null}
                  <EvidenceAction
                    ids={[e.id]}
                    title={e.title ?? e.publisher}
                    label={tx("Read source passage")}
                    open={open}
                  />
                </View>
              ))}
          </CandidateDisclosure>
        )}
      {chapters.map((section) => {
        const remaining = section.claims;
        if (
          (brief.research || judicial) &&
          !remaining.length &&
          !section.missingEvidence?.trim()
        )
          return null;
        const title = {
          priorities: tx(judicial ? "Judicial background" : "Priorities"),
          mechanisms: tx(judicial ? "Court authority" : "How plans could work"),
          effects: tx("Potential effects"),
          tradeoffs: tx(judicial ? "Considerations" : "Costs & tradeoffs"),
          unknowns: tx("What is still unknown"),
          record: tx("Record"),
        }[section.topic];
        return (
          <CandidateDisclosure key={section.topic} title={title}>
            {remaining.map((claim) =>
              claim.kind === "promise" ? (
                <PromiseCard
                  key={claim.id}
                  brief={brief}
                  claim={claim}
                  onPromise={onPromise}
                />
              ) : (
                <View key={claim.id} style={s.point}>
                  <Text style={s.muted}>{tx(claimLabels[claim.kind])}</Text>
                  <Emphasis
                    terms={terms}
                    text={claim.text}
                    phrases={claim.emphasis}
                  />
                  <EvidenceAction
                    ids={claim.evidenceIds}
                    title={claim.text}
                    open={open}
                  />
                </View>
              ),
            )}
            {section.missingEvidence && (
              <Text style={s.body}>{section.missingEvidence}</Text>
            )}
          </CandidateDisclosure>
        );
      })}
    </>
  );
}
function PromiseCard({
  brief,
  claim,
  onPromise,
}: {
  brief: CandidateBrief;
  claim: CandidateBrief["sections"][number]["claims"][number];
  onPromise: (id: string) => void;
}) {
  const { t: tx } = useAppTranslation();
  const terms = brief.research?.terms;
  return (
    <Panel>
      <View style={s.row}>
        <View
          style={s.tile}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Icon name="quote" size={19} color={P.primary} />
        </View>
        <View style={s.grow}>
          <Text style={s.muted}>{tx("Candidate promise")}</Text>
          <Text style={s.heading}>
            {brief.research?.promises.find((p) => p.claimId === claim.id)
              ?.title ?? claim.text}
          </Text>
        </View>
      </View>
      <Emphasis terms={terms} text={claim.text} phrases={claim.emphasis} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx("Explore promise: {value1}", {
          value1: claim.text,
        })}
        onPress={() => onPromise(claim.id)}
        style={[
          s.rule,
          s.row,
          { justifyContent: "space-between", minHeight: 48 },
        ]}
      >
        <Text style={s.link}>{tx("Explore this promise")}</Text>
        <Icon name="chevR" size={18} color={P.primary} />
      </Pressable>
    </Panel>
  );
}

export function PromiseDetail({
  brief,
  promiseId,
  analysis,
  onRead,
  open,
}: {
  brief: CandidateBrief;
  promiseId: string;
  analysis: boolean;
  onRead: (analysis: boolean) => void;
  open: EvidenceOpener;
}) {
  const { t: tx } = useAppTranslation();

  const terms = brief.research?.terms;
  const claim = brief.sections
    .flatMap((s) => s.claims)
    .find((c) => c.id === promiseId && c.kind === "promise");
  const detail = brief.research?.promises.find((p) => p.claimId === promiseId);
  const repeatsPromise =
    detail?.brief.change.text.trim() === claim?.text.trim();
  if (!claim)
    return (
      <Panel title={tx("Promise unavailable")}>
        <Text style={s.body}>
          {tx("This promise is not in the current candidate research.")}
        </Text>
      </Panel>
    );
  return (
    <>
      <Text accessibilityRole="header" style={s.title}>
        {detail?.title ?? tx("Campaign promise")}
      </Text>
      {!!terms?.length && (
        <Text style={s.muted}>
          {tx("Tap an underlined word for its meaning.")}
        </Text>
      )}
      <Panel>
        <Text style={s.muted}>{tx("Candidate promise")}</Text>
        <Emphasis terms={terms} text={claim.text} phrases={claim.emphasis} />
        <EvidenceAction
          ids={
            repeatsPromise && detail
              ? [
                  ...new Set([
                    ...claim.evidenceIds,
                    ...detail.brief.change.evidenceIds,
                  ]),
                ]
              : claim.evidenceIds
          }
          title={tx("Campaign promise")}
          label={
            repeatsPromise ? tx("Proposal sources") : tx("Read source passage")
          }
          open={open}
        />
      </Panel>
      <Segments
        options={[
          { value: "brief", label: tx("In brief") },
          { value: "analysis", label: tx("In depth") },
        ]}
        value={analysis ? "analysis" : "brief"}
        onChange={(value) => onRead(value === "analysis")}
      />
      <Text style={s.muted}>
        {tx("Billion interpretation {value1}", {
          value1:
            brief.authorship.kind === "generated"
              ? ` · ${tx("AI-assisted")}`
              : "",
        })}
      </Text>
      {!detail ? (
        <Panel title={tx("Analysis not yet available")}>
          <Text style={s.body}>
            {tx(
              "The campaign source is available above. Billion has not published a deeper analysis of this promise.",
            )}
          </Text>
        </Panel>
      ) : analysis ? (
        <>
          <Panel title={tx("Benefits & tradeoffs")}>
            <Point
              terms={terms}
              point={
                detail.benefits[0] ?? {
                  title: tx("Potential benefits"),
                  text: tx(
                    "The reviewed sources do not establish the benefits.",
                  ),
                  emphasis: [],
                  evidenceIds: claim.evidenceIds,
                }
              }
              open={open}
            />
            {detail.benefits.slice(1).map((p) => (
              <Point terms={terms} key={p.title} point={p} open={open} />
            ))}
            <View style={s.rule}>
              {detail.costs.length ? (
                detail.costs.map((p) => (
                  <Point terms={terms} key={p.title} point={p} open={open} />
                ))
              ) : (
                <Text style={s.body}>
                  {tx(
                    "Costs have not been established in the reviewed sources.",
                  )}
                </Text>
              )}
            </View>
          </Panel>
          <Panel title={tx("Who could be affected")}>
            {detail.affected.length ? (
              detail.affected.map((p) => (
                <Point terms={terms} key={p.title} point={p} open={open} />
              ))
            ) : (
              <Text style={s.body}>
                {tx(
                  "The reviewed sources do not establish who would be affected.",
                )}
              </Text>
            )}
          </Panel>
          <Panel title={tx("Perspectives in the sources")}>
            {detail.perspectives.length ? (
              detail.perspectives.map((p) => (
                <Point terms={terms} key={p.title} point={p} open={open} />
              ))
            ) : (
              <Text style={s.body}>
                {tx("Additional perspectives have not been documented.")}
              </Text>
            )}
          </Panel>
          {[
            { title: tx("Who needs to act"), points: detail.steps },
            { title: tx("Other approaches"), points: detail.alternatives },
            { title: tx("What is still unknown"), points: detail.unknowns },
          ].map((group) => (
            <CandidateDisclosure key={group.title} title={group.title}>
              {group.points.length ? (
                group.points.map((p) => (
                  <Point terms={terms} key={p.title} point={p} open={open} />
                ))
              ) : (
                <Text style={s.body}>
                  {tx("No reviewed details are available.")}
                </Text>
              )}
            </CandidateDisclosure>
          ))}
        </>
      ) : (
        <>
          {[
            {
              title: tx("What could change"),
              icon: "sparkle" as const,
              point: detail.brief.change,
            },
            {
              title: tx("Who has to agree"),
              icon: "layers" as const,
              point: detail.brief.authority,
            },
            {
              title: tx("What we still don’t know"),
              icon: "help" as const,
              point: detail.brief.unknowns,
            },
          ]
            .filter(
              ({ point }) => point !== detail.brief.change || !repeatsPromise,
            )
            .map(({ title, icon, point }) => (
              <Panel key={title}>
                <View style={[s.row, { alignItems: "center" }]}>
                  <View
                    style={s.tile}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    aria-hidden
                  >
                    <Icon name={icon} size={19} color={P.primary} />
                  </View>
                  <Text
                    accessibilityRole="header"
                    style={[s.heading, { flex: 1 }]}
                  >
                    {title}
                  </Text>
                </View>
                <Emphasis
                  terms={terms}
                  text={point.text}
                  phrases={point.emphasis}
                />
                <EvidenceAction
                  ids={point.evidenceIds}
                  title={title}
                  label={tx("View sources")}
                  open={open}
                />
              </Panel>
            ))}
          <Action
            label={tx("Read the in-depth analysis")}
            onPress={() => onRead(true)}
          />
        </>
      )}
    </>
  );
}
