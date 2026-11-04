import type { ReactNode } from "react";
import { useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "~/hooks/useLanguage";
import {
  DigestHair,
  BillReaderPalette as R,
  BillReaderType as T,
} from "~/styles";
import { Icon } from "./Icon";

/** A short reading detour, separate from the article's scrolling layout. */
export function ReaderPopup({
  title,
  children,
  actions,
  onClose,
  testID,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  testID?: string;
}) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const heading = useRef<Text>(null);
  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? "none" : "fade"}
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={() => {
        if (Platform.OS === "web") return;
        const node = findNodeHandle(heading.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }}
    >
      <View
        style={[
          s.stage,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          style={[
            s.window,
            { maxHeight: height - insets.top - insets.bottom - 48 },
          ]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          testID={testID}
        >
          {actions ? <View style={s.actions}>{actions}</View> : null}
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text ref={heading} style={s.title} accessibilityRole="header">
              {title}
            </Text>
            {children}
          </ScrollView>
          <Pressable
            style={s.close}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("readerUi.close")}
            testID={testID ? `${testID}-close` : undefined}
          >
            <Icon name="close" size={20} color={R.text} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: DigestHair.menuScrim,
  },
  window: {
    width: "100%",
    maxWidth: 480,
    flexShrink: 1,
    borderRadius: 20,
    backgroundColor: R.canvas,
    borderColor: R.rule,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  title: { ...T.body, color: R.text, paddingRight: 44, paddingBottom: 4 },
  close: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: R.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  actions: {
    paddingLeft: 24,
    paddingRight: 64,
    paddingTop: 12,
    paddingBottom: 4,
  },
  content: { padding: 24, gap: 12 },
});
