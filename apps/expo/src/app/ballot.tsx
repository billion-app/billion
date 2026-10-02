import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { BallotLookupGate } from "~/components/ballot/BallotLookupGate";
import { BallotLookupView } from "~/components/ballot/BallotLookupView";
import { trpc } from "~/utils/api";
import { electionsAreLive } from "~/utils/elections-live";

/** Public lookup remains gated pending launch review. */
export default function BallotRoute() {
  const router = useRouter();
  const availability = useQuery({
    ...trpc.civic.getBallotAvailability.queryOptions(),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  if (!electionsAreLive(availability.isError ? undefined : availability.data)) {
    return (
      <BallotLookupGate
        checking={availability.isFetching}
        failed={availability.isError}
        onRetry={() => void availability.refetch()}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
        onHome={() => router.replace("/")}
      />
    );
  }

  return <BallotExperience />;
}

/** Mount directly in controlled tests; the public route always checks launch readiness. */
export function BallotExperience({
  initialAddress = "",
  reuseInitialLookup = false,
}: {
  initialAddress?: string;
  /** A legacy caller already loaded this exact address into the query cache. */
  reuseInitialLookup?: boolean;
}) {
  const [{ address, reuseLookup }, setLookup] = useState({
    address: initialAddress,
    reuseLookup: reuseInitialLookup,
  });
  return (
    <AddressBallot
      key={address}
      address={address}
      onAddress={(address) => setLookup({ address, reuseLookup: false })}
      reuseLookup={reuseLookup}
    />
  );
}

function AddressBallot({
  address,
  onAddress,
  reuseLookup,
}: {
  address: string;
  reuseLookup: boolean;
  onAddress: (address: string) => void;
}) {
  const [electionId, setElectionId] = useState<string>();
  // Base lookup must not wait for enrichment or trigger generation.
  const request = { address, includeEnrichment: false };
  // Discovery is address-specific. Never select from the national election list.
  const discovery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions(request),
    enabled: !!address,
    // Handoff reuses the caller’s result; edits and explicit retries still fetch.
    refetchOnMount: reuseLookup ? false : true,
    retry: false,
  });
  const selection = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ ...request, electionId }),
    enabled: !!address && !!electionId,
    retry: false,
  });
  const query = electionId ? selection : discovery;
  return (
    <BallotLookupView
      address={address}
      onAddress={(next) => {
        if (next === address) void query.refetch();
        else onAddress(next);
      }}
      discovery={discovery.data}
      data={query.isError || query.isFetching ? undefined : query.data}
      settled={query.isSuccess}
      requestedElectionId={electionId}
      loading={!!address && query.isFetching}
      failed={query.isError}
      onRetry={() => {
        void query.refetch();
      }}
      onElection={setElectionId}
    />
  );
}
