import type * as ExpoSpeech from "expo-speech";

/** Stop must finish before speaking; iOS otherwise cancels the new utterance. */
export async function speakChunks(
  speech: typeof ExpoSpeech,
  options: {
    chunks: readonly string[];
    start: number;
    language: string;
    current: () => boolean;
    onStart: (index: number) => void;
    onDone: () => void;
    onError: () => void;
  },
) {
  try {
    await speech.stop();
    if (!options.current()) return;
    const voices = await speech.getAvailableVoicesAsync();
    if (!options.current()) return;
    const locale = (language: string) =>
      language.toLowerCase().replaceAll("_", "-");
    const requested = locale(options.language);
    const base = requested.split("-")[0];
    const voice = voices
      .filter((v) => locale(v.language).split("-")[0] === base)
      .sort(
        (a, b) =>
          Number(locale(b.language) === requested) -
            Number(locale(a.language) === requested) ||
          Number(b.quality === speech.VoiceQuality.Enhanced) -
            Number(a.quality === speech.VoiceQuality.Enhanced),
      )[0]?.identifier;
    const next = (index: number) => {
      if (!options.current()) return;
      const text = options.chunks[index];
      if (text === undefined) {
        options.onDone();
        return;
      }
      try {
        speech.speak(text, {
          language: options.language,
          voice,
          // A system-managed speech session avoids the app's ambient/silent session.
          useApplicationAudioSession: false,
          onStart: () => {
            if (options.current()) options.onStart(index);
          },
          onDone: () => next(index + 1),
          onError: () => {
            if (options.current()) options.onError();
          },
        });
      } catch {
        if (options.current()) options.onError();
      }
    };
    next(options.start);
  } catch {
    if (options.current()) options.onError();
  }
}
