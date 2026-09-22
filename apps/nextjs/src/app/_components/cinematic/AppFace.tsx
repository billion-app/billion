"use client";

import type { ReactNode } from "react";

import {
  PERSONAL_TOPICS,
  type AppScreenId,
  type PersonalTopicId,
} from "./journey";

const FEED_SRC = "/product-screens/feed.png";
const ELECTION_SRC = "/product-screens/election.png";
const SEARCH_SRC = "/product-screens/search.png";

interface Story {
  kicker: string;
  title: string;
  dek: string;
  meta: string;
}

const FEED_BY_TOPIC: Record<PersonalTopicId, Story[]> = {
  technology: [
    {
      kicker: "COVER · CONGRESS",
      title: "The AI procurement memo is now the product.",
      dek: "Agencies must disclose model use in contracts above a threshold.",
      meta: "H.R. 3935 · House",
    },
    {
      kicker: "COURTS",
      title: "Chip export rules survive a first challenge.",
      dek: "The opinion turns on administrative record, not the politics around it.",
      meta: "D.D.C. · filed Tuesday",
    },
  ],
  defense: [
    {
      kicker: "COVER · PENTAGON",
      title: "A reporting rule for vendors, not a press release.",
      dek: "The requirement travels from executive action into existing programs.",
      meta: "DoD · implementation memo",
    },
    {
      kicker: "CONGRESS",
      title: "Secure America Act clears committee.",
      dek: "The interesting fight is jurisdiction, not the floor speech.",
      meta: "S. 2 · Senate",
    },
  ],
  economy: [
    {
      kicker: "COVER · TREASURY",
      title: "The tax change is in the definition, not the headline.",
      dek: "Pass-through language rewrites who gets the credit next year.",
      meta: "H.R. 7024 · Ways and Means",
    },
    {
      kicker: "FEDERAL",
      title: "A labor rule that actually hits payroll.",
      dek: "Overtime thresholds move. The briefing is the effective date.",
      meta: "DOL · final rule",
    },
  ],
  energy: [
    {
      kicker: "COVER · INTERIOR",
      title: "Permitting is the bill. The rest is costume.",
      dek: "A two-year shot clock on certain reviews, with a judicial venue clause.",
      meta: "H.R. 1 · House",
    },
    {
      kicker: "CALIFORNIA",
      title: "The water question on your ballot.",
      dek: "Bond for pipe upgrades and drought storage, written in English.",
      meta: "Prop 12 · CA SOS",
    },
  ],
  healthcare: [
    {
      kicker: "COVER · HHS",
      title: "A coverage rule that starts at the pharmacy.",
      dek: "The interesting number is the out-of-pocket cap, not the speech.",
      meta: "CMS · final rule",
    },
    {
      kicker: "COURTS",
      title: "A standing fight that decides the policy.",
      dek: "If plaintiffs survive, the rule pauses. If not, it stands.",
      meta: "5th Cir. · argued",
    },
  ],
};

function ScreenChrome({
  children,
  paper = false,
}: {
  children: ReactNode;
  paper?: boolean;
}) {
  return (
    <div className={`phone-face ${paper ? "is-paper" : "is-night"}`}>
      <div className="phone-face-status">
        <span>9:41</span>
        <span className="phone-face-island" />
        <span>LTE</span>
      </div>
      {children}
    </div>
  );
}

function FeedHtml({ topic }: { topic: PersonalTopicId | null }) {
  const stories = FEED_BY_TOPIC[topic ?? "technology"];
  const first = stories[0];
  const second = stories[1];
  return (
    <ScreenChrome>
      <div className="phone-face-home">
        <p className="phone-face-brand">Billion</p>
        <p className="phone-face-kicker">THE DAILY BRIEF</p>
        <p className="phone-face-title">Today’s California news</p>
        {first ? (
          <article className="phone-face-card">
            <p className="phone-face-kicker gold">{first.kicker}</p>
            <p className="phone-face-story">{first.title}</p>
            <p className="phone-face-dek">{first.dek}</p>
            <p className="phone-face-meta">{first.meta}</p>
          </article>
        ) : null}
        {second ? (
          <article className="phone-face-card dim">
            <p className="phone-face-kicker">{second.kicker}</p>
            <p className="phone-face-story">{second.title}</p>
            <p className="phone-face-meta">{second.meta}</p>
          </article>
        ) : null}
      </div>
    </ScreenChrome>
  );
}

function BillScreen({ node }: { node: number }) {
  const briefs = [
    {
      kicker: "Just dropped",
      title: "A two-year clock on aviation reviews.",
      dek: "It’s a proposal. Billion tells you what the shot clock actually binds.",
      card: "Before: open-ended. After: a dated clock.",
    },
    {
      kicker: "The rewrite",
      title: "Committee is where the bill changes.",
      dek: "Transportation and Infrastructure marks it up. That draft is the one that ships.",
      card: "Watch jurisdiction, not the floor speech.",
    },
    {
      kicker: "Out of the House",
      title: "377–31. The easy vote is over.",
      dek: "If you fly, build, or insure, the fight moves to implementation.",
      card: "Senate referral is the next real page.",
    },
    {
      kicker: "It’s law",
      title: "Public Law 118–63.",
      dek: "Agencies have dates now. Billion stays on the memo, not the signing photo.",
      card: "The clock is running.",
    },
  ] as const;
  const brief = briefs[node] ?? briefs[0];
  if (!brief) return null;
  return (
    <ScreenChrome>
      <div className="phone-face-home">
        <p className="phone-face-kicker gold">{brief.kicker}</p>
        <p className="phone-face-title">{brief.title}</p>
        <p className="phone-face-dek">{brief.dek}</p>
        <article className="phone-face-card">
          <p className="phone-face-story">{brief.card}</p>
        </article>
      </div>
    </ScreenChrome>
  );
}

function DetailScreen() {
  return (
    <ScreenChrome>
      <div className="phone-face-home">
        <p className="phone-face-kicker gold">Bill brief</p>
        <p className="phone-face-title">What this actually does.</p>
        <p className="phone-face-dek">
          It sets a two-year shot clock on certain aviation reviews and names
          the court that hears the fights.
        </p>
        <article className="phone-face-card">
          <p className="phone-face-kicker gold">The change</p>
          <p className="phone-face-story">Before: open-ended review.</p>
          <p className="phone-face-story">After: a dated clock.</p>
        </article>
      </div>
    </ScreenChrome>
  );
}

function ElectionScreen() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ELECTION_SRC}
      alt="Billion elections"
      className="phone-face-photo"
    />
  );
}

function CourtScreen() {
  return (
    <ScreenChrome>
      <div className="phone-face-home">
        <p className="phone-face-kicker gold">COURTS</p>
        <p className="phone-face-title">The opinion, in English.</p>
        <article className="phone-face-card">
          <p className="phone-face-kicker">D.D.C.</p>
          <p className="phone-face-story">
            Standing is the whole case. The policy waits.
          </p>
          <p className="phone-face-dek">
            If plaintiffs survive, the rule pauses. If not, it stands.
          </p>
        </article>
      </div>
    </ScreenChrome>
  );
}

function SearchScreen() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SEARCH_SRC}
      alt="Billion browse"
      className="phone-face-photo"
    />
  );
}

export function EditorialFace({
  kicker,
  title,
  dek,
}: {
  kicker: string;
  title: string;
  dek: string;
}) {
  return (
    <ScreenChrome>
      <div className="phone-face-home">
        <p className="phone-face-kicker gold">{kicker}</p>
        <p className="phone-face-title">{title}</p>
        <p className="phone-face-dek">{dek}</p>
      </div>
    </ScreenChrome>
  );
}

export function AppFace({
  screen,
  topic,
  preferPhoto,
  billNode = 0,
}: {
  screen: AppScreenId;
  topic: PersonalTopicId | null;
  preferPhoto?: boolean;
  billNode?: number;
}) {
  if (preferPhoto && screen === "feed" && !topic) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={FEED_SRC}
        alt="Billion home feed"
        className="phone-face-photo"
      />
    );
  }

  if (screen === "bill") return <BillScreen node={billNode} />;
  if (screen === "detail") return <DetailScreen />;
  if (screen === "election") return <ElectionScreen />;
  if (screen === "court") return <CourtScreen />;
  if (screen === "search") return <SearchScreen />;
  if (topic) return <FeedHtml topic={topic} />;
  if (preferPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={FEED_SRC}
        alt="Billion home feed"
        className="phone-face-photo"
      />
    );
  }
  return <FeedHtml topic="technology" />;
}

export function TopicPills({
  active,
  onSelect,
}: {
  active: PersonalTopicId | null;
  onSelect: (id: PersonalTopicId) => void;
}) {
  return (
    <div className="cinematic-topics cinematic-topics-inline">
      {PERSONAL_TOPICS.map((topic) => (
        <button
          key={topic.id}
          type="button"
          className={active === topic.id ? "is-gold" : undefined}
          onClick={() => onSelect(topic.id)}
        >
          {topic.label}
        </button>
      ))}
    </div>
  );
}
