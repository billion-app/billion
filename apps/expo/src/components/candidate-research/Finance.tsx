import { useState } from "react";
import { Pressable, View } from "react-native";

import type { CampaignFinance } from "@acme/validators";
import {
  donorTypeLabels,
  interestLabels,
  receiptLabels,
} from "@acme/validators";

import type { EvidenceOpener } from "./ResearchUI";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { CandidateDisclosure } from "~/components/ballot-evidence/CandidateDisclosure";
import { Icon } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { interestColors, DigestPalette as P, planes } from "~/styles";
import { EvidenceAction, Panel, Point, s, Segments } from "./ResearchUI";

const displayDate = (date: string, locale = "en-US") =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function FinancePeriod({
  periodStart,
  periodEnd,
  updatedAt,
}: {
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
}) {
  const { t: tx, locale } = useAppTranslation();
  return (
    <View style={s.point}>
      <Text style={s.muted}>
        {displayDate(periodStart, locale)} – {displayDate(periodEnd, locale)}
      </Text>
      <Text style={s.muted}>
        {tx("Checked {value1}", {
          value1: new Date(updatedAt).toLocaleDateString(locale, {
            timeZone: "UTC",
          }),
        })}
      </Text>
    </View>
  );
}

export const money = (cents: number, locale = "en-US") =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
function Interest({ area }: { area: keyof typeof interestLabels | "unknown" }) {
  const { t: tx } = useAppTranslation();

  const color = interestColors[area];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 7,
        borderWidth: 1,
        borderColor: `${color}47`,
        backgroundColor: `${color}17`,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text style={[s.muted, { color, fontSize: 12 }]}>
        {area === "unknown"
          ? tx("Interest not established")
          : tx(interestLabels[area])}
      </Text>
    </View>
  );
}
export function Finance({
  finance,
  gap,
  filingSource,
  donorId,
  onDonor,
  open,
}: {
  finance: CampaignFinance | null;
  gap: string | null;
  filingSource?: { label: string; url: string };
  donorId?: string;
  onDonor: (id: string) => void;
  open: EvidenceOpener;
}) {
  const { t: tx, locale: appLocale } = useAppTranslation();

  const [type, setType] = useState("all");
  const [area, setArea] = useState("all");
  if (!finance)
    return (
      <Panel title={tx("Campaign finance unavailable")}>
        <Text style={s.body}>
          {gap ??
            tx(
              "Billion has not published reviewed financial records for this candidate yet.",
            )}
        </Text>
        <Text style={s.muted}>
          {tx("No reported amount here means unknown, not $0.")}
        </Text>
        {filingSource && (
          <SourceLink
            label={filingSource.label}
            url={filingSource.url}
            prominence="primary"
          />
        )}
      </Panel>
    );
  const observation = finance.observation;
  const summary = observation?.summary;
  const donorSelection = observation?.donorSelection;
  const independentExpenditures = observation?.independentExpenditures;
  const filingStatus = observation?.filingStatus;
  const thresholdStatement =
    filingStatus?.status === "available" &&
    filingStatus.kind === "committee_threshold_statement";
  const donor = finance.donors.find((d) => d.id === donorId);
  if (donorId)
    return donor ? (
      <>
        <Text accessibilityRole="header" style={s.title}>
          {donor.name}
        </Text>
        <Panel>
          <Text style={s.heading}>{money(donor.amountCents, appLocale)}</Text>
          <Text style={s.body}>
            {tx("Given to {value1}", { value1: finance.committeeName })}
          </Text>
          <Text style={s.muted}>{tx(donorTypeLabels[donor.type])}</Text>
          {donorSelection?.status === "available" && (
            <>
              <Text style={s.muted}>{donorSelection.selection}</Text>
              <FinancePeriod {...donorSelection} />
            </>
          )}
          <EvidenceAction
            ids={donor.evidenceIds}
            title={tx("{value1}: contribution", { value1: donor.name })}
            label={tx("Reported contribution")}
            open={open}
          />
        </Panel>
        {donor.lobbying && (
          <Panel>
            <Point point={donor.lobbying} open={open} />
          </Panel>
        )}
        <Panel title={tx("Documented interests")}>
          {donor.interests.length ? (
            donor.interests.map((interest) => (
              <View key={interest.area} style={s.point}>
                <Interest area={interest.area} />
                <EvidenceAction
                  ids={interest.evidenceIds}
                  title={`${donor.name}: ${tx(interestLabels[interest.area])}`}
                  label={tx("Classification source")}
                  open={open}
                />
              </View>
            ))
          ) : (
            <>
              <Interest area="unknown" />
              <Text style={s.muted}>
                {tx("The reviewed records do not establish an interest area.")}
              </Text>
            </>
          )}
          {donor.positions.map((position) => (
            <Point key={position.title} point={position} open={open} />
          ))}
          <Text style={s.muted}>
            {tx(
              "These describe the donor. A contribution alone does not establish influence or the candidate’s views.",
            )}
          </Text>
        </Panel>
      </>
    ) : (
      <Panel title={tx("Donor unavailable")}>
        <Text style={s.body}>
          {tx("This donor is not part of the current report.")}
        </Text>
      </Panel>
    );
  const receipts = finance.receipts;
  const donors = finance.donors.filter(
    (d) =>
      (type === "all" ||
        (type === "lobbyists" ? !!d.lobbying : d.type === type)) &&
      (area === "all" ||
        (area === "unknown"
          ? !d.interests.length
          : d.interests.some((i) => i.area === area))),
  );
  return (
    <>
      <CandidateDisclosure
        title={`${displayDate(finance.periodStart, appLocale)} – ${displayDate(finance.periodEnd, appLocale)}`}
      >
        <Text style={s.body}>
          {finance.committeeName} · {finance.committeeId}
        </Text>
        <Text style={s.muted}>{finance.coverageNote}</Text>
        <Text style={s.muted}>
          {tx("Updated {value1}", {
            value1: new Date(finance.updatedAt).toLocaleDateString(appLocale, {
              timeZone: "UTC",
            }),
          })}
        </Text>
        <EvidenceAction
          ids={finance.filingEvidenceIds}
          title={tx("Reporting period")}
          label={tx("Official filings")}
          open={open}
        />
      </CandidateDisclosure>
      {filingStatus && (
        <Panel title={tx("Filing status")}>
          {filingStatus.status === "available" ? (
            <>
              <Text style={s.body}>
                {tx("Latest filing: {value1}", {
                  value1: filingStatus.latestForm,
                })}
              </Text>
              {filingStatus.statement && (
                <Text style={s.body}>
                  {tx("The committee states: {value1}", {
                    value1: filingStatus.statement,
                  })}
                </Text>
              )}
              <Text style={s.muted}>
                {tx("Filings listed: {value1}", {
                  value1: filingStatus.observedForms.join(", "),
                })}
              </Text>
              <FinancePeriod {...filingStatus} />
            </>
          ) : (
            <Text style={s.body}>{filingStatus.reason}</Text>
          )}
          <EvidenceAction
            ids={filingStatus.evidenceIds}
            title={tx("Filing status")}
            label={tx("Official filing history")}
            open={open}
          />
        </Panel>
      )}
      {summary && (
        <Panel title={tx("Campaign totals")}>
          {summary.status === "available" ? (
            <>
              <FinancePeriod {...summary} />
              {(
                [
                  ["Total raised", receipts?.totalCents ?? null],
                  ["Spent", summary.spentCents],
                  ["Cash on hand", summary.cashCents],
                  ["Debt", summary.debtCents],
                  ["Individuals · itemized", summary.itemizedIndividualCents],
                  [
                    "Individuals · unitemized",
                    summary.unitemizedIndividualCents,
                  ],
                ] as const
              ).map(([label, amount]) => (
                <View
                  key={label}
                  style={[
                    s.row,
                    { justifyContent: "space-between", flexWrap: "wrap" },
                  ]}
                >
                  <Text style={[s.body, { flexShrink: 1 }]}>{tx(label)}</Text>
                  <Text style={s.label}>
                    {amount === null
                      ? tx("Not reported")
                      : money(amount, appLocale)}
                  </Text>
                </View>
              ))}
              <Text style={s.muted}>
                {tx(
                  "Itemized contributions include donor details in the filing. Unitemized contributions are reported together. Both are included in total raised.",
                )}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.body}>{summary.reason}</Text>
              {thresholdStatement && (
                <Text style={s.muted}>
                  {tx(
                    "Exact amounts raised, spent, cash on hand and debt have not been filed in a financial report.",
                  )}
                </Text>
              )}
            </>
          )}
          <EvidenceAction
            ids={summary.evidenceIds}
            title={tx("Campaign totals")}
            label={tx("Official filings")}
            open={open}
          />
        </Panel>
      )}
      {finance.donorCoverage === "unavailable" ? (
        <Panel title={tx("Donors & interests")}>
          <Text style={s.muted}>
            {donorSelection?.status === "unavailable"
              ? donorSelection.reason
              : tx(
                  "Donor identities and lobbying ties weren’t available in this source check.",
                )}
          </Text>
          {donorSelection && (
            <EvidenceAction
              ids={donorSelection.evidenceIds}
              title={tx("Donor availability")}
              label={tx("Official filings")}
              open={open}
            />
          )}
        </Panel>
      ) : (
        <Panel title={tx("Donors & interests")}>
          {donorSelection?.status === "available" && (
            <>
              <Text style={s.body}>{donorSelection.selection}</Text>
              <FinancePeriod {...donorSelection} />
              <Text style={s.muted}>
                {tx(
                  "This is a selection of contributions from these filings, not a list of every donor or the largest donors for the election cycle.",
                )}
              </Text>
              <EvidenceAction
                ids={donorSelection.evidenceIds}
                title={tx("Selected contributions")}
                label={tx("Selection sources")}
                open={open}
              />
            </>
          )}
          <Text style={s.muted}>
            {tx("{value1} · Given to the campaign", {
              value1:
                finance.donorAmounts === "contribution"
                  ? tx("Selected contributions · one payment per row")
                  : finance.donorCoverage === "selected"
                    ? tx("Selected donors")
                    : tx("Itemized donors"),
            })}
          </Text>
          <CandidateDisclosure title={tx("Filter donors")}>
            <Segments
              options={[
                { value: "all", label: tx("All types") },
                { value: "individual", label: tx("Individuals") },
                { value: "committee", label: tx("Committees") },
                { value: "lobbyists", label: tx("Lobbyists") },
              ]}
              value={type}
              onChange={setType}
            />
            <Text style={s.label}>{tx("Interest area")}</Text>
            <Segments
              options={[
                { value: "all", label: tx("All interests") },
                ...Array.from(
                  new Set(
                    finance.donors.flatMap((d) =>
                      d.interests.map((i) => i.area),
                    ),
                  ),
                ).map((value) => ({ value, label: tx(interestLabels[value]) })),
                { value: "unknown", label: tx("Not established") },
              ]}
              value={area}
              onChange={setArea}
            />
          </CandidateDisclosure>
          {donors.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityLabel={tx(
                "{value1}, {value2}. {value3}. {value4}{value5}. View donor details",
                {
                  value1: d.name,
                  value2: money(d.amountCents, appLocale),
                  value3: tx(donorTypeLabels[d.type]),
                  value4: d.lobbying ? tx("Registered lobbyist. ") : "",
                  value5: d.interests.length
                    ? d.interests
                        .map((i) => tx(interestLabels[i.area]))
                        .join(", ")
                    : tx("Interest not established"),
                },
              )}
              onPress={() => onDonor(d.id)}
              style={[s.rule, { minHeight: 44 }]}
            >
              <View
                style={[
                  s.row,
                  { flexWrap: "wrap", justifyContent: "space-between" },
                ]}
              >
                <Text style={[s.body, { flexShrink: 1, flexBasis: "65%" }]}>
                  {d.name}
                </Text>
                <Text style={s.label}>{money(d.amountCents, appLocale)}</Text>
              </View>
              <View style={s.row}>
                <View style={s.grow}>
                  <Text style={s.muted}>
                    {tx(donorTypeLabels[d.type])}
                    {d.lobbying ? tx(" · Registered lobbyist") : ""}
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {d.interests.length ? (
                      d.interests.map((i) => (
                        <Interest key={i.area} area={i.area} />
                      ))
                    ) : (
                      <Interest area="unknown" />
                    )}
                  </View>
                </View>
                <Icon name="chevR" color={P.primary} size={18} />
              </View>
            </Pressable>
          ))}
          {!donors.length && (
            <Text style={s.body}>
              {finance.donors.length
                ? tx("No donors match these filters.")
                : tx("No reviewed donor details are available.")}
            </Text>
          )}
          <Text style={s.muted}>
            {tx(
              "Included in the receipts below. Open the reporting period for coverage details.",
            )}
          </Text>
        </Panel>
      )}
      <Panel
        title={tx(
          observation ? "Receipt breakdown" : "Received by the campaign",
        )}
      >
        {receipts ? (
          <>
            <Text style={[s.title, { fontSize: 36, lineHeight: 44 }]}>
              {money(receipts.totalCents, appLocale)}
            </Text>
            <Text style={s.muted}>
              {finance.committeeName} · {finance.committeeId}
            </Text>
            <Text style={s.muted}>
              {tx("Excludes outside spending. Refunds are shown separately.")}
            </Text>
            {Object.entries(receiptLabels).map(([key, label]) => {
              const amount =
                receipts.breakdown[key as keyof typeof receiptLabels];
              return (
                <View key={key} style={s.point}>
                  <View
                    style={[
                      s.row,
                      { justifyContent: "space-between", flexWrap: "wrap" },
                    ]}
                  >
                    <Text style={[s.body, { flexShrink: 1 }]}>{tx(label)}</Text>
                    <Text style={s.label}>{money(amount, appLocale)}</Text>
                  </View>
                  <View
                    accessible={false}
                    style={{
                      height: 5,
                      borderRadius: 5,
                      backgroundColor: planes.surface,
                    }}
                  >
                    <View
                      style={{
                        height: 5,
                        borderRadius: 5,
                        backgroundColor: P.primary,
                        width: `${receipts.totalCents ? (amount / receipts.totalCents) * 100 : 0}%`,
                      }}
                    />
                  </View>
                </View>
              );
            })}
            <Text style={s.muted}>
              {tx(
                "Refunds: {value1}. These are outflows, not additional receipts.",
                {
                  value1:
                    receipts.refundsCents === null
                      ? tx("Not available")
                      : money(receipts.refundsCents, appLocale),
                },
              )}
            </Text>
          </>
        ) : (
          <Text style={s.body}>
            {thresholdStatement
              ? tx("Receipt totals have not been filed in a financial report.")
              : tx("Receipt totals are unavailable for this period.")}
          </Text>
        )}
        <EvidenceAction
          ids={finance.filingEvidenceIds}
          title={tx("Campaign receipts")}
          label={tx("Official filings")}
          open={open}
        />
      </Panel>
      <Panel title={tx("Outside spending")}>
        <Text style={s.muted}>
          {tx(
            "Spent independently of the campaign. These amounts are not campaign receipts.",
          )}
        </Text>
        {independentExpenditures ? (
          <>
            {independentExpenditures.status === "available" ? (
              <>
                <FinancePeriod {...independentExpenditures} />
                {(
                  [
                    [
                      "Supporting the candidate",
                      independentExpenditures.supportCents,
                    ],
                    [
                      "Opposing the candidate",
                      independentExpenditures.opposeCents,
                    ],
                  ] as const
                ).map(([label, amount]) => (
                  <View
                    key={label}
                    style={[
                      s.row,
                      { justifyContent: "space-between", flexWrap: "wrap" },
                    ]}
                  >
                    <Text style={[s.body, { flexShrink: 1 }]}>{tx(label)}</Text>
                    <Text style={s.label}>{money(amount, appLocale)}</Text>
                  </View>
                ))}
                <Text style={s.muted}>
                  {tx(
                    "Includes independent spending in processed periodic reports for this period. Excludes 24-hour and 48-hour notices to avoid counting spending twice.",
                  )}
                </Text>
              </>
            ) : (
              <Text style={s.body}>{independentExpenditures.reason}</Text>
            )}
            <EvidenceAction
              ids={independentExpenditures.evidenceIds}
              title={tx("Outside spending")}
              label={tx("Official spending reports")}
              open={open}
            />
          </>
        ) : finance.outsideSpending === null ? (
          <Text style={s.body}>
            {tx("Outside spending records are unavailable.")}
          </Text>
        ) : finance.outsideSpending.length ? (
          finance.outsideSpending.map((item) => (
            <View key={item.id} style={s.rule}>
              <Text style={s.eyebrow}>
                {item.direction === "support"
                  ? tx("SUPPORTING")
                  : item.direction === "oppose"
                    ? tx("OPPOSING")
                    : tx("POSITION UNSPECIFIED")}
              </Text>
              <Text style={s.body}>{item.spender}</Text>
              <Text style={s.heading}>
                {money(item.amountCents, appLocale)}
              </Text>
              <EvidenceAction
                ids={item.evidenceIds}
                title={item.spender}
                label={tx("Spending report")}
                open={open}
              />
            </View>
          ))
        ) : (
          <Text style={s.body}>
            {tx(
              "No outside spending appears in the reviewed reports for this period.",
            )}
          </Text>
        )}
      </Panel>
    </>
  );
}
