import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { EvidenceSelection } from "./EvidenceSheet";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { NavHeader } from "~/components/ui";
import { DigestPalette as P, planes } from "~/styles";
import { trpc } from "~/utils/api";
import { Brief, claimLabels, PromiseDetail } from "./Brief";
import { EvidenceSheet } from "./EvidenceSheet";
import { Finance } from "./Finance";
import { candidateResearchPreview } from "./fixtures";
import { Action, EvidenceAction, Panel, s, Segments } from "./ResearchUI";

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
  const router = useRouter();
  const params = useLocalSearchParams<{
    race?: string;
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
  const fixture = candidateResearchPreview(params.preview);
  const fictional = !!fixture;
  const previewUnavailable = __DEV__ && !!params.preview && !fixture;
  const validId =
    !!params.race &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      params.race,
    );
  const query = useQuery({
    ...trpc.candidateBriefs.race.queryOptions({
      releaseId: validId ? (params.race ?? blankReleaseId) : blankReleaseId,
    }),
    enabled: validId && !fictional && !previewUnavailable,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const catalog = useQuery({
    ...trpc.candidateBriefs.listRaces.queryOptions(),
    enabled: !params.race && !fictional && !previewUnavailable,
    staleTime: 0,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);
  const route = JSON.stringify([
    params.race,
    params.person,
    params.promise,
    params.tab,
    params.view,
  ]);
  const race =
    fixture ??
    (!query.isError &&
    query.data &&
    Date.parse(query.data.manifest.expiresAt) > now
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
        ...(fictional ? { preview: params.preview } : { race: params.race }),
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
    ? "Campaign promise"
    : params.donor
      ? "Donor details"
      : member
        ? "Candidate"
        : params.view === "compare"
          ? "Compare the race"
          : "Candidate research";
  return (
    <View style={s.screen}>
      <NavHeader title={pageTitle} tone="dark" onBack={back} />
      <ScrollView
        key={`${params.race}-${params.person}-${params.promise}-${params.tab}-${params.donor}-${params.view}`}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {fictional && (
          <Text style={s.eyebrow}>Fictional example · not your ballot</Text>
        )}
        {!race ? (
          <>
            {(validId && query.isFetching) ||
            (!params.race && catalog.isPending && !previewUnavailable) ? (
              <ActivityIndicator
                accessibilityLabel="Loading candidate research"
                color={P.primary}
              />
            ) : null}
            {(validId && query.isError) || (!params.race && catalog.isError) ? (
              <Panel title="Research couldn’t load">
                <Text style={s.body}>Please try again.</Text>
                <Action
                  label="Try again"
                  onPress={() =>
                    void (params.race ? query.refetch() : catalog.refetch())
                  }
                />
              </Panel>
            ) : validId &&
              query.isPending &&
              !previewUnavailable ? null : params.race || previewUnavailable ? (
              <Panel title="Research unavailable">
                <Text style={s.body}>
                  This race is not currently available. Its research may be
                  awaiting review or an update.
                </Text>
                <Action
                  label="Browse available races"
                  onPress={() => router.replace("/candidate-research")}
                />
              </Panel>
            ) : (
              <>
                <Text accessibilityRole="header" style={s.title}>
                  Explore the candidates
                </Text>
                <Text style={s.body}>
                  Reviewed records, campaign promises and reported funding.
                </Text>
                {catalog.data?.length
                  ? catalog.data.map((item) => (
                      <Panel key={item.id} title={item.office}>
                        <Text style={s.muted}>
                          {item.jurisdiction} · {item.electionDate}
                        </Text>
                        <Text style={s.body}>
                          {item.candidateCount} candidates
                        </Text>
                        <Action
                          label="Explore this race"
                          onPress={() =>
                            router.push({
                              pathname: "/candidate-research",
                              params: { race: item.id },
                            })
                          }
                        />
                      </Panel>
                    ))
                  : !catalog.isPending && (
                      <Panel title="No reviewed races available yet">
                        <Text style={s.body}>
                          You can still read official candidate statements in
                          the statewide guide. Your election office has the
                          official candidate list.
                        </Text>
                        <SourceLink
                          label="Find your election office"
                          url="https://www.usa.gov/state-election-office"
                        />
                      </Panel>
                    )}
                {__DEV__ && (
                  <Panel title="Development examples">
                    <Action
                      label="Open fictional candidate research"
                      onPress={() =>
                        router.push({
                          pathname: "/candidate-research",
                          params: { preview: "full" },
                        })
                      }
                    />
                    <Action
                      label="Open missing-research example"
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
            <Panel title="Candidate unavailable">
              <Text style={s.body}>
                This candidate is not in the current race roster.
              </Text>
              <Action
                label="View the whole race"
                onPress={() => navigate({})}
              />
            </Panel>
          ) : (
            <>
              <Text style={s.eyebrow}>
                {race.manifest.jurisdictionLabel.toUpperCase()} ·{" "}
                {race.manifest.electionDate}
              </Text>
              <Text accessibilityRole="header" style={s.title}>
                {race.manifest.office}
              </Text>
              <Text style={s.muted}>
                {race.manifest.members.length} candidates · Confirm this contest
                appears on your ballot.
              </Text>
              {params.view === "compare" ? (
                <>
                  <Segments
                    scrollable
                    options={[...topics]}
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
                      <Panel key={person.candidateId} title={person.name}>
                        {person.ballotStatus === "withdrawn_on_ballot" && (
                          <Text style={s.muted}>
                            Withdrawn; name remains on ballot
                          </Text>
                        )}
                        {section?.claims.length ? (
                          section.claims.map((claim) => (
                            <View key={claim.id} style={s.point}>
                              <Text style={s.muted}>
                                {claimLabels[claim.kind]}
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
                              "No reviewed evidence available for this question."}
                          </Text>
                        )}
                        <Action
                          label={`Explore ${person.name}`}
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
                  <Action
                    label="Compare the whole race"
                    onPress={() => navigate({ view: "compare" })}
                  />
                  <TextInput
                    accessibilityLabel="Search candidates"
                    placeholder="Search candidates"
                    placeholderTextColor="#BDC1CD"
                    value={search}
                    onChangeText={setSearch}
                    style={[
                      s.body,
                      {
                        minHeight: 48,
                        borderRadius: 12,
                        backgroundColor: planes.slate,
                        padding: 12,
                      },
                    ]}
                    autoCorrect={false}
                  />
                  {race.manifest.members
                    .filter((person) =>
                      person.name
                        .toLocaleLowerCase()
                        .includes(search.trim().toLocaleLowerCase()),
                    )
                    .map((person) => (
                      <Panel key={person.candidateId}>
                        <Text accessibilityRole="header" style={s.heading}>
                          {person.name}
                        </Text>
                        <Text style={s.muted}>
                          {person.description}
                          {person.ballotStatus === "withdrawn_on_ballot"
                            ? " · Withdrawn; name remains on ballot"
                            : ""}
                        </Text>
                        <Action
                          label={`Explore ${person.name}`}
                          onPress={() =>
                            navigate({ person: person.candidateId })
                          }
                        />
                      </Panel>
                    ))}
                  {!race.manifest.members.some((person) =>
                    person.name
                      .toLocaleLowerCase()
                      .includes(search.trim().toLocaleLowerCase()),
                  ) && (
                    <Text style={s.body}>No candidates match your search.</Text>
                  )}
                </>
              )}
              {fictional ? (
                <Text style={s.muted}>
                  The roster and all sources in this example are fictional.
                </Text>
              ) : (
                <SourceLink
                  label="Official candidate list"
                  url={race.manifest.rosterSourceUrl}
                />
              )}
            </>
          )
        ) : (
          <>
            <View style={s.point}>
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
                  ? " · Withdrawn; name remains on ballot"
                  : ""}
              </Text>
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
              <>
                {!params.donor && (
                  <Segments
                    options={[
                      { value: "brief", label: "The brief" },
                      { value: "money", label: "Money" },
                      { value: "sources", label: "Sources" },
                    ]}
                    value={tab}
                    onChange={(value) => router.setParams({ tab: value })}
                  />
                )}
                {tab === "money" ? (
                  <Finance
                    finance={brief.research?.finance ?? null}
                    gap={brief.research?.financeGap ?? null}
                    donorId={params.donor}
                    onDonor={(donor) =>
                      navigate({
                        person: member.candidateId,
                        tab: "money",
                        donor,
                      })
                    }
                    open={open}
                  />
                ) : tab === "sources" ? (
                  <>
                    <Text style={s.muted}>
                      {fictional ? "Example review" : "Reviewed"}{" "}
                      {new Date(race.reviewedAt).toLocaleDateString("en-US", {
                        timeZone: "UTC",
                      })}
                    </Text>
                    {brief.evidence.length ? (
                      brief.evidence.map((evidence) => (
                        <Panel key={evidence.id}>
                          <Text style={s.eyebrow}>
                            {evidence.origin === "candidate"
                              ? "CANDIDATE SOURCE"
                              : evidence.origin === "primary_record"
                                ? "ORIGINAL RECORD"
                                : "INDEPENDENT REPORTING"}
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
                            label="Read source passage"
                            open={open}
                          />
                        </Panel>
                      ))
                    ) : (
                      <Panel title="Sources unavailable">
                        <Text style={s.body}>
                          No reviewed source passages are available for this
                          candidate.
                        </Text>
                      </Panel>
                    )}
                    <SourceLink
                      label="Report a correction"
                      url="https://billion-news.app/support"
                    />
                  </>
                ) : (
                  <Brief
                    brief={brief}
                    open={open}
                    onPromise={(promise) =>
                      navigate({ person: member.candidateId, promise }, true)
                    }
                  />
                )}
                {!params.donor && (
                  <Action
                    label="Compare the whole race"
                    onPress={() => navigate({ view: "compare" })}
                  />
                )}
              </>
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
