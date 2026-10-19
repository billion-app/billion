/**
 * Reads an article aloud with the phone's own speech engine (`expo-speech`):
 * on-device voices, no network, no cost.
 *
 * Text arrives pre-split by `buildSpeechChunks`; each chunk is spoken in turn
 * and `onDone` advances to the next. Pause is stop-and-remember rather than
 * the engine's pause, which Android does not support, so both platforms
 * behave the same and resume from the start of the current chunk.
 *
 * `expo-speech` is a native module. Builds made before it was added do not
 * contain it, and importing it there throws, so it is required lazily and the
 * feature reports itself unavailable instead.
 */
import type * as ExpoSpeech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";

import type { AppLanguage } from "~/i18n/language";
import { posthog } from "~/config/posthog";
import { speechLanguageTag } from "~/i18n/language";
import { speakChunks } from "~/utils/speech-playback";

type SpeechModule = typeof ExpoSpeech;

let speechModule: SpeechModule | null | undefined;

function loadSpeech(): SpeechModule | null {
  if (speechModule !== undefined) return speechModule;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => unknown;
    };
    speechModule = requireOptionalNativeModule("ExpoSpeech")
      ? (require("expo-speech") as SpeechModule)
      : null;
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    speechModule = null;
  }
  return speechModule;
}

export type SpeechStatus = "idle" | "playing" | "paused";

export function useArticleSpeech(options: {
  chunks: string[];
  language: AppLanguage;
  contentId?: string;
  mode: "explainer" | "opinions" | "source";
}) {
  const { chunks, language, contentId, mode } = options;
  const focused = useIsFocused();
  const available = loadSpeech() !== null;
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);

  // Every stop bumps the session so a late `onDone` from the previous chunk
  // cannot restart playback.
  const session = useRef(0);
  const chunksRef = useRef(chunks);
  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);
  const indexRef = useRef(0);

  const halt = useCallback(() => {
    session.current += 1;
    void loadSpeech()
      ?.stop()
      .catch(() => undefined);
  }, []);

  const speakFrom = useCallback(
    async (start: number) => {
      const speech = loadSpeech();
      if (!speech) return;
      session.current += 1;
      const mine = session.current;
      setError(false);
      await speakChunks(speech, {
        chunks: chunksRef.current,
        start,
        language: speechLanguageTag(language),
        current: () => mine === session.current,
        onStart: (i) => {
          indexRef.current = i;
          setIndex(i);
          setStatus("playing");
        },
        onDone: () => {
          indexRef.current = 0;
          setIndex(0);
          setStatus("idle");
        },
        onError: () => {
          setError(true);
          setStatus("idle");
        },
      });
    },
    [language],
  );

  const play = useCallback(() => {
    posthog.capture("article_listen_started", {
      content_id: contentId ?? null,
      language,
      parts: chunksRef.current.length,
    });
    void speakFrom(0);
  }, [contentId, language, speakFrom]);

  const pause = useCallback(() => {
    halt();
    setStatus("paused");
  }, [halt]);

  const resume = useCallback(() => {
    void speakFrom(indexRef.current);
  }, [speakFrom]);

  const stop = useCallback(() => {
    halt();
    indexRef.current = 0;
    setIndex(0);
    setStatus("idle");
  }, [halt]);

  useEffect(() => {
    if (focused) return stop;
  }, [focused, contentId, mode, language, chunks, stop]);

  return {
    available: available && chunks.length > 0,
    status,
    error,
    index,
    total: chunks.length,
    play,
    pause,
    resume,
    stop,
  };
}
