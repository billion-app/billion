import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { TrillionScreen } from "~/components/trillion/TrillionScreen";
import { NavHeader } from "~/components/ui";
import { fontBody, DigestPalette as P, sp } from "~/styles";
import { trpc } from "~/utils/api";

/** The Trillion argument graph for one California proposition (#455). */
export default function TrillionRoute() {
  const router = useRouter();
  const { number = "" } = useLocalSearchParams<{ number?: string }>();
  const query = useQuery(
    trpc.civic.getTrillion.queryOptions(
      { number },
      { enabled: /^\d+[A-Z]?$/.test(number) },
    ),
  );
  if (query.data) return <TrillionScreen graph={query.data} />;
  return (
    <View style={s.screen}>
      <NavHeader
        title={`Proposition ${number} · The debate`}
        tone="dark"
        onBack={() => router.back()}
      />
      <View style={s.body}>
        {query.isPending ? (
          <ActivityIndicator color={P.quiet} />
        ) : (
          <>
            <Text style={s.title}>
              {query.isError
                ? "Could not load the debate"
                : "No debate for this proposition yet"}
            </Text>
            <Text style={s.detail}>
              {query.isError
                ? "Check your connection and try again."
                : "Billion only shows a debate once every quote in it matches the current official guide."}
            </Text>
            {query.isError && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void query.refetch()}
                style={s.retry}
              >
                <Text style={s.retryText}>Try again</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  body: { padding: 20, gap: sp[2] },
  title: { fontFamily: fontBody.semibold, fontSize: 17, color: P.inkOnNight },
  detail: { fontFamily: fontBody.regular, fontSize: 14.5, color: P.quiet },
  retry: { alignSelf: "flex-start", paddingVertical: 8 },
  retryText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.linkOnNight,
  },
});
