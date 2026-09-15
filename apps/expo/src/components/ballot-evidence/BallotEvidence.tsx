import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import type { BallotCitation, BallotEvidence, LanguageEvidence } from "./model";
import { Icon } from "~/components/ui/Icon";
import {
  DigestHair,
  fontBody,
  fontEditorial,
  DigestPalette as P,
  sp,
} from "~/styles";
import { BallotText as Text } from "./BallotText";
import {
  ballotStatus,
  citationFieldLabel,
  verificationLabel,
  verifiedLanguages,
  webUrl,
} from "./model";

export function SourceLink({
  label,
  url,
  prominence = "secondary",
}: {
  label: string;
  url?: string;
  prominence?: "primary" | "secondary";
}) {
  const [failed, setFailed] = useState(false);
  const href = webUrl(url);
  if (!href) return <Text style={s.secondary}>{label} · Link unavailable</Text>;
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        style={[s.link, prominence === "primary" && s.primary]}
        onPress={() => {
          void Linking.openURL(href).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
      >
        <Text style={[s.linkText, prominence === "primary" && s.primaryText]}>
          {label}
        </Text>
        <Icon
          name="external"
          size={16}
          color={prominence === "primary" ? P.canvas : P.inkOnNight}
        />
      </Pressable>
      {failed && (
        <Text accessibilityRole="alert" style={s.secondary}>
          Could not open the link. Tap to retry.
        </Text>
      )}
    </View>
  );
}

export function ElectionOfficeLink({
  prominence = "secondary",
}: { prominence?: "primary" | "secondary" } = {}) {
  return (
    <SourceLink
      label="Find your election office"
      prominence={prominence}
      url="https://www.usa.gov/state-election-office"
    />
  );
}

function Retry({
  onPress,
  label,
  primary = false,
}: {
  onPress: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.link, primary && s.primary]}
    >
      <Text style={[s.linkText, primary && s.primaryText]}>{label}</Text>
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
  const retryFirst =
    evidence.kind === "provider-failure" || evidence.kind === "invalid-input";
  const office = (
    <SourceLink
      label="Find your election office"
      url={
        webUrl(officialOfficeUrl) ?? "https://www.usa.gov/state-election-office"
      }
      prominence={
        retryFirst || evidence.contestCount > 0 ? "secondary" : "primary"
      }
    />
  );
  return (
    <View style={s.recoveryCard}>
      <Text accessibilityRole="header" style={s.statusTitle}>
        {status.title}
      </Text>
      <Text style={s.body}>{status.detail}</Text>
      <View style={s.actions}>
        {retryFirst ? (
          <>
            <Retry
              primary
              onPress={onRetry}
              label={
                evidence.kind === "invalid-input" ? "Edit address" : "Try again"
              }
            />
            {evidence.kind !== "invalid-input" && office}
          </>
        ) : (
          <>
            {office}
            <Retry onPress={onRetry} label="Try again" />
          </>
        )}
      </View>
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
      {citations.length === 0 ? (
        <Text style={[s.secondary, s.unavailable]}>
          Source information unavailable
        </Text>
      ) : (
        <Disclosure
          title="Sources"
          detail={`${citations.length} reference${citations.length === 1 ? "" : "s"}`}
        >
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
              <SourceLink
                label={citation.sourceName}
                url={citation.sourceUrl}
              />
              <Text style={s.secondary}>{verificationLabel(citation)}</Text>
              {citation.fetchedAt && (
                <Text style={s.secondary}>Retrieved {citation.fetchedAt}</Text>
              )}
            </View>
          ))}
        </Disclosure>
      )}
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
        title="Language help"
        detail={
          verified.length
            ? `${verified.length} verified material${verified.length === 1 ? "" : "s"}`
            : "Availability unknown"
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
      </Disclosure>
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
      <BallotLanguages items={[]} showRecovery={showOfficeLink} />
    </View>
  );
}

const s = StyleSheet.create({
  footer: { marginTop: sp[3] },
  unavailable: { paddingVertical: sp[3] },
  actions: { gap: sp[3], marginTop: sp[3] },
  statusTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 22,
    lineHeight: 28,
    color: P.inkOnNight,
  },
  primary: {
    backgroundColor: P.inkOnNight,
    paddingHorizontal: sp[5],
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 48,
  },
  primaryText: {
    textDecorationLine: "none",
    fontFamily: fontBody.semibold,
    color: P.canvas,
  },
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
  citation: { paddingVertical: sp[2], gap: 2 },
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
    paddingVertical: sp[2],
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "space-between",
    paddingHorizontal: sp[4],
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: 10,
    gap: sp[2],
  },
  linkText: {
    textDecorationLine: "none",
    flexShrink: 1,
    fontFamily: fontBody.medium,
    fontSize: 16,
    color: P.inkOnNight,
  },
  recoveryCard: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: 14,
    padding: 20,
    gap: sp[2],
  },
  status: { paddingVertical: sp[3], gap: sp[2] },
});
