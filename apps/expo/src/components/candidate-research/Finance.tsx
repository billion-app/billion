import { useState } from "react";
import { Pressable, View } from "react-native";

import type { CampaignFinance } from "@acme/validators";
import {
  donorTypeLabels,
  interestLabels,
  receiptLabels,
} from "@acme/validators";

import type { EvidenceOpener } from "./ResearchUI";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { CandidateDisclosure } from "~/components/ballot-evidence/CandidateDisclosure";
import { Icon } from "~/components/ui";
import { interestColors, DigestPalette as P, planes } from "~/styles";
import { EvidenceAction, Panel, Point, s, Segments } from "./ResearchUI";

const displayDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
function Interest({ area }: { area: keyof typeof interestLabels | "unknown" }) {
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
        {area === "unknown" ? "Interest not established" : interestLabels[area]}
      </Text>
    </View>
  );
}
export function Finance({
  finance,
  gap,
  donorId,
  onDonor,
  open,
}: {
  finance: CampaignFinance | null;
  gap: string | null;
  donorId?: string;
  onDonor: (id: string) => void;
  open: EvidenceOpener;
}) {
  const [type, setType] = useState("all");
  const [area, setArea] = useState("all");
  if (!finance)
    return (
      <Panel title="Campaign finance unavailable">
        <Text style={s.body}>
          {gap ??
            "Billion has not published reviewed financial records for this candidate yet."}
        </Text>
        <Text style={s.muted}>
          No reported amount here means unknown, not $0.
        </Text>
      </Panel>
    );
  const donor = finance.donors.find((d) => d.id === donorId);
  if (donorId)
    return donor ? (
      <>
        <Text accessibilityRole="header" style={s.title}>
          {donor.name}
        </Text>
        <Panel>
          <Text style={s.heading}>{money(donor.amountCents)}</Text>
          <Text style={s.body}>Given to {finance.committeeName}</Text>
          <Text style={s.muted}>{donorTypeLabels[donor.type]}</Text>
          <EvidenceAction
            ids={donor.evidenceIds}
            title={`${donor.name}: contribution`}
            label="Reported contribution"
            open={open}
          />
        </Panel>
        {donor.lobbying && (
          <Panel>
            <Point point={donor.lobbying} open={open} />
          </Panel>
        )}
        <Panel title="Documented interests">
          {donor.interests.length ? (
            donor.interests.map((interest) => (
              <View key={interest.area} style={s.point}>
                <Interest area={interest.area} />
                <EvidenceAction
                  ids={interest.evidenceIds}
                  title={`${donor.name}: ${interestLabels[interest.area]}`}
                  label="Classification source"
                  open={open}
                />
              </View>
            ))
          ) : (
            <>
              <Interest area="unknown" />
              <Text style={s.muted}>
                The reviewed records do not establish an interest area.
              </Text>
            </>
          )}
          {donor.positions.map((position) => (
            <Point key={position.title} point={position} open={open} />
          ))}
          <Text style={s.muted}>
            These describe the donor. A contribution alone does not establish
            influence or the candidate’s views.
          </Text>
        </Panel>
      </>
    ) : (
      <Panel title="Donor unavailable">
        <Text style={s.body}>
          This donor is not part of the current report.
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
        title={`${displayDate(finance.periodStart)} – ${displayDate(finance.periodEnd)}`}
      >
        <Text style={s.body}>
          {finance.committeeName} · {finance.committeeId}
        </Text>
        <Text style={s.muted}>{finance.coverageNote}</Text>
        <Text style={s.muted}>
          Updated{" "}
          {new Date(finance.updatedAt).toLocaleDateString("en-US", {
            timeZone: "UTC",
          })}
        </Text>
        <EvidenceAction
          ids={finance.filingEvidenceIds}
          title="Reporting period"
          label="Official filings"
          open={open}
        />
      </CandidateDisclosure>
      {finance.donorCoverage === "unavailable" ? (
        <Panel title="Donors & interests">
          <Text style={s.muted}>
            Donor identities and lobbying ties weren’t available in this source
            check.
          </Text>
        </Panel>
      ) : (
        <Panel title="Donors & interests">
          <Text style={s.muted}>
            {finance.donorAmounts === "contribution"
              ? "Selected contributions · one payment per row"
              : finance.donorCoverage === "selected"
                ? "Selected donors"
                : "Itemized donors"}{" "}
            · Given to the campaign
          </Text>
          <CandidateDisclosure title="Filter donors">
            <Segments
              options={[
                { value: "all", label: "All types" },
                { value: "individual", label: "Individuals" },
                { value: "committee", label: "Committees" },
                { value: "lobbyists", label: "Lobbyists" },
              ]}
              value={type}
              onChange={setType}
            />
            <Text style={s.label}>Interest area</Text>
            <Segments
              options={[
                { value: "all", label: "All interests" },
                ...Array.from(
                  new Set(
                    finance.donors.flatMap((d) =>
                      d.interests.map((i) => i.area),
                    ),
                  ),
                ).map((value) => ({ value, label: interestLabels[value] })),
                { value: "unknown", label: "Not established" },
              ]}
              value={area}
              onChange={setArea}
            />
          </CandidateDisclosure>
          {donors.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityLabel={`${d.name}, ${money(d.amountCents)}. ${donorTypeLabels[d.type]}. ${d.lobbying ? "Registered lobbyist. " : ""}${d.interests.length ? d.interests.map((i) => interestLabels[i.area]).join(", ") : "Interest not established"}. View donor details`}
              onPress={() => onDonor(d.id)}
              style={s.rule}
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
                <Text style={s.label}>{money(d.amountCents)}</Text>
              </View>
              <View style={s.row}>
                <View style={s.grow}>
                  <Text style={s.muted}>
                    {donorTypeLabels[d.type]}
                    {d.lobbying ? " · Registered lobbyist" : ""}
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
                ? "No donors match these filters."
                : "No reviewed donor details are available."}
            </Text>
          )}
          <Text style={s.muted}>
            Included in the receipts below. Open the reporting period for
            coverage details.
          </Text>
        </Panel>
      )}
      <Panel title="Received by the campaign">
        {receipts ? (
          <>
            <Text style={[s.title, { fontSize: 36, lineHeight: 44 }]}>
              {money(receipts.totalCents)}
            </Text>
            <Text style={s.muted}>
              {finance.committeeName} · {finance.committeeId}
            </Text>
            <Text style={s.muted}>
              Excludes outside spending. Refunds are shown separately.
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
                    <Text style={[s.body, { flexShrink: 1 }]}>{label}</Text>
                    <Text style={s.label}>{money(amount)}</Text>
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
              Refunds:{" "}
              {receipts.refundsCents === null
                ? "not available"
                : money(receipts.refundsCents)}
              . These are outflows, not additional receipts.
            </Text>
          </>
        ) : (
          <Text style={s.body}>
            Receipt totals are unavailable for this period.
          </Text>
        )}
        <EvidenceAction
          ids={finance.filingEvidenceIds}
          title="Campaign receipts"
          label="Official filings"
          open={open}
        />
      </Panel>
      <Panel title="Outside spending">
        <Text style={s.muted}>
          Spent independently of the campaign. These amounts are not campaign
          receipts.
        </Text>
        {finance.outsideSpending === null ? (
          <Text style={s.body}>Outside spending records are unavailable.</Text>
        ) : finance.outsideSpending.length ? (
          finance.outsideSpending.map((item) => (
            <View key={item.id} style={s.rule}>
              <Text style={s.eyebrow}>
                {item.direction === "support"
                  ? "SUPPORTING"
                  : item.direction === "oppose"
                    ? "OPPOSING"
                    : "POSITION UNSPECIFIED"}
              </Text>
              <Text style={s.body}>{item.spender}</Text>
              <Text style={s.heading}>{money(item.amountCents)}</Text>
              <EvidenceAction
                ids={item.evidenceIds}
                title={item.spender}
                label="Spending report"
                open={open}
              />
            </View>
          ))
        ) : (
          <Text style={s.body}>
            No outside spending appears in the reviewed reports for this period.
          </Text>
        )}
      </Panel>
    </>
  );
}
