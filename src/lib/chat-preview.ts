import { entrySchema, localDate, type Entry } from "./ledger";

// UI fixtures only. These actions never call extraction or ledger APIs.
export type PreviewScenario = "expense" | "income" | "clarification" | "unavailable";
export type PreviewStatus = "needs-clarification" | "ready" | "editing" | "saving" | "unknown" | "checking" | "saved" | "cancelled" | "failed";
export type ChatPreview = {
  id: string;
  status: PreviewStatus;
  entry: Entry;
  error?: string;
  saveKey?: string;
  receipt?: { id: string; entry: Entry };
};
export type PreviewAction =
  | { type: "add"; id: string; scenario: PreviewScenario; date: string }
  | { type: "reply"; id: string; text: string }
  | { type: "edit" | "apply" | "cancel" | "save-failed" | "lost" | "check" | "ack"; id: string }
  | { type: "change"; id: string; field: keyof Entry; value: string }
  | { type: "confirm"; id: string; key: string }
  | { type: "reset" };
export const isActivePreview = (preview: ChatPreview) => !["saved", "cancelled", "failed"].includes(preview.status);
export const isLockedPreview = (preview: ChatPreview) => ["saving", "unknown", "checking"].includes(preview.status);
export function fixturePreview(id: string, scenario: PreviewScenario, date = localDate()): ChatPreview {
  const income = scenario === "income";
  return {
    id,
    status: scenario === "unavailable" ? "failed" : scenario === "clarification" ? "needs-clarification" : "ready",
    entry: { type: income ? "income" : "expense", amount: scenario === "clarification" ? "" : income ? "25000.00" : "120.00",
      category: income ? "salary" : "dining", date, description: income ? "Salary" : "Lunch expense" },
  };
}
export function previewReducer(state: ChatPreview[], action: PreviewAction): ChatPreview[] {
  if (action.type === "reset") return [];
  if (action.type === "add") {
    if (state.some(isActivePreview)) return state;
    return [...state, fixturePreview(action.id, action.scenario, action.date)];
  }
  return state.map(preview => {
    if (preview.id !== action.id) return preview;
    switch (action.type) {
      case "reply": {
        if (preview.status !== "needs-clarification") return preview;
        const entry = { ...preview.entry, amount: action.text.trim() };
        if (!entrySchema.safeParse(entry).success) return { ...preview, error: "Reply with a positive amount, such as 120 or 120.50." };
        return { ...preview, entry, status: "ready", error: undefined };
      }
      case "edit": return preview.status === "ready" ? { ...preview, status: "editing", error: undefined } : preview;
      case "change": {
        if (preview.status !== "editing") return preview;
        if (action.field === "type") {
          if (action.value !== "income" && action.value !== "expense") return preview;
          return { ...preview, entry: { ...preview.entry, type: action.value, category: action.value === "income" ? "other-income" : "other-expense" }, error: undefined };
        }
        return { ...preview, entry: { ...preview.entry, [action.field]: action.value }, error: undefined };
      }
      case "apply": {
        if (preview.status !== "editing") return preview;
        const result = entrySchema.safeParse(preview.entry);
        return result.success ? { ...preview, entry: result.data, status: "ready", error: undefined }
          : { ...preview, error: "Check the amount, date, category, and description before reviewing." };
      }
      case "confirm":
        if (preview.status !== "ready" || !entrySchema.safeParse(preview.entry).success) return preview;
        return { ...preview, status: "saving", saveKey: action.key, error: undefined };
      case "ack":
        if (!["saving", "checking"].includes(preview.status) || !preview.saveKey) return preview;
        return { ...preview, status: "saved", receipt: { id: `example-${preview.id}`, entry: { ...preview.entry } } };
      case "lost": return preview.status === "saving" ? { ...preview, status: "unknown" } : preview;
      case "check": return preview.status === "unknown" ? { ...preview, status: "checking" } : preview;
      case "save-failed": return preview.status === "saving" ? { ...preview, status: "ready", saveKey: undefined, error: "Example save was rejected. Nothing saved; your edits are retained." } : preview;
      case "cancel": return isActivePreview(preview) && !isLockedPreview(preview) ? { ...preview, status: "cancelled", error: undefined } : preview;
    }
  });
}
