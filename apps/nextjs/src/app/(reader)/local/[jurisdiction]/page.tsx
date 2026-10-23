import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getLocalCities, localCaller } from "../local-data";
import {
  cityKey,
  localFilters,
  localListHref,
  meetingDate,
  topics,
} from "../local-presentation";

interface Props {
  params: Promise<{ jurisdiction: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function getCity(key: string) {
  const parsed = cityKey.safeParse(key);
  if (!parsed.success) notFound();
  const city = (await getLocalCities()).find(
    (entry) => entry.key === parsed.data,
  );
  if (!city) notFound();
  return { ...city, key: parsed.data };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = await getCity((await params).jurisdiction);
  return {
    title: `${city.name} decisions — Billion`,
    alternates: { canonical: `/local/${city.key}` },
  };
}

export default async function CityPage({ params, searchParams }: Props) {
  const city = await getCity((await params).jurisdiction);
  const filters = localFilters.parse(await searchParams);
  const decisions = await localCaller.legistar.listDecisions({
    jurisdiction: city.key,
    ...filters,
    topic: filters.topic || undefined,
    limit: 20,
  });
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <Link href="/local" className="text-ink-night text-sm">
        ← All cities
      </Link>
      <p className="text-spark mt-8 text-xs font-bold tracking-widest uppercase">
        City hall
      </p>
      <h1 className="font-display mt-3 text-4xl font-bold">
        What {city.name.replace(/^City of /, "")} is deciding
      </h1>
      <p className="text-ink-night mt-4">
        From official meeting agendas. Titles remain as published.
      </p>
      <form className="border-chrome my-8 flex flex-wrap items-end gap-4 border-y py-5">
        <label className="text-ink-night grid gap-2 text-sm">
          Meetings
          <select
            name="timeline"
            defaultValue={filters.timeline}
            className="bg-slate text-ink-night rounded-lg border p-2"
          >
            <option value="upcoming">Upcoming</option>
            <option value="recent">Recent</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="text-ink-night grid gap-2 text-sm">
          Topic
          <select
            name="topic"
            defaultValue={filters.topic}
            className="bg-slate text-ink-night rounded-lg border p-2"
          >
            <option value="">All topics</option>
            {topics.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="bg-spark text-night rounded-lg px-4 py-2 font-semibold">
          Apply filters
        </button>
      </form>
      <div className="grid gap-4">
        {decisions.map((decision) => (
          <Link
            href={`/local/${city.key}/${decision.id}`}
            key={decision.id}
            className="border-chrome bg-slate hover:border-spark rounded-2xl border p-5 no-underline"
          >
            <p className="text-ink-night text-sm">
              {decision.body} · {meetingDate(decision.meetingStartsAt)}
            </p>
            <h2
              lang="en"
              className="font-display mt-3 text-2xl leading-snug font-bold"
            >
              {decision.title}
            </h2>
            <p className="text-ink-night mt-3 text-sm">
              File {decision.fileNumber}
              {decision.agendaNumber ? ` · Item ${decision.agendaNumber}` : ""}
            </p>
            <p className="text-ink-night mt-2 text-sm">
              {decision.meetingCancelled
                ? "Meeting cancelled"
                : (decision.outcome ??
                  decision.status ??
                  "On the published agenda")}
            </p>
          </Link>
        ))}
      </div>
      {decisions.length === 0 && (
        <div className="border-chrome rounded-2xl border p-6">
          <p>
            No {filters.timeline === "upcoming" ? "upcoming " : ""}decisions
            match these filters in the published agendas.
          </p>
          <Link
            className="text-spark mt-4 inline-block"
            href={localListHref(city.key, {
              timeline: filters.timeline === "upcoming" ? "recent" : "all",
              topic: "",
              offset: 0,
            })}
          >
            {filters.timeline === "upcoming"
              ? "See recent decisions"
              : "See all decisions"}{" "}
            →
          </Link>
        </div>
      )}
      <nav
        aria-label="Decision pages"
        className="mt-8 flex justify-between gap-4"
      >
        {filters.offset > 0 ? (
          <Link
            className="text-spark"
            href={localListHref(city.key, {
              ...filters,
              offset: Math.max(0, filters.offset - 20),
            })}
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {decisions.length === 20 && filters.offset <= 9_980 && (
          <Link
            className="text-spark"
            href={localListHref(city.key, {
              ...filters,
              offset: filters.offset + 20,
            })}
          >
            Next →
          </Link>
        )}
      </nav>
    </main>
  );
}
