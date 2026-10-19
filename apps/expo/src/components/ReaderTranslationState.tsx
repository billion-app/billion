import { ScrollView, StyleSheet, View } from "react-native";

import { NavHeader } from "~/components/ui/NavHeader";
import { DigestPalette as P } from "~/styles";
import { TranslationNotice } from "./TranslationNotice";

/** Keep the requested record and Back visible without exposing untranslated prose. */
export function ReaderTranslationState({
  title,
  state,
  onBack,
  onRetry,
}: {
  title: string;
  state: "pending" | "unavailable" | "delayed";
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <View style={s.screen}>
      <NavHeader title={title} onBack={onBack} />
      <ScrollView contentContainerStyle={s.content}>
        <TranslationNotice state={state} onRetry={onRetry} hideEnglish />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.night },
  content: { padding: 16, width: "100%", maxWidth: 720, alignSelf: "center" },
});
