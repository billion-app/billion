import Constants from "expo-constants";

export function getAppVersion() {
  return Constants.expoConfig?.version ?? "unknown";
}

export function getAppBuildNumber() {
  const iosBuildNumber = Constants.platform?.ios?.buildNumber;
  if (iosBuildNumber) return iosBuildNumber;

  const androidVersionCode = Constants.platform?.android?.versionCode;
  if (androidVersionCode == null) return null;

  return String(androidVersionCode);
}

export function getAppVersionLabel() {
  const appVersion = getAppVersion();
  const buildNumber = getAppBuildNumber();

  return buildNumber
    ? `Version ${appVersion} (build ${buildNumber})`
    : `Version ${appVersion}`;
}
