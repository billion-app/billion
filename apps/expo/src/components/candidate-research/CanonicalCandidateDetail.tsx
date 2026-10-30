import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { EvidenceSelection } from "./EvidenceSheet";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { CandidatePortrait } from "~/components/ballot/CandidatePortrait";
import { CardTranslationNotice } from "~/components/CardTranslationNotice";
import { NavHeader } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { translateAppLabel } from "~/i18n/app-strings";
import { DigestPalette as P } from "~/styles";
import { trpc } from "~/utils/api";
import {
  currentResearch,
  parseResearchIdentity,
  sameResearchIdentity,
} from "~/utils/candidate-research-route";
import { CandidateResearchBody } from "./CandidateResearchBody";
import { EvidenceSheet } from "./EvidenceSheet";
import { Action, Panel, s } from "./ResearchUI";

export function CanonicalCandidateDetail({
  identityParam,
  expectedName,
}: {
  identityParam: string;
  expectedName?: string;
}) {
  const { t: tx, language, locale } = useAppTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const identity = parseResearchIdentity(identityParam);
  const query = useQuery({
    ...trpc.candidateBriefs.forCandidate.queryOptions({
      identity: identity ?? {
        candidateId: "invalid",
        contestId: "invalid",
        jurisdiction: "CA",
        electionDate: "2026-11-03",
      },
      language,
    }),
    enabled: !!identity,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.status === "published" &&
      query.state.data.race.translationState === "pending"
        ? 3_000
        : 30_000,
  });
  const [now, setNow] = useState(Date.now);
  const [selection, setSelection] = useState<
    (EvidenceSelection & { revisionId: string }) | null
  >(null);
  const response = query.data;
  const candidate = response?.candidate;
  const expiresAt =
    response?.status === "published"
      ? response.race.manifest.expiresAt
      : undefined;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Date.parse(expiresAt) - Date.now()) + 1,
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const race =
    response?.status === "published" &&
    !query.isError &&
    currentResearch(response.race.manifest.expiresAt, now, query.dataUpdatedAt)
      ? response.race
      : null;
  const member = race?.manifest.members.find(
    (m) => m.candidateId === identity?.candidateId,
  );
  const brief = race?.briefs.find(
    (b) => identity && sameResearchIdentity(b.identity, identity),
  );
  const consistent =
    !!candidate &&
    !!identity &&
    sameResearchIdentity(candidate.identity, identity) &&
    (!expectedName || candidate.name === expectedName);
  const published =
    consistent && member?.name === candidate.name && !!brief && !!race;
  const judicial = candidate?.officeFamily === "judicial_retention";
  const navigate = (next: Record<string, string>, promise = false) => {
    if (!race) return;
    router.push({
      pathname: promise ? "/candidate-promise" : "/candidate-research",
      params: { race: race.manifest.id, ...next },
    });
  };
  return (
    <View style={s.screen}>
      <NavHeader
        title={tx("Candidate")}
        tone="dark"
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace("/candidate-research")
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        {query.isPending && identity ? (
          <ActivityIndicator
            color={P.primary}
            accessibilityLabel={tx("Loading candidate research")}
          />
        ) : !consistent ? (
          <Panel
            title={tx(
              query.isError
                ? "Research couldn’t load"
                : "Candidate unavailable",
            )}
          >
            <Text style={s.body}>{tx("Please try again.")}</Text>
            {identity ? (
              <Action
                label={tx("Try again")}
                onPress={() => void query.refetch()}
              />
            ) : null}
            <Action
              label={tx("Browse the candidate roster")}
              onPress={() => router.replace("/candidate-research")}
            />
          </Panel>
        ) : (
          <>
            <Text style={s.eyebrow}>
              {candidate.jurisdictionLabel} ·{" "}
              {new Date(
                `${candidate.identity.electionDate}T12:00:00Z`,
              ).toLocaleDateString(locale, {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </Text>
            <View style={s.personHead}>
              <CandidatePortrait name={candidate.name} size={64} />
              <View style={s.grow}>
                <Text accessibilityRole="header" style={s.title}>
                  {candidate.name}
                </Text>
                <Text style={s.body}>
                  {translateAppLabel(language, candidate.office)}
                </Text>
                {candidate.party ? (
                  <Text style={s.muted}>
                    {translateAppLabel(language, candidate.party)}
                  </Text>
                ) : null}
              </View>
            </View>
            {candidate.ballotStatus === "qualified_write_in" ? (
              <Text style={s.label}>{tx("Qualified write-in")}</Text>
            ) : null}
            <Text style={s.muted}>
              {tx(
                judicial
                  ? "Judicial retention"
                  : "Listed in the official candidate roster",
              )}
            </Text>
            {published ? (
              <>
                <CardTranslationNotice
                  items={[race]}
                  isError={query.isError}
                  onRetry={() => void query.refetch()}
                />
                <CandidateResearchBody
                  brief={brief}
                  reviewedAt={race.reviewedAt}
                  judicial={judicial}
                  tab={
                    params.tab === "money" || params.tab === "sources"
                      ? params.tab
                      : "brief"
                  }
                  onTab={(tab) => router.setParams({ tab })}
                  onDonor={(donor) =>
                    navigate({
                      person: candidate.identity.candidateId,
                      tab: "money",
                      donor,
                    })
                  }
                  onPromise={(promise) =>
                    navigate(
                      { person: candidate.identity.candidateId, promise },
                      true,
                    )
                  }
                  onCompare={() => navigate({ view: "compare" })}
                  open={(ids, title, restoreFocus) =>
                    setSelection({
                      ids,
                      title,
                      restoreFocus,
                      revisionId: brief.revisionId,
                    })
                  }
                />
              </>
            ) : (
              <Panel
                title={tx(
                  judicial ? "Judicial record" : "Research not yet published",
                )}
              >
                <Text style={s.body}>
                  {tx(
                    "Reviewed research is not yet available for this candidate.",
                  )}
                </Text>
                {judicial ? (
                  <Text style={s.muted}>
                    {tx(
                      "No reviewed judicial record sources are available yet.",
                    )}
                  </Text>
                ) : null}
                {query.isError ? (
                  <Action
                    label={tx("Try again")}
                    onPress={() => void query.refetch()}
                  />
                ) : null}
              </Panel>
            )}
            <SourceLink
              label={tx("Official candidate list")}
              url={candidate.rosterSourceUrl}
            />
            <Text style={s.muted}>
              {tx(
                "Check your official ballot for the contests you can vote in.",
              )}
            </Text>
          </>
        )}
      </ScrollView>
      {published && selection?.revisionId === brief.revisionId ? (
        <EvidenceSheet
          selection={selection}
          evidence={brief.evidence}
          onClose={() => setSelection(null)}
          fictional={false}
        />
      ) : null}
    </View>
  );
}
