import { useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { ElectionOfficeLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { BallotLookupView } from "~/components/ballot/BallotLookupView";
import { Card } from "~/components/ui/layout";
import { NavHeader } from "~/components/ui/NavHeader";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { electionsAreLive } from "~/utils/elections-live";

/** Public lookup remains gated pending launch review. */
export default function BallotRoute() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 16,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fontDisplay.bold,
              fontSize: 34,
              lineHeight: 38,
              color: P.inkOnNight,
            }}
          >
            Your ballot
          </Text>
          <Card style={{ padding: 16, gap: 16, borderRadius: 14 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fontEditorial.bold,
                fontSize: 16,
                lineHeight: 19,
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
            <ElectionOfficeLink prominence="primary" />
            <Link href="/" asChild>
              <Pressable
                accessibilityRole="button"
                style={{
                  minHeight: 48,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: P.canvas,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: fontBody.bold,
                    fontSize: 16,
                    color: P.primary,
                  }}
                >
                  Back home
                </Text>
              </Pressable>
            </Link>
          </Card>
        </ScrollView>
      </View>
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
