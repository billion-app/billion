// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const projectRoot = __dirname;
const config = withNativewind(getDefaultConfig(projectRoot));

/**
 * NativeWind (react-native-css) remaps `react-native` and
 * `react-native-safe-area-context` onto interceptor modules. Those interceptors
 * then require the original packages and are supposed to skip the remap via a
 * path-prefix check. pnpm's symlink layout makes the prefix miss, so:
 *   - require("react-native") loops until Hermes blows the stack
 *     (DeviceEventEmitter getter in index.cjs)
 *   - require("react-native-safe-area-context") re-exports an empty module
 *     (useSafeAreaInsets is undefined)
 *
 * Requests for those two packages that originate inside react-native-css skip
 * the rewrite and hit Metro's default resolver. Everything else still goes
 * through NativeWind so its metro-override setup probe keeps working.
 */
const nativewindResolve = config.resolver.resolveRequest;
const cssPassthrough = new Set(["react-native", "react-native-safe-area-context"]);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const from = context.originModulePath ?? "";
  const fromCss =
    from.includes("/react-native-css/") || from.includes("\\react-native-css\\");
  // Must still call NativeWind for everything else — it injects a setup
  // probe (`react-native-css-metro-override`) that Metro's default resolver
  // cannot see.
  if (fromCss && cssPassthrough.has(moduleName)) {
    return context.resolveRequest(context, moduleName, platform);
  }
  if (typeof nativewindResolve === "function") {
    return nativewindResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

/** @type {import('expo/metro-config').MetroConfig} */
module.exports = config;
