import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { webUrl } from "~/components/ballot-evidence/model";
import { Text } from "~/components/Themed";
import { fontEditorial, hair, DigestPalette as P, planes } from "~/styles";

export function candidateInitials(name: string) {
  const words = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase();
}

export function CandidatePortrait({
  name,
  photoUrl,
  size = 48,
  label,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
  /** Accessibility label for a loaded portrait; omit when adjacent text names the person. */
  label?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const height = Math.round(size * 1.15);
  const frame = { width: size, height, borderRadius: Math.round(size / 5) };
  const uri = webUrl(photoUrl);
  if (uri && failed !== uri)
    return (
      <Image
        source={{ uri }}
        style={[s.photo, frame]}
        onError={() => setFailed(uri)}
        accessible={!!label}
        accessibilityLabel={label}
      />
    );
  return (
    <View style={[s.fallback, frame]} aria-hidden>
      <Text style={[s.initials, { fontSize: Math.round(size * 0.38) }]}>
        {candidateInitials(name)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  photo: { backgroundColor: planes.surface },
  fallback: {
    backgroundColor: planes.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hair[3],
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontFamily: fontEditorial.bold, color: P.inkOnNight },
});
