import { useState } from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { BallotLookupView } from "~/components/ballot/BallotLookupView";
import { DigestPalette as P } from "~/styles";
import { trpc } from "~/utils/api";
import { electionsAreLive } from "~/utils/elections-live";

/** Dedicated route; the Elections tab remains parked pending launch review. */
export default function BallotRoute() {
  if (!electionsAreLive()) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          gap: 16,
          backgroundColor: P.canvas,
        }}
      >
        <Text style={{ color: P.inkOnNight, fontSize: 22 }}>
          Ballot lookup is coming soon
        </Text>
        <Text style={{ color: P.inkOnNight }}>
          We’re checking election coverage before making this lookup available.
        </Text>
        <Link href="/" style={{ color: P.spark }}>
          Back to home
        </Link>
      </View>
    );
  }
  return <BallotExperience />;
}

/** Mount directly in controlled tests; the public route always checks launch readiness. */
export function BallotExperience() {
  const [address, setAddress] = useState("");
  return (
    <AddressBallot key={address} address={address} onAddress={setAddress} />
  );
}

function AddressBallot({
  address,
  onAddress,
}: {
  address: string;
  onAddress: (address: string) => void;
}) {
  const [electionId, setElectionId] = useState<string>();
  // Base lookup must not wait for enrichment or trigger generation.
  const request = { address, includeEnrichment: false };
  // Discovery is address-specific. Never select from the national election list.
  const discovery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions(request),
    enabled: !!address,
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
