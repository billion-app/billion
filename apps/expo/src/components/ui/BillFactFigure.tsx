import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useState } from "react";
import {
  PixelRatio,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Circle, Line } from "react-native-svg";

import type { getBillFactFigure } from "./bill-fact-figure";
import type { BillBriefData, BriefQuote } from "./BillBrief";
import { useLanguage } from "~/hooks/useLanguage";
import {
  fontBody,
  BillReaderPalette as R,
  BillReaderSpace as S,
  BillReaderType as T,
} from "~/styles";
import { getBillDateMilestones } from "./bill-date-milestones";
import { getBillFactDisplay } from "./bill-fact-figure";
import {
  getBillMetricComparison,
  getBillPercent,
  getPrimaryMetricFacts,
  isEssentialMetricNote,
} from "./bill-visual";
import { Icon } from "./Icon";
import { readerColumns, readerScalePosition } from "./reader-geometry";
import {
  ReaderDisclosureIcon,
  readerLayout,
  ReaderReveal,
} from "./ReaderMotion";
import { ReaderPressable } from "./ReaderPressable";
import { ReaderTimelineRow } from "./ReaderTimelineRow";

function FactTarget({
  children,
  label,
  expanded,
  onPress,
  style,
  testID,
}: {
  children: ReactNode;
  label: string;
  expanded: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return onPress ? (
    <ReaderPressable
      style={style}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      onPress={onPress}
      testID={testID}
    >
      {children}
    </ReaderPressable>
  ) : (
    <View style={style} accessible accessibilityLabel={label}>
      {children}
    </View>
  );
}

/** Supporting evidence follows the explanation; unrelated values never share a scale. */
export function BillFactFigure({
  figure,
  onViewSource,
  changes = [],
  legalStatus = "proposed",
  onInspect,
}: {
  figure: NonNullable<ReturnType<typeof getBillFactFigure>>;
  onViewSource?: (quote: BriefQuote) => void;
  changes?: BillBriefData["changes"];
  legalStatus?: BillBriefData["legalStatus"];
  onInspect?: (y: number) => void;
}) {
  const { t } = useLanguage();
  const { fontScale, width } = useWindowDimensions();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moreFiguresOpen, setMoreFiguresOpen] = useState(false);
  const [selectedFactIndex, setSelectedFactIndex] = useState<number | null>(
    null,
  );
  const selectedFact =
    selectedFactIndex === null ? null : figure.points[selectedFactIndex];
  const selectedComparison = selectedFact
    ? getBillMetricComparison(selectedFact, changes)
    : null;
  const [contentWidth, setContentWidth] = useState(width - S.page * 2);
  const [labelHeights, setLabelHeights] = useState<Record<string, number>>({});
  const [wrappedValue, setWrappedValue] = useState(false);
  const temperature = figure.kind === "temperature";
  const dates = temperature ? [] : getBillDateMilestones(figure.points);
  const dateIndices = new Set(dates.map((point) => point.index));
  const metricPoints = figure.points.filter(
    (_, index) => !dateIndices.has(index),
  );
  const displayed = metricPoints.map((point) =>
    getBillFactDisplay(point.value),
  );
  const anchored = !temperature && displayed.some((point) => point.numeric);
  const textOnly = !temperature && !dates.length && !anchored;
  const visiblePoints =
    anchored && !moreFiguresOpen
      ? getPrimaryMetricFacts(metricPoints)
      : metricPoints;
  const contextualPoints = !temperature
    ? metricPoints.filter(
        (point) =>
          Boolean(getBillMetricComparison(point, changes)) ||
          Boolean(point.note && !isEssentialMetricNote(point.note)),
      )
    : [];
  const gutter = S.block;
  const stacked =
    anchored ||
    wrappedValue ||
    fontScale >= 1.3 ||
    contentWidth < 2 * 144 * fontScale + gutter ||
    (!temperature &&
      displayed.some((point) => !point.numeric || point.value.length > 6));
  const columns = readerColumns(
    contentWidth,
    !stacked && visiblePoints.length > 1 ? 2 : 1,
    temperature ? 0 : gutter,
    PixelRatio.get(),
  );
  const positions =
    figure.kind === "temperature"
      ? figure.points.map((point) =>
          readerScalePosition(
            point.amount,
            figure.min,
            figure.max,
            contentWidth,
          ),
        )
      : [];
  const supporting = figure.kind === "temperature" ? figure.supporting : [];
  const sources = [...figure.points, ...supporting].filter(
    (point) => point.quote && onViewSource,
  );
  const showHeading =
    temperature ||
    dates.length > 0 ||
    !displayed.every((point) => point.numeric);
  const hasDetails =
    contextualPoints.length > 0 ||
    sources.length > 0 ||
    (temperature &&
      (supporting.length > 0 || figure.points.some((point) => point.note)));
  return (
    <Animated.View
      layout={readerLayout}
      onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
      style={s.figure}
      testID="bill-fact-figure"
    >
      {showHeading ? (
        <Text
          style={[s.figureHeading, textOnly && s.detailHeading]}
          accessibilityRole="header"
        >
          {t(
            figure.kind === "temperature"
              ? "readerUi.heatThresholds"
              : dates.length
                ? "readerUi.keyDates"
                : displayed.every((point) => point.numeric)
                  ? "readerUi.inNumbers"
                  : "readerUi.keyDetails",
          )}
        </Text>
      ) : null}
      {temperature ? (
        <Text style={s.context}>{t("readerUi.proposedThresholdsNote")}</Text>
      ) : null}
      {dates.length ? (
        <View style={s.dateTimeline} testID="bill-date-timeline">
          {dates.map(({ fact, index }, position) => (
            <ReaderTimelineRow
              key={index}
              firstLineHeight={28}
              hasNext={position < dates.length - 1}
            >
              <FactTarget
                label={`${fact.label.replaceAll("**", "")}. ${fact.value.replaceAll("**", "")}`}
                expanded={selectedFactIndex === index}
                onPress={
                  fact.note || fact.quote
                    ? () => {
                        setDetailsOpen(false);
                        setSelectedFactIndex(
                          selectedFactIndex === index ? null : index,
                        );
                      }
                    : undefined
                }
                testID={`figure-inspect-${index}`}
                style={s.metricHeading}
              >
                <View style={s.factLabel}>
                  <Text style={[s.dateValue, s.factLabelText]}>
                    {fact.value.replaceAll("**", "")}
                  </Text>
                  {fact.note || fact.quote ? (
                    <ReaderDisclosureIcon
                      expanded={selectedFactIndex === index}
                    />
                  ) : null}
                </View>
                <Text style={s.label}>{fact.label.replaceAll("**", "")}</Text>
                {fact.note ? (
                  <Text style={s.note}>{fact.note.replaceAll("**", "")}</Text>
                ) : null}
              </FactTarget>
            </ReaderTimelineRow>
          ))}
        </View>
      ) : null}
      {dates.length && metricPoints.length ? (
        <Text style={s.otherFacts}>{t("readerUi.atAGlance")}</Text>
      ) : null}
      {metricPoints.length ? (
        <View
          style={[
            s.values,
            !showHeading && { marginTop: 0 },
            figure.kind === "temperature" && s.thresholdValues,
            stacked && s.stacked,
            textOnly && s.textFacts,
            { columnGap: columns.gap },
          ]}
        >
          {visiblePoints.map((point, index) => {
            const supplied = point.value.replaceAll("**", "");
            const metric = getBillFactDisplay(point.value);
            const percent = getBillPercent(point.value);
            const prominent = anchored && metric.numeric;
            const factIndex = figure.points.findIndex(
              (candidate) => candidate === point,
            );
            const canInspect =
              Boolean(point.note) ||
              Boolean(point.quote) ||
              Boolean(getBillMetricComparison(point, changes));
            const selected = selectedFactIndex === factIndex;
            const inspect = canInspect
              ? () => {
                  setDetailsOpen(false);
                  setSelectedFactIndex(selected ? null : factIndex);
                }
              : undefined;
            const cellWidth =
              columns.widths[index % columns.widths.length] ?? 0;
            const plotWidth = cellWidth;
            const impactTag =
              percent !== null && !!point.note && point.note.length <= 80;
            const rowStart =
              Math.floor(index / columns.widths.length) * columns.widths.length;
            const peers = visiblePoints.slice(
              rowStart,
              rowStart + columns.widths.length,
            );
            const labelHeight = Math.max(
              T.label.lineHeight * fontScale,
              ...peers.map(
                (peer) => labelHeights[peer.label + "\0" + peer.value] ?? 0,
              ),
            );
            const prefixSlot = peers.some(
              (peer) => "prefix" in getBillFactDisplay(peer.value),
            );
            return (
              <View
                key={index}
                style={[
                  s.metric,
                  !metric.numeric && !temperature && s.textFact,
                  { width: cellWidth },
                ]}
              >
                <FactTarget
                  label={`${point.label.replaceAll("**", "")}. ${supplied}`}
                  onPress={inspect}
                  expanded={selected}
                  testID={`figure-inspect-${factIndex}`}
                  style={[
                    s.metricHeading,
                    !metric.numeric && !temperature && s.textFactHeading,
                    figure.kind === "temperature" && !stacked && s.centered,
                    selected && s.selectedMetric,
                  ]}
                >
                  {figure.kind === "metrics" ? (
                    <View
                      style={[
                        s.factLabel,
                        !stacked && { minHeight: labelHeight },
                      ]}
                    >
                      <Text
                        style={[
                          s.label,
                          prominent && s.metricTitle,
                          !metric.numeric && s.detailLabel,
                          s.factLabelText,
                        ]}
                        onLayout={(event) => {
                          const measured = event.nativeEvent.layout.height;
                          const key = point.label + "\0" + point.value;
                          setLabelHeights((previous) =>
                            Math.abs((previous[key] ?? 0) - measured) < 0.5
                              ? previous
                              : { ...previous, [key]: measured },
                          );
                        }}
                      >
                        {point.label.replaceAll("**", "")}
                      </Text>
                      {canInspect && !metric.numeric ? (
                        <ReaderDisclosureIcon expanded={selected} />
                      ) : null}
                    </View>
                  ) : null}
                  {"prefix" in metric && metric.prefix ? (
                    <Text style={s.qualifier}>{metric.prefix}</Text>
                  ) : !stacked && prefixSlot ? (
                    <View
                      style={{ height: T.label.lineHeight * fontScale }}
                      accessible={false}
                    />
                  ) : null}
                  <Text
                    onTextLayout={(event) => {
                      if (!stacked && event.nativeEvent.lines.length > 1)
                        setWrappedValue(true);
                    }}
                    style={[
                      s.value,
                      !metric.numeric && !temperature && s.textValue,
                      metric.numeric && s.numericValue,
                      temperature && s.temperatureValue,
                    ]}
                  >
                    {figure.kind === "temperature"
                      ? `${figure.points[index]?.amount ?? ""}°${figure.unit}`
                      : metric.value}
                  </Text>
                  {figure.kind === "metrics" && metric.qualifier ? (
                    <Text style={s.qualifier}>{metric.qualifier}</Text>
                  ) : null}
                  {figure.kind === "temperature" ? (
                    <View style={s.thresholdLabel}>
                      <Text style={[s.label, { flexShrink: 1 }]}>
                        {point.label.replaceAll("**", "")}
                      </Text>
                      {canInspect && !metric.numeric ? (
                        <ReaderDisclosureIcon expanded={selected} />
                      ) : null}
                    </View>
                  ) : null}
                </FactTarget>
                {percent !== null && plotWidth > 8 ? (
                  <FactTarget
                    style={s.percentPlot}
                    label={t("readerUi.inspectFigure", {
                      label: point.label.replaceAll("**", ""),
                    })}
                    onPress={inspect}
                    expanded={selected}
                    testID={`bill-percent-plot-${index}`}
                  >
                    <Svg
                      width={plotWidth}
                      height={20}
                      viewBox={`0 0 ${plotWidth} 20`}
                    >
                      <Line
                        x1={4}
                        x2={Math.max(4, plotWidth - 4)}
                        y1={10}
                        y2={10}
                        stroke={R.rule}
                        strokeWidth={4}
                        strokeLinecap="round"
                      />
                      <Line x1={4} x2={4} y1={6} y2={14} stroke={R.muted} />
                      <Line
                        x1={4}
                        x2={4 + (Math.max(0, plotWidth - 8) * percent) / 100}
                        y1={10}
                        y2={10}
                        stroke={R.secondary}
                        strokeWidth={4}
                        strokeLinecap="round"
                      />
                      <Line
                        x1={plotWidth - 4}
                        x2={plotWidth - 4}
                        y1={6}
                        y2={14}
                        stroke={R.muted}
                      />
                      <Circle
                        cx={4 + (Math.max(0, plotWidth - 8) * percent) / 100}
                        cy={10}
                        r={4}
                        fill={R.secondary}
                      />
                    </Svg>
                    <View style={s.axisLabels}>
                      <Text style={s.axisLabel}>0%</Text>
                      <Text style={s.axisLabel}>100%</Text>
                    </View>
                  </FactTarget>
                ) : null}
                {figure.kind === "metrics" &&
                point.note &&
                (impactTag || isEssentialMetricNote(point.note)) ? (
                  <View>
                    <Text
                      style={[
                        impactTag ? s.impactText : s.note,
                        !metric.numeric && s.detailNote,
                      ]}
                    >
                      {point.note.replaceAll("**", "")}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {temperature &&
      positions.length === 2 &&
      positions.every((position) => position !== null) ? (
        <Svg
          viewBox={`0 0 ${contentWidth} 32`}
          width="100%"
          height={32}
          preserveAspectRatio="none"
          accessible={false}
        >
          <Line x1={0} y1={16} x2={contentWidth} y2={16} stroke={R.rule} />
          <Line
            x1={positions[0] ?? 0}
            y1={16}
            x2={positions[1] ?? contentWidth}
            y2={16}
            stroke={R.secondary}
            strokeWidth={1}
            opacity={0.7}
          />
          {positions.map((x) => (
            <Circle
              key={x}
              cx={x}
              cy={16}
              r={3}
              fill={R.secondary}
              onPress={() => {
                setDetailsOpen(false);
                setSelectedFactIndex(positions.indexOf(x));
              }}
            />
          ))}
        </Svg>
      ) : null}
      {figure.kind === "temperature" && stacked ? (
        <View style={s.thresholdLegend} accessible={false}>
          {figure.points.map((point) => (
            <Text key={point.amount} style={s.thresholdLegendValue}>
              {point.amount}°{figure.unit}
            </Text>
          ))}
        </View>
      ) : null}
      {selectedFact ? (
        <View
          key={selectedFactIndex}
          onLayout={(event) => onInspect?.(event.nativeEvent.layout.y)}
        >
          <ReaderReveal style={s.inspector}>
            <View style={s.inspectorHeading}>
              <Text style={s.inspectorTitle} accessibilityRole="header">
                {selectedFact.label.replaceAll("**", "")}
              </Text>
              <ReaderPressable
                style={s.closeInspector}
                accessibilityRole="button"
                accessibilityLabel={t("readerUi.close")}
                onPress={() => {
                  setSelectedFactIndex(null);
                  onInspect?.(0);
                }}
                testID="figure-inspect-close"
              >
                <Icon name="close" size={16} color={R.muted} />
              </ReaderPressable>
            </View>
            <Text style={s.qualifier}>
              {selectedFact.value.replaceAll("**", "")}
            </Text>
            {selectedFact.note ? (
              <Text style={s.note}>
                {selectedFact.note.replaceAll("**", "")}
              </Text>
            ) : null}
            {selectedFact.quote && !onViewSource ? (
              <Text style={s.note}>{selectedFact.quote.text}</Text>
            ) : null}
            {selectedComparison ? (
              <Text style={s.comparison}>
                <Text style={s.comparisonLabel}>
                  {t(
                    legalStatus === "enacted"
                      ? "readerUi.metricBeforeLaw"
                      : "readerUi.metricToday",
                  )}{" "}
                </Text>
                {selectedComparison}
              </Text>
            ) : null}
            {selectedFact.quote && onViewSource ? (
              <ReaderPressable
                style={s.sourceToggle}
                accessibilityRole="button"
                accessibilityLabel={t("readerUi.viewFigureSource", {
                  label: selectedFact.label.replaceAll("**", ""),
                })}
                onPress={() =>
                  selectedFact.quote && onViewSource(selectedFact.quote)
                }
                testID="figure-inspect-source"
              >
                <Icon name="quote" size={12} color={R.muted} />
                <Text style={s.sourceText}>{t("readerUi.viewSource")}</Text>
                {selectedFact.quote.locator ? (
                  <Text style={s.sourceLabel}>
                    {selectedFact.quote.locator}
                  </Text>
                ) : null}
              </ReaderPressable>
            ) : null}
          </ReaderReveal>
        </View>
      ) : null}
      {hasDetails || (anchored && metricPoints.length > 1) ? (
        <View style={s.evidence}>
          <ReaderPressable
            style={s.sourceToggle}
            onPress={() => {
              setSelectedFactIndex(null);
              const expanded = detailsOpen || moreFiguresOpen;
              setDetailsOpen(!expanded);
              setMoreFiguresOpen(!expanded);
              if (expanded) onInspect?.(0);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen || moreFiguresOpen }}
            testID="figure-sources"
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon
                name={detailsOpen || moreFiguresOpen ? "close" : "activity"}
                size={16}
                color={R.muted}
              />
            </View>
            <Text style={s.sourceLabel}>
              {t(
                detailsOpen || moreFiguresOpen
                  ? "readerUi.closeDetails"
                  : anchored && metricPoints.length > 1
                    ? "readerUi.allNumbersSources"
                    : temperature
                      ? "readerUi.thresholdDetails"
                      : contextualPoints.length
                        ? "readerUi.figureDetails"
                        : "readerUi.figureSources",
              )}
            </Text>
          </ReaderPressable>
          {detailsOpen && hasDetails ? (
            <ReaderReveal style={s.details}>
              {contextualPoints.map((point, index) => {
                const comparison = getBillMetricComparison(point, changes);
                return (
                  <View key={`context-${index}`} style={s.detail}>
                    <Text style={s.label}>
                      {point.label.replaceAll("**", "")}
                    </Text>
                    {point.note && !isEssentialMetricNote(point.note) ? (
                      <Text style={s.note}>
                        {point.note.replaceAll("**", "")}
                      </Text>
                    ) : null}
                    {comparison ? (
                      <Text
                        style={s.comparison}
                        testID={`figure-comparison-${index}`}
                      >
                        <Text style={s.comparisonLabel}>
                          {t(
                            legalStatus === "enacted"
                              ? "readerUi.metricBeforeLaw"
                              : "readerUi.metricToday",
                          )}{" "}
                        </Text>
                        {comparison}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
              {temperature
                ? figure.points.map((point, index) =>
                    point.note ? (
                      <View key={index} style={s.detail}>
                        <Text style={s.label}>
                          {point.label.replaceAll("**", "")}
                        </Text>
                        <Text style={s.note}>
                          {point.note.replaceAll("**", "")}
                        </Text>
                      </View>
                    ) : null,
                  )
                : null}
              {supporting.map((point, index) => (
                <View key={`supporting-${index}`} style={s.detail}>
                  <Text style={s.label}>
                    {point.label.replaceAll("**", "")}
                  </Text>
                  <Text style={s.qualifier}>
                    {point.value.replaceAll("**", "")}
                  </Text>
                  {point.note ? (
                    <Text style={s.note}>
                      {point.note.replaceAll("**", "")}
                    </Text>
                  ) : null}
                </View>
              ))}
              {sources.map((point, index) => (
                <ReaderPressable
                  key={index}
                  style={s.source}
                  onPress={() => point.quote && onViewSource?.(point.quote)}
                  accessibilityRole="button"
                  accessibilityLabel={t("readerUi.viewFigureSource", {
                    label: point.label.replaceAll("**", ""),
                  })}
                  testID={`figure-source-${index}`}
                >
                  <Text style={s.sourceText}>
                    {point.label.replaceAll("**", "")}
                  </Text>
                  {point.quote?.locator ? (
                    <Text style={s.sourceLabel}>{point.quote.locator}</Text>
                  ) : null}
                </ReaderPressable>
              ))}
            </ReaderReveal>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  figure: { paddingTop: S.inline, paddingBottom: S.block },
  dateTimeline: { marginTop: 20 },
  dateValue: {
    ...T.body,
    fontFamily: fontBody.semibold,
    fontSize: 22,
    lineHeight: 28,
    color: R.text,
  },
  otherFacts: { ...T.label, color: R.muted, marginTop: S.block },
  values: { flexDirection: "row", flexWrap: "wrap", gap: 24, marginTop: 20 },
  textFacts: { gap: S.group, marginTop: S.group },
  textFact: { gap: 4 },
  textFactHeading: { gap: 4 },
  detailHeading: { color: R.secondary },
  detailLabel: { color: R.muted },
  detailNote: { ...T.label, color: R.muted },
  textValue: { ...T.body, fontFamily: fontBody.medium, letterSpacing: 0 },
  thresholdValues: { gap: 0, marginTop: 20 },
  thresholdLegend: { flexDirection: "row" },
  thresholdLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  thresholdLegendValue: {
    ...T.label,
    color: R.text,
    width: "50%",
    textAlign: "center",
  },
  figureHeading: { ...T.label, color: R.secondary, marginBottom: 4 },
  numericValue: {
    fontFamily: fontBody.semibold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1.2,
    color: R.text,
  },
  temperatureValue: {
    fontFamily: fontBody.semibold,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1.6,
    color: R.text,
  },
  stacked: { flexDirection: "column", flexWrap: "nowrap", gap: 24 },
  metric: { gap: S.inline },
  metricTitle: { ...T.label, fontFamily: fontBody.regular, color: R.muted },
  comparison: { ...T.body, color: R.reading },
  comparisonLabel: { fontFamily: fontBody.semibold, color: R.text },
  impactText: { ...T.label, color: R.reading },
  percentPlot: { paddingVertical: 4 },
  axisLabels: { flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { ...T.label, color: R.muted },
  metricHeading: {
    gap: S.inline,
    minHeight: 44,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  selectedMetric: { borderBottomColor: R.secondary },
  inspector: {
    gap: S.inline,
    paddingVertical: S.group,
    marginTop: S.group,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: R.rule,
  },
  inspectorHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.inline,
  },
  inspectorTitle: { ...T.action, color: R.text, flex: 1 },
  closeInspector: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  centered: { alignItems: "center" },
  value: {
    fontFamily: fontBody.medium,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: R.text,
  },
  factLabel: { flexDirection: "row", alignItems: "flex-start", gap: S.inline },
  factLabelText: { flex: 1 },
  label: { ...T.label, fontFamily: fontBody.medium, color: R.reading },
  qualifier: { ...T.label, color: R.reading },
  details: { gap: 16, paddingTop: 8, paddingBottom: 4 },
  detail: { gap: 4 },
  note: { ...T.body, color: R.reading },
  context: { ...T.label, color: R.muted },
  evidence: { marginTop: 8 },
  sourceToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sourceLabel: { ...T.label, color: R.muted, flexShrink: 1 },
  source: {
    minHeight: 44,
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
  },
  sourceText: { ...T.action, color: R.link },
});
