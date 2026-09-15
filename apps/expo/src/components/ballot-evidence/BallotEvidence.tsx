import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import type { BallotCitation, BallotEvidence, LanguageEvidence } from "./model";
import { sp, typography, useTheme } from "~/styles";
import {
  ballotStatus,
  verificationLabel,
  verifiedLanguages,
  webUrl,
} from "./model";

function SourceLink({ label, url }: { label: string; url?: string }) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const href = webUrl(url);
  if (!href)
    return (
      <Text style={{ color: theme.textSecondary }}>
        {label} · Link unavailable
      </Text>
    );
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        style={{ paddingVertical: sp[3] }}
        onPress={() => {
          void Linking.openURL(href).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
      >
        <Text
          style={{ color: theme.foreground, textDecorationLine: "underline" }}
        >
          {label}
        </Text>
      </Pressable>
      {failed && (
        <Text accessibilityRole="alert" style={{ color: theme.textSecondary }}>
          Could not open this link. Tap it to retry.
        </Text>
      )}
    </View>
  );
}

/** USAGov directory is a recovery path when no local office is known. */
export function ElectionOfficeLink() {
  return (
    <SourceLink
      label="Find your official election office (USAGov)"
      url="https://www.usa.gov/state-election-office"
    />
  );
}

/** Required retry keeps every unavailable state actionable, even without an office URL. */
export function BallotStatusNotice({
  evidence,
  onRetry,
  officialOfficeUrl,
}: {
  evidence: BallotEvidence;
  onRetry: () => void;
  officialOfficeUrl?: string;
}) {
  const { theme } = useTheme();
  const status = ballotStatus(evidence);
  return (
    <View style={{ gap: sp[2], paddingVertical: sp[3] }}>
      <Text
        accessibilityRole="header"
        style={[typography.h3, { color: theme.foreground }]}
      >
        {status.title}
      </Text>
      <Text style={{ color: theme.textSecondary }}>{status.detail}</Text>
      {webUrl(officialOfficeUrl) && (
        <SourceLink label="Official election office" url={officialOfficeUrl} />
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={{ paddingVertical: sp[3] }}
      >
        <Text style={{ color: theme.foreground }}>
          {evidence.kind === "invalid-input"
            ? "Edit address and retry"
            : "Retry ballot lookup"}
        </Text>
      </Pressable>
    </View>
  );
}

/** Place beside the relevant field, preserving per-field attribution. */
export function BallotSources({
  citations,
  contentKind,
  onRetry,
}: {
  citations: readonly BallotCitation[];
  contentKind: "source" | "citations" | "ai-summary" | "enrichment-unavailable";
  onRetry?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: sp[2], paddingVertical: sp[3] }}>
      <Text style={[typography.body, { color: theme.foreground }]}>
        {contentKind === "citations"
          ? "Sources and citations"
          : contentKind === "source"
            ? "Source material"
            : contentKind === "ai-summary"
              ? "AI-generated explanation · Check the cited sources"
              : "Additional explanation unavailable · Ballot data may still be available"}
      </Text>
      {citations.map((citation, index) => (
        <View key={`${citation.field}-${index}`}>
          <Text style={{ color: theme.textSecondary }}>
            {citation.field} ·{" "}
            {citation.tier === "ai_generated"
              ? "AI-generated explanation"
              : citation.official === true
                ? "Official source"
                : "Source"}
          </Text>
          <SourceLink label={citation.sourceName} url={citation.sourceUrl} />
          <Text style={{ color: theme.textSecondary }}>
            {verificationLabel(citation)}
          </Text>
          {citation.fetchedAt && (
            <Text style={{ color: theme.textSecondary }}>
              Retrieved {citation.fetchedAt}
            </Text>
          )}
        </View>
      ))}
      {citations.length === 0 && (
        <Text style={{ color: theme.textSecondary }}>
          Source citations unavailable to Billion.
        </Text>
      )}
      {(contentKind === "enrichment-unavailable" || citations.length === 0) &&
        (onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={{ paddingVertical: sp[3] }}
          >
            <Text style={{ color: theme.foreground }}>
              Retry loading details
            </Text>
          </Pressable>
        ) : (
          <ElectionOfficeLink />
        ))}
    </View>
  );
}

export function BallotLanguages({
  items,
  onRetry,
  officialOfficeUrl,
}: {
  items: readonly LanguageEvidence[];
  onRetry?: () => void;
  officialOfficeUrl?: string;
}) {
  const { theme } = useTheme();
  const verified = verifiedLanguages(items);
  return (
    <View style={{ gap: sp[2], paddingVertical: sp[3] }}>
      <Text
        accessibilityRole="header"
        style={[typography.h3, { color: theme.foreground }]}
      >
        Language availability
      </Text>
      <Text style={{ color: theme.textSecondary }}>
        {verified.length
          ? "Verified materials below. Availability of other languages is unknown to Billion."
          : "Language availability is unknown to Billion. Ask your election office about translated materials and assistance."}
      </Text>
      {verified.map((item, index) => (
        <View key={`${item.language}-${index}`}>
          <SourceLink
            label={`${item.language} · ${item.material} · ${item.citation.sourceName}`}
            url={item.citation.sourceUrl}
          />
          <Text style={{ color: theme.textSecondary }}>
            {verificationLabel(item.citation)}
          </Text>
        </View>
      ))}
      {webUrl(officialOfficeUrl) && (
        <SourceLink label="Official election office" url={officialOfficeUrl} />
      )}
      {verified.length === 0 &&
        (onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={{ paddingVertical: sp[3] }}
          >
            <Text style={{ color: theme.foreground }}>
              Retry language information
            </Text>
          </Pressable>
        ) : (
          <ElectionOfficeLink />
        ))}
    </View>
  );
}
