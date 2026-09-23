import type { Metadata } from "next";

import { SavedList } from "./saved-list";

export const metadata: Metadata = {
  title: "Saved — Billion",
  robots: { index: false },
};

export default function SavedPage() {
  return <SavedList />;
}
