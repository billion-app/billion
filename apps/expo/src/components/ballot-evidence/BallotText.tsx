import type { TextProps } from "react-native";
import { Text, useWindowDimensions } from "react-native";

/** Refresh native text measurements after a Dynamic Type change. */
export function BallotText(props: TextProps) {
  const { fontScale } = useWindowDimensions();
  return <Text key={fontScale} {...props} />;
}
