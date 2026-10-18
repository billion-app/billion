"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CandidateBrief } from "@acme/validators";
import { candidateBriefSchema } from "@acme/validators";

import { useTRPC } from "~/trpc/react";

const button = "rounded-lg border px-4 py-2 disabled:opacity-40";
const inputStyle = "w-full rounded-lg border bg-transparent p-3";
export function Workbench() {
  const trpc = useTRPC();
  const client = useQueryClient();
  const catalog = useQuery(trpc.candidateResearchEditorial.list.queryOptions());
  const [id, setId] = useState<string | null>(null);
  const [version, setVersion] = useState("candidate-research-v1");
  const [statement, setStatement] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const collection = useQuery({
    ...trpc.candidateResearchEditorial.collection.queryOptions({
      id: id ?? "00000000-0000-4000-8000-000000000000",
    }),
    enabled: !!id,
  });
  const refresh = async () => {
    await client.invalidateQueries({
      queryKey: trpc.candidateResearchEditorial.pathKey(),
    });
  };
  const review = useMutation(
    trpc.candidateResearchEditorial.review.mutationOptions({
      onSuccess: () => {
        setMessage("Review event recorded.");
        void refresh();
      },
      onError: (e) => setMessage(e.message),
    }),
  );
  const publish = useMutation(
    trpc.candidateResearchEditorial.publish.mutationOptions({
      onSuccess: (r) => {
        setMessage(`Published race ${r.releaseId}`);
        void refresh();
      },
      onError: (e) => setMessage(e.message),
    }),
  );
  const policy = useMutation(
    trpc.candidateResearchEditorial.approvePolicy.mutationOptions({
      onSuccess: () => {
        setMessage("Policy approval recorded with your account identity.");
        void refresh();
      },
      onError: (e) => setMessage(e.message),
    }),
  );
  const revokePolicy = useMutation(
    trpc.candidateResearchEditorial.revokePolicy.mutationOptions({
      onSuccess: () => {
        setMessage("Publication policy revoked; public research is closed.");
        void refresh();
      },
      onError: (e) => setMessage(e.message),
    }),
  );
  if (catalog.isPending) return <p>Loading editorial access…</p>;
  if (catalog.isError)
    return (
      <p role="alert">
        {catalog.error.message}. A server operator must grant access to your
        signed-in account.
      </p>
    );
  return (
    <div className="space-y-6">
      <p role="status" className="font-medium">
        {message}
      </p>
      <p>
        Publication policy:{" "}
        {catalog.data.policy.approved
          ? catalog.data.policy.version
          : "Not approved"}
      </p>
      <div className="flex flex-wrap gap-3">
        {catalog.data.collections.map((c) => (
          <button
            className={button}
            key={c.id}
            onClick={() => {
              setId(c.id);
              setMessage("");
            }}
          >
            {c.jurisdiction} · {c.candidates} candidates
            {c.failure ? " · Refresh failed" : ""}
          </button>
        ))}
      </div>
      {!catalog.data.collections.length && (
        <p>
          No collected races. Run the bounded candidate-research scraper first.
        </p>
      )}
      {collection.isError && <p role="alert">{collection.error.message}</p>}
      {collection.data && (
        <>
          <div className="rounded-xl border p-5">
            <h2 className="font-serif text-2xl">
              {collection.data.document.manifest.jurisdictionLabel}
            </h2>
            <p>Sources checked {collection.data.checkedAt.toLocaleString()}</p>
            {collection.data.failure && (
              <p role="alert">{collection.data.failure}</p>
            )}
            <a
              className="underline"
              href={`billion://candidate-research?draft=${collection.data.id}`}
            >
              Open draft in the Billion app
            </a>
          </div>
          <label className="block">
            Policy version
            <input
              className={inputStyle}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </label>
          <label className="block">
            Review or withdrawal reason
            <textarea
              className={inputStyle}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What you checked, findings, and remaining limits"
            />
          </label>
          <p>
            Enter a review reason of at least 10 characters to enable review.
            Publishing also requires an approved policy and independent approval
            of every candidate revision.
          </p>
          {collection.data.document.briefs.map((brief) => (
            <section
              key={brief.revisionId}
              className="space-y-4 rounded-xl border p-5"
            >
              <h2 className="font-serif text-2xl">
                {
                  collection.data.document.manifest.members.find(
                    (m) => m.revisionId === brief.revisionId,
                  )?.name
                }
              </h2>
              <p>
                Draft {brief.revisionId} · Author {brief.authorId}
              </p>
              {brief.sections.map((section) => (
                <div key={section.topic}>
                  <h3 className="mt-4 font-semibold capitalize">
                    {section.topic}
                  </h3>
                  {section.claims.map((c) => (
                    <p key={c.id} className="my-2">
                      <span className="mr-2 text-sm opacity-70">{c.kind}</span>
                      {c.text}
                    </p>
                  ))}
                  {section.missingEvidence && (
                    <p className="text-sm opacity-70">
                      {section.missingEvidence}
                    </p>
                  )}
                </div>
              ))}
              {brief.research?.finance && (
                <p>
                  Reported receipts:{" "}
                  {brief.research.finance.receipts
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(
                        brief.research.finance.receipts.totalCents / 100,
                      )
                    : "Unavailable"}{" "}
                  · {brief.research.finance.periodStart} –{" "}
                  {brief.research.finance.periodEnd}
                </p>
              )}
              <details>
                <summary>Source passages and limitations</summary>
                {brief.evidence.map((e) => (
                  <div className="my-4 border-t pt-3" key={e.id}>
                    <a
                      className="underline"
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {e.title ?? e.publisher}
                    </a>
                    {e.filingUrl && (
                      <a
                        className="underline"
                        href={e.filingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View original filing
                      </a>
                    )}
                    <p>{e.locator}</p>
                    <blockquote className="my-2 border-l-2 pl-4 whitespace-pre-wrap">
                      {e.excerpt}
                    </blockquote>
                    <p>
                      {e.shows} {e.limits}
                    </p>
                  </div>
                ))}
              </details>
              <DraftEditor
                brief={brief}
                collectionId={collection.data.id}
                onSaved={(newId) => {
                  setId(newId);
                  void refresh();
                }}
              />
              <div className="flex gap-3">
                <button
                  className={button}
                  disabled={reason.trim().length < 10 || review.isPending}
                  onClick={() =>
                    review.mutate({
                      collectionId: collection.data.id,
                      revisionId: brief.revisionId,
                      action: "approve",
                      policyVersion: version,
                      reason,
                    })
                  }
                >
                  Approve this exact revision
                </button>
                <button
                  className={button}
                  disabled={reason.trim().length < 10 || review.isPending}
                  onClick={() =>
                    review.mutate({
                      collectionId: collection.data.id,
                      revisionId: brief.revisionId,
                      action: "withdraw",
                      policyVersion: version,
                      reason,
                    })
                  }
                >
                  Withdraw
                </button>
              </div>
              <details>
                <summary>Review history</summary>
                {collection.data.events
                  .filter((e) => e.revisionId === brief.revisionId)
                  .map((e) => (
                    <p key={e.id}>
                      {e.createdAt.toLocaleString()} · {e.action} · {e.actorId}{" "}
                      · {e.reason}
                    </p>
                  ))}
              </details>
            </section>
          ))}
          <details>
            <summary>Complete collected source text</summary>
            {collection.data.document.sources.map((s) => (
              <details key={s.id} className="my-3">
                <summary>
                  {s.publisher} · {s.id}
                </summary>
                <a className="underline" href={s.url}>
                  {s.url}
                </a>
                <pre className="max-h-96 overflow-auto text-sm whitespace-pre-wrap">
                  {s.text}
                </pre>
              </details>
            ))}
          </details>
          {catalog.data.canPublish && (
            <button
              className={button}
              disabled={publish.isPending}
              onClick={() =>
                publish.mutate({ collectionId: collection.data.id })
              }
            >
              Publish independently approved complete race
            </button>
          )}
        </>
      )}
      {catalog.data.canPublish && (
        <details className="rounded-xl border p-5">
          <summary>Publication policy decision</summary>
          <p className="my-3">
            The accountable publisher must explicitly adopt a versioned policy
            covering attribution, primary evidence, complete race coverage,
            corrections, uncertainty, and independent review. This does not
            approve individual drafts.
          </p>
          <label className="block">
            Version
            <input
              className={inputStyle}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </label>
          <label className="block">
            Policy and scope you are adopting
            <textarea
              className={inputStyle}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
          </label>
          <button
            className={button}
            disabled={statement.trim().length < 80 || policy.isPending}
            onClick={() => policy.mutate({ version, statement })}
          >
            Record my policy approval
          </button>
          {catalog.data.policy.approved && (
            <button
              className={button}
              disabled={revokePolicy.isPending}
              onClick={() =>
                revokePolicy.mutate({ version: catalog.data.policy.version })
              }
            >
              Revoke current policy
            </button>
          )}
        </details>
      )}
    </div>
  );
}
function DraftEditor({
  brief,
  collectionId,
  onSaved,
}: {
  brief: CandidateBrief;
  collectionId: string;
  onSaved: (id: string) => void;
}) {
  const trpc = useTRPC();
  const [document, setDocument] = useState(JSON.stringify(brief, null, 2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const save = useMutation(
    trpc.candidateResearchEditorial.save.mutationOptions({
      onSuccess: (r) => onSaved(r.collectionId),
      onError: (e) => setError(e.message),
    }),
  );
  return (
    <details>
      <summary>Edit structured draft</summary>
      <p>
        Corrections create a new revision and require a different editor’s
        approval. Citations must quote the collected source snapshots.
      </p>
      <textarea
        aria-label="Draft JSON"
        spellCheck={false}
        className={`${inputStyle} h-96 font-mono text-sm`}
        value={document}
        onChange={(e) => setDocument(e.target.value)}
      />
      <input
        aria-label="Correction reason"
        placeholder="Correction reason"
        className={inputStyle}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <p role="alert">{error}</p>
      <button
        className={button}
        disabled={save.isPending || reason.trim().length < 10}
        onClick={() => {
          try {
            const value = candidateBriefSchema.parse(JSON.parse(document));
            setError("");
            save.mutate({ collectionId, brief: value, reason });
          } catch {
            setError("The draft must be valid candidate-research JSON.");
          }
        }}
      >
        Save successor revision
      </button>
    </details>
  );
}
