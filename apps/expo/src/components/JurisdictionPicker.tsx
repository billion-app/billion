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
import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";
import {
  jurisdictionFromAddress,
  JURISDICTIONS,
  STATE_JURISDICTIONS,
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
      <View style={s.scopeIcon}>
        <Icon name={item.icon} size={22} color={colors.bill} />
      </View>
      <View style={s.scopeCopy}>
        <Kicker style={s.scopeKicker}>Jurisdiction</Kicker>
        <Text style={s.scopeBody}>{item.body}</Text>
        <Text style={s.scopeSession}>{item.session}</Text>
      </View>
      <View style={s.change}>
        <Text style={s.changeText}>Change</Text>
        <Icon name="chevR" size={17} color={colors.bill} />
      </View>
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
              Choose whose government you’re browsing. Search, filters and
              results all follow.
            </Text>

            {!address ? (
              <TouchableOpacity style={s.addressOffer} onPress={onSetAddress}>
                <Icon name="pin" size={17} color={colors.bill} />
                <View style={s.addressCopy}>
                  <Text style={s.addressTitle}>Set my address</Text>
                  <Text style={s.addressSub}>
                    We’ll mark your state when it’s covered.
                  </Text>
                </View>
                <Icon name="chevR" size={16} color={colors.bill} />
              </TouchableOpacity>
            ) : null}

            <Kicker style={s.groupLabel}>Federal</Kicker>
            <JurisdictionOption
              jurisdiction="federal"
              selected={selected === "federal"}
              onPress={() => onSelect("federal")}
            />

            <Kicker style={s.groupLabel}>States</Kicker>
            {STATE_JURISDICTIONS.map((jurisdiction) => (
              <JurisdictionOption
                key={jurisdiction}
                jurisdiction={jurisdiction}
                selected={selected === jurisdiction}
                isHome={homeJurisdiction === jurisdiction}
                onPress={() => onSelect(jurisdiction)}
              />
            ))}

            <View style={s.coverageNote}>
              <Icon name="info" size={16} color={colors.textSecondary} />
              <Text style={s.coverageText}>
                State bill coverage currently includes California, Missouri,
                North Carolina and Texas.
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
      {selected ? <Icon name="check" size={22} color={colors.bill} /> : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  scope: {
    minHeight: 80,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scopeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(74,124,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  scopeCopy: { flex: 1, minWidth: 0 },
  scopeKicker: { marginBottom: 3 },
  scopeBody: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.white,
  },
  scopeSession: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  change: { flexDirection: "row", alignItems: "center", gap: 2 },
  changeText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.bill,
  },
  modal: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(4,8,22,0.72)",
  },
  sheet: {
    maxHeight: "82%",
    backgroundColor: planes.navy,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: hair[2],
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: hair[3],
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.white,
  },
  intro: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 22,
  },
  addressOffer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hair[2],
    marginBottom: 20,
  },
  addressCopy: { flex: 1 },
  addressTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  addressSub: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  groupLabel: { marginTop: 4, marginBottom: 10 },
  option: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 16,
    marginBottom: 22,
  },
  optionSelected: { borderColor: colors.bill },
  codeTile: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[3],
  },
  codeTileSelected: { borderColor: colors.bill },
  code: {
    fontFamily: fontDisplay.regular,
    fontSize: 17,
    color: colors.textSecondary,
  },
  codeSelected: { color: colors.bill },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.white,
  },
  optionDescription: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
});
