"use client";

import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { MonthPicker } from "./month-picker";
import { VStack } from "@astryxdesign/core/VStack";
import { formatEntryDate, money, type Transaction } from "@/lib/ledger";
import { label, useTracker } from "./tracker-provider";

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <VStack gap={3}><Text type="supporting">{eyebrow}</Text>
    <Heading level={1}>{title}</Heading><Text as="p" color="secondary">{description}</Text></VStack>;
}
export function ConnectionStatus() {
  const { message, ready } = useTracker();
  return <VStack gap={2}><Text as="p" role="status" aria-live="polite">{message}</Text>
    {!ready && <Text type="supporting">If connection fails, reload to retry or sign in again.</Text>}
  </VStack>;
}
export function Summary() {
  const { ledger } = useTracker();
  return <Grid columns={{ minWidth: 150, max: 3 }} gap={6}>
    {[["Income",ledger?.summary.income],["Expenses",ledger?.summary.expenses],["Net cash flow",ledger ? ledger.summary.income-ledger.summary.expenses : undefined]].map(([name,value]) =>
      <VStack key={name} gap={2}><Text type="supporting">{name}</Text>
        <Text type="large" hasTabularNumbers weight="semibold">{value === undefined ? "—" : money(Number(value))}</Text></VStack>)}
  </Grid>;
}
export function MonthFilter() {
  const { month, setMonth, loadMonth, busy, ready } = useTracker();
  return <HStack wrap="wrap" gap={3} vAlign="end">
    <MonthPicker value={month} onChange={setMonth} disabled={busy || !ready} />
    <Button label="Load month" onClick={() => void loadMonth()} isDisabled={busy || !ready} />
  </HStack>;
}
export function TransactionRows({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) return <VStack gap={3} paddingBlock={6}>
    <Text weight="medium">No entries to show</Text><Text color="secondary">Add an entry in Chat, or choose another month.</Text>
    <Button label="Go to chat" href="/chat" as={Link} variant="ghost" />
  </VStack>;
  return <List edge="flush">{transactions.map((entry) => <ListItem key={entry.id}
    label={<Text weight="medium">{entry.description}</Text>}
    description={<Text type="supporting">{formatEntryDate(entry.date)} · {label(entry.category)} · {label(entry.type)}</Text>}
    endContent={<Text hasTabularNumbers weight="medium">{entry.type === "income" ? "+" : "−"}{money(entry.amount_minor)}</Text>} />)}</List>;
}
