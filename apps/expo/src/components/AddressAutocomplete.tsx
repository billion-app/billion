import { useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { AppTranslate } from "~/i18n/app-strings";
import { PinMark } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  deviceLocationMessage,
  useDeviceAddress,
} from "~/hooks/useDeviceAddress";
import { DigestHair, DigestPalette, fontBody } from "~/styles";

type LocationError = ReturnType<typeof useDeviceAddress>["error"];

/**
 * What the address is for. Ballot lookups need the registered voting address;
 * the news menus only need somewhere to center local coverage, so their
 * fallback copy must not tell people to find their registration.
 */
export type AddressPurpose = "voting" | "news";

interface AddressAutocompleteProps {
  /** Initial text to seed the field (e.g. the currently stored address). */
  initialValue?: string;
  /** Commit the address after the voter confirms it. */
  onSubmit: (address: string) => void;
  /** Leave without committing. Renders a visible Cancel action when set. */
  onCancel?: () => void;
  /**
   * Optional field hint. Pass `null` to hide — Elections empty state carries
   * the editorial lead elsewhere so we don't repeat "enter your address".
   * Omit for the default one-liner.
   */
  hint?: string | null;
  autoFocus?: boolean;
  /** Menu/sheet field: compact type, Save, and Cancel. No Look Up chrome. */
  inline?: boolean;
  /** Label for the full-size commit button. Defaults to "Look Up". */
  submitLabel?: string;
  /** Defaults to `news` for inline menus and `voting` for the full field. */
  purpose?: AddressPurpose;
}

function newsLocationMessage(
  error: LocationError,
  t: AppTranslate,
): string | null {
  switch (error) {
    case "denied":
      return t("address.news.denied");
    case "unavailable":
      return t("address.news.unavailable");
    case "failed":
      return t("address.news.failed");
    case "address-unavailable":
      return t("address.news.noStreetAddress");
    default:
      return null;
  }
}

export function AddressAutocomplete({
  initialValue = "",
  onSubmit,
  onCancel,
  hint: hintProp,
  autoFocus = true,
  inline = false,
  submitLabel,
  purpose = inline ? "news" : "voting",
}: AddressAutocompleteProps) {
  const { t } = useAppTranslation();
  const hint = hintProp === undefined ? t("address.defaultHint") : hintProp;
  const [input, setInput] = useState(initialValue);
  // Set when device location wrote the draft; cleared once the person edits.
  const [suggested, setSuggested] = useState(false);
  const {
    resolve: resolveAddress,
    cancel: cancelLocation,
    locating,
    resolving,
    error: locationError,
  } = useDeviceAddress();
  const busy = locating || resolving;
  const draft = input.trim();
  const commitLabel = inline
    ? t("common.save")
    : (submitLabel ?? t("address.lookUp"));

  const commit = () => {
    if (!draft) return;
    cancelLocation();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSuggested(false);
    setInput(draft);
    onSubmit(draft);
  };

  const edit = (value: string) => {
    cancelLocation();
    setSuggested(false);
    setInput(value);
  };

  // Location only fills the draft. The person still reviews and commits it.
  const captureLocation = async () => {
    setSuggested(false);
    const address = await resolveAddress();
    if (!address) return;
    setInput(address);
    setSuggested(true);
  };

  const cancel = () => {
    cancelLocation();
    onCancel?.();
  };

  const errorMessage =
    purpose === "news"
      ? newsLocationMessage(locationError, t)
      : deviceLocationMessage(locationError, t);
  const statusMessage = locating
    ? t("address.finding")
    : resolving
      ? t("address.confirming")
      : suggested
        ? t("address.checkDraft", { action: commitLabel })
        : null;
  const locationStatus = errorMessage ? (
    <Text accessibilityRole="alert" style={s.statusText}>
      {errorMessage}
    </Text>
  ) : statusMessage ? (
    <Text accessibilityLiveRegion="polite" style={s.statusText}>
      {statusMessage}
    </Text>
  ) : null;

  const gpsButton = (
    <TouchableOpacity
      style={[s.gpsBtn, busy && s.gpsBtnBusy]}
      disabled={busy}
      onPress={() => void captureLocation()}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t("address.useLocation")}
      accessibilityState={{ disabled: busy, busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={DigestPalette.spark} />
      ) : (
        <PinMark size={14} color={DigestPalette.spark} />
      )}
      <Text style={s.gpsText}>{t("address.useLocation")}</Text>
    </TouchableOpacity>
  );

  const cancelButton = onCancel ? (
    <TouchableOpacity
      style={s.cancelBtn}
      onPress={cancel}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t("common.cancel")}
    >
      <Text style={s.cancelText}>{t("common.cancel")}</Text>
    </TouchableOpacity>
  ) : null;

  if (inline) {
    return (
      <View>
        <TextInput
          style={s.inputInline}
          placeholder={t("address.placeholder")}
          accessibilityLabel={t("address.placeholder")}
          placeholderTextColor={DigestPalette.quiet}
          value={input}
          onChangeText={edit}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={commit}
        />
        <View style={s.inlineGps}>{gpsButton}</View>
        {locationStatus}
        <View style={s.inlineActions}>
          {cancelButton}
          <TouchableOpacity
            style={[s.saveBtn, !draft && s.btnOff]}
            disabled={!draft}
            onPress={commit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !draft }}
          >
            <Text style={s.saveText}>{commitLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <View style={s.row}>
        <View style={s.field}>
          <View style={s.pin}>
            <PinMark size={18} color={DigestPalette.spark} />
          </View>
          <TextInput
            style={s.input}
            placeholder={t("address.registeredPlaceholder")}
            accessibilityLabel={t("address.registeredPlaceholder")}
            placeholderTextColor={DigestHair.inkMuted}
            value={input}
            onChangeText={edit}
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            autoFocus={autoFocus}
            returnKeyType="done"
            onSubmitEditing={commit}
          />
        </View>
        <TouchableOpacity
          style={[s.btn, !draft && s.btnOff]}
          disabled={!draft}
          accessibilityRole="button"
          accessibilityState={{ disabled: !draft }}
          onPress={commit}
        >
          <Text style={s.btnText}>{commitLabel}</Text>
        </TouchableOpacity>
      </View>

      {!!draft && (
        <Text testID="address-draft" selectable style={s.statusText}>
          {draft}
        </Text>
      )}
      <View style={s.secondaryRow}>
        {gpsButton}
        {cancelButton}
      </View>
      {locationStatus}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginTop: 12,
  },
  inputInline: {
    height: 40,
    paddingHorizontal: 10,
    color: DigestPalette.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 15,
  },
  inlineActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  saveBtn: {
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 9999,
    backgroundColor: DigestPalette.primary,
    justifyContent: "center",
  },
  saveText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
  },
  cancelBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.spark,
  },
  hint: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: DigestPalette.quiet,
    marginBottom: 12,
    lineHeight: 19,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  field: { flex: 1, position: "relative" },
  pin: { position: "absolute", left: 18, top: 19, zIndex: 1 },
  input: {
    height: 56,
    backgroundColor: DigestPalette.paper,
    borderRadius: 28,
    paddingLeft: 46,
    paddingRight: 16,
    color: DigestPalette.ink,
    fontFamily: fontBody.medium,
    fontSize: 17,
  },
  btn: {
    backgroundColor: DigestPalette.primary,
    borderRadius: 9999,
    height: 56,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  btnOff: { opacity: 0.5 },
  btnText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: DigestPalette.inkOnNight,
  },
  secondaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  inlineGps: { marginTop: 10 },
  gpsBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.stone,
  },
  gpsBtnBusy: { opacity: 0.7 },
  gpsText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
  },
  statusText: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: DigestPalette.inkOnNight,
    marginTop: 8,
    lineHeight: 17,
  },
});
