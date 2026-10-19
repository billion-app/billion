import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeOut, ReduceMotion } from "react-native-reanimated";
import { useNavigation, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PublicTrillionGraph } from "@acme/validators";

import type { TrillionReaderHandle } from "./dom/TrillionReader";
import { ListenBar } from "~/components/ListenBar";
import { ReaderTools } from "~/components/ReaderTools";
import { ReaderTranslationState } from "~/components/ReaderTranslationState";
import { TranslationNotice } from "~/components/TranslationNotice";
import { NavHeader } from "~/components/ui/NavHeader";
import { PrimaryButton } from "~/components/ui/primitives";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useArticleSpeech } from "~/hooks/useArticleSpeech";
import { useMeasureTranslation } from "~/hooks/useMeasureTranslation";
import { fontBody, DigestPalette as P } from "~/styles";
import { queryClient, trpc } from "~/utils/api";
import { ballotElectionDate } from "~/utils/ballot-lookup";
import { graphSpeechChunks } from "~/utils/measure-speech";
import TrillionReader from "./dom/TrillionReader";
import { TrillionLoading } from "./TrillionLoading";

/** Native navigation stays above the embedded reading surface. */
interface TrillionScreenProps {
  graph: PublicTrillionGraph;
  view?: "list" | "map";
  ballot?: string[];
}

export function TrillionScreen(props: TrillionScreenProps) {
  return (
    <ReaderHost
      key={`${props.graph.electionDate}.${props.graph.measure.number}`}
      {...props}
    />
  );
}

function ReaderHost({ graph, view, ballot }: TrillionScreenProps) {
  const { t: tx } = useAppTranslation();
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const translation = useMeasureTranslation(
    graph.measure.number,
    graph.revision,
  );
  const waitingForTranslation =
    translation.language !== "en" && !translation.translation?.graph;
  const displayedGraph = translation.translation?.graph ?? graph;
  const spokenLanguage = translation.translation ? translation.language : "en";
  const contentKey = `${graph.revision}:${spokenLanguage}:${translation.translation?.sourceHash ?? "original"}`;
  const ready = readyKey === contentKey;
  const startupFailed = failedKey === contentKey;
  const chunks = useMemo(
    () =>
      waitingForTranslation
        ? []
        : graphSpeechChunks(displayedGraph, spokenLanguage),
    [displayedGraph, spokenLanguage, waitingForTranslation],
  );
  const speech = useArticleSpeech({
    chunks,
    language: spokenLanguage,
    mode: "explainer",
    contentId: `${graph.electionDate}:${graph.measure.number}`,
  });
  const router = useRouter();
  const navigation = useNavigation();
  const storageKey = `billion.trillion.${graph.electionDate}.${graph.measure.number}`;
  const [stored, setStored] = useState<{ key: string; value: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(
      (value) => {
        if (active) setStored({ key: storageKey, value: value ?? "" });
      },
      () => {
        if (active) setStored({ key: storageKey, value: "" });
      },
    );
    return () => {
      active = false;
    };
  }, [storageKey]);
  const reader = useRef<TrillionReaderHandle>(null);
  // Back stays inside the reader below the main case or with a sheet or the full map open.
  // Then the edge swipe and Android's back action step back like the reader's back button,
  // instead of the stack leaving the whole debate.
  const [backInside, setBackInside] = useState(false);
  const handleBackInside = backInside && !startupFailed;
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !handleBackInside });
  }, [navigation, handleBackInside]);
  useEffect(() => {
    if (!handleBackInside || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!reader.current) return false;
        reader.current.goBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [handleBackInside]);
  useEffect(() => {
    if (ready || waitingForTranslation) return;
    const timer = setTimeout(() => setFailedKey(contentKey), 15_000);
    return () => clearTimeout(timer);
  }, [ready, contentKey, waitingForTranslation, attempt]);
  const title = tx("Proposition {value1} · The debate", {
    value1: graph.measure.number,
  });
  const goBack = () => {
    if (handleBackInside && reader.current) reader.current.goBack();
    else router.back();
  };
  return (
    <View style={s.screen}>
      {!waitingForTranslation && (
        <NavHeader
          title={title}
          onBack={goBack}
          action={
            <ReaderTools
              inline
              showLanguage={false}
              showNotice={false}
              speech={speech}
              state={translation.state}
              onRetry={translation.retry}
            />
          }
        />
      )}
      {!waitingForTranslation && (
        <Text style={s.context}>
          {tx("California · {value1}", {
            value1: ballotElectionDate(
              graph.electionDate,
              translation.language,
            ),
          })}
        </Text>
      )}
      {translation.state === "translated" && !waitingForTranslation && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TranslationNotice state="translated" onRetry={translation.retry} />
        </View>
      )}
      <View style={[s.web, waitingForTranslation && s.hidden]}>
        <View
          style={[s.web, startupFailed && s.hidden]}
          accessibilityElementsHidden={!ready || waitingForTranslation}
          importantForAccessibility={
            ready && !waitingForTranslation ? "auto" : "no-hide-descendants"
          }
          pointerEvents={ready ? "auto" : "none"}
        >
          {!startupFailed &&
            (readyKey !== null || !waitingForTranslation) &&
            stored?.key === storageKey && (
              <TrillionReader
                key={`${storageKey}.${attempt}`}
                externalHeader
                localState={stored.value}
                onReady={() => Promise.resolve(setReadyKey(contentKey))}
                onLocalState={async (value) => {
                  await AsyncStorage.setItem(storageKey, value);
                }}
                ref={reader}
                graph={displayedGraph}
                language={spokenLanguage}
                translationKey={
                  translation.translation?.sourceHash
                    ? `${translation.language}:${translation.translation.sourceHash}`
                    : "en"
                }
                view={view}
                ballot={ballot}
                onExit={() => Promise.resolve(router.back())}
                onOpenUrl={async (url) => {
                  await Linking.openURL(url);
                }}
                onOpenMeasure={(number) => {
                  void queryClient.prefetchQuery(
                    trpc.civic.getTrillion.queryOptions({ number }),
                  );
                  router.push({
                    pathname: "/proposition-detail",
                    params: { number },
                  });
                  return Promise.resolve();
                }}
                onBackState={(inside) => Promise.resolve(setBackInside(inside))}
                dom={{
                  style: s.web,
                  // The DOM document paints before reader.css arrives with its bundle.
                  injectedJavaScriptBeforeContentLoaded: `
              document.documentElement.style.backgroundColor = '#0E1530';
              document.documentElement.style.colorScheme = 'dark';
              true;
            `,
                  bounces: false,
                  contentInsetAdjustmentBehavior: "never",
                }}
              />
            )}
        </View>
        {startupFailed ? (
          <View style={s.failure}>
            <Text
              style={{
                color: P.inkOnNight,
                fontSize: 16,
                lineHeight: 24,
                marginBottom: 16,
              }}
            >
              {tx("readerAudit.openFailed")}
            </Text>
            <PrimaryButton
              label={tx("common.retry")}
              onPress={() => {
                setFailedKey(null);
                setReadyKey(null);
                setAttempt((value) => value + 1);
              }}
            />
          </View>
        ) : (
          !ready && (
            <Animated.View
              style={StyleSheet.absoluteFill}
              exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
            >
              <TrillionLoading
                showHeader={false}
                number={graph.measure.number}
                electionDate={graph.electionDate}
                notice={graph.verification.state !== "verified"}
                onBack={() => router.back()}
              />
            </Animated.View>
          )
        )}
      </View>
      {waitingForTranslation && (
        <ReaderTranslationState
          title={title}
          state={
            translation.state === "delayed"
              ? "delayed"
              : translation.state === "unavailable" ||
                  translation.state === "translated"
                ? "unavailable"
                : "pending"
          }
          onRetry={translation.retry}
          onBack={goBack}
        />
      )}

      <ListenBar
        status={speech.status}
        index={speech.index}
        total={speech.total}
        accent={P.spark}
        onPause={speech.pause}
        onResume={speech.resume}
        onStop={speech.stop}
      />
    </View>
  );
}

const s = StyleSheet.create({
  // The reader's navy, so the safe area and the web view read as one surface.
  screen: { flex: 1, backgroundColor: "#0E1530" },
  context: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
    color: P.quiet,
  },
  failure: { flex: 1, justifyContent: "center", padding: 24 },
  hidden: { display: "none" },
  web: { flex: 1, backgroundColor: "#0E1530" },
});
