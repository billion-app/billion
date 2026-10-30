import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { californiaOfficeFamilySchema } from "@acme/validators";

import type { RouterOutputs } from "~/utils/api";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { NavHeader, SearchInput } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { translateAppLabel } from "~/i18n/app-strings";
import { DigestPalette as P, planes } from "~/styles";
import { trpc } from "~/utils/api";
import { ELECTION_DATE } from "~/utils/candidate-explainer";
import { researchCandidateRoute } from "~/utils/candidate-research-route";
import { Action, ChoiceCard, focusControl, Panel, s } from "./ResearchUI";

export const officialRosterUrl = "https://media.sos.ca.gov/media/C26GG.txt";
export function CandidateCatalog() {
  const { t: tx, locale, language } = useAppTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string;
    officeFamily?: string;
    cursors?: string;
  }>();
  const [searchState, setSearchState] = useState({
    route: params.q ?? "",
    value: params.q ?? "",
  });
  if (searchState.route !== (params.q ?? ""))
    setSearchState({ route: params.q ?? "", value: params.q ?? "" });
  const search = searchState.value;
  const setSearch = (value: string) =>
    setSearchState({ route: params.q ?? "", value });
  const [sheet, setSheet] = useState<"office" | "coverage" | null>(null);
  const officeRef = useRef<View>(null);
  const coverageRef = useRef<View>(null);
  const doneRef = useRef<View>(null);
  const headingRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  let cursors: string[] = [];
  try {
    const raw: unknown = JSON.parse(params.cursors ?? "[]");
    if (
      Array.isArray(raw) &&
      raw.length < 1000 &&
      raw.every((v) => typeof v === "string" && v.length <= 2000)
    )
      cursors = raw as string[];
  } catch {
    cursors = [];
  }
  const cursor = cursors.at(-1);
  const officeFamily = californiaOfficeFamilySchema.safeParse(
    params.officeFamily,
  ).data;
  const filterKey = JSON.stringify([params.q ?? "", officeFamily ?? ""]);
  const [previousPage, setPreviousPage] = useState<{
    data: RouterOutputs["candidateBriefs"]["catalog"];
    filterKey: string;
    cursors: string[];
  } | null>(null);
  const query = useQuery({
    ...trpc.candidateBriefs.catalog.queryOptions({
      electionDate: ELECTION_DATE,
      query: params.q ?? undefined,
      officeFamily,
      cursor,
      limit: 20,
    }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== (params.q ?? ""))
        router.setParams({ q: search.trim(), cursors: "" });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, params.q, router]);
  const previous =
    query.isError && previousPage?.filterKey === filterKey
      ? previousPage
      : null;
  const data = query.data ?? previous?.data;
  const displayedPage =
    previous && !query.data ? previous.cursors.length : cursors.length;
  const activeOffice = data?.families.find(
    (family) => family.value === params.officeFamily,
  );
  const officeLabel = activeOffice
    ? translateAppLabel(language, activeOffice.label)
    : officeFamily
      ? tx("Loading candidates")
      : tx("All offices");
  const dismiss = () => {
    const previous = sheet;
    setSheet(null);
    requestAnimationFrame(() =>
      focusControl(
        previous === "office" ? officeRef.current : coverageRef.current,
      ),
    );
  };
  const reset = () => {
    setSearch("");
    router.setParams({ q: "", officeFamily: "", cursors: "" });
  };
  useEffect(() => {
    if (query.data && cursor)
      requestAnimationFrame(() => focusControl(headingRef.current));
  }, [query.data, cursor]);
  const page = (next: string[]) => {
    if (query.data && !query.isError)
      setPreviousPage({ data: query.data, filterKey, cursors });
    router.setParams({ cursors: JSON.stringify(next) });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    requestAnimationFrame(() => focusControl(headingRef.current));
  };
  const date = new Date(
    `${data?.coverage.electionDate ?? ELECTION_DATE}T12:00:00Z`,
  ).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <View style={s.screen}>
      <NavHeader
        title={tx("Candidates")}
        tone="dark"
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace("/(tabs)/elections")
        }
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.content, { gap: 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={[s.title, { fontSize: 28 }]}>
          {tx("California candidates")}
        </Text>
        <Text style={s.muted}>{date}</Text>
        {data?.snapshotId ? (
          <Text style={s.muted}>
            {tx("{listed} listed · {published} with reviewed research", {
              listed: data.coverage.expectedCandidates,
              published: data.coverage.publishedCandidates,
            })}
          </Text>
        ) : null}
        <Pressable
          ref={coverageRef}
          accessibilityRole="button"
          onPress={() => setSheet("coverage")}
          style={styles.control}
        >
          <Text style={s.link}>{tx("Coverage details")}</Text>
        </Pressable>
        <Text style={s.label}>{tx("Search candidates")}</Text>
        <SearchInput
          accessibilityLabel={tx("Search candidates")}
          placeholder={tx("Name, office or district")}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          maxLength={200}
        />
        <View style={styles.toolbar}>
          <Pressable
            ref={officeRef}
            accessibilityRole="button"
            accessibilityLabel={tx("Office: {office}", { office: officeLabel })}
            onPress={() => setSheet("office")}
            style={[styles.control, styles.filter]}
          >
            <Text style={s.link}>
              {tx("Office: {office}", { office: officeLabel })}
            </Text>
          </Pressable>
          {search || params.officeFamily ? (
            <Pressable
              accessibilityRole="button"
              onPress={reset}
              style={styles.control}
            >
              <Text style={s.link}>{tx("Clear search and filters")}</Text>
            </Pressable>
          ) : null}
        </View>
        {query.isError && data ? (
          <Panel title={tx("Couldn’t load this page.")}>
            <Text style={s.body}>{tx("Showing the last loaded results.")}</Text>
            <Action
              label={tx("Try again")}
              onPress={() => void query.refetch()}
            />
            <Action
              label={tx("Return to first page")}
              onPress={() => page([])}
            />
          </Panel>
        ) : null}
        {query.isPending ? (
          <ActivityIndicator
            accessibilityLabel={tx("Loading candidates")}
            color={P.primary}
          />
        ) : !data?.snapshotId ? (
          <Panel title={tx("Candidate catalog unavailable")}>
            <Text style={s.body}>{tx("Please try again.")}</Text>
            <Action
              label={tx("Try again")}
              onPress={() => void query.refetch()}
            />
            <SourceLink
              label={tx("Official candidate list")}
              url={data?.coverage.sourceUrl ?? officialRosterUrl}
            />
            {cursor ? (
              <Action
                label={tx("Return to first page")}
                onPress={() => page([])}
              />
            ) : null}
          </Panel>
        ) : (
          <>
            <View
              ref={headingRef}
              accessible
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
            >
              <Text style={s.muted}>
                {tx("Candidates {start}–{end} of {total}", {
                  start: data.totalMatches ? displayedPage * 20 + 1 : 0,
                  end: displayedPage * 20 + data.items.length,
                  total: data.totalMatches,
                })}
              </Text>
              <Text style={s.muted}>{tx("Alphabetical by name")}</Text>
            </View>
            {data.items.length ? (
              data.items.map((item) => (
                <ChoiceCard
                  key={`${item.identity.contestId}:${item.identity.candidateId}`}
                  title={item.name}
                  meta={`${translateAppLabel(language, item.office)} · ${item.jurisdictionLabel}`}
                  note={[
                    item.party ? translateAppLabel(language, item.party) : "",
                    item.ballotStatus === "qualified_write_in"
                      ? tx("Qualified write-in")
                      : "",
                    tx(
                      item.status === "published"
                        ? "Reviewed research"
                        : "Official roster only",
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  accessibilityLabel={`${item.name}. ${item.office}. ${item.jurisdictionLabel}. ${item.ballotStatus === "qualified_write_in" ? tx("Qualified write-in") + ". " : ""}${tx(item.status === "published" ? "Reviewed research" : "Official roster only")}`}
                  onPress={() => router.push(researchCandidateRoute(item))}
                />
              ))
            ) : (
              <Panel title={tx("No candidates match these filters.")}>
                <Text style={s.body}>
                  {tx("Try another name, office or district.")}
                </Text>
                <Action
                  label={tx("Clear search and filters")}
                  onPress={reset}
                />
              </Panel>
            )}
            <View style={styles.toolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !cursor || query.isError }}
                disabled={!cursor || query.isError}
                onPress={() => page(cursors.slice(0, -1))}
                style={[
                  styles.control,
                  styles.filter,
                  (!cursor || query.isError) && { opacity: 0.4 },
                ]}
              >
                <Text style={s.link}>{tx("Previous")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !data.nextCursor || query.isError,
                }}
                disabled={!data.nextCursor || query.isError}
                onPress={() => {
                  if (data.nextCursor) page([...cursors, data.nextCursor]);
                }}
                style={[
                  styles.control,
                  styles.filter,
                  (!data.nextCursor || query.isError) && { opacity: 0.4 },
                ]}
              >
                <Text style={s.link}>{tx("Next")}</Text>
              </Pressable>
            </View>
          </>
        )}
        <Text style={s.muted}>
          {tx("Check your official ballot for the contests you can vote in.")}
        </Text>
      </ScrollView>
      {sheet ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={dismiss}
          onDismiss={() =>
            focusControl(
              sheet === "office" ? officeRef.current : coverageRef.current,
            )
          }
          onShow={() => focusControl(doneRef.current)}
        >
          <View style={styles.overlay}>
            <Pressable
              accessible={false}
              style={StyleSheet.absoluteFill}
              onPress={dismiss}
            />
            <View accessibilityViewIsModal style={styles.sheet}>
              <View style={styles.toolbar}>
                <Text accessibilityRole="header" style={[s.heading, s.grow]}>
                  {tx(
                    sheet === "office"
                      ? "Filter by office"
                      : "What this catalog covers",
                  )}
                </Text>
                <Pressable
                  ref={doneRef}
                  accessibilityRole="button"
                  onPress={dismiss}
                  style={styles.control}
                >
                  <Text style={s.link}>{tx("Done")}</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ gap: 12 }}>
                {sheet === "office" ? (
                  <>
                    <Text style={s.muted}>
                      {tx("Number of candidates in each office group.")}
                    </Text>
                    {[
                      {
                        value: "",
                        label: tx("All offices"),
                        count: data?.families.reduce(
                          (count, family) => count + family.count,
                          0,
                        ),
                      },
                      ...(data?.families ?? []),
                    ].map((family) => (
                      <Pressable
                        key={family.value}
                        accessibilityRole="radio"
                        accessibilityState={{
                          selected:
                            (params.officeFamily ?? "") === family.value,
                          checked: (params.officeFamily ?? "") === family.value,
                        }}
                        onPress={() => {
                          router.setParams({
                            officeFamily: family.value,
                            cursors: "",
                          });
                          dismiss();
                        }}
                        style={[
                          styles.control,
                          styles.filter,
                          (params.officeFamily ?? "") === family.value && {
                            borderColor: P.primary,
                          },
                        ]}
                      >
                        <Text style={s.link}>
                          {(params.officeFamily ?? "") === family.value
                            ? "✓ "
                            : ""}
                          {translateAppLabel(language, family.label)}
                          {family.count === undefined
                            ? ""
                            : ` (${family.count})`}
                        </Text>
                      </Pressable>
                    ))}
                  </>
                ) : (
                  <>
                    <Text style={s.body}>{date}</Text>
                    {data?.coverage.sourceName ? (
                      <Text style={s.muted}>{data.coverage.sourceName}</Text>
                    ) : null}
                    {data?.coverage.fetchedAt ? (
                      <Text style={s.muted}>
                        {tx("Roster retrieved {date}", {
                          date: new Date(
                            data.coverage.fetchedAt,
                          ).toLocaleString(locale, { timeZone: "UTC" }),
                        })}{" "}
                        UTC
                      </Text>
                    ) : null}
                    <Text style={s.body}>
                      {data?.scopeLabel ?? tx("Candidate catalog unavailable")}
                    </Text>
                    {data?.snapshotId ? (
                      <>
                        <Text style={s.body}>
                          {tx("{candidates} candidates · {contests} contests", {
                            candidates: data.coverage.expectedCandidates,
                            contests: data.coverage.expectedRaces,
                          })}
                        </Text>
                        <Text style={s.body}>
                          {tx("{count} candidates with reviewed research", {
                            count: data.coverage.publishedCandidates,
                          })}
                        </Text>
                        <Text style={s.body}>
                          {tx(
                            "County coverage verified: {verified} of {total}",
                            {
                              verified: data.coverage.countyCoverage.verified,
                              total: data.coverage.countyCoverage.total,
                            },
                          )}
                        </Text>
                        <Text style={s.muted}>
                          {tx("Office counts follow the current search.")}
                        </Text>
                        {data.families.map((family) => (
                          <Text key={family.value} style={s.muted}>
                            {translateAppLabel(language, family.label)} ·{" "}
                            {family.count}
                          </Text>
                        ))}
                      </>
                    ) : null}
                    <Text style={s.muted}>
                      {tx(
                        "Local coverage is partial. Check your official ballot.",
                      )}
                    </Text>
                    <SourceLink
                      label={tx("Official candidate list")}
                      url={data?.coverage.sourceUrl ?? officialRosterUrl}
                    />
                    <SourceLink
                      label={tx("Find your election office")}
                      url="https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
                    />
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  control: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  filter: {
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.quiet,
    backgroundColor: planes.slate,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingTop: 60,
  },
  sheet: {
    backgroundColor: P.canvas,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
    maxHeight: "90%",
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
