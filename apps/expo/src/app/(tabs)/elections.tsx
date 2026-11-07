import { useRouter } from "expo-router";

import { CaliforniaGuidePreview } from "~/components/ballot/CaliforniaGuidePreview";

export default function ElectionsScreen() {
  const router = useRouter();
  return <CaliforniaGuidePreview onOpenBallot={() => router.push("/ballot")} />;
}
