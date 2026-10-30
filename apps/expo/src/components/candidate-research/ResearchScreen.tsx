import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { EvidenceSelection } from "./EvidenceSheet";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { CandidatePortrait } from "~/components/ballot/CandidatePortrait";
import { CardTranslationNotice } from "~/components/CardTranslationNotice";
import { NavHeader, SearchInput } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { DigestPalette as P } from "~/styles";
import { trpc } from "~/utils/api";
import { claimLabels, PromiseDetail } from "./Brief";
import { CandidateResearchBody } from "./CandidateResearchBody";
import { EvidenceSheet } from "./EvidenceSheet";
import { candidateResearchPreview } from "./fixtures";
import {
  Action,
  ChoiceCard,
  EvidenceAction,
  Panel,
  s,
  Segments,
} from "./ResearchUI";

const electionLabel = (date: string, locale = "en-US") =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const blankReleaseId = "00000000-0000-4000-8000-000000000000";
const topics = [
  { value: "priorities", label: "Priorities" },
  { value: "record", label: "Record" },
  { value: "mechanisms", label: "How plans work" },
  { value: "effects", label: "Potential effects" },
  { value: "tradeoffs", label: "Tradeoffs" },
  { value: "unknowns", label: "Unknowns" },
] as const;
export function ResearchScreen({
  promisePage = false,
}: {
  promisePage?: boolean;
}) {
  const { t: tx, locale: appLocale, language } = useAppTranslation();

  const router = useRouter();
  const params = useLocalSearchParams<{
    race?: string;
    draft?: string;
    person?: string;
    preview?: string;
    tab?: string;
    promise?: string;
    read?: string;
    view?: string;
    donor?: string;
  }>();
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("priorities");
  const [selection, setSelection] = useState<
    (EvidenceSelection & { person: string; route: string }) | null
  >(null);
  const [now, setNow] = useState(() => Date.now());
  const draftQuery = useQuery({
    ...trpc.candidateResearchEditorial.preview.queryOptions({
      id: params.draft ?? blankReleaseId,
    }),
    enabled: !!params.draft,
    retry: false,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const fixture = params.draft
    ? null
    : candidateResearchPreview(params.preview);
  const fictional = !!fixture;
  const previewUnavailable = __DEV__ && !!params.preview && !fixture;
  const validId =
    !!params.race &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      params.race,
    );
  const query = useQuery({
    ...trpc.candidateBriefs.race.queryOptions({
      language,
      releaseId: validId ? (params.race ?? blankReleaseId) : blankReleaseId,
    }),
    enabled: validId && !params.draft && !fictional && !previewUnavailable,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.translationState === "pending" ? 3_000 : 30_000,
  });
  const catalog = useQuery({
    ...trpc.candidateBriefs.listRaces.queryOptions({ language }),
    enabled: !params.race && !params.draft && !fictional && !previewUnavailable,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.some((row) => row.translationState === "pending")
        ? 3_000
        : false,
  });
  const expiresAt = query.data?.manifest.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Date.parse(expiresAt) - Date.now()) + 1,
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const route = JSON.stringify([
    params.race,
    params.draft,
    params.person,
    params.promise,
    params.tab,
    params.view,
  ]);
  const race =
    (params.draft && !draftQuery.isError ? draftQuery.data : null) ??
    fixture ??
    (!query.isError &&
    query.data &&
    Date.parse(query.data.manifest.expiresAt) >
      Math.max(now, query.dataUpdatedAt)
      ? query.data
      : null);
  const member = race?.manifest.members.find(
    (m) => m.candidateId === params.person,
  );
  const brief = race?.briefs.find(
    (b) => b.identity.candidateId === member?.candidateId,
  );
  const sourceBrief = race?.briefs.find(
    (b) =>
      selection?.route === route && b.identity.candidateId === selection.person,
  );
  const tab =
    params.tab === "money" || params.tab === "sources" ? params.tab : "brief";
  const navigate = (next: Record<string, string>, promise = false) =>
    router.push({
      pathname: promise ? "/candidate-promise" : "/candidate-research",
      params: {
        ...(params.draft
          ? { draft: params.draft }
          : fictional
            ? { preview: params.preview }
            : { race: params.race }),
        ...next,
      },
    });
  const open = (ids: string[], title: string, restoreFocus?: () => void) => {
    if (member)
      setSelection({
        route,
        ids,
        title,
        person: member.candidateId,
        restoreFocus,
      });
  };
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/elections");
  };
  const pageTitle = promisePage
    ? tx("Promise")
    : params.donor
      ? tx("Donor")
      : member
        ? tx("Candidate")
        : params.view === "compare"
          ? tx("Compare")
          : tx("Candidates");
  return (
    <View style={s.screen}>
      <NavHeader title={pageTitle} tone="dark" onBack={back} />
      <ScrollView
        key={`${params.race}-${params.person}-${params.promise}-${params.tab}-${params.donor}-${params.view}`}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {catalog.data && (
          <CardTranslationNotice
            items={catalog.data}
            onRetry={() => void catalog.refetch()}
            isError={catalog.isError}
          />
        )}
        {query.data && !params.draft && !fictional && (
          <CardTranslationNotice
            items={[query.data]}
            isError={query.isError}
            onRetry={() => void query.refetch()}
          />
        )}
        {params.draft && (
          <Panel title={tx("Editorial draft · not published")}>
            <Text style={s.body}>
              {tx(
                "Real collected sources. The explanation is awaiting independent review.",
              )}
            </Text>
            {draftQuery.data?.failure ? (
              <Text style={s.body}>{draftQuery.data.failure}</Text>
            ) : null}
            {draftQuery.isError ? (
              <Text style={s.body}>
                {tx(
                  "Sign in with an authorized editor account to view this draft.",
                )}
              </Text>
            ) : null}
          </Panel>
        )}
        {fictional && (
          <Text style={s.eyebrow}>
            {tx("Fictional example · not your ballot")}
          </Text>
        )}
        {params.draft && !race ? (
          <ActivityIndicator
            accessibilityLabel={tx("Loading editorial draft")}
            color={P.primary}
            animating={!draftQuery.isError}
          />
        ) : !race ? (
          <>
            {(validId && query.isFetching) ||
            (!params.race && catalog.isPending && !previewUnavailable) ? (
              <ActivityIndicator
                accessibilityLabel={tx("Loading candidate research")}
                color={P.primary}
              />
            ) : null}
            {(validId && query.isError) || (!params.race && catalog.isError) ? (
              <Panel title={tx("Research couldn’t load")}>
                <Text style={s.body}>{tx("Please try again.")}</Text>
                <Action
                  label={tx("Try again")}
                  onPress={() =>
                    void (params.race ? query.refetch() : catalog.refetch())
                  }
                />
              </Panel>
            ) : validId &&
              query.isPending &&
              !previewUnavailable ? null : params.race || previewUnavailable ? (
              <Panel title={tx("Research unavailable")}>
                <Text style={s.body}>
                  {tx(
                    "This race is not currently available. Its research may be awaiting review or an update.",
                  )}
                </Text>
                <Action
                  label={tx("Browse available races")}
                  onPress={() => router.replace("/candidate-research")}
                />
              </Panel>
            ) : (
              <>
                <Text accessibilityRole="header" style={s.title}>
                  {tx("Explore the candidates")}
                </Text>
                <Text style={s.body}>
                  {tx(
                    "Reviewed records, campaign promises and reported funding.",
                  )}
                </Text>
                {catalog.data?.length
                  ? catalog.data.map((item) => (
                      <ChoiceCard
                        key={item.id}
                        eyebrow={`${item.jurisdiction.toUpperCase()} · ${electionLabel(item.electionDate, appLocale)}`}
                        title={item.office}
                        meta={tx("candidate.count", {
                          count: item.candidateCount,
                        })}
                        accessibilityLabel={`${tx("Explore this race")}: ${item.office}, ${item.jurisdiction}, ${electionLabel(item.electionDate, appLocale)}, ${tx("candidate.count", { count: item.candidateCount })}`}
                        onPress={() =>
                          router.push({
                            pathname: "/candidate-research",
                            params: { race: item.id },
                          })
                        }
                      />
                    ))
                  : !catalog.isPending && (
                      <Panel title={tx("No reviewed races available yet")}>
                        <Text style={s.body}>
                          {tx(
                            "You can still read official candidate statements in the statewide guide. Your election office has the official candidate list.",
                          )}
                        </Text>
                        <SourceLink
                          label={tx("Find your election office")}
                          url="https://www.usa.gov/state-election-office"
                        />
                      </Panel>
                    )}
                {__DEV__ && (
                  <Panel title={tx("Development examples")}>
                    <Action
                      label={tx("Open fictional candidate research")}
                      onPress={() =>
                        router.push({
                          pathname: "/candidate-research",
                          params: { preview: "full" },
                        })
                      }
                    />
                    <Action
                      label={tx("Open missing-research example")}
                      onPress={() =>
                        router.push({
                          pathname: "/candidate-research",
                          params: { preview: "sparse" },
                        })
                      }
                    />
                  </Panel>
                )}
              </>
            )}
          </>
        ) : !member || !brief ? (
          params.person ? (
            <Panel title={tx("Candidate unavailable")}>
              <Text style={s.body}>
                {tx("This candidate is not in the current race roster.")}
              </Text>
              <Action
                label={tx("View the whole race")}
                onPress={() => navigate({})}
              />
            </Panel>
          ) : (
            <>
              <Text style={s.eyebrow}>
                {race.manifest.jurisdictionLabel.toUpperCase()} ·{" "}
                {electionLabel(race.manifest.electionDate, appLocale)}
              </Text>
              <Text accessibilityRole="header" style={s.title}>
                {race.manifest.office}
              </Text>
              <Text style={s.muted}>
                {tx(
                  "{value1} candidates · Confirm this contest appears on your ballot.",
                  { value1: race.manifest.members.length },
                )}
              </Text>
              <Segments
                options={[
                  { value: "roster", label: tx("Candidates") },
                  { value: "compare", label: tx("Compare") },
                ]}
                value={params.view === "compare" ? "compare" : "roster"}
                onChange={(value) =>
                  router.setParams({
                    view: value === "compare" ? "compare" : "",
                  })
                }
              />
              {params.view === "compare" ? (
                <>
                  <Segments
                    scrollable
                    options={topics.map((item) => ({
                      ...item,
                      label: tx(item.label),
                    }))}
                    value={topic}
                    onChange={setTopic}
                  />
                  {race.manifest.members.map((person) => {
                    const b = race.briefs.find(
                      (item) =>
                        item.identity.candidateId === person.candidateId,
                    );
                    const section = b?.sections.find(
                      (item) => item.topic === topic,
                    );
                    return (
                      <Panel key={person.candidateId}>
                        <View style={s.personHead}>
                          <CandidatePortrait name={person.name} size={40} />
                          <Text
                            accessibilityRole="header"
                            style={[s.heading, s.grow]}
                          >
                            {person.name}
                          </Text>
                        </View>
                        {person.ballotStatus === "withdrawn_on_ballot" && (
                          <Text style={s.muted}>
                            {tx("Withdrawn; name remains on ballot")}
                          </Text>
                        )}
                        {section?.claims.length ? (
                          section.claims.map((claim) => (
                            <View key={claim.id} style={s.point}>
                              <Text style={s.muted}>
                                {tx(claimLabels[claim.kind])}
                              </Text>
                              <Text style={s.body}>{claim.text}</Text>
                              <EvidenceAction
                                ids={claim.evidenceIds}
                                title={claim.text}
                                open={(ids, title, restoreFocus) =>
                                  setSelection({
                                    ids,
                                    title,
                                    restoreFocus,
                                    person: person.candidateId,
                                    route,
                                  })
                                }
                              />
                            </View>
                          ))
                        ) : (
                          <Text style={s.body}>
                            {section?.missingEvidence ??
                              tx(
                                "No reviewed evidence available for this question.",
                              )}
                          </Text>
                        )}
                        {!!section?.claims.length &&
                          !!section.missingEvidence && (
                            <Text style={s.muted}>
                              {section.missingEvidence}
                            </Text>
                          )}
                        <Action
                          label={tx("Explore {value1}", {
                            value1: person.name,
                          })}
                          onPress={() =>
                            navigate({ person: person.candidateId })
                          }
                        />
                      </Panel>
                    );
                  })}
                </>
              ) : (
                <>
                  <SearchInput
                    accessibilityLabel={tx("Search candidates")}
                    placeholder={tx("Search candidates")}
                    value={search}
                    onChangeText={setSearch}
                    autoCorrect={false}
                  />
                  {race.manifest.members
                    .filter((person) =>
                      person.name
                        .toLocaleLowerCase()
                        .includes(search.trim().toLocaleLowerCase()),
                    )
                    .map((person) => (
                      <ChoiceCard
                        key={person.candidateId}
                        leading={
                          <CandidatePortrait name={person.name} size={48} />
                        }
                        title={person.name}
                        meta={person.description ?? undefined}
                        note={
                          person.ballotStatus === "withdrawn_on_ballot"
                            ? tx("Withdrawn; name remains on ballot")
                            : undefined
                        }
                        accessibilityLabel={[
                          tx("Explore {value1}", { value1: person.name }),
                          person.description,
                          person.ballotStatus === "withdrawn_on_ballot"
                            ? tx("Withdrawn; name remains on ballot")
                            : undefined,
                        ]
                          .filter(Boolean)
                          .join(". ")}
                        onPress={() => navigate({ person: person.candidateId })}
                      />
                    ))}
                  {!race.manifest.members.some((person) =>
                    person.name
                      .toLocaleLowerCase()
                      .includes(search.trim().toLocaleLowerCase()),
                  ) && (
                    <Text style={s.body}>
                      {tx("No candidates match your search.")}
                    </Text>
                  )}
                </>
              )}
              {fictional ? (
                <Text style={s.muted}>
                  {tx(
                    "The roster and all sources in this example are fictional.",
                  )}
                </Text>
              ) : (
                <SourceLink
                  label={tx("Official candidate list")}
                  url={race.manifest.rosterSourceUrl}
                />
              )}
            </>
          )
        ) : (
          <>
            <View style={s.personHead}>
              {!promisePage && !params.donor && (
                <CandidatePortrait name={member.name} size={64} />
              )}
              <View style={[s.point, s.grow]}>
                <Text style={s.eyebrow}>
                  {race.manifest.office.toUpperCase()} ·{" "}
                  {race.manifest.jurisdictionLabel.toUpperCase()}
                </Text>
                <Text
                  accessibilityRole="header"
                  style={promisePage || params.donor ? s.heading : s.title}
                >
                  {member.name}
                </Text>
                <Text style={s.muted}>
                  {member.description}
                  {member.ballotStatus === "withdrawn_on_ballot"
                    ? tx(" · Withdrawn; name remains on ballot")
                    : ""}
                </Text>
              </View>
            </View>
            {promisePage ? (
              <PromiseDetail
                brief={brief}
                promiseId={params.promise ?? ""}
                analysis={params.read === "analysis"}
                onRead={(analysis) =>
                  router.setParams({ read: analysis ? "analysis" : "brief" })
                }
                open={open}
              />
            ) : (
              <CandidateResearchBody
                brief={brief}
                reviewedAt={race.reviewedAt}
                reviewKind={
                  params.draft ? "draft" : fictional ? "example" : "published"
                }
                tab={tab}
                onTab={(value) => router.setParams({ tab: value })}
                donorId={params.donor}
                onDonor={(donor) =>
                  navigate({ person: member.candidateId, tab: "money", donor })
                }
                onPromise={(promise) =>
                  navigate({ person: member.candidateId, promise }, true)
                }
                onCompare={() => navigate({ view: "compare" })}
                open={open}
              />
            )}
          </>
        )}
      </ScrollView>
      {selection && sourceBrief && (
        <EvidenceSheet
          key={`${selection.person}-${selection.title}`}
          selection={selection}
          evidence={sourceBrief.evidence}
          onClose={() => setSelection(null)}
          fictional={fictional}
        />
      )}
    </View>
  );
}
