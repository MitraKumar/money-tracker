import test from 'node:test';
import assert from 'node:assert/strict';
import { entrySchema, localDate, organizeModelResult, toMinorUnits } from '../src/lib/ledger.ts';

test('money is exact integer paise, with bounded positive inputs', () => {
  assert.equal(toMinorUnits('0.01'), 1);
  assert.equal(toMinorUnits('30.1'), 3010);
  assert.equal(toMinorUnits('15000'), 1500000);
  for (const value of ['0','-1','1.001','1e4','NaN','1,000','1000001']) assert.throws(() => toMinorUnits(value));
});
test('ledger dates are real calendar dates and categories match direction', () => {
  const entry = {type:'expense',amount:'30',date:'2026-11-14',category:'transport',description:'Rickshaw'};
  assert.equal(entrySchema.safeParse(entry).success,true);
  for (const change of [{date:'2026-02-30'},{date:'14/11/2026'},{category:'salary'},{type:'income'},{description:''}]) {
    assert.equal(entrySchema.safeParse({...entry,...change}).success,false);
  }
});
test('accounting day follows Kolkata across UTC midnight boundaries', () => {
  assert.equal(localDate(new Date('2026-11-13T18:29:00Z')),'2026-11-13');
  assert.equal(localDate(new Date('2026-11-13T18:30:00Z')),'2026-11-14');
});

const salary = {status:'candidate',reason:'',type:'income',amount:'15000',date:'2026-11-14',category:'salary',description:null};
test('salary extraction with a null description remains a reviewable draft', () => {
  const result=organizeModelResult(salary,'Got 15000 salary today');
  assert.equal(result.status,'candidate');
  assert.equal(result.entry.description,'Got 15000 salary today');
  assert.equal(result.entry.amount,'15000');
  assert.equal(result.entry.category,'salary');
});
test('missing optional labels have safe visible defaults without changing financial facts', () => {
  const result=organizeModelResult({...salary,category:null,description:'   '},'Got 15000 salary today');
  assert.equal(result.status,'candidate');
  assert.equal(result.entry.category,'other-income');
  assert.equal(result.entry.description,'Got 15000 salary today');
});
test('missing or invalid financial facts request clarification rather than a service error or guessed amount', () => {
  for(const change of [{amount:null},{type:null},{date:null},{amount:'0'},{date:'2026-02-30'},{category:'transport'}]) {
    const result=organizeModelResult({...salary,...change},'Got salary today');
    assert.equal(result.status,'clarify');
    assert.equal(result.entry,undefined);
  }
});
