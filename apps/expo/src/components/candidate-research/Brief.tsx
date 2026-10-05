import { Pressable, View } from "react-native";

import type { CandidateBrief } from "@acme/validators";

import type { EvidenceOpener } from "./ResearchUI";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { CandidateDisclosure } from "~/components/ballot-evidence/CandidateDisclosure";
import { Icon } from "~/components/ui";
import { hair, DigestPalette as P } from "~/styles";
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
};
export function Brief({
  brief,
  open,
  onPromise,
}: {
  brief: CandidateBrief;
  open: EvidenceOpener;
  onPromise: (id: string) => void;
}) {
  const terms = brief.research?.terms;
  const claims = brief.sections.flatMap((section) => section.claims);
  const headline =
    claims.find((claim) => claim.id === brief.research?.headlineClaimId) ??
    brief.sections.find((section) => section.topic === "priorities")?.claims[0];
  const recordGap = brief.sections.find(
    (section) => section.topic === "record",
  )?.missingEvidence;
  const records = claims.filter((claim) => claim.kind === "fact");
  const promises = claims.filter((claim) => claim.kind === "promise");
  return (
    <>
      {brief.correction && (
        <Panel title="Updated research">
          <Text style={s.body}>{brief.correction.reason}</Text>
        </Panel>
      )}
      {headline && (
        <Panel>
          <Text style={s.muted}>
            {claimLabels[headline.kind]}
            {headline.kind === "analysis" &&
            brief.authorship.kind === "generated"
              ? " · AI-assisted"
              : ""}
          </Text>
          <Emphasis
            terms={terms}
            text={headline.text}
            phrases={headline.emphasis}
          />
          <EvidenceAction
            ids={headline.evidenceIds}
            title="Candidate priorities"
            open={open}
          />
        </Panel>
      )}
      <Text accessibilityRole="header" style={s.heading}>
        Record & promises
      </Text>
      {records.length ? (
        records.map((claim) => (
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
              <Text style={s.muted}>
                Documented fact
                {(() => {
                  const date = brief.evidence.find(
                    (e) => claim.evidenceIds.includes(e.id) && e.documentDate,
                  )?.documentDate;
                  return date
                    ? ` · ${new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
                    : "";
                })()}
              </Text>
              <Emphasis
                terms={terms}
                text={claim.text}
                phrases={claim.emphasis}
              />
              <EvidenceAction
                ids={claim.evidenceIds}
                title={claim.text}
                label="Read the record"
                open={open}
              />
            </View>
          </View>
        ))
      ) : (
        <Panel>
          <Text style={s.muted}>
            {brief.sections.find((section) => section.topic === "record")
              ?.missingEvidence ?? "No reviewed record available."}
          </Text>
        </Panel>
      )}
      {!!records.length && !!recordGap && (
        <Panel>
          <Text style={s.muted}>{recordGap}</Text>
        </Panel>
      )}
      {promises.map((claim) => (
        <Panel key={claim.id}>
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
              <Text style={s.muted}>Candidate promise</Text>
              <Text style={s.heading}>
                {brief.research?.promises.find((p) => p.claimId === claim.id)
                  ?.title ?? claim.text}
              </Text>
            </View>
          </View>
          <Emphasis terms={terms} text={claim.text} phrases={claim.emphasis} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Explore promise: ${claim.text}`}
            onPress={() => onPromise(claim.id)}
            style={[
              s.rule,
              s.row,
              { justifyContent: "space-between", minHeight: 48 },
            ]}
          >
            <Text style={s.link}>Explore this promise</Text>
            <Icon name="chevR" size={18} color={P.primary} />
          </Pressable>
        </Panel>
      ))}
      {!promises.length && (
        <Panel title="Campaign promises">
          <Text style={s.body}>
            No reviewed campaign promises are available.
          </Text>
        </Panel>
      )}
      {brief.research &&
        brief.evidence.some((e) => e.origin === "candidate") && (
          <CandidateDisclosure title="Values in their own words">
            {brief.evidence
              .filter((e) => e.origin === "candidate")
              .map((e) => (
                <View key={e.id} style={s.point}>
                  <Text selectable style={s.body}>
                    {e.excerpt}
                  </Text>
                  <EvidenceAction
                    ids={[e.id]}
                    title={e.title ?? e.publisher}
                    label="Campaign source"
                    open={open}
                  />
                </View>
              ))}
          </CandidateDisclosure>
        )}
      {brief.sections
        .filter((section) => section.topic !== "record")
        .map((section) => {
          const remaining = section.claims.filter(
            (claim) =>
              claim !== headline &&
              claim.kind !== "fact" &&
              claim.kind !== "promise",
          );
          if (brief.research && !remaining.length) return null;
          const title = {
            priorities: "Values in their own words",
            mechanisms: "How plans could work",
            effects: "Potential effects",
            tradeoffs: "Costs & tradeoffs",
            unknowns: "What is still unknown",
            record: "Record",
          }[section.topic];
          return (
            <CandidateDisclosure key={section.topic} title={title}>
              {remaining.map((claim) => (
                <View key={claim.id} style={s.point}>
                  <Text style={s.muted}>{claimLabels[claim.kind]}</Text>
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
              ))}
              {section.missingEvidence && (
                <Text style={s.body}>{section.missingEvidence}</Text>
              )}
            </CandidateDisclosure>
          );
        })}
    </>
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
  const terms = brief.research?.terms;
  const claim = brief.sections
    .flatMap((s) => s.claims)
    .find((c) => c.id === promiseId && c.kind === "promise");
  const detail = brief.research?.promises.find((p) => p.claimId === promiseId);
  const repeatsPromise =
    detail?.brief.change.text.trim() === claim?.text.trim();
  if (!claim)
    return (
      <Panel title="Promise unavailable">
        <Text style={s.body}>
          This promise is not in the current candidate research.
        </Text>
      </Panel>
    );
  return (
    <>
      <Text accessibilityRole="header" style={s.title}>
        {detail?.title ?? "Campaign promise"}
      </Text>
      {!!terms?.length && (
        <Text style={s.muted}>Tap an underlined word for its meaning.</Text>
      )}
      <Panel>
        <Text style={s.muted}>Candidate promise</Text>
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
          title="Campaign promise"
          label={repeatsPromise ? "Proposal sources" : "Campaign source"}
          open={open}
        />
      </Panel>
      <Segments
        options={[
          { value: "brief", label: "In brief" },
          { value: "analysis", label: "In depth" },
        ]}
        value={analysis ? "analysis" : "brief"}
        onChange={(value) => onRead(value === "analysis")}
      />
      <Text style={s.muted}>
        Billion interpretation
        {brief.authorship.kind === "generated" ? " · AI-assisted" : ""}
      </Text>
      {!detail ? (
        <Panel title="Analysis not yet available">
          <Text style={s.body}>
            The campaign source is available above. Billion has not published a
            deeper analysis of this promise.
          </Text>
        </Panel>
      ) : analysis ? (
        <>
          <Panel title="Benefits & tradeoffs">
            <Point
              terms={terms}
              point={
                detail.benefits[0] ?? {
                  title: "Potential benefits",
                  text: "The reviewed sources do not establish the benefits.",
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
                  Costs have not been established in the reviewed sources.
                </Text>
              )}
            </View>
          </Panel>
          <Panel title="Who could be affected">
            {detail.affected.length ? (
              detail.affected.map((p) => (
                <Point terms={terms} key={p.title} point={p} open={open} />
              ))
            ) : (
              <Text style={s.body}>
                The reviewed sources do not establish who would be affected.
              </Text>
            )}
          </Panel>
          <Panel title="Perspectives in the sources">
            {detail.perspectives.length ? (
              detail.perspectives.map((p) => (
                <Point terms={terms} key={p.title} point={p} open={open} />
              ))
            ) : (
              <Text style={s.body}>
                Additional perspectives have not been documented.
              </Text>
            )}
          </Panel>
          {[
            { title: "Who needs to act", points: detail.steps },
            { title: "Other approaches", points: detail.alternatives },
            { title: "What is still unknown", points: detail.unknowns },
          ].map((group) => (
            <CandidateDisclosure key={group.title} title={group.title}>
              {group.points.length ? (
                group.points.map((p) => (
                  <Point terms={terms} key={p.title} point={p} open={open} />
                ))
              ) : (
                <Text style={s.body}>No reviewed details are available.</Text>
              )}
            </CandidateDisclosure>
          ))}
        </>
      ) : (
        <>
          {[
            {
              title: "What could change",
              icon: "sparkle" as const,
              point: detail.brief.change,
            },
            {
              title: "Who has to agree",
              icon: "layers" as const,
              point: detail.brief.authority,
            },
            {
              title: "What we still don’t know",
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
                  label="View sources"
                  open={open}
                />
              </Panel>
            ))}
          <Action
            label="Read the in-depth analysis"
            onPress={() => onRead(true)}
          />
        </>
      )}
    </>
  );
}
