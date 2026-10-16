import { AuthShowcase } from "~/app/_components/auth-showcase";
import { getSession } from "~/auth/server";
import { Workbench } from "./workbench";

export default async function CandidateResearchEditorPage() {
  const session = await getSession();
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-3 font-serif text-3xl">Candidate research review</h1>
      <p className="mb-8">
        Collected sources and unpublished drafts. Public readers receive only an
        independently approved complete race.
      </p>
      {session ? <Workbench /> : <AuthShowcase />}
    </main>
  );
}
