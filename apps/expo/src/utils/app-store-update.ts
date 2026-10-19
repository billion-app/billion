function versionParts(version: string | null): number[] | null {
  if (!version || !/^\d{1,5}(?:\.\d{1,5}){0,2}$/.test(version)) return null;
  return version.split(".").map(Number);
}

/** Compare native version components, never OTA config versions or build IDs. */
export function compareVersions(left: string | null, right: string | null) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function shouldShowAppStoreUpdate(input: {
  installedVersion: string | null;
  systemVersion: string;
  release: { version: string; minimumOsVersion: string } | null | undefined;
  dismissedVersion: string | null;
  otaVisible: boolean;
}) {
  const { release } = input;
  if (
    !release ||
    input.otaVisible ||
    input.dismissedVersion === release.version
  )
    return false;
  const osComparison = compareVersions(
    input.systemVersion,
    release.minimumOsVersion,
  );
  return (
    compareVersions(release.version, input.installedVersion) === 1 &&
    osComparison !== null &&
    osComparison >= 0
  );
}
