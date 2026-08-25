/**
 * ShareSheet — the choice between sharing a record as a link or as an image.
 *
 * Both options end in the system share sheet, so this is not a second share
 * UI on top of the OS one. It exists because those two shares are genuinely
 * different acts: a link is something you send one person to read, an image is
 * something you post. Collapsing them into one button would mean guessing
 * which the reader meant, and the wrong guess is the one that never gets sent.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { IconName } from "~/components/ui";
import type { ShareSurface } from "~/utils/share";
import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { colors, fontBody, fontEditorial, hair, planes } from "~/styles";
import { shareContentLink, shareContentStory } from "~/utils/share";

export interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  contentId: string;
  contentType: string;
  contentTitle: string;
  surface: ShareSurface;
  accent: string;
  /** Overrides the default heading — the screenshot prompt says its own thing. */
  heading?: string;
  subheading?: string;
}

export function ShareSheet({
  visible,
  onClose,
  contentId,
  contentType,
  contentTitle,
  surface,
  accent,
  heading = "Send this to someone",
  subheading = "They can read the whole brief without installing anything.",
}: ShareSheetProps) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<"link" | "story" | null>(null);

  const target = {
    contentId,
    contentType,
    title: contentTitle,
    surface,
  };

  const run = async (format: "link" | "story") => {
    if (busy) return;
    setBusy(format);
    try {
      const done =
        format === "link"
          ? await shareContentLink(target)
          : await shareContentStory(target);
      if (done) onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={s.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
        <View style={s.grabber} />

        <Text style={s.heading}>{heading}</Text>
        <Text style={s.subheading}>{subheading}</Text>

        <ShareOption
          icon="link"
          label="Share the link"
          hint="Opens a readable page — no app needed"
          accent={accent}
          loading={busy === "link"}
          disabled={busy !== null}
          onPress={() => void run("link")}
          testID="share-link"
        />
        <ShareOption
          icon="image"
          label="Share as an image"
          hint="Sized for a story or a post"
          accent={accent}
          loading={busy === "story"}
          disabled={busy !== null}
          onPress={() => void run("story")}
          testID="share-story"
        />

        <TouchableOpacity
          style={s.cancel}
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={s.cancelText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ShareOption({
  icon,
  label,
  hint,
  accent,
  loading,
  disabled,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  hint: string;
  accent: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      style={[s.option, disabled && !loading ? s.optionDimmed : null]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      testID={testID}
    >
      <View style={[s.optionIcon, { backgroundColor: `${accent}22` }]}>
        {loading ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Icon name={icon} size={19} color={accent} />
        )}
      </View>
      <View style={s.optionCopy}>
        <Text style={s.optionLabel}>{label}</Text>
        <Text style={s.optionHint}>{hint}</Text>
      </View>
      <Icon name="chevR" size={17} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(5,8,20,0.6)" },
  sheet: {
    backgroundColor: planes.slate,
    borderTopWidth: 1,
    borderTopColor: hair[2],
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: hair[3],
    marginBottom: 12,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    color: colors.white,
  },
  subheading: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  optionDimmed: { opacity: 0.5 },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: colors.white,
  },
  optionHint: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
  cancel: { alignItems: "center", paddingVertical: 12, marginTop: 2 },
  cancelText: {
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.textSecondary,
  },
});
