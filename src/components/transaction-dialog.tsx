"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { entrySchema, formatEntryDate, money, type Entry, type Transaction } from "@/lib/ledger";
import { api, RequestError, label, useTracker } from "./tracker-provider";
import { TransactionFields } from "./transaction-fields";

const editable = ({type,amount,category,date,description}:Transaction):Entry => ({type,amount,category,date,description});

export function TransactionDialog({id,onClose}:{id:string;onClose:()=>void}) {
  const {refreshLedger}=useTracker();
  const [row,setRow]=useState<Transaction|null>(null);
  const [entry,setEntry]=useState<Entry|null>(null);
  const [mode,setMode]=useState<"details"|"edit"|"delete">("details");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [error,setError]=useState("");
  const [conflict,setConflict]=useState(false);
  const [showErrors,setShowErrors]=useState(false);
  const operation=useRef<{path:string;body:{id:string;requestId:string;expectedRevision:number;entry?:Entry}}|null>(null);
  useEffect(()=>{
    let active=true;
    void api<{transaction:Transaction}>(`/api/transactions/detail?id=${encodeURIComponent(id)}`)
      .then(result=>{if(active){setRow(result.transaction);setEntry(editable(result.transaction));}})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Could not load this transaction.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[id]);
  const locked=saving||unknown;
  async function reload() {
    setLoading(true);setError("");setConflict(false);
    try {
      const result=await api<{transaction:Transaction}>(`/api/transactions/detail?id=${encodeURIComponent(id)}`);
      setRow(result.transaction);setEntry(editable(result.transaction));setMode("details");setShowErrors(false);
    } catch(cause){setError(cause instanceof Error?cause.message:"Reload failed.");}
    finally{setLoading(false);}
  }
  async function submit() {
    if(!row||!entry||saving)return;
    if(mode==="edit"&&!operation.current){
      setShowErrors(true);
      const valid=entrySchema.safeParse(entry);
      if(!valid.success){setError("Check the highlighted fields.");return;}
      operation.current={path:"/api/transactions/update",body:{id,requestId:crypto.randomUUID(),expectedRevision:row.revision,entry:valid.data}};
    }
    if(mode==="delete"&&!operation.current)operation.current={path:"/api/transactions/delete",body:{id,requestId:crypto.randomUUID(),expectedRevision:row.revision}};
    if(!operation.current)return;
    setSaving(true);setError("");
    try {
      await api(operation.current.path,operation.current.body);
      operation.current=null;setUnknown(false);
      try {await refreshLedger();}
      catch {setError("Change saved. Reload the page to refresh the list.");setMode("details");setRow(null);return;}
      onClose();
    } catch(cause) {
      if(cause instanceof RequestError){
        operation.current=null;setUnknown(false);setConflict(cause.status===409);
        setError(cause.message);
      } else {
        setUnknown(true);setError("The outcome is unknown. Retry the same operation to recover its result safely.");
      }
    } finally {setSaving(false);}
  }
  return <Dialog isOpen onOpenChange={open=>{if(!open&&!locked)onClose();}} purpose={locked?"required":"info"} width="38rem" padding={0} maxHeight="calc(100dvh - var(--spacing-8))">
    <VStack padding={5} gap={0} style={{flexShrink:0}}>
      <DialogHeader title={<Text type="large" weight="semibold" style={{fontFamily:"var(--font-family-body)"}}>{mode==="edit"?"Edit transaction":mode==="delete"?"Delete transaction?":"Transaction details"}</Text>}
        subtitle="Confirmed ledger entry · INR" hasDivider={false} onOpenChange={locked?undefined:()=>onClose()} />
    </VStack>
    <VStack gap={4} paddingInline={5} paddingBlock={3} style={{overflowY:"auto",minHeight:0,flex:"1 1 auto"}}>
      {loading&&<Text role="status">Loading transaction…</Text>}
      {error&&<Text as="p" role="alert">{error}</Text>}
      {conflict&&!locked&&<Button label="Reload saved version" onClick={()=>void reload()} />}
      {!loading&&row&&entry&&(mode==="edit"
        ? <TransactionFields value={entry} onChange={setEntry} isDisabled={locked} showErrors={showErrors} />
        : <List edge="flush">
          <ListItem label={row.description} description={`${label(row.type)} · ${label(row.category)}`} endContent={<Text weight="semibold" hasTabularNumbers>{row.type==="income"?"+":"−"}{money(row.amount_minor)}</Text>} />
          <ListItem label="Date" endContent={<Text>{formatEntryDate(row.date)}</Text>} />
        </List>)}
      {mode==="delete"&&<Text>Delete this entry from your ledger and monthly reports? Its financial values will no longer appear in totals or CSV exports.</Text>}
    </VStack>
    <HStack gap={2} padding={4} wrap="wrap" hAlign="end" style={{flexShrink:0}}>
      {mode==="details" ? <>
        <Button label="Close" size="sm" variant="ghost" onClick={onClose} />
        {!loading&&!row&&<Button label="Retry loading" onClick={()=>void reload()} />}
        {row&&!loading&&<><Button label="Delete" aria-label="Delete transaction" size="sm" variant="secondary" onClick={()=>{setError("");setMode("delete");}} />
          <Button label="Edit" aria-label="Edit transaction" size="sm" variant="primary" onClick={()=>{setError("");setMode("edit");}} /></>}
      </> : <>
        <Button label="Cancel" variant="ghost" isDisabled={locked} onClick={()=>{setMode("details");setEntry(row?editable(row):null);setError("");setConflict(false);setShowErrors(false);}} />
        <Button label={unknown?"Retry same operation":mode==="delete"?"Confirm deletion":"Save changes"} variant="primary"
          isLoading={saving} isDisabled={loading||conflict||(!row)} onClick={()=>void submit()} />
      </>}
    </HStack>
  </Dialog>;
}
