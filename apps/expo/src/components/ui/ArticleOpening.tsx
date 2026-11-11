import type { ImageSource } from "expo-image";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import {
  BillReaderPalette as R,
  BillReaderSpace as S,
  BillReaderType as T,
} from "~/styles";

/** One continuous photo/title opening, using the Feed's existing navy fade.
 * Content sets its height: long titles and Dynamic Type never get cropped.
 */
export function ArticleOpening({
  title,
  metadata,
  imageSource,
  imageCredit,
  titleTestID = "article-title",
}: {
  title: string;
  metadata: ReactNode;
  imageSource?: ImageSource;
  imageCredit?: string;
  titleTestID?: string;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  const { fontScale } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const photo = !!imageSource?.uri && imageSource.uri !== failedUri;
  return (
    <Animated.View
      entering={FadeInDown.withInitialValues({
        opacity: 0,
        transform: [{ translateY: 10 }],
      })
        .duration(240)
        .easing(Easing.out(Easing.cubic))
        .reduceMotion(ReduceMotion.System)}
      key={fontScale}
      style={[s.opening, photo && s.photoOpening]}
      testID="article-opening"
    >
      {photo ? (
        <>
          <Image
            source={imageSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={imageSource.uri}
            onError={() => setFailedUri(imageSource.uri)}
            transition={reduceMotion ? 0 : 180}
            accessible={false}
          />
          <LinearGradient
            colors={[
              "transparent",
              "rgba(14,21,48,0.2)",
              "rgba(14,21,48,0.78)",
              R.canvas,
            ]}
            locations={[0.12, 0.4, 0.7, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {imageCredit ? <Text style={s.credit}>{imageCredit}</Text> : null}
          <View style={s.photoSpace} />
        </>
      ) : null}
      <View style={s.identity}>{metadata}</View>
      <Text style={s.title} accessibilityRole="header" testID={titleTestID}>
        {title}
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  opening: { gap: 8, paddingTop: 8, paddingBottom: 12 },
  photoOpening: {
    marginHorizontal: -S.page,
    paddingHorizontal: S.page,
    paddingTop: 16,
  },
  photoSpace: { height: 156 },
  credit: {
    ...T.label,
    color: R.text,
    opacity: 0.88,
    alignSelf: "flex-end",
    backgroundColor: R.canvas,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  identity: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 8,
    rowGap: 4,
  },
  title: { ...T.display, color: R.text },
});
