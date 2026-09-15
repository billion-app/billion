import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import type { BallotCitation, BallotEvidence, LanguageEvidence } from "./model";
import { Icon } from "~/components/ui/Icon";
import { DigestHair, fontBody, DigestPalette as P, sp } from "~/styles";
import {
  ballotStatus,
  citationFieldLabel,
  verificationLabel,
  verifiedLanguages,
  webUrl,
} from "./model";

export function SourceLink({ label, url }: { label: string; url?: string }) {
  const [failed, setFailed] = useState(false);
  const href = webUrl(url);
  if (!href) return <Text style={s.secondary}>{label} · Link unavailable</Text>;
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        style={s.link}
        onPress={() => {
          void Linking.openURL(href).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
      >
        <Text style={s.linkText}>{label}</Text>
        <Icon name="external" size={15} color={P.quiet} />
      </Pressable>
      {failed && (
        <Text accessibilityRole="alert" style={s.secondary}>
          Could not open the link. Tap to retry.
        </Text>
      )}
    </View>
  );
}

export function ElectionOfficeLink() {
  return (
    <SourceLink
      label="Find election office"
      url="https://www.usa.gov/state-election-office"
    />
  );
}

function Retry({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.link}>
      <Text style={s.linkText}>{label}</Text>
    </Pressable>
  );
}

function Disclosure({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, detail].filter(Boolean).join(", ")}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.row}
      >
        <View style={s.rowText}>
          <Text style={s.label}>{title}</Text>
          {detail && <Text style={s.secondary}>{detail}</Text>}
        </View>
        <Icon name={expanded ? "chevD" : "chevR"} size={16} color={P.quiet} />
      </Pressable>
      {expanded && <View style={s.disclosureBody}>{children}</View>}
    </View>
  );
}

export function AiSummaryLabel({ label = "AI summary" }: { label?: string }) {
  return <Text style={s.secondary}>{label}</Text>;
}

/** Lookup state remains visible; only supporting metadata uses disclosure. */
export function BallotStatusNotice({
  evidence,
  onRetry,
  officialOfficeUrl,
}: {
  evidence: BallotEvidence;
  onRetry: () => void;
  officialOfficeUrl?: string;
}) {
  const status = ballotStatus(evidence);
  return (
    <View style={s.status}>
      <Text accessibilityRole="header" style={s.label}>
        {status.title}
      </Text>
      <Text style={s.body}>{status.detail}</Text>
      {webUrl(officialOfficeUrl) && (
        <SourceLink label="Election office" url={officialOfficeUrl} />
      )}
      <Retry
        onPress={onRetry}
        label={evidence.kind === "invalid-input" ? "Edit address" : "Try again"}
      />
    </View>
  );
}

type ContentKind =
  | "source"
  | "citations"
  | "ai-summary"
  | "enrichment-unavailable";

/** Each citation retains its own field and URL inside an accessible disclosure. */
export function BallotSources({
  citations,
  contentKind,
  onRetry,
  showRecovery = true,
}: {
  citations: readonly BallotCitation[];
  contentKind: ContentKind;
  onRetry?: () => void;
  /** Detail pages share one recovery action with the language row. */
  showRecovery?: boolean;
}) {
  const missing = contentKind === "enrichment-unavailable";
  return (
    <View>
      {missing && (
        <Text style={[s.body, s.status]}>
          Additional details are unavailable to Billion.
        </Text>
      )}
      {contentKind === "ai-summary" && <AiSummaryLabel />}
      <Disclosure
        title="Sources"
        detail={
          citations.length
            ? `${citations.length} reference${citations.length === 1 ? "" : "s"}`
            : "Unavailable"
        }
      >
        {citations.length === 0 && (
          <Text style={s.secondary}>
            Billion has no citations for this content.
          </Text>
        )}
        {citations.map((citation, index) => (
          <View key={`${citation.field}-${index}`} style={s.citation}>
            <Text style={s.label}>{citationFieldLabel(citation.field)}</Text>
            <Text style={s.secondary}>
              {citation.tier === "ai_generated"
                ? "AI-generated explanation"
                : citation.official === true
                  ? "Official source"
                  : "Source"}
            </Text>
            <SourceLink label={citation.sourceName} url={citation.sourceUrl} />
            <Text style={s.secondary}>{verificationLabel(citation)}</Text>
            {citation.fetchedAt && (
              <Text style={s.secondary}>Retrieved {citation.fetchedAt}</Text>
            )}
          </View>
        ))}
      </Disclosure>
      {showRecovery &&
        (missing || citations.length === 0) &&
        (onRetry ? (
          <Retry onPress={onRetry} label="Try again" />
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
  showRecovery = true,
}: {
  items: readonly LanguageEvidence[];
  onRetry?: () => void;
  officialOfficeUrl?: string;
  showRecovery?: boolean;
}) {
  const verified = verifiedLanguages(items);
  return (
    <View>
      <Disclosure
        title="Languages"
        detail={
          verified.length
            ? `${verified.length} verified material${verified.length === 1 ? "" : "s"}`
            : "Unknown to Billion"
        }
      >
        <Text style={s.secondary}>
          {verified.length
            ? "Other language availability is unknown to Billion."
            : "Billion has not verified translated materials for this election. Ask your election office about materials and assistance."}
        </Text>
        {verified.map((item, index) => (
          <View key={`${item.language}-${index}`} style={s.citation}>
            <Text style={s.label}>
              {item.language} · {item.material}
            </Text>
            <SourceLink
              label={item.citation.sourceName}
              url={item.citation.sourceUrl}
            />
            <Text style={s.secondary}>{verificationLabel(item.citation)}</Text>
          </View>
        ))}
      </Disclosure>
      {showRecovery &&
        (webUrl(officialOfficeUrl) ? (
          <SourceLink label="Election office" url={officialOfficeUrl} />
        ) : verified.length === 0 ? (
          onRetry ? (
            <Retry onPress={onRetry} label="Try again" />
          ) : (
            <ElectionOfficeLink />
          )
        ) : null)}
    </View>
  );
}

/** A single quiet footer, with one recovery link for missing supporting evidence. */
export function BallotDetailEvidence({
  citations,
  contentKind = "citations",
  showOfficeLink = true,
}: {
  citations: readonly BallotCitation[];
  contentKind?: ContentKind;
  showOfficeLink?: boolean;
}) {
  return (
    <View style={s.footer}>
      <BallotSources
        citations={citations}
        contentKind={contentKind}
        showRecovery={false}
      />
      <BallotLanguages items={[]} showRecovery={false} />
      {showOfficeLink && <ElectionOfficeLink />}
    </View>
  );
}

const s = StyleSheet.create({
  footer: { marginTop: sp[5] },
  disclosure: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
  },
  row: {
    minHeight: 56,
    paddingVertical: sp[3],
    flexDirection: "row",
    alignItems: "center",
    gap: sp[3],
  },
  rowText: { flex: 1, gap: sp[1] },
  disclosureBody: { paddingBottom: sp[4], gap: sp[3] },
  citation: { paddingVertical: sp[2], gap: sp[1] },
  label: { fontFamily: fontBody.semibold, fontSize: 16, color: P.inkOnNight },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  secondary: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
    opacity: 0.7,
  },
  link: {
    minHeight: 44,
    paddingVertical: sp[3],
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
  },
  linkText: {
    flexShrink: 1,
    fontFamily: fontBody.medium,
    fontSize: 16,
    color: P.inkOnNight,
  },
  status: { paddingVertical: sp[3], gap: sp[2] },
});
