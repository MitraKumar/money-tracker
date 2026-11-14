import type { Transaction } from "./ledger";

export type MonthlyReport = {
  categories: { category: string; amount_minor: number }[];
  days: { date: string; income: number; expenses: number }[];
};
export function calendarDays(month: string, days: MonthlyReport["days"]) {
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const byDate = new Map(days.map(day => [day.date, day]));
  return Array.from({length:count}, (_, i) => {
    const date = month + "-" + String(i + 1).padStart(2, "0");
    return byDate.get(date) ?? {date, income:0, expenses:0};
  });
}
function csvCell(value: string) {
  // Neutralize spreadsheet formulas, including whitespace-prefixed formulas.
  const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function transactionCsv(rows: Transaction[]) {
  const header = "date,type,category,description,currency,amount\r\n";
  return header + rows.map(row => [
    row.date, row.type, row.category, row.description, "INR",
    (row.amount_minor / 100).toFixed(2),
  ].map(csvCell).join(",")).join("\r\n") + (rows.length ? "\r\n" : "");
}
