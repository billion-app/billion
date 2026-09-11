/**
 * Watch picks: civic buildings as hairline SVGs. Dull at rest, gold
 * draws the outline on select. Circles keep a fixed size so neighbors
 * never collide.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg from "react-native-svg";

import { fontBody, DigestPalette as P } from "~/styles";
import type { TrackingVector } from "~/utils/onboarding-store";

import { DrawnPath } from "./DrawnMark";

/** U.S. Capitol — wide colonnaded wings, peristyle drum, ribbed dome, statue. */
function Congress({ selected }: { selected: boolean }) {
  return (
    <>
      <DrawnPath d="M2 58H62" length={80} selected={selected} delay={0} fill={false} />
      <DrawnPath d="M3 58V47H22V57" length={90} selected={selected} delay={40} fill={false} />
      <DrawnPath d="M42 57V47H61V58" length={90} selected={selected} delay={40} fill={false} />
      <DrawnPath
        d="M6 47V54M10 47V54M14 47V54M18 47V54"
        length={50}
        selected={selected}
        delay={140}
        fill={false}
        weight={1.15}
      />
      <DrawnPath
        d="M46 47V54M50 47V54M54 47V54M58 47V54"
        length={50}
        selected={selected}
        delay={140}
        fill={false}
        weight={1.15}
      />
      <DrawnPath d="M22 58V41H42V58" length={90} selected={selected} delay={180} fill={false} />
      <DrawnPath d="M25 58H39M27 55H37M29 52H35" length={70} selected={selected} delay={220} fill={false} />
      <DrawnPath d="M25 41H39V31H25Z" length={70} selected={selected} delay={280} />
      <DrawnPath
        d="M27 41V31M30 41V31M32 41V31M34.5 41V31M37 41V31"
        length={70}
        selected={selected}
        delay={340}
        fill={false}
        weight={1.1}
      />
      <DrawnPath
        d="M24 31C24 16 28 11 32 11C36 11 40 16 40 31"
        length={120}
        selected={selected}
        delay={420}
        fill={false}
      />
      <DrawnPath d="M29 11H35V7H29Z" length={40} selected={selected} delay={520} />
      <DrawnPath d="M32 7V3" length={12} selected={selected} delay={580} fill={false} />
    </>
  );
}

/** California State Capitol — long hall, nine-bay colonnade, slender dome. */
function California({ selected }: { selected: boolean }) {
  return (
    <>
      <DrawnPath d="M3 58H61" length={80} selected={selected} delay={0} fill={false} />
      <DrawnPath d="M5 58V44H59V58" length={110} selected={selected} delay={50} fill={false} />
      <DrawnPath
        d="M9 44V55M14 44V55M19 44V55M24 44V55M32 44V55M40 44V55M45 44V55M50 44V55M55 44V55"
        length={140}
        selected={selected}
        delay={140}
        fill={false}
        weight={1.15}
      />
      <DrawnPath d="M26 44V36H38V44" length={60} selected={selected} delay={260} fill={false} />
      <DrawnPath d="M28 36H36V29H28Z" length={50} selected={selected} delay={340} />
      <DrawnPath
        d="M26 29C26 18 29 13 32 13C35 13 38 18 38 29"
        length={90}
        selected={selected}
        delay={420}
        fill={false}
      />
      <DrawnPath d="M30 13H34V9H30Z" length={30} selected={selected} delay={520} />
    </>
  );
}

/**
 * White House, north facade: a wide three-storey block, shallow pediment
 * over four Ionic columns, chimneys, window bays. Not a steep house.
 */
function WhiteHouse({ selected }: { selected: boolean }) {
  return (
    <>
      <DrawnPath d="M4 56H60" length={80} selected={selected} delay={0} fill={false} />
      <DrawnPath d="M5 56V34H59V56" length={130} selected={selected} delay={40} fill={false} />
      <DrawnPath d="M11 34V28H15V34M49 34V28H53V34" length={40} selected={selected} delay={140} fill={false} />
      <DrawnPath
        d="M8 38V43M12 38V43M16 38V43M20 38V43M8 46V52M12 46V52M16 46V52M20 46V52"
        length={90}
        selected={selected}
        delay={200}
        fill={false}
        weight={1.1}
      />
      <DrawnPath
        d="M44 38V43M48 38V43M52 38V43M56 38V43M44 46V52M48 46V52M52 46V52M56 46V52"
        length={90}
        selected={selected}
        delay={200}
        fill={false}
        weight={1.1}
      />
      <DrawnPath d="M22 36H42V34H22Z" length={50} selected={selected} delay={280} />
      <DrawnPath d="M22 34L32 27L42 34" length={50} selected={selected} delay={340} fill={false} />
      <DrawnPath
        d="M24 36V54M28 36V54M36 36V54M40 36V54"
        length={110}
        selected={selected}
        delay={420}
        fill={false}
      />
    </>
  );
}

/** Supreme Court — broad stairs, eight columns, shallow sculpted pediment. */
function Courts({ selected }: { selected: boolean }) {
  return (
    <>
      <DrawnPath
        d="M18 58H46M15 54H49M12 50H52M10 46H54"
        length={180}
        selected={selected}
        delay={0}
        fill={false}
      />
      <DrawnPath
        d="M14 46V22M19 46V22M24 46V22M28 46V22M36 46V22M40 46V22M45 46V22M50 46V22"
        length={220}
        selected={selected}
        delay={140}
        fill={false}
      />
      <DrawnPath d="M11 22H53V18H11Z" length={90} selected={selected} delay={280} />
      <DrawnPath d="M12 18L32 6L52 18" length={120} selected={selected} delay={380} fill={false} />
    </>
  );
}

function Mark({ id, selected }: { id: TrackingVector; selected: boolean }) {
  switch (id) {
    case "congress":
      return <Congress selected={selected} />;
    case "state":
      return <California selected={selected} />;
    case "executive":
      return <WhiteHouse selected={selected} />;
    case "courts":
      return <Courts selected={selected} />;
  }
}

export function Orb({
  id,
  label,
  selected,
  size,
  onPress,
}: {
  id: TrackingVector;
  label: string;
  selected: boolean;
  size: number;
  onPress: () => void;
}) {
  const mark = Math.round(size * 0.72);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{ alignItems: "center", width: size }}
    >
      <View
        style={[
          s.bubble,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
            borderColor: selected ? P.spark : "rgba(247,244,238,0.14)",
          },
        ]}
      >
        <Svg width={mark} height={mark} viewBox="0 0 64 64">
          <Mark id={id} selected={selected} />
        </Svg>
      </View>
      <Text style={[s.label, selected && s.labelOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bubble: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.stone,
  },
  label: {
    marginTop: 8,
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: P.quiet,
    textAlign: "center",
  },
  labelOn: { color: P.inkOnNight },
});
