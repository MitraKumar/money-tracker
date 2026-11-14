import { z } from "zod";

export const categories = ["transport", "dining", "groceries", "bills", "shopping", "salary", "other-income", "other-expense"] as const;
export const requestIdSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && value >= "2000-01-01" && value <= "2100-12-31";
}, "Choose a valid date between 2000 and 2100.");

export function toMinorUnits(value: string): number {
  // Reject grouping in edited fields: unambiguous decimal text only.
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000) throw new Error("Amount must be between ₹0.01 and ₹10,00,000.");
  return amount;
}

export const entrySchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.string().refine((value) => { try { toMinorUnits(value); return true; } catch { return false; } }, "Enter ₹0.01–₹10,00,000 with at most two decimal places."),
  date: dateSchema,
  category: z.enum(categories),
  description: z.string().trim().min(1).max(160),
}).strict().refine((entry) => entry.type === "income"
  ? ["salary", "other-income"].includes(entry.category)
  : !["salary", "other-income"].includes(entry.category), "Choose a category matching income or expense.");

export type Entry = z.infer<typeof entrySchema>;
export type Transaction = Entry & { id: string; amount_minor: number; created_at: number; revision: number };

export function localDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (name: string) => parts.find((part) => part.type === name)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function money(minor: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minor / 100);
}

export const modelResultSchema = z.object({
  status: z.enum(["candidate", "clarify", "unsupported"]),
  reason: z.string().max(240),
  type: z.enum(["expense", "income"]).nullable(),
  amount: z.string().nullable(),
  date: z.string().nullable(),
  category: z.enum(categories).nullable(),
  description: z.string().nullable(),
}).strict();

export function organizeModelResult(result: z.infer<typeof modelResultSchema>, input: string) {
  if (result.status !== "candidate") {
    return { status: result.status, message: result.reason || "Please enter one clear income or expense with an amount." };
  }
  if (!result.amount) return { status: "clarify", message: "What was the amount? Please resend the complete entry or use manual entry." };
  if (!result.type) return { status: "clarify", message: "Was this income or an expense? Please resend the complete entry or use manual entry." };
  if (!result.date) return { status: "clarify", message: "What date was this entry for? Please resend the complete entry or use manual entry." };
  const entry = entrySchema.safeParse({
    type: result.type,
    amount: result.amount,
    date: result.date,
    category: result.category ?? (result.type === "income" ? "other-income" : "other-expense"),
    // Description is display text, not an inferred financial fact. Preserve
    // the user's words when the model does not supply a useful short label.
    description: result.description?.trim() || input.trim().slice(0, 160),
  });
  if (!entry.success) return { status: "clarify", message: `${entry.error.issues[0].message} Please resend the complete entry or use manual entry.` };
  return { status: "candidate", entry: entry.data };
}
