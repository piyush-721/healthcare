"use client";

import { ChartLine } from "lucide-react";
import { useId, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { MedicalDisclaimer } from "@/components/domain/MedicalDisclaimer";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Select,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useLabTestsQuery, useLabTrendQuery } from "@/services/labs";
import type { LabTestSummary, TrendPoint } from "@/types/api";

import { formatRange, rangeLabel, trimNumber } from "./RangeBadge";

const BRAND = "#0f6b66";
const BAND = "#d5f2ed";
const GRID = "#e2e8f0";
const AXIS = "#64748b";

type ChartPoint = { date: string; label: string; value: number; point: TrendPoint };

export function toChartPoints(points: TrendPoint[]): ChartPoint[] {
  return points
    .map((point) => ({
      date: point.report_date,
      label: formatDate(point.report_date),
      value: Number(point.value),
      point,
    }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Use the most recent report's printed range for the shaded band. */
export function referenceBand(
  points: TrendPoint[],
): { low?: number; high?: number; varies: boolean } | null {
  const withRange = points.filter((p) => p.reference_low !== null || p.reference_high !== null);
  if (!withRange.length) return null;
  const latest = [...withRange].sort((a, b) => b.report_date.localeCompare(a.report_date))[0];
  const key = (p: TrendPoint) => `${p.reference_low ?? ""}|${p.reference_high ?? ""}`;
  return {
    low: latest.reference_low !== null ? Number(latest.reference_low) : undefined,
    high: latest.reference_high !== null ? Number(latest.reference_high) : undefined,
    varies: withRange.some((p) => key(p) !== key(latest)),
  };
}

function TrendTooltip({ active, payload, unit }: TooltipContentProps & { unit: string }) {
  const item = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !item) return null;
  const position = rangeLabel(item.point.range_position);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-900">{item.label}</p>
      <p className="text-slate-700">
        {trimNumber(item.point.value)} {unit}
      </p>
      <p className="text-slate-500">
        Report range: {formatRange(item.point.reference_low, item.point.reference_high)}
      </p>
      {position && <p className="text-slate-500">{position}</p>}
    </div>
  );
}

function TrendChart({ test, profileId }: { test: LabTestSummary; profileId: string | undefined }) {
  const query = useLabTrendQuery({ profile: profileId, test: test.test_key });
  const captionId = useId();
  if (query.isLoading) return <LoadingState label="Loading trend…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const points = query.data?.points ?? [];
  const data = toChartPoints(points);
  const unit = test.unit || points[0]?.unit || "";
  if (data.length === 0) {
    return (
      <EmptyState
        icon={ChartLine}
        title="No numeric values to chart"
        description="This test only has text results so far. Numeric values from future reports will appear here."
      />
    );
  }
  const band = referenceBand(points);

  return (
    <figure className="space-y-3" aria-labelledby={captionId}>
      <div
        className="h-64 w-full"
        role="img"
        aria-label={`Line chart of ${test.test_name} values over time. A data table follows.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            {band && (
              <ReferenceArea
                y1={band.low}
                y2={band.high}
                fill={BAND}
                fillOpacity={0.6}
                stroke="none"
                ifOverflow="extendDomain"
              />
            )}
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={16}
            />
            <YAxis
              tick={{ fill: AXIS, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={(props) => <TrendTooltip {...props} unit={unit} />}
              cursor={{ stroke: "#94a3b8", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={test.test_name}
              stroke={BRAND}
              strokeWidth={2}
              dot={{ r: 4, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption id={captionId} className="space-y-1 text-xs text-slate-600">
        <p>
          {test.test_name}
          {unit ? ` (${unit})` : ""} across {data.length} report{data.length === 1 ? "" : "s"}.
          {band &&
            ` Shaded band: reference range printed on the most recent report (${formatRange(
              band.low !== undefined ? String(band.low) : null,
              band.high !== undefined ? String(band.high) : null,
            )}).`}
          {band?.varies && " Ranges differ between reports — see the table."}
        </p>
      </figcaption>
      <details className="rounded-lg border border-slate-200 text-sm">
        <summary className="cursor-pointer px-3 py-2 font-medium text-slate-700">
          Show data table
        </summary>
        <Table caption={`${test.test_name} values by report date`}>
          <THead>
            <tr>
              <Th>Report date</Th>
              <Th>Value</Th>
              <Th>Report range</Th>
              <Th>Position</Th>
            </tr>
          </THead>
          <TBody>
            {[...data].reverse().map((p) => (
              <Tr key={`${p.point.report_id}-${p.date}`}>
                <Td>{p.label}</Td>
                <Td>
                  {trimNumber(p.point.value)} {p.point.unit || unit}
                </Td>
                <Td>{formatRange(p.point.reference_low, p.point.reference_high)}</Td>
                <Td>{rangeLabel(p.point.range_position) ?? "—"}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </details>
    </figure>
  );
}

export function LabTrendCard({ profileId }: { profileId: string | undefined }) {
  const tests = useLabTestsQuery({ profile: profileId });
  const [selected, setSelected] = useState<string>("");
  const list = tests.data ?? [];
  const test = list.find((t) => t.test_key === selected) ?? list[0];

  return (
    <Card>
      <CardHeader title="Trends" description="Follow a test across your reports." />
      <CardBody className="space-y-4">
        {tests.isLoading ? (
          <LoadingState label="Loading tests…" />
        ) : tests.error ? (
          <ErrorState error={tests.error} onRetry={() => void tests.refetch()} />
        ) : !test ? (
          <EmptyState
            icon={ChartLine}
            title="No results to chart yet"
            description="Add a lab report with results and trends for each test will appear here."
          />
        ) : (
          <>
            <Field label="Test">
              <Select
                value={test.test_key}
                onChange={(e) => setSelected(e.target.value)}
                options={list.map((t) => ({
                  value: t.test_key,
                  label: `${t.test_name}${t.unit ? ` (${t.unit})` : ""} · ${t.count} result${t.count === 1 ? "" : "s"}`,
                }))}
              />
            </Field>
            <TrendChart key={test.test_key} test={test} profileId={profileId} />
            <MedicalDisclaimer />
          </>
        )}
      </CardBody>
    </Card>
  );
}
