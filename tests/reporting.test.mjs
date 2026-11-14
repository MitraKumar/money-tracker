import test from "node:test";
import assert from "node:assert/strict";
import { calendarDays, transactionCsv } from "../src/lib/reporting.ts";

test("daily reports fill leap-year and empty-month gaps without changing totals", () => {
  const rows = calendarDays("2024-02", [{date:"2024-02-29",income:123,expenses:101}]);
  assert.equal(rows.length,29);
  assert.deepEqual(rows[0],{date:"2024-02-01",income:0,expenses:0});
  assert.equal(rows.reduce((n,row)=>n+row.expenses,0),101);
  assert.equal(calendarDays("2026-04",[]).length,30);
});
test("CSV escapes quotes/newlines and neutralizes spreadsheet formulas", () => {
  for(const description of ['=SUM(A1)'," +2","-1","@cmd","\ttext","\ntext"]) {
    const csv=transactionCsv([{date:"2026-11-15",type:"expense",category:"dining",description,amount_minor:125}]);
    assert.ok(csv.includes('"'+"'"+description+'"'),csv);
  }
  const csv=transactionCsv([{date:"2026-11-15",type:"expense",category:"dining",description:'Lunch, "tea"\nCafe',amount_minor:101}]);
  assert.ok(csv.includes('"Lunch, ""tea""\nCafe"'));
  assert.ok(csv.endsWith('"INR","1.01"\r\n'));
  assert.equal(transactionCsv([]),"date,type,category,description,currency,amount\r\n");
});
