"use client";

import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import { entrySchema, localDate, money, type Entry, type Transaction } from "@/lib/ledger";

import { previewReducer, isActivePreview, isLockedPreview, type PreviewScenario } from "@/lib/chat-preview";

export type ChatLine = { id: string; sender: "user" | "assistant"; text: string; at: string; previewId?: string };

import { type MonthlyReport } from "@/lib/reporting";

type Ledger = { report?: MonthlyReport; transactions: Transaction[]; summary: { income: number; expenses: number }; month: string };
type Draft = { entry: Entry; draftId: string | null };
export type AppUser = { id: string; name: string; email: string; image?: string | null };
type Save = { entry: Entry; draftId: string | null; requestId: string };
export class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, data === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const message = result.error || "The request could not be completed.";
    // A service failure after a write can have an unknown commit outcome.
    if (response.status >= 500) throw new Error(message);
    throw new RequestError(message, response.status);
  }
  return result;
}
export const label = (value: string) => value.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
const blankEntry = (): Entry => ({ type: "expense", amount: "", category: "other-expense", date: localDate(), description: "" });

function useTrackerState() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previews, previewAction] = useReducer(previewReducer, []);
  const [previewScenario, setPreviewScenario] = useState<PreviewScenario>("expense");
  const activePreview = previews.find(isActivePreview);
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [chatError, setChatError] = useState(false);
  const [failNextChat, setFailNextChat] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const chatSending = useRef(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("Checking your sign-in…");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [month, setMonth] = useState("");
  const [uncertainSave, setUncertainSave] = useState(false);
  const saveOperation = useRef<Save | null>(null);

  useEffect(() => {
    let active = true;
    async function connect() {
      try {
        const session = await api<{ user: AppUser | null; configured: boolean }>("/api/session");
        if (!active) return;
        setConfigured(session.configured); setUser(session.user);
        if (!session.user) { setMessage("Sign in with Google to access your ledger."); return; }
        const data = await api<Ledger>("/api/transactions");
        if (active) { setLedger(data); setMonth(data.month); setReady(true); setMessage("Connected to your account ledger."); }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not connect. Reload to retry.");
      } finally { if (active) setAuthLoading(false); }
    }
    void connect();
    return () => { active = false; };
  }, []);

  function handleExpired(error: unknown) {
    if (error instanceof RequestError && error.status === 401) {
      setReady(false); setUser(null); setLedger(null);
    }
  }
  async function signIn() {
    setBusy(true);
    try {
      const result = await api<{ url: string }>("/api/auth/sign-in/social", { provider: "google", callbackURL: `${window.location.origin}/chat/` });
      const destination = new URL(result.url);
      if (destination.origin !== "https://accounts.google.com") throw new Error("Unexpected sign-in destination.");
      window.location.assign(destination.href);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Google sign-in could not start."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/sign-out", {});
      setReady(false); setUser(null); setLedger(null); setDraft(null); setText(""); setMonth("");
      previewAction({type:"reset"}); setPreviewScenario("expense");
      setChatLines([]); setChatError(false); setHistoryLoaded(false); setFailNextChat(false);
      saveOperation.current = null; parseOperation.current = null; setUncertainSave(false);
      setMessage("You have signed out.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not sign out. Please retry."); }
    finally { setBusy(false); }
  }
  async function refresh(target = month) {
    const data = await api<Ledger>(`/api/transactions?month=${encodeURIComponent(target)}`);
    setLedger(data); setMonth(data.month);
  }
  const parseOperation = useRef<{ text: string; requestId: string } | null>(null);
  async function parse() {
    if (chatSending.current || busy || !ready || draft || activePreview || !text.trim() || text.length > 500) return;
    const input = text.trim();
    if (parseOperation.current?.text !== input) parseOperation.current = { text: input, requestId: crypto.randomUUID() };
    chatSending.current = true; setBusy(true); setChatError(false);
    setMessage("Organizing your entry…");
    try {
      const result = await api<
        { status: "candidate"; entry: Entry; draftId: string } |
        { status: "clarify" | "unsupported" | "unavailable"; message: string; draftId: string }
      >("/api/parse", parseOperation.current);
      const at = new Date().toISOString();
      if (result.status === "candidate") {
        const entry = entrySchema.parse(result.entry);
        setDraft({ entry, draftId: result.draftId });
        setMessage("Review the AI suggestion. Nothing is saved until you confirm.");
        setText("");
      } else {
        setMessage(result.message);
        setChatError(result.status === "unavailable");
        if (result.status !== "unavailable") setText("");
      }
      setChatLines(lines => [...lines,
        { id: crypto.randomUUID(), sender: "user", text: input, at },
        { id: crypto.randomUUID(), sender: "assistant", text: result.status === "candidate"
          ? "Review the suggested transaction in the confirmation form. Nothing has been saved."
          : result.message, at },
      ]);
      // A completed unavailable result needs a fresh operation for an explicit retry.
      parseOperation.current = null;
    } catch (error) {
      handleExpired(error);
      setChatError(true);
      setMessage(error instanceof Error ? error.message : "Could not organize your entry. Retry or add it manually.");
      if (error instanceof RequestError) parseOperation.current = null;
    } finally {
      chatSending.current = false; setBusy(false);
    }
  }
  function loadChatHistory() {
    if (historyLoaded) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(12, 0, 0, 0);
    setChatLines(lines => [
      { id: "example-user", sender: "user", text: "Spent ₹120 on lunch", at: yesterday.toISOString() },
      { id: "example-assistant", sender: "assistant", text: "Example history: lunch expense received for review. This is sample conversation text, not a saved record.", at: yesterday.toISOString() }, ...lines,
    ]);
    setHistoryLoaded(true);
  }
  async function save() {
    if (!draft) return;
    const valid = entrySchema.safeParse(draft.entry);
    if (!valid.success) { setMessage(valid.error.issues[0].message); return; }
    saveOperation.current ??= { entry: valid.data, draftId: draft.draftId, requestId: crypto.randomUUID() };
    setBusy(true); setMessage("Saving your confirmed entry…");
    try {
      const result = await api<{ transaction: Transaction }>("/api/transactions", saveOperation.current);
      saveOperation.current = null; setUncertainSave(false); setDraft(null); setText("");
      setMessage(`Saved ${money(result.transaction.amount_minor)} under ${label(result.transaction.category)} for ${result.transaction.date}.`);
      try { await refresh(result.transaction.date.slice(0, 7)); }
      catch { setMessage("Your entry was saved. Reload the page to refresh your records."); }
    } catch (error) {
      handleExpired(error);
      if (error instanceof RequestError) { saveOperation.current = null; setUncertainSave(false); setMessage(error.message); }
      else { setUncertainSave(true); setMessage("Save status is unknown. Retry the same save below; it will not create a duplicate."); }
    } finally { setBusy(false); }
  }
  function setEntry(entry: Entry) {
    if (draft && !uncertainSave) setDraft({...draft,entry});
  }
  function edit<K extends keyof Entry>(key: K, value: Entry[K]) {
    if (draft && !uncertainSave) setDraft({ ...draft, entry: { ...draft.entry, [key]: value } });
  }
  function startManual() {
    if (activePreview) return;
    setDraft({ entry: blankEntry(), draftId: null });
    setMessage("Enter the details and confirm to save.");
  }
  function cancelDraft() { setDraft(null); setMessage("Draft cancelled. Nothing saved."); }
  function changeText(value: string) { setText(value); }
  function changeType(value: Entry["type"]) {
    if (draft && !uncertainSave) setDraft({ ...draft, entry: { ...draft.entry, type: value, category: value === "income" ? "other-income" : "other-expense" } });
  }
  async function loadMonth() {
    setBusy(true);
    try { await refresh(); } catch (error) { handleExpired(error); setMessage(error instanceof Error ? error.message : "Could not load this month."); }
    finally { setBusy(false); }
  }
  function startSeparateEntry() {
    if (!activePreview || isLockedPreview(activePreview)) return;
    previewAction({type:"cancel",id:activePreview.id});
    setChatError(false);
  }
  return { previews, previewAction, previewScenario, setPreviewScenario, activePreview, startSeparateEntry, chatLines, chatError, failNextChat, setFailNextChat, historyLoaded, loadChatHistory, user, authLoading, configured, signIn, signOut, ready, busy, text, message, draft, ledger, month, uncertainSave,
    refreshLedger: refresh, setMonth, parse, save, setEntry, edit, startManual, cancelDraft, changeText, changeType, loadMonth };
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
