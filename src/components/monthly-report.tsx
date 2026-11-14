"use client";

import { useState } from "react";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { money } from "@/lib/ledger";
import { calendarDays } from "@/lib/reporting";
import { label, useTracker } from "./tracker-provider";

export function MonthlyReportCharts() {
  const { ledger } = useTracker();
  if (!ledger) return <Text role="status">Loading monthly report…</Text>;
  if (!ledger.report) return <Text role="status">Monthly report is unavailable. Reload to retry.</Text>;
  const { categories, days } = ledger.report;
  const calendar = calendarDays(ledger.month, days);
  const maxCategory = Math.max(1, ...categories.map(row => row.amount_minor));
  const maxDay = Math.max(1, ...calendar.map(day => Math.max(day.income, day.expenses)));
  const points = (key: "income" | "expenses") => calendar.map((day, i) =>
    `${20 + i * 560 / (calendar.length - 1)},${150 - day[key] / maxDay * 130}`).join(" ");
  return <Grid columns={{minWidth:280,max:2}} gap={8} align="start">
    <VStack as="section" aria-labelledby="category-title" gap={4}>
      <Heading level={2} id="category-title" style={{fontFamily:"var(--font-family-body)"}}>Where it went</Heading>
      <Text type="supporting">Confirmed expenses by category · {ledger.month}</Text>
      {categories.length ? <List edge="flush">
        {categories.map(row => <ListItem key={row.category}
          label={<HStack gap={3} hAlign="between" wrap="wrap"><Text>{label(row.category)}</Text><Text hasTabularNumbers>{money(row.amount_minor)}</Text></HStack>}
          description={<svg viewBox="0 0 300 12" width="100%" height="1rem" aria-hidden="true">
            <rect width="300" height="12" rx="6" fill="var(--color-background-surface)" />
            <rect width={row.amount_minor / maxCategory * 300} height="12" rx="6" fill="var(--color-text-primary)" />
          </svg>} />)}
      </List> : <Text>No expenses recorded for this month.</Text>}
    </VStack>
    <VStack as="section" aria-labelledby="daily-title" gap={4}>
      <Heading level={2} id="daily-title" style={{fontFamily:"var(--font-family-body)"}}>Daily activity</Heading>
      <Text type="supporting">Daily totals in INR · solid line: income · dashed line: expenses</Text>
      {days.length ? <>
        <svg viewBox="0 0 600 190" width="100%" role="img" aria-label={`Daily income and expenses for ${ledger.month}.`}>
          <line x1="20" x2="580" y1="150" y2="150" stroke="var(--color-text-secondary)" />
          <polyline points={points("income")} fill="none" stroke="var(--color-text-primary)" strokeWidth="3" />
          <polyline points={points("expenses")} fill="none" stroke="var(--color-text-secondary)" strokeWidth="3" strokeDasharray="6 4" />
          <text x="20" y="180" fill="var(--color-text-secondary)" fontSize="14">Day 1</text>
          <text x="540" y="180" fill="var(--color-text-secondary)" fontSize="14">{calendar.length}</text>
        </svg>
        <Text type="supporting">Daily scale: {money(0)}–{money(maxDay)}. Days without entries are zero.</Text>
      </> : <Text>No entries recorded for this month. Add an income or expense to see daily activity.</Text>}
    </VStack>
  </Grid>;
}

export function useMonthlyExport() {
  const { ledger, busy, ready } = useTracker();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (!ledger || exporting) return;
    setExporting(true); setError("");
    try {
      const response = await fetch(`/api/export?month=${encodeURIComponent(ledger.month)}`, {cache:"no-store"});
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Export failed. Retry.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `money-tracker-${ledger.month}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed. Retry.");
    } finally { setExporting(false); }
  }
  return { ledger, busy, ready, exporting, error, download };
}
