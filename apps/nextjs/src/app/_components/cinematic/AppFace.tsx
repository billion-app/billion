"use client";

import type { AppScreenId, PersonalTopicId } from "./journey";
import { PERSONAL_TOPICS } from "./journey";

const FEED_SRC = "/product-screens/feed.png";
const ELECTION_SRC = "/product-screens/election.png";
const SEARCH_SRC = "/product-screens/search.png";
const BROWSE_SRC = "/product-screens/live-browse.png";

function ProductShot({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="phone-face-photo" />
  );
}

/** Phone face is always a real product screenshot — never HTML mocks. */
export function AppFace({
  screen,
}: {
  screen: AppScreenId;
  topic?: PersonalTopicId | null;
  preferPhoto?: boolean;
  billNode?: number;
}) {
  if (screen === "bill" || screen === "detail") {
    return <ProductShot src={BROWSE_SRC} alt="Billion bills" />;
  }
  if (screen === "election") {
    return <ProductShot src={ELECTION_SRC} alt="Billion elections" />;
  }
  if (screen === "search" || screen === "court") {
    return <ProductShot src={SEARCH_SRC} alt="Billion browse" />;
  }
  return <ProductShot src={FEED_SRC} alt="Billion home feed" />;
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
