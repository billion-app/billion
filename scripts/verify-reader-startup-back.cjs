// Exercise the real reader host with a stalled DOM bridge and native navigation boundaries.
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { chromium } = require("@playwright/test");
const req = createRequire(resolve("apps/expo/package.json"));
const { build } = req(
  req.resolve("esbuild", {
    paths: [resolve("node_modules/.pnpm/node_modules")],
  }),
);
(async () => {
  const native = req.resolve("react-native-web");
  const stubs = {
    "react-native": `export * from ${JSON.stringify(native)}; export const Platform={OS:'android'}; export const BackHandler={addEventListener(_event,callback){window.hardwareBack=callback;return{remove(){delete window.hardwareBack}}}};`,
    "react-native-reanimated": `import {View} from ${JSON.stringify(native)};export default {View};export const FadeOut={duration(){return{reduceMotion(){return undefined}}}};export const ReduceMotion={System:0};`,
    "expo-router": `const navigation={setOptions(value){window.gestureEnabled=value.gestureEnabled}};const router={back(){window.routeBack=(window.routeBack||0)+1}};export const useNavigation=()=>navigation;export const useRouter=()=>router;`,
    "@react-native-async-storage/async-storage": `export default {getItem:async()=>'',setItem:async()=>{}}`,
    "~/hooks/useMeasureTranslation": `import {useState} from 'react';export function useMeasureTranslation(){const[language,setLanguage]=useState('en');window.changeLanguage=()=>setLanguage('es');return{language,translation:language==='en'?null:{graph:window.graph,sourceHash:'es'},state:language==='en'?'original':'translated',retry(){}}}`,
    "~/hooks/useAppTranslation": `export const useAppTranslation=()=>({t:key=>key})`,
    "~/hooks/useArticleSpeech": `export const useArticleSpeech=()=>({status:'idle'})`,
    "~/utils/api": `export const queryClient={};export const trpc={}`,
    "~/utils/ballot-lookup": `export const ballotElectionDate=value=>value`,
    "~/utils/measure-speech": `export const graphSpeechChunks=()=>[]`,
    "~/styles": `export const fontBody={regular:'system-ui'};export const DigestPalette={inkOnNight:'#fff',quiet:'#aaa',spark:'#ff0'}`,
    "~/components/ui/NavHeader": `export function NavHeader({onBack}){return <button onClick={onBack}>Back</button>}`,
    "~/components/ui/primitives": `export function PrimaryButton({label,onPress}){return <button onClick={onPress}>{label}</button>}`,
    "./dom/TrillionReader": `import {useEffect,useImperativeHandle} from 'react';export default function Reader({language,onBackState,onReady,ref}){useImperativeHandle(ref,()=>({goBack(){window.readerBack=(window.readerBack||0)+1}}),[]);useEffect(()=>{if(language==='en')void onReady()},[language]);return <button data-testid={'reader-'+language} onClick={()=>void onBackState(true)}>Open question</button>}`,
  };
  const empty = [
    "~/components/ListenBar",
    "~/components/ReaderTools",
    "~/components/ReaderTranslationState",
    "~/components/TranslationNotice",
    "./TrillionLoading",
  ];
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {TrillionScreen} from './src/components/trillion/TrillionScreen';import graph from './src/components/trillion/development/prop40-pilot.json';window.graph=graph;createRoot(document.getElementById('root')).render(<><button onClick={()=>window.changeLanguage()}>Change language</button><TrillionScreen graph={graph}/></>);`,
      resolveDir: resolve("apps/expo"),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    outfile: "/tmp/reader-startup-back.js",
    define: { __DEV__: "false", "process.env.NODE_ENV": '"test"' },
    plugins: [
      {
        name: "native-boundaries",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(stubs, args.path) || empty.includes(args.path)
              ? { path: args.path, namespace: "boundary" }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: "boundary" }, (args) => ({
            contents:
              stubs[args.path] ||
              `export const ${args.path.split("/").pop()}=()=>null;`,
            loader: "tsx",
            resolveDir: resolve("apps/expo"),
          }));
        },
      },
    ],
  });
  const server = createServer((request, response) => {
    if (request.url === "/app.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else response.end('<div id="root"></div><script src="/app.js"></script>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.clock.install();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button", { name: "Open question" }).click();
    await page.waitForFunction(
      () =>
        window.gestureEnabled === false &&
        typeof window.hardwareBack === "function",
    );
    await page.getByRole("button", { name: "Change language" }).click();
    await page.getByTestId("reader-es").waitFor();
    await page.clock.fastForward(15_001);
    await page.getByText("readerAudit.openFailed", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.routeBack),
      1,
      "Back exits the route when the failed reader was removed",
    );
    assert.equal(
      await page.evaluate(() => window.gestureEnabled),
      true,
      "iOS route gesture is released after reader failure",
    );
    assert.equal(
      await page.evaluate(() => typeof window.hardwareBack),
      "undefined",
      "Android Back interception is removed after reader failure",
    );
    console.log(
      "Verified real ReaderHost: deep-question language-change startup failure releases route Back, swipe gesture, and Android interception. DOM bridge/native navigation are simulated boundaries.",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
