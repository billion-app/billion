import type { StyleProp, TextStyle } from "react-native";
import { useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { DefinedTextPart, InlineDefinition } from "./defined-text";
import { fontBody, hair, DigestPalette as P, planes } from "~/styles";
import { splitDefinedText } from "./defined-text";

export type { InlineDefinition } from "./defined-text";

/** Inline, keyboard-accessible explanations shared by structured readers. */
export function DefinedText({
  text,
  terms = [],
  emphasis = [],
  accent = P.primary,
  style,
}: {
  text: string;
  terms?: readonly InlineDefinition[];
  emphasis?: readonly string[];
  accent?: string;
  style: StyleProp<TextStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const [selection, setSelection] = useState<{
    term: string;
    text: string;
    index: number;
  } | null>(null);
  const triggers = useRef(new Map<number, Text>());
  const parts = splitDefinedText(text, terms, emphasis);
  const runs: {
    definition?: InlineDefinition;
    parts: DefinedTextPart[];
    index: number;
  }[] = [];
  parts.forEach((part, index) => {
    const previous = runs.at(-1);
    if (previous && previous.definition === part.definition)
      previous.parts.push(part);
    else runs.push({ definition: part.definition, parts: [part], index });
  });
  const renderParts = (chunks: DefinedTextPart[]) =>
    chunks.map((part, index) =>
      part.emphasized ? (
        <Text key={index} style={s.emphasis}>
          {part.text}
        </Text>
      ) : (
        part.text
      ),
    );
  const open =
    selection?.text === text
      ? parts.find((p) => p.definition?.term === selection.term)?.definition
      : undefined;
  const close = () => {
    const trigger = selection && triggers.current.get(selection.index);
    setSelection(null);
    if (!trigger) return;
    requestAnimationFrame(() => {
      if (Platform.OS === "web")
        (trigger as unknown as { focus?: () => void }).focus?.();
      else {
        const handle = findNodeHandle(trigger);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }
    });
  };
  return (
    <View style={s.wrap}>
      <Text key={fontScale} style={style}>
        {runs.map(({ definition: term, parts: chunks, index }) => {
          if (!term) return <Text key={index}>{renderParts(chunks)}</Text>;
          const expanded = open?.term === term.term;
          return (
            <Text
              key={index}
              ref={(node) => {
                if (node) triggers.current.set(index, node);
                else triggers.current.delete(index);
              }}
              style={{ color: P.linkOnNight, textDecorationLine: "underline" }}
              accessibilityRole="button"
              accessibilityLabel={`Define ${term.term}`}
              accessibilityHint="Shows a short definition below this paragraph"
              accessibilityState={{ expanded }}
              aria-expanded={expanded}
              onPress={() => {
                if (expanded) setSelection(null);
                else {
                  setSelection({ term: term.term, text, index });
                  if (Platform.OS !== "web")
                    AccessibilityInfo.announceForAccessibility(
                      `${term.term}. ${term.plain}`,
                    );
                }
              }}
            >
              {renderParts(chunks)}
            </Text>
          );
        })}
      </Text>
      {open && (
        <View
          style={[s.definition, { borderLeftColor: accent }]}
          accessibilityLiveRegion="polite"
          testID="inline-term-definition"
        >
          <View style={s.head}>
            <Text accessibilityRole="header" style={s.term}>
              {open.term}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close definition of ${open.term}`}
              onPress={close}
              style={s.close}
            >
              <Text style={s.closeText}>Close</Text>
            </Pressable>
          </View>
          <Text key={fontScale} style={s.plain}>
            {open.plain}
          </Text>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flexShrink: 1, gap: 8 },
  emphasis: { fontFamily: fontBody.bold },
  definition: {
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[3],
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  term: {
    color: P.linkOnNight,
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 23,
  },
  close: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  closeText: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: P.inkOnNight,
  },
  plain: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
    color: P.inkOnNight,
  },
});
