import type { Metadata } from "next";
import Link from "next/link";

import { getLocalCities } from "./local-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "City decisions — Billion",
  description:
    "Upcoming and recent decisions from official city meeting agendas.",
  alternates: { canonical: "/local" },
};

export default async function LocalPage() {
  const cities = await getLocalCities();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-8">
      <p className="text-spark text-xs font-bold tracking-widest uppercase">
        City hall
      </p>
      <h1 className="font-display mt-3 text-4xl font-bold">
        Decisions close to home
      </h1>
      <p className="text-ink-night mt-4 leading-relaxed">
        Follow the official record from a published agenda to a recorded
        outcome. Original titles and documents stay as the city published them.
      </p>
      <div className="mt-8 grid gap-4">
        {cities.map((city) => (
          <Link
            key={city.key}
            href={`/local/${city.key}`}
            className="border-chrome bg-slate hover:border-spark rounded-2xl border p-6 no-underline"
          >
            <h2 className="font-display text-2xl font-bold">{city.name}</h2>
            <p className="text-ink-night mt-2">
              Upcoming and recent decisions →
            </p>
          </Link>
        ))}
        {cities.length === 0 && (
          <p className="text-ink-night">
            City agendas are not available yet. Please check back.
          </p>
        )}
      </div>
      <p className="text-ink-night mt-8 text-sm">
        Coverage is for the listed cities. City of Santa Clara records are
        separate from Santa Clara County.
      </p>
    </main>
  );
}
