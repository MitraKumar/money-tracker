"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { Table } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { categories, dateSchema, money, type Transaction } from "@/lib/ledger";
import { label, useTracker } from "./tracker-provider";
import { ConnectionStatus, MonthFilter, PageHeading } from "./tracker-parts";
import { MonthlyExport } from "./monthly-report";
import { TransactionDialog } from "./transaction-dialog";

export function TransactionsScreen() {
  const {ledger,busy,ready}=useTracker();
  const {isMobile}=useAppShellMobile();
  const [search,setSearch]=useState("");
  const [type,setType]=useState("all");
  const [category,setCategory]=useState("all");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [sort,setSort]=useState("newest");
  const [limit,setLimit]=useState(20);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const params=useSearchParams();
  const router=useRouter();
  const pathname=usePathname();
  const selected=params.get("transaction");
  function select(id:string|null) {
    const next=new URLSearchParams(params.toString());
    if(id)next.set("transaction",id);else next.delete("transaction");
    router.replace(pathname+(next.size?"?"+next.toString():""),{scroll:false});
  }
  function change(setter:(value:string)=>void,value:string){setter(value);setLimit(20);}
  function clear(){setSearch("");setType("all");setCategory("all");setFrom("");setTo("");setLimit(20);}
  const dateError=from&&!dateSchema.safeParse(from).success?"Enter a valid start date."
    :to&&!dateSchema.safeParse(to).success?"Enter a valid end date."
    :from&&to&&from>to?"The end date must be on or after the start date.":"";
  const filtered=(ledger?.transactions??[]).filter(row=>!dateError &&
    (type==="all"||row.type===type)&&(category==="all"||row.category===category)&&
    row.description.toLowerCase().includes(search.trim().toLowerCase())&&(!from||row.date>=from)&&(!to||row.date<=to))
    .toSorted((a,b)=>sort==="oldest"?a.date.localeCompare(b.date)||a.created_at-b.created_at
      :sort==="highest"?b.amount_minor-a.amount_minor||b.date.localeCompare(a.date)
      :sort==="lowest"?a.amount_minor-b.amount_minor||b.date.localeCompare(a.date)
      :b.date.localeCompare(a.date)||b.created_at-a.created_at);
  const visible=filtered.slice(0,limit);
  const filteredIncome=filtered.filter(row=>row.type==="income").reduce((n,row)=>n+row.amount_minor,0);
  const filteredExpenses=filtered.filter(row=>row.type==="expense").reduce((n,row)=>n+row.amount_minor,0);
  const details=(row:Transaction)=><IconButton label={`View transaction: ${row.description}`} tooltip="Transaction details" icon={<Icon icon="info" />} variant="ghost" onClick={()=>select(row.id)} />;
  return <>
    <PageHeading eyebrow="YOUR RECORDS" title="Every little entry." description="Find, review, and update your confirmed income and expenses." />
    <ConnectionStatus /><MonthFilter />
    <VStack gap={4} as="section" aria-label="Transaction filters">
      <TextInput label="Search descriptions" value={search} onChange={value=>change(setSearch,value)} type="search" width="100%" isDisabled={!ready} />
      <Button label="Filters and sort" variant="secondary" aria-expanded={filtersOpen} aria-controls="transaction-filter-options" onClick={()=>setFiltersOpen(!filtersOpen)} />
      {filtersOpen && <Grid id="transaction-filter-options" columns={{minWidth:180,max:3}} gap={4}>
        <Selector label="Type" width="100%" value={type} onChange={value=>change(setType,value)} options={[{value:"all",label:"All types"},{value:"expense",label:"Expenses"},{value:"income",label:"Income"}]} />
        <Selector label="Category" width="100%" value={category} onChange={value=>change(setCategory,value)} options={[{value:"all",label:"All categories"},...categories.map(value=>({value,label:label(value)}))]} />
        <Selector label="Sort entries" width="100%" value={sort} onChange={value=>change(setSort,value)} options={[{value:"newest",label:"Newest first"},{value:"oldest",label:"Oldest first"},{value:"highest",label:"Highest amount"},{value:"lowest",label:"Lowest amount"}]} />
        <TextInput label="From date (YYYY-MM-DD)" value={from} onChange={value=>change(setFrom,value)} width="100%" />
        <TextInput label="To date (YYYY-MM-DD)" value={to} onChange={value=>change(setTo,value)} width="100%" />
      </Grid>}
      {dateError&&<Text role="alert">{dateError}</Text>}
      <HStack wrap="wrap" gap={3} hAlign="between" vAlign="center">
        <Text role="status">{ledger?`${filtered.length} of ${ledger.transactions.length} entries · ${ledger.month}`:"Loading your records…"}</Text>
        <Button label="Clear filters" variant="ghost" onClick={clear} />
      </HStack>
    </VStack>
    {busy&&<Text role="status">Refreshing records…</Text>}
    {ledger&&!dateError&&(filtered.length ? <>
      <Text type="supporting">Matching entries: income {money(filteredIncome)} · expenses {money(filteredExpenses)} · net cash flow {money(filteredIncome-filteredExpenses)}</Text>
      {isMobile ? <List edge="flush" aria-label="Transactions">{visible.map(row=><ListItem key={row.id}
        label={<Text weight="semibold" style={{overflowWrap:"anywhere"}}>{row.description}</Text>}
        description={<VStack gap={1}><Text type="supporting">{row.date} · {label(row.category)} · {label(row.type)}</Text>
          <HStack wrap="wrap" gap={2} hAlign="between" vAlign="center"><Text weight="semibold" hasTabularNumbers>{row.type==="income"?"+":"−"}{money(row.amount_minor)}</Text>{details(row)}</HStack></VStack>} />)}</List>
        : <Table<Transaction> aria-label="Transactions" data={visible} idKey="id" hasHover density="compact" columns={[
          {key:"date",header:"Date",renderCell:row=><Text>{row.date}</Text>},
          {key:"description",header:"Description",renderCell:row=><Text style={{overflowWrap:"anywhere"}}>{row.description}</Text>},
          {key:"category",header:"Category",renderCell:row=><Text>{label(row.category)}</Text>},
          {key:"type",header:"Type",renderCell:row=><Text>{label(row.type)}</Text>},
          {key:"amount_minor",header:"Amount (INR)",renderCell:row=><Text hasTabularNumbers weight="semibold">{row.type==="income"?"+":"−"}{money(row.amount_minor)}</Text>},
          {key:"id",header:"Actions",renderCell:details},
        ]} />}
      <HStack wrap="wrap" gap={3} hAlign="between" vAlign="center">
        <Text type="supporting">Showing {visible.length} of {filtered.length} matches</Text>
        {visible.length<filtered.length&&<Button label="Load more entries" onClick={()=>setLimit(previous=>previous+20)} />}
      </HStack>
    </> : <VStack gap={3} paddingBlock={5}>
      <Text weight="semibold">{ledger.transactions.length?"No matches in this month.":"No transactions this month."}</Text>
      <Text type="supporting">{ledger.transactions.length?"Try another description, category, or date range.":"Add an entry in Chat, or load another month."}</Text>
      {!ledger.transactions.length&&<Button label="Go to chat" href="/chat" />}
    </VStack>)}
    <MonthlyExport />
    <Text type="supporting">Filters apply to the loaded month. Up to 100 saved records are supported per account in this pilot; Load more reveals additional matches from that loaded data.</Text>
    {selected&&<TransactionDialog key={selected} id={selected} onClose={()=>select(null)} />}
  </>;
}
