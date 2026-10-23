import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getLocalCities, getLocalDecision } from "../../local-data";
import { meetingDate } from "../../local-presentation";

interface Props {
  params: Promise<{ jurisdiction: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jurisdiction, id } = await params;
  const decision = await getLocalDecision(jurisdiction, id);
  if (!decision) return { title: "Not found — Billion" };
  return {
    title: `${decision.title} — ${decision.jurisdiction} — Billion`,
    description: `File ${decision.fileNumber}. Official city records and source documents.`,
    alternates: { canonical: `/local/${jurisdiction}/${id}` },
  };
}

export default async function DecisionPage({ params }: Props) {
  const { jurisdiction, id } = await params;
  const [decision, cities] = await Promise.all([
    getLocalDecision(jurisdiction, id),
    getLocalCities(),
  ]);
  if (!decision || !cities.some((city) => city.key === jurisdiction))
    notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <Link href={`/local/${jurisdiction}`} className="text-ink-night text-sm">
        ← {decision.jurisdiction} decisions
      </Link>
      <header className="mt-8">
        <p className="text-spark text-xs font-bold tracking-widest uppercase">
          Official title · File {decision.fileNumber}
        </p>
        <h1
          lang="en"
          className="font-display mt-4 text-3xl leading-tight font-bold md:text-4xl"
        >
          {decision.title}
        </h1>
        <p className="text-ink-night mt-4">
          {decision.jurisdiction}
          {decision.type ? ` · ${decision.type}` : ""}
        </p>
        <div className="mt-5">
          <Source href={decision.sourceUrl}>{decision.sourceLabel} ↗</Source>
        </div>
      </header>

      {decision.brief && (
        <section
          aria-labelledby="billion-reading"
          className="border-spark bg-slate mt-10 rounded-2xl border p-6"
        >
          <p className="text-spark text-xs font-bold tracking-widest uppercase">
            Billion’s reading
          </p>
          <h2
            id="billion-reading"
            className="font-display mt-2 text-2xl font-bold"
          >
            What the documents say
          </h2>
          <p className="text-ink-night mt-3 text-sm">
            AI-generated explanation, separate from the city’s official wording.
            Check each claim against its cited page.
          </p>
          <div className="mt-6 space-y-6">
            {decision.brief.claims.map((claim, index) => (
              <div key={index}>
                <p className="text-lg leading-relaxed">{claim.text}</p>
                <div className="mt-3 space-y-3">
                  {claim.citations.map((citation, citationIndex) => {
                    const document = decision.documents.find(
                      (entry) => entry.id === citation.documentId,
                    );
                    if (!document) return null;
                    return (
                      <details
                        key={citationIndex}
                        className="border-chrome rounded-lg border p-3 text-sm"
                      >
                        <summary className="text-spark cursor-pointer">
                          {document.name} · page {citation.page}
                        </summary>
                        <blockquote
                          lang="en"
                          className="text-ink-night my-3 border-l-2 pl-3 leading-relaxed"
                        >
                          “{citation.quote}”
                        </blockquote>
                        <Source href={document.url}>
                          Open original document · page {citation.page} ↗
                        </Source>
                      </details>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12" aria-labelledby="official-record">
        <p className="text-ink-night text-xs font-bold tracking-widest uppercase">
          As published · {decision.jurisdiction}
        </p>
        <h2
          id="official-record"
          className="font-display mt-2 text-2xl font-bold"
        >
          The official record
        </h2>
        <dl className="border-chrome mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-y py-5 text-sm">
          <dt className="text-ink-night">File</dt>
          <dd>{decision.fileNumber}</dd>
          <dt className="text-ink-night">Published status</dt>
          <dd>{decision.status ?? "Not provided"}</dd>
          {decision.enactmentNumber && (
            <>
              <dt className="text-ink-night">Enactment</dt>
              <dd>{decision.enactmentNumber}</dd>
            </>
          )}
        </dl>
        <h3 className="font-display mt-8 text-xl font-bold">
          Meetings and outcomes
        </h3>
        {decision.occurrences.length === 0 && (
          <p className="text-ink-night mt-4">No meeting record is available.</p>
        )}
        <ol className="mt-5 space-y-5">
          {decision.occurrences.map((occurrence) => (
            <li
              key={occurrence.id}
              className="border-chrome bg-slate rounded-2xl border p-5"
            >
              <h4 className="font-semibold">{occurrence.body}</h4>
              <p className="text-ink-night mt-1 text-sm">
                {meetingDate(occurrence.startsAt)}
                {occurrence.agendaNumber
                  ? ` · Item ${occurrence.agendaNumber}`
                  : ""}
              </p>
              {occurrence.cancelled && (
                <p className="mt-3 font-semibold">Meeting cancelled</p>
              )}
              {occurrence.location && (
                <p className="text-ink-night mt-2 text-sm">{occurrence.location}</p>
              )}
              {occurrence.proposedAction && (
                <div className="mt-4">
                  <p className="text-ink-night text-xs font-semibold uppercase">
                    Published action text
                  </p>
                  <p className="mt-2 leading-relaxed whitespace-pre-line">
                    {occurrence.proposedAction}
                  </p>
                </div>
              )}
              <p className="mt-4">
                <span className="text-ink-night">Recorded outcome: </span>
                {[occurrence.action, occurrence.passed, occurrence.tally]
                  .filter(Boolean)
                  .join(" · ") || "No outcome published in this record."}
              </p>
              {occurrence.minutesNote && (
                <p className="text-ink-night mt-3 text-sm whitespace-pre-line">
                  {occurrence.minutesNote}
                </p>
              )}
              {decision.votes.some(
                (vote) => vote.meetingItemId === occurrence.id,
              ) && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Recorded votes
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm">
                    {decision.votes
                      .filter((vote) => vote.meetingItemId === occurrence.id)
                      .map((vote, index) => (
                        <li key={index} className="flex justify-between gap-4">
                          <span>{vote.personName}</span>
                          <span>{vote.value}</span>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <Source href={occurrence.meetingSourceUrl}>
                  Meeting record ↗
                </Source>
                {occurrence.agendaUrl && (
                  <Source href={occurrence.agendaUrl}>Agenda ↗</Source>
                )}
                {occurrence.minutesUrl && (
                  <Source href={occurrence.minutesUrl}>Minutes ↗</Source>
                )}
                {occurrence.videoUrl && (
                  <Source href={occurrence.videoUrl}>Video ↗</Source>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="documents">
        <h2 id="documents" className="font-display text-2xl font-bold">
          Source documents
        </h2>
        <ul className="mt-4 space-y-3">
          {decision.documents.map((document) => (
            <li key={document.id}>
              <Source href={document.url}>{document.name} ↗</Source>
              {document.pageCount ? (
                <span className="text-ink-night ml-2 text-sm">
                  {document.pageCount} pages
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {decision.documents.length === 0 && (
          <p className="text-ink-night mt-4">
            No documents are attached to this record.
          </p>
        )}
      </section>

      <section className="border-chrome mt-10 border-t pt-8">
        <h2 className="font-display text-2xl font-bold">Take part</h2>
        <p className="text-ink-night mt-3 leading-relaxed">
          {decision.participation.note}
        </p>
        <div className="mt-3">
          <Source href={decision.participation.instructionsUrl}>
            Check the official meeting instructions ↗
          </Source>
        </div>
        {decision.publicComments.officialLinks.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer font-semibold">
              Public comments in the official record (
              {decision.publicComments.documentCount})
            </summary>
            <p className="text-ink-night mt-3 text-sm">
              These links open the city’s original records. Public comments are
              not used in Billion’s generated explanations.
            </p>
            <ul className="mt-3 space-y-3">
              {decision.publicComments.officialLinks.map((comment, index) => (
                <li key={comment.id}>
                  <Source href={comment.url}>
                    {comment.label} {index + 1} ↗
                  </Source>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </main>
  );
}

function Source({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  if (!href)
    return <span className="text-ink-night">Official link not provided</span>;
  return (
    <a
      className="text-spark underline decoration-current/40 underline-offset-4 hover:decoration-current"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
