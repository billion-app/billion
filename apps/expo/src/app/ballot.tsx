import { useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { BallotLookupView } from "~/components/ballot/BallotLookupView";
import { NavHeader } from "~/components/ui/NavHeader";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { electionsAreLive } from "~/utils/elections-live";

/** Dedicated route; the Elections tab remains parked pending launch review. */
export default function BallotRoute() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  if (!electionsAreLive()) {
    return (
      <View style={{ flex: 1, backgroundColor: P.canvas }}>
        <NavHeader
          key={fontScale}
          title=""
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
        <View style={{ margin: 24, gap: 20 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fontDisplay.bold,
              fontSize: 34,
              lineHeight: 40,
              color: P.inkOnNight,
            }}
          >
            Your ballot
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fontEditorial.bold,
              fontSize: 24,
              lineHeight: 30,
              color: P.inkOnNight,
            }}
          >
            Ballot lookup is coming soon
          </Text>
          <Text
            style={{
              fontFamily: fontBody.regular,
              fontSize: 16,
              lineHeight: 24,
              color: P.inkOnNight,
            }}
          >
            We’re checking election coverage before opening this lookup.
          </Text>
          <Link href="/" asChild>
            <Pressable
              accessibilityRole="button"
              style={{
                minHeight: 48,
                padding: 12,
                borderRadius: 12,
                backgroundColor: P.inkOnNight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: fontBody.bold,
                  fontSize: 16,
                  color: P.canvas,
                }}
              >
                Back home
              </Text>
            </Pressable>
          </Link>
        </View>
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
