import type React from "react";
import { Platform } from "react-native";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";

export function ExternalLink(
  props: Omit<React.ComponentProps<typeof Link>, "href"> & {
    /** Official source URLs arrive as runtime strings, not literal routes. */
    href: string;
  },
) {
  const href = props.href as React.ComponentProps<typeof Link>["href"];
  return (
    <Link
      target="_blank"
      {...props}
      href={href}
      onPress={(e) => {
        if (Platform.OS !== "web") {
          // Prevent the default behavior of linking to the default browser on native.
          e.preventDefault();
          // Open the link in an in-app browser.
          void WebBrowser.openBrowserAsync(props.href);
        }
      }}
    />
  );
}
