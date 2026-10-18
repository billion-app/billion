import { Text, View } from "react-native";

import type { CardTranslationState } from "~/utils/card-translation";
import { useLanguage } from "~/hooks/useLanguage";
import { DigestPalette, fontBody } from "~/styles";
import { cardTranslationState } from "~/utils/card-translation";
import { TranslationNotice } from "./TranslationNotice";

export function CardTranslationNotice({
  items,
  onRetry,
  isError = false,
}: {
  items: readonly CardTranslationState[];
  onRetry: () => void;
  isError?: boolean;
}) {
  const { language, t } = useLanguage();
  const state = cardTranslationState(items, language, isError);
  if (state === "original") return null;
  if (state === "translated")
    return (
      <Text
        accessibilityLiveRegion="polite"
        style={{
          marginVertical: 10,
          paddingHorizontal: 16,
          color: DigestPalette.quiet,
          fontFamily: fontBody.regular,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {t("article.translated")} · {t("reader.originalSources")}
      </Text>
    );
  return (
    <View style={{ marginVertical: 12 }}>
      <TranslationNotice state={state} onRetry={onRetry} />
    </View>
  );
}
