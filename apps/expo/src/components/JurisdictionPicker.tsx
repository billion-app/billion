import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ContentJurisdiction } from "~/utils/jurisdiction";
import type { LocalJurisdictionKey } from "~/utils/local-government";
import { AddressAutocomplete } from "~/components/AddressAutocomplete";
import { DecisionSeal } from "~/components/digest/CraftMarks";
import { GoldFoilText } from "~/components/GoldBillionMark";
import { Text } from "~/components/Themed";
import { Icon, Kicker } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestShadow,
  DigestSpace,
  fontBody,
  fontDisplay,
} from "~/styles";
import {
  jurisdictionFromAddress,
  JURISDICTIONS,
  jurisdictionText,
  SUPPORTED_STATE_JURISDICTIONS,
} from "~/utils/jurisdiction";
import {
  detectJurisdictionKey,
  LOCAL_JURISDICTIONS,
  localJurisdictionsInState,
  localJurisdictionText,
} from "~/utils/local-government";

export function JurisdictionScopeRow({
  jurisdiction,
  onPress,
}: {
  jurisdiction: ContentJurisdiction;
  onPress: () => void;
}) {
  const { language, t } = useAppTranslation();
  const item = jurisdictionText(jurisdiction, language);
  return (
    <TouchableOpacity
      style={s.scope}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={t("jurisdictionPicker.scopeA11y", {
        body: item.body,
      })}
      testID="jurisdiction-scope"
    >
      <GoldFoilText text={item.name} style={s.scopeBody} />
      <Icon name="chevD" size={12} color={DigestPalette.quiet} />
    </TouchableOpacity>
  );
}

export function JurisdictionPicker({
  visible,
  selected,
  address,
  onSelect,
  onClose,
  onSaveAddress,
  onClearAddress,
  onOpenLocal,
}: {
  visible: boolean;
  selected: ContentJurisdiction;
  address: string | null;
  onSelect: (jurisdiction: ContentJurisdiction) => void;
  onClose: () => void;
  onSaveAddress: (address: string) => void;
  onClearAddress?: () => void;
  onOpenLocal: (jurisdiction: LocalJurisdictionKey) => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const homeJurisdiction = jurisdictionFromAddress(address);
  const homeLocal = detectJurisdictionKey(address);
  const [editingAddress, setEditingAddress] = useState(false);

  const close = () => {
    setEditingAddress(false);
    onClose();
  };

  const select = (jurisdiction: ContentJurisdiction) => {
    setEditingAddress(false);
    onSelect(jurisdiction);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={s.modal}>
        <Pressable
          style={s.scrim}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t("jurisdictionPicker.close")}
        />
        <View
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
          accessibilityViewIsModal
        >
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.title} accessibilityRole="header">
              {t("jurisdictionPicker.title")}
            </Text>
            <Text style={s.intro}>{t("jurisdictionPicker.intro")}</Text>

            {editingAddress ? (
              <View style={s.addressBlock}>
                <AddressAutocomplete
                  key={address ?? "none"}
                  initialValue={address ?? ""}
                  hint={null}
                  autoFocus
                  inline
                  onSubmit={(next) => {
                    onSaveAddress(next);
                    setEditingAddress(false);
                  }}
                  onCancel={() => setEditingAddress(false)}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={s.addressRow}
                onPress={() => setEditingAddress(true)}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={
                  address
                    ? `${t("address.change")}. ${address}`
                    : t("address.set")
                }
              >
                <Text style={s.addressLine} numberOfLines={1}>
                  {address ?? t("address.set")}
                </Text>
                {address && onClearAddress ? (
                  <TouchableOpacity
                    onPress={onClearAddress}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("address.clear")}
                  >
                    <Text style={s.addressClear}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            )}

            <Kicker style={s.groupLabel}>
              {t("jurisdictionPicker.federal")}
            </Kicker>
            <JurisdictionOption
              jurisdiction="federal"
              selected={selected === "federal"}
              onPress={() => select("federal")}
            />

            <Kicker style={s.groupLabel}>
              {t("jurisdictionPicker.states")}
            </Kicker>
            {SUPPORTED_STATE_JURISDICTIONS.map((jurisdiction) => {
              const locals = localJurisdictionsInState(jurisdiction);
              return (
                <View key={jurisdiction}>
                  <JurisdictionOption
                    jurisdiction={jurisdiction}
                    selected={selected === jurisdiction}
                    isHome={homeJurisdiction === jurisdiction}
                    nested={locals.length > 0}
                    onPress={() => select(jurisdiction)}
                  />
                  {locals.length > 0 ? (
                    <View style={s.localGroup}>
                      {locals.map((local) => (
                        <LocalJurisdictionOption
                          key={local}
                          jurisdiction={local}
                          isHome={homeLocal === local}
                          onPress={() => {
                            setEditingAddress(false);
                            onOpenLocal(local);
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={s.coverageNote}>
              <Icon name="info" size={16} color={DigestPalette.quiet} />
              <Text style={s.coverageText}>
                {t("jurisdictionPicker.coverage")}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function JurisdictionOption({
  jurisdiction,
  selected,
  isHome,
  nested,
  onPress,
}: {
  jurisdiction: ContentJurisdiction;
  selected: boolean;
  isHome?: boolean;
  nested?: boolean;
  onPress: () => void;
}) {
  const { language, t } = useAppTranslation();
  const item = jurisdictionText(jurisdiction, language);
  const title = isHome
    ? `${item.name} · ${t("jurisdictionPicker.yourState")}`
    : item.name;
  return (
    <TouchableOpacity
      style={[s.option, nested && s.optionNested, selected && s.optionSelected]}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${item.description}`}
    >
      <View style={[s.codeTile, selected && s.codeTileSelected]}>
        <Text style={[s.code, selected && s.codeSelected]}>
          {JURISDICTIONS[jurisdiction].code}
        </Text>
      </View>
      <View style={s.optionCopy}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionDescription}>{item.description}</Text>
      </View>
      {selected ? (
        <Icon name="check" size={22} color={DigestPalette.inkOnNight} />
      ) : null}
    </TouchableOpacity>
  );
}

function LocalJurisdictionOption({
  jurisdiction,
  isHome,
  onPress,
}: {
  jurisdiction: LocalJurisdictionKey;
  isHome: boolean;
  onPress: () => void;
}) {
  const { language, t } = useAppTranslation();
  const item = localJurisdictionText(jurisdiction, language);
  const state = jurisdictionText(
    LOCAL_JURISDICTIONS[jurisdiction].state,
    language,
  ).name;
  const title = isHome
    ? `${item.name} · ${t("jurisdictionPicker.yourCity")}`
    : item.name;
  return (
    <TouchableOpacity
      style={s.localOption}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={t("jurisdictionPicker.localA11y", {
        body: item.body,
        state,
        description: item.description,
      })}
      accessibilityHint={t("jurisdictionPicker.localHint")}
      testID={`jurisdiction-local-${jurisdiction}`}
    >
      <View
        style={s.localMark}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <DecisionSeal size={26} />
      </View>
      <View style={s.optionCopy}>
        <Text style={s.localTitle}>{title}</Text>
        <Text style={s.localDescription}>{item.description}</Text>
      </View>
      <Icon name="chevR" size={16} color={DigestPalette.quiet} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  scope: {
    alignSelf: "flex-start",
    minHeight: 28,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scopeBody: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: DigestPalette.spark,
  },
  modal: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: DigestHair.menuScrim,
  },
  sheet: {
    maxHeight: "82%",
    backgroundColor: DigestPalette.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: DigestSpace.screenPadX,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: DigestHair.menuBorder,
    ...DigestShadow.menu,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: DigestHair.sectionRule,
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.7,
    color: DigestPalette.inkOnNight,
  },
  intro: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: DigestPalette.quiet,
    marginTop: 6,
    marginBottom: 22,
  },
  addressBlock: {
    marginBottom: 20,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    marginBottom: 20,
    gap: 12,
  },
  addressLine: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: DigestPalette.inkOnNight,
  },
  addressClear: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: DigestPalette.quiet,
  },
  groupLabel: {
    marginTop: 4,
    marginBottom: 10,
    color: DigestPalette.quiet,
    fontFamily: fontBody.bold,
    letterSpacing: 2.1,
  },
  option: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
    backgroundColor: DigestPalette.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
    marginBottom: 22,
  },
  optionNested: { marginBottom: 0 },
  optionSelected: {
    borderColor: DigestPalette.paper,
    backgroundColor: "rgba(247,244,238,0.08)",
  },
  localGroup: {
    marginLeft: 35,
    paddingLeft: 14,
    paddingTop: 10,
    borderLeftWidth: 1,
    borderLeftColor: DigestHair.cardBorder,
    marginBottom: 22,
    gap: 8,
  },
  localOption: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
  },
  localMark: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  localTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: DigestPalette.inkOnNight,
  },
  localDescription: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    color: DigestPalette.quiet,
    marginTop: 2,
  },
  codeTile: {
    width: 42,
    height: 42,
    borderRadius: DigestRadii.menuRow,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DigestPalette.stone,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  codeTileSelected: {
    borderColor: DigestPalette.paper,
    backgroundColor: DigestPalette.paper,
  },
  code: {
    fontFamily: fontDisplay.regular,
    fontSize: 17,
    color: DigestPalette.quiet,
  },
  codeSelected: { color: DigestPalette.ink },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 21,
    color: DigestPalette.inkOnNight,
  },
  optionDescription: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: DigestPalette.quiet,
    marginTop: 3,
  },
  coverageNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 4,
  },
  coverageText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 20,
    color: DigestPalette.quiet,
  },
});
