"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { entrySchema, localDate, money, type Entry, type Transaction } from "@/lib/ledger";

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
export const label = (value: string) => value.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
const blankEntry = (): Entry => ({ type: "expense", amount: "", category: "other-expense", date: localDate(), description: "" });

function useTrackerState() {
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
  function startManual() {
    setDraft({ entry: blankEntry(), draftId: null });
    setMessage("Enter the details and confirm to save.");
  }
  function cancelDraft() { setDraft(null); setMessage("Draft cancelled. Nothing saved."); }
  function changeText(value: string) { setText(value); parseOperation.current = null; }
  function changeType(value: Entry["type"]) {
    if (draft && !uncertainSave) setDraft({ ...draft, entry: { ...draft.entry, type: value, category: value === "income" ? "other-income" : "other-expense" } });
  }
  async function loadMonth() {
    setBusy(true);
    try { await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load this month."); }
    finally { setBusy(false); }
  }
  return { ready, busy, text, message, draft, ledger, month, uncertainSave,
    setMonth, parse, save, edit, startManual, cancelDraft, changeText, changeType, loadMonth };
}

const TrackerContext = createContext<ReturnType<typeof useTrackerState> | null>(null);
export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const state = useTrackerState();
  return <TrackerContext.Provider value={state}>{children}</TrackerContext.Provider>;
}
export function useTracker() {
  const value = useContext(TrackerContext);
  if (!value) throw new Error("TrackerProvider is required");
  return value;
}
