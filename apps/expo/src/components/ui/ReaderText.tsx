import type { StyleProp, TextStyle } from "react-native";
import { StyleSheet } from "react-native";

import type { InlineDefinition } from "./DefinedText";
import {
  fontBody,
  BillReaderPalette as R,
  BillReaderType as T,
} from "~/styles";
import { DefinedText } from "./DefinedText";

export function ReaderText({
  text,
  terms = [],
  style,
  emphasize = true,
}: {
  text: string;
  terms?: readonly InlineDefinition[];
  style?: StyleProp<TextStyle>;
  emphasize?: boolean;
}) {
  return (
    <DefinedText
      text={text.replaceAll("**", "")}
      emphasis={
        emphasize
          ? text.split(/\n\s*\n/).flatMap((paragraph) =>
              Array.from(
                paragraph.matchAll(/\*\*([^*]+)\*\*/g),
                (match) => match[1] ?? "",
              )
                .filter(
                  (phrase) =>
                    phrase.length > 0 &&
                    phrase.length <= 48 &&
                    phrase.split(/\s+/).length <= 6,
                )
                .slice(0, 1),
            )
          : []
      }
      emphasisStyle={s.inlineEmphasis}
      termStyle={s.definitionTerm}
      terms={terms.map((term) => ({
        ...term,
        plain: term.plain.replaceAll("**", ""),
      }))}
      accent={R.link}
      style={[s.prose, style]}
    />
  );
}

const s = StyleSheet.create({
  prose: { ...T.body, color: R.reading },
  inlineEmphasis: { fontFamily: fontBody.semibold, color: R.text },
  definitionTerm: {
    color: R.reading,
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor: R.muted,
  },
});
