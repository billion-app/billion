import Link from "next/link";

const SAMPLE_ITEMS = [
  {
    type: "BILL",
    color: "#4A7CFF",
    title: "H.R. 1892 — American Infrastructure Reinvestment Act",
    preview:
      "Allocates $480 billion toward highway reconstruction, broadband expansion, and clean energy grid modernization across all 50 states.",
    meta: "Sponsored by Rep. Torres · House Transportation Committee",
    date: "Mar 24, 2026",
  },
  {
    type: "ORDER",
    color: "#6366F1",
    title: "Executive Order 14201 — Reforming Federal AI Procurement",
    preview:
      "Requires all federal agencies to conduct bias audits before deploying AI systems, and establishes the Office of Algorithmic Accountability.",
    meta: "White House · Office of Science and Technology Policy",
    date: "Mar 21, 2026",
  },
  {
    type: "CASE",
    color: "#0891B2",
    title: "Chen v. Department of Education — 9th Circuit",
    preview:
      "Three-judge panel hears arguments on whether student loan servicer data-sharing agreements violate federal privacy statutes.",
    meta: "9th Circuit Court of Appeals · Oral arguments heard",
    date: "Mar 19, 2026",
  },
];

function Badge({ type, color }: { type: string; color: string }) {
  return (
    <span
      className="inline-block rounded-[6px] px-3 py-1 text-[11px] font-medium tracking-[0.6px] text-white uppercase"
      style={{ backgroundColor: color }}
    >
      {type}
    </span>
  );
}

function ContentCard({ item }: { item: (typeof SAMPLE_ITEMS)[number] }) {
  return (
    <article
      className="group relative flex flex-col gap-3 rounded-2xl p-6 transition-transform duration-200 ease-out hover:-translate-y-0.5"
      style={{
        backgroundColor: "#272D3C",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <div
        className="absolute top-0 left-0 h-full w-[3px] rounded-l-2xl opacity-70"
        style={{ backgroundColor: item.color }}
      />
      <Badge type={item.type} color={item.color} />
      <h3
        className="text-[17px] leading-snug font-bold text-white"
        style={{
          fontFamily: "var(--font-inria-serif), 'Times New Roman', serif",
        }}
      >
        {item.title}
      </h3>
      <p
        className="text-[15px] leading-relaxed"
        style={{ color: "rgba(255,255,255,0.72)" }}
      >
        {item.preview}
      </p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[13px]" style={{ color: "#8A8FA0" }}>
          {item.meta}
        </span>
        <span className="text-[13px]" style={{ color: "#8A8FA0" }}>
          {item.date}
        </span>
      </div>
    </article>
  );
}

export default function LandingPage() {
  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: "#0E1530", color: "#FFFFFF" }}
    >
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-8 py-5"
        style={{
          backgroundColor: "rgba(14,21,48,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          className="text-[22px] font-bold tracking-tight text-white"
          style={{ fontFamily: "var(--font-ibm-plex-serif), Georgia, serif" }}
        >
          Billion
        </span>
        <div className="flex items-center gap-6">
          <Link
            href="#how-it-works"
            className="text-[14px] font-medium transition-opacity duration-150 hover:opacity-100"
            style={{
              color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--font-albert-sans)",
            }}
          >
            How it works
          </Link>
          <a
            href="#"
            className="rounded-full px-5 py-2 text-[14px] font-medium text-black transition-opacity duration-150 hover:opacity-90"
            style={{
              backgroundColor: "#FFFFFF",
              fontFamily: "var(--font-albert-sans)",
            }}
          >
            Get early access
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative overflow-hidden px-8 pt-24 pb-28 text-center"
        style={{
          background: "linear-gradient(180deg, #0E1530 0%, #141c3a 100%)",
        }}
      >
        {/* Decorative rule */}
        <div
          className="mx-auto mb-10 h-px w-16"
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
        />

        <p
          className="mb-4 text-[13px] font-medium tracking-[1.4px] uppercase"
          style={{ color: "#8A8FA0", fontFamily: "var(--font-albert-sans)" }}
        >
          Civic intelligence for every American
        </p>

        <h1
          className="mx-auto max-w-3xl text-[clamp(2.6rem,5.5vw,4.2rem)] leading-[1.15] font-bold tracking-[-0.01em] text-white"
          style={{ fontFamily: "var(--font-ibm-plex-serif), Georgia, serif" }}
        >
          Your government, <em>understood.</em>
        </h1>

        <p
          className="mx-auto mt-6 max-w-xl text-[18px] leading-relaxed"
          style={{
            color: "rgba(255,255,255,0.65)",
            fontFamily: "var(--font-albert-sans)",
          }}
        >
          Bills. Executive orders. Court cases. Billion surfaces what your
          government is doing — in plain language, from every angle.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#"
            className="rounded-full px-8 py-3.5 text-[15px] font-medium text-black transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            style={{
              backgroundColor: "#FFFFFF",
              fontFamily: "var(--font-albert-sans)",
            }}
          >
            Download the app
          </a>
          <a
            href="#how-it-works"
            className="text-[15px] font-medium transition-opacity duration-150 hover:opacity-100"
            style={{
              color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--font-albert-sans)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            See how it works
          </a>
        </div>

        <div
          className="mx-auto mt-10 h-px w-16"
          style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
        />
      </section>

      {/* Sample feed */}
      <section className="px-8 pb-24">
        <div className="mx-auto max-w-2xl">
          <p
            className="mb-6 text-[12px] font-medium tracking-[1px] uppercase"
            style={{ color: "#8A8FA0", fontFamily: "var(--font-albert-sans)" }}
          >
            Today's briefing — sample
          </p>
          <div className="flex flex-col gap-4">
            {SAMPLE_ITEMS.map((item) => (
              <ContentCard key={item.title} item={item} />
            ))}
          </div>
          <p
            className="mt-6 text-center text-[14px]"
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "var(--font-albert-sans)",
            }}
          >
            Updated continuously · Every piece links to the original source
          </p>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-t px-8 py-24"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="mx-auto max-w-3xl">
          <h2
            className="mb-16 text-[clamp(1.6rem,3vw,2.2rem)] leading-tight font-bold text-white"
            style={{ fontFamily: "var(--font-ibm-plex-serif), Georgia, serif" }}
          >
            Information that exists.
            <br />
            <em className="opacity-60">Access that hasn't — until now.</em>
          </h2>

          <div className="grid gap-10 sm:grid-cols-3">
            {[
              {
                label: "01",
                heading: "We track the source",
                body: "Bills from Congress.gov. Executive orders from the White House. Federal court filings. All updated the moment they change.",
              },
              {
                label: "02",
                heading: "AI makes it readable",
                body: "Dense legal language becomes plain summaries, explainers, and dual-perspective analysis — with the original always one tap away.",
              },
              {
                label: "03",
                heading: "You stay informed",
                body: "A daily briefing tailored to your interests. No algorithm gaming. No partisan spin. Just what's actually happening.",
              },
            ].map((step) => (
              <div key={step.label} className="flex flex-col gap-3">
                <span
                  className="text-[12px] font-medium tracking-[1px]"
                  style={{
                    color: "#4A7CFF",
                    fontFamily: "var(--font-albert-sans)",
                  }}
                >
                  {step.label}
                </span>
                <h3
                  className="text-[18px] font-bold text-white"
                  style={{
                    fontFamily:
                      "var(--font-inria-serif), 'Times New Roman', serif",
                  }}
                >
                  {step.heading}
                </h3>
                <p
                  className="text-[15px] leading-relaxed"
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "var(--font-albert-sans)",
                  }}
                >
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="border-t px-8 py-28 text-center"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, #0E1530 0%, #272D3C 100%)",
        }}
      >
        <p
          className="mb-3 text-[13px] font-medium tracking-[1.2px] uppercase"
          style={{ color: "#8A8FA0", fontFamily: "var(--font-albert-sans)" }}
        >
          Early access
        </p>
        <h2
          className="mx-auto mb-6 max-w-lg text-[clamp(1.8rem,4vw,2.8rem)] leading-tight font-bold text-white"
          style={{ fontFamily: "var(--font-ibm-plex-serif), Georgia, serif" }}
        >
          A well-informed people.
        </h2>
        <p
          className="mx-auto mb-10 max-w-sm text-[16px] leading-relaxed"
          style={{
            color: "rgba(255,255,255,0.55)",
            fontFamily: "var(--font-albert-sans)",
          }}
        >
          Join the waitlist. We're launching on iOS and Android.
        </p>
        <a
          href="#"
          className="inline-block rounded-full px-10 py-4 text-[15px] font-medium text-black transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
          style={{
            backgroundColor: "#FFFFFF",
            fontFamily: "var(--font-albert-sans)",
          }}
        >
          Join the waitlist
        </a>
      </section>

      {/* Footer */}
      <footer
        className="border-t px-8 py-8"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[15px] font-bold text-white"
            style={{ fontFamily: "var(--font-ibm-plex-serif), Georgia, serif" }}
          >
            Billion
          </span>
          <p
            className="text-[13px]"
            style={{ color: "#8A8FA0", fontFamily: "var(--font-albert-sans)" }}
          >
            © 2026 Billion · All source links preserved
          </p>
        </div>
      </footer>
    </main>
  );
}
