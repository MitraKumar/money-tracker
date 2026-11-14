"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { categories, entrySchema, money, toMinorUnits, type Entry } from "@/lib/ledger";
import { type ChatPreview } from "@/lib/chat-preview";
import { label, useTracker } from "./tracker-provider";

export function TransactionPreview({ preview }: { preview: ChatPreview }) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const { previewAction } = useTracker();
  const heading = useRef<HTMLHeadingElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const lastStatus = useRef(preview.status);
  useEffect(() => {
    if (preview.status !== lastStatus.current) {
      if (preview.status === "editing") amountInput.current?.focus();
      else heading.current?.focus({preventScroll:true});
      lastStatus.current = preview.status;
    }
  }, [preview.status]);
  const action = (type: "edit" | "apply" | "cancel" | "save-failed" | "lost" | "check" | "ack") => previewAction({type,id:preview.id});
  const change = (field: keyof Entry, value: string) => previewAction({type:"change",id:preview.id,field,value});
  const errors = entrySchema.safeParse(preview.entry);
  const fieldError = (field: keyof Entry) => {
    if (errors.success) return undefined;
    const issue = errors.error.issues.find(issue => issue.path[0] === field || (field === "category" && issue.path.length === 0));
    return issue ? {type:"error" as const,message:issue.message} : undefined;
  };
  const title = {
    "needs-clarification":"More details needed", ready:"Review transaction", editing:"Edit transaction",
    saving:"Saving…", unknown:"Save status unknown", checking:"Checking save status…",
    saved:"Example saved receipt", cancelled:"Draft cancelled", failed:"Chat entry unavailable",
  }[preview.status];
  const entry = preview.receipt?.entry ?? preview.entry;
  let amount = "Amount needed";
  try { amount = money(toMinorUnits(entry.amount)); } catch { /* Incomplete/invalid drafts show no invented amount. */ }
  const date = new Date(`${entry.date}T12:00:00Z`);
  const dateLabel = Number.isNaN(date.valueOf()) ? entry.date : date.toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Kolkata"});
  return <Card>
    <VStack as="section" aria-label="Example transaction preview" gap={4}>
      <Heading ref={heading} tabIndex={-1} level={3} style={{fontFamily:"var(--font-family-body)"}}>{title}</Heading>
      <Text type="supporting">Fixture preview · no real ledger changes</Text>
      {!["saved","cancelled","failed"].includes(preview.status) && <Text weight="semibold">{["unknown","checking"].includes(preview.status) ? "Outcome unconfirmed. Do not start another save." : "Not saved yet · INR"}</Text>}
      {!["failed","cancelled"].includes(preview.status) && <VStack gap={1}>
        <Text type="large" weight="semibold" style={{fontVariantNumeric:"tabular-nums"}}>{label(entry.type)} · {amount} · INR</Text>
        <Text style={{overflowWrap:"anywhere"}}>{label(entry.category)} · {dateLabel}</Text>
        <Text style={{overflowWrap:"anywhere"}}>{entry.description}</Text>
      </VStack>}
      {preview.status === "needs-clarification" && <>
        <Text>How much did you spend? Reply with the amount in the composer.</Text>
        <Button label="Cancel draft" onClick={() => action("cancel")} />
      </>}
      {preview.status === "ready" && <VStack gap={2}>
        <Button label="Confirm example save" variant="primary" onClick={() => previewAction({type:"confirm",id:preview.id,key:crypto.randomUUID()})} />
        <Button label="Edit transaction" onClick={() => action("edit")} />
        <Button label="Cancel draft" variant="ghost" onClick={() => action("cancel")} />
      </VStack>}
      {preview.status === "editing" && <VStack gap={3}>
        <TextInput ref={amountInput} label="Example amount (INR)" value={entry.amount} inputMode="decimal" width="100%" onChange={value => change("amount",value)} status={fieldError("amount")} />
        <Selector label="Example type" width="100%" value={entry.type} options={[{value:"expense",label:"Expense"},{value:"income",label:"Income"}]} onChange={value => change("type",value)} />
        <Selector label="Example category" width="100%" value={entry.category} options={categories.filter(category => entry.type === "income" ? ["salary","other-income"].includes(category) : !["salary","other-income"].includes(category)).map(category => ({value:category,label:label(category)}))} onChange={value => change("category",value)} status={fieldError("category")} />
        <TextInput label="Example date (YYYY-MM-DD)" value={entry.date} width="100%" onChange={value => change("date",value)} status={fieldError("date")} />
        <TextInput label="Example description" value={entry.description} width="100%" onChange={value => change("description",value)} status={fieldError("description")} />
        <Button label="Review changes" variant="primary" onClick={() => action("apply")} isDisabled={!errors.success} />
        <Button label="Cancel draft" onClick={() => action("cancel")} />
      </VStack>}
      {preview.status === "saving" && <>
        <Text role="status">Saving the example. Awaiting simulated acknowledgment; nothing is confirmed yet.</Text>
        <Button label="Saving…" isLoading />
        <Button label="Acknowledge example save" onClick={() => action("ack")} />
        <Button label="Simulate lost response" onClick={() => action("lost")} />
        <Button label="Simulate rejected save" onClick={() => action("save-failed")} />
      </>}
      {preview.status === "unknown" && <>
        <Text role="status">The response was lost. Check the original confirmation rather than saving again.</Text>
        <Button label="Check example save status" onClick={() => action("check")} />
      </>}
      {preview.status === "checking" && <>
        <Text role="status">Checking the same confirmation. Editing and new saves are paused.</Text>
        <Button label="Checking save status…" isLoading />
        <Button label="Acknowledge existing example save" onClick={() => action("ack")} />
      </>}
      {preview.status === "saved" && <>
        <Text role="status">Simulated acknowledgment received. This example receipt is not in your ledger.</Text>
        <Button label="View example transaction" onClick={() => setReceiptOpen(open => !open)} aria-expanded={receiptOpen} />
        {receiptOpen && <Text type="supporting" style={{overflowWrap:"anywhere"}}>Receipt: {preview.receipt?.id}. This sample transaction exists only in chat.</Text>}
      </>}
      {preview.status === "cancelled" && <Text>Nothing saved. This draft cannot be confirmed.</Text>}
      {preview.status === "failed" && <Text>Example service failure. Nothing saved. Send again to try another fixture, or use Add manually for a real entry.</Text>}
      {preview.error && <Text role="status">{preview.error}</Text>}
    </VStack>
  </Card>;
}
