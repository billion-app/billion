import { StyleSheet } from "react-native";

import { useAppTranslation } from "~/hooks/useAppTranslation";
import { sp, useTheme } from "~/styles";
import { ExternalLink } from "./ExternalLink";
import { MonoText } from "./StyledText";
import { Text, View } from "./Themed";

export default function EditScreenInfo({ path }: { path: string }) {
  const { theme } = useTheme();
  const { t } = useAppTranslation();

  return (
    <View>
      <View style={styles.getStartedContainer}>
        <Text
          style={styles.getStartedText}
          lightColor="rgba(0,0,0,0.8)"
          darkColor="rgba(255,255,255,0.8)"
        >
          {t("dev.openCode")}
        </Text>

        <View
          style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
          darkColor="rgba(255,255,255,0.05)"
          lightColor="rgba(0,0,0,0.05)"
        >
          <MonoText>{path}</MonoText>
        </View>

        <Text
          style={styles.getStartedText}
          lightColor="rgba(0,0,0,0.8)"
          darkColor="rgba(255,255,255,0.8)"
        >
          {t("dev.changeText")}
        </Text>
      </View>

      <View style={styles.helpContainer}>
        <ExternalLink
          style={styles.helpLink}
          href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet"
        >
          <Text style={styles.helpLinkText} lightColor={theme.primary}>
            {t("dev.tapHere")}
          </Text>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  getStartedContainer: {
    alignItems: "center",
    marginHorizontal: 50,
  },
  homeScreenFilename: {
    marginVertical: sp[2],
  },
  codeHighlightContainer: {
    borderRadius: 3,
    paddingHorizontal: sp[1],
  },
  getStartedText: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
  },
  helpContainer: {
    marginTop: sp[4],
    marginHorizontal: sp[5],
    alignItems: "center",
  },
  helpLink: {
    paddingVertical: sp[4],
  },
  helpLinkText: {
    textAlign: "center",
  },
});
