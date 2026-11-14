"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { categories, entrySchema, localDate, money, type Entry, type Transaction } from "@/lib/ledger";

type Ledger = { transactions: Transaction[]; summary: { income: number; expenses: number }; month: string };
type Draft = { entry: Entry; draftId: string | null };
type Save = { entry: Entry; draftId: string | null; requestId: string };
class RequestError extends Error {}
async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, data === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const message = result.error || "The request could not be completed.";
    // A service failure after a write can have an unknown commit outcome.
    if (response.status >= 500) throw new Error(message);
    throw new RequestError(message);
  }
  return result;
}
const label = (value: string) => value.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
const blankEntry = (): Entry => ({ type: "expense", amount: "", category: "other-expense", date: localDate(), description: "" });

export default function Home() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("Connecting to your demo ledger…");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [month, setMonth] = useState("");
  const [uncertainSave, setUncertainSave] = useState(false);
  const saveOperation = useRef<Save | null>(null);
  const parseOperation = useRef<{ text: string; requestId: string } | null>(null);

  useEffect(() => {
    let active = true;
    async function connect() {
      try {
        await api("/api/session", {});
        const data = await api<Ledger>("/api/transactions");
        if (active) { setLedger(data); setMonth(data.month); setReady(true); setMessage("Connected. Try an example or add an entry manually."); }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not connect. Reload to retry.");
      }
    }
    void connect();
    return () => { active = false; };
  }, []);

  async function refresh(target = month) {
    const data = await api<Ledger>(`/api/transactions?month=${encodeURIComponent(target)}`);
    setLedger(data); setMonth(data.month);
  }
  async function parse() {
    setBusy(true); setMessage("Organizing your entry…");
    if (parseOperation.current?.text !== text) parseOperation.current = { text, requestId: crypto.randomUUID() };
    try {
      const result = await api<{ status: string; entry?: Entry; draftId: string; message?: string }>("/api/parse", parseOperation.current);
      if (result.status === "candidate" && result.entry) {
        setDraft({ entry: result.entry, draftId: result.draftId });
        setMessage("Review the details below. Nothing has been saved to your ledger yet.");
      } else {
        if (result.status === "unavailable") parseOperation.current = null;
        setMessage(result.message || "Please add more detail or use manual entry. For this demo, resend a complete sentence to clarify.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Chat entry failed. Manual entry is available."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!draft) return;
    const valid = entrySchema.safeParse(draft.entry);
    if (!valid.success) { setMessage(valid.error.issues[0].message); return; }
    saveOperation.current ??= { entry: valid.data, draftId: draft.draftId, requestId: crypto.randomUUID() };
    setBusy(true); setMessage("Saving your confirmed entry…");
    try {
      const result = await api<{ transaction: Transaction }>("/api/transactions", saveOperation.current);
      saveOperation.current = null; setUncertainSave(false); setDraft(null); setText(""); parseOperation.current = null;
      setMessage(`Saved ${money(result.transaction.amount_minor)} under ${label(result.transaction.category)} for ${result.transaction.date}.`);
      try { await refresh(result.transaction.date.slice(0, 7)); }
      catch { setMessage("Your entry was saved. Reload the page to refresh your records."); }
    } catch (error) {
      if (error instanceof RequestError) { saveOperation.current = null; setUncertainSave(false); setMessage(error.message); }
      else { setUncertainSave(true); setMessage("Save status is unknown. Retry the same save below; it will not create a duplicate."); }
    } finally { setBusy(false); }
  }
  function edit<K extends keyof Entry>(key: K, value: Entry[K]) {
    if (draft && !uncertainSave) setDraft({ ...draft, entry: { ...draft.entry, [key]: value } });
  }
  const actionsDisabled = busy || !ready || !!draft;

  return (
    <VStack minHeight="100svh" padding={5} gap={8} style={{ background: "var(--color-background-body)", color: "var(--color-text-primary)" }}>
      <HStack as="header" hAlign="between" wrap="wrap" gap={3}>
        <Text type="large" weight="bold">Money Tracker</Text>
        <Text type="supporting">Cloudflare proof of concept · INR · Asia/Kolkata</Text>
      </HStack>
      <VStack as="main" width="100%" maxWidth="70rem" gap={6} style={{ marginInline: "auto" }}>
        <Heading level={1}>A little clarity, every day.</Heading>
        <Text as="p" color="secondary">Test data only. This demo ledger belongs to this browser cookie for seven days. No Google login yet; clearing cookies loses access. Demo records are automatically removed after expiry.</Text>
        <Text as="p" role="status" aria-live="polite">{message}</Text>
        <Grid columns={{ minWidth: 280, max: 2 }} gap={8}>
          <VStack as="section" gap={5} aria-labelledby="entry-title">
            <Heading level={2} id="entry-title" style={{ fontFamily: "var(--font-family-body)" }}>Add an entry</Heading>
            <TextArea label="Expense or income" value={text} onChange={(value) => { setText(value); parseOperation.current = null; }}
              placeholder="Spent ₹30 on a rickshaw to work" maxLength={500} width="100%" rows={3} isDisabled={busy || !!draft} />
            <HStack gap={3} wrap="wrap">
              <Button label="Organize with AI" variant="primary" onClick={() => void parse()} isDisabled={actionsDisabled || !text.trim() || text.length > 500} isLoading={busy && !draft} />
              <Button label="Add manually" onClick={() => { setDraft({ entry: blankEntry(), draftId: null }); setMessage("Enter the details and confirm to save."); }} isDisabled={actionsDisabled} />
            </HStack>
            <HStack gap={2} wrap="wrap">
              {["Spent 30 Rs on Rickshaw to work", "Got 15000 salary today"].map((example) => (
                <Button key={example} label={example} variant="ghost" onClick={() => { setText(example); parseOperation.current = null; }} isDisabled={actionsDisabled} />
              ))}
            </HStack>
            <Text type="supporting">AI requests are capped at 10 per browser and 50 across the demo per UTC day. Send one complete entry at a time. Manual entry works without AI.</Text>
            {draft && <Card>
              <VStack gap={4}>
                <Heading level={3} style={{ fontFamily: "var(--font-family-body)" }}>Review transaction</Heading>
                <Text type="supporting">Not saved yet · INR</Text>
                <Selector label="Type" options={[{value:"expense",label:"Expense"},{value:"income",label:"Income"}]} value={draft.entry.type}
                  onChange={(value) => { if (!uncertainSave) setDraft({ ...draft, entry: { ...draft.entry, type: value as Entry["type"], category: value === "income" ? "other-income" : "other-expense" } }); }} isDisabled={busy || uncertainSave} />
                <TextInput label="Amount (INR)" value={draft.entry.amount} inputMode="decimal" onChange={(value) => edit("amount", value)} isDisabled={busy || uncertainSave} width="100%" />
                <Selector label="Category" options={categories.filter((category) => draft.entry.type === "income" ? ["salary","other-income"].includes(category) : !["salary","other-income"].includes(category)).map((category) => ({value:category,label:label(category)}))}
                  value={draft.entry.category} onChange={(value) => edit("category", value as Entry["category"])} isDisabled={busy || uncertainSave} />
                <TextInput label="Date (YYYY-MM-DD)" value={draft.entry.date} onChange={(value) => edit("date", value)} isDisabled={busy || uncertainSave} width="100%" />
                <TextInput label="Description" value={draft.entry.description} onChange={(value) => edit("description", value)} isDisabled={busy || uncertainSave} width="100%" />
                <HStack wrap="wrap" gap={3}>
                  <Button label={uncertainSave ? "Retry same save" : "Confirm and save"} variant="primary" onClick={() => void save()} isLoading={busy} />
                  <Button label="Cancel" onClick={() => { setDraft(null); setMessage("Draft cancelled. Nothing saved."); }} isDisabled={busy || uncertainSave} />
                </HStack>
              </VStack>
            </Card>}
          </VStack>
          <VStack as="section" gap={5} aria-labelledby="records-title">
            <Heading level={2} id="records-title" style={{ fontFamily: "var(--font-family-body)" }}>Your saved entries</Heading>
            <HStack wrap="wrap" gap={3} vAlign="end">
              <TextInput label="Month (YYYY-MM)" value={month} onChange={setMonth} width="100%" isDisabled={busy || !ready} />
              <Button label="Load month" onClick={() => { setBusy(true); void refresh().catch((error) => setMessage(error.message)).finally(() => setBusy(false)); }} isDisabled={busy || !ready} />
            </HStack>
            {ledger && <>
              <Text type="supporting">Confirmed records for {ledger.month}</Text>
              <Grid columns={{ minWidth: 150, max: 3 }} gap={3}>
                {[["Income",ledger.summary.income],["Expenses",ledger.summary.expenses],["Net cash flow",ledger.summary.income-ledger.summary.expenses]].map(([name,value]) => (
                  <VStack gap={1} key={name}>
                    <Text type="supporting">{name}</Text><Text type="large" hasTabularNumbers>{money(Number(value))}</Text>
                  </VStack>
                ))}
              </Grid>
              {ledger.transactions.length === 0 ? <Text as="p" color="secondary">No saved entries this month. Add an entry to try the full flow.</Text> :
                <List edge="flush">{ledger.transactions.map((transaction) => (
                  <ListItem key={transaction.id} label={transaction.description} description={`${transaction.date} · ${label(transaction.category)} · ${label(transaction.type)}`}
                    endContent={<Text hasTabularNumbers>{transaction.type === "income" ? "+" : "−"}{money(transaction.amount_minor)}</Text>} />
                ))}</List>}
            </>}
            <Text type="supporting">Up to 100 test records per browser. Net cash flow is recorded income minus expenses, not a bank balance.</Text>
          </VStack>
        </Grid>
      </VStack>
    </VStack>
  );
}
