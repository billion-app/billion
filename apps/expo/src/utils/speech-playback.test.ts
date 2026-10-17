import assert from "node:assert/strict";
import test from "node:test";
import type * as ExpoSpeech from "expo-speech";

import { speakChunks } from "./speech-playback";

void test("playback waits for stop, uses a system audio session, and ignores cancelled callbacks", async () => {
  let release!: () => void;
  const stop = new Promise<void>((r) => {
    release = r;
  });
  let current = true;
  const spoken: { text: string; options: ExpoSpeech.SpeechOptions }[] = [];
  const speech = {
    stop: () => stop,
    getAvailableVoicesAsync: () => Promise.resolve([]),
    speak: (text: string, options: ExpoSpeech.SpeechOptions) =>
      spoken.push({ text, options }),
  } as unknown as typeof ExpoSpeech;
  const started: number[] = [];
  let done = false;
  const run = speakChunks(speech, {
    chunks: ["第一段", "第二段"],
    start: 0,
    language: "zh-CN",
    current: () => current,
    onStart: (i) => started.push(i),
    onDone: () => {
      done = true;
    },
    onError: () => assert.fail("unexpected speech error"),
  });
  await Promise.resolve();
  assert.equal(spoken.length, 0);
  release();
  await run;
  const first = spoken[0];
  assert.ok(first);
  assert.equal(first.options.useApplicationAudioSession, false);
  assert.equal(first.options.language, "zh-CN");
  assert.deepEqual(started, []);
  (first.options.onStart as () => void)();
  assert.deepEqual(started, [0]);
  (first.options.onDone as () => void)();
  const second = spoken[1];
  assert.ok(second);
  assert.equal(second.text, "第二段");
  current = false;
  (second.options.onDone as () => void)();
  assert.equal(done, false);
});
void test("native startup failures reach the visible error state", async () => {
  let failed = false;
  const speech = {
    stop: () => Promise.reject(new Error("native failure")),
  } as unknown as typeof ExpoSpeech;
  await speakChunks(speech, {
    chunks: ["text"],
    start: 0,
    language: "en-US",
    current: () => true,
    onStart: () => assert.fail(),
    onDone: () => assert.fail(),
    onError: () => {
      failed = true;
    },
  });
  assert.equal(failed, true);
});
