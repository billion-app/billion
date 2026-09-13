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
import { Text } from "~/components/Themed";
import { Icon, Kicker } from "~/components/ui";
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
  SUPPORTED_STATE_JURISDICTIONS,
} from "~/utils/jurisdiction";

export function JurisdictionScopeRow({
  jurisdiction,
  onPress,
}: {
  jurisdiction: ContentJurisdiction;
  onPress: () => void;
}) {
  const item = JURISDICTIONS[jurisdiction];
  return (
    <TouchableOpacity
      style={s.scope}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`Jurisdiction: ${item.body}. Change jurisdiction`}
      testID="jurisdiction-scope"
    >
      <Text style={s.scopeBody}>{item.name}</Text>
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
  onSetAddress,
}: {
  visible: boolean;
  selected: ContentJurisdiction;
  address: string | null;
  onSelect: (jurisdiction: ContentJurisdiction) => void;
  onClose: () => void;
  onSetAddress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const homeJurisdiction = jurisdictionFromAddress(address);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modal}>
        <Pressable
          style={s.scrim}
          onPress={onClose}
          accessibilityLabel="Close jurisdiction picker"
        />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.title}>Jurisdiction</Text>
            <Text style={s.intro}>
              Search and results follow this government.
            </Text>

            {!address ? (
              <TouchableOpacity style={s.addressOffer} onPress={onSetAddress}>
                <Icon name="pin" size={17} color={DigestPalette.spark} />
                <View style={s.addressCopy}>
                  <Text style={s.addressTitle}>Set my address</Text>
                  <Text style={s.addressSub}>
                    We’ll mark your state when it’s covered.
                  </Text>
                </View>
                <Icon name="chevR" size={16} color={DigestPalette.spark} />
              </TouchableOpacity>
            ) : null}

            <Kicker style={s.groupLabel}>Federal</Kicker>
            <JurisdictionOption
              jurisdiction="federal"
              selected={selected === "federal"}
              onPress={() => onSelect("federal")}
            />

            <Kicker style={s.groupLabel}>States</Kicker>
            {SUPPORTED_STATE_JURISDICTIONS.map((jurisdiction) => (
              <JurisdictionOption
                key={jurisdiction}
                jurisdiction={jurisdiction}
                selected={selected === jurisdiction}
                isHome={homeJurisdiction === jurisdiction}
                onPress={() => onSelect(jurisdiction)}
              />
            ))}

            <View style={s.coverageNote}>
              <Icon name="info" size={16} color={DigestPalette.quiet} />
              <Text style={s.coverageText}>
                State bill coverage currently includes California, North
                Carolina and Texas.
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
  onPress,
}: {
  jurisdiction: ContentJurisdiction;
  selected: boolean;
  isHome?: boolean;
  onPress: () => void;
}) {
  const item = JURISDICTIONS[jurisdiction];
  return (
    <TouchableOpacity
      style={[s.option, selected && s.optionSelected]}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={[s.codeTile, selected && s.codeTileSelected]}>
        <Text style={[s.code, selected && s.codeSelected]}>{item.code}</Text>
      </View>
      <View style={s.optionCopy}>
        <Text style={s.optionTitle}>
          {item.name}
          {isHome ? " · your state" : ""}
        </Text>
        <Text style={s.optionDescription}>{item.description}</Text>
      </View>
      {selected ? (
        <Icon name="check" size={22} color={DigestPalette.spark} />
      ) : null}
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
  addressOffer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: DigestRadii.menu,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.card,
    marginBottom: 20,
  },
  addressCopy: { flex: 1 },
  addressTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: DigestPalette.inkOnNight,
  },
  addressSub: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: DigestPalette.quiet,
    marginTop: 2,
  },
  groupLabel: {
    marginTop: 4,
    marginBottom: 10,
    color: DigestPalette.spark,
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
  optionSelected: {
    borderColor: DigestPalette.spark,
    backgroundColor: DigestHair.menuRowOn,
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
    borderColor: DigestPalette.spark,
    backgroundColor: DigestHair.tabActivePill,
  },
  code: {
    fontFamily: fontDisplay.regular,
    fontSize: 17,
    color: DigestPalette.quiet,
  },
  codeSelected: { color: DigestPalette.spark },
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
