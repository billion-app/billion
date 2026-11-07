import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { CaliforniaGuidePreview } from "~/components/ballot/CaliforniaGuidePreview";
import { trpc } from "~/utils/api";
import { electionsAreLive } from "~/utils/elections-live";

export default function ElectionsScreen() {
  const router = useRouter();
  const availability = useQuery({
    ...trpc.civic.getBallotAvailability.queryOptions(),
    retry: false,
  });
  const ballotLive = electionsAreLive(
    availability.isError ? undefined : availability.data,
  );
  return (
    <CaliforniaGuidePreview
      onOpenBallot={ballotLive ? () => router.push("/ballot") : undefined}
    />
  );
}
