"use client";
import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { categories, type Entry } from "@/lib/ledger";
import { label, useTracker } from "./tracker-provider";
import { ConnectionStatus, PageHeading, Summary, TransactionRows } from "./tracker-parts";

export function ChatScreen() {
  const {ready,busy,text,draft,ledger,uncertainSave,parse,save,edit,startManual,cancelDraft,changeText,changeType}=useTracker();
  const actionsDisabled=busy||!ready||!!draft;
  return <>
    <PageHeading eyebrow="YOUR DAILY CHECK-IN" title="Small entries. A clearer picture." description="Tell us what came in or went out. Review every detail before it becomes a record." />
    <ConnectionStatus />
    <Grid columns={{minWidth:280,max:2}} gap={8} align="start">
      <VStack as="section" gap={5} aria-label="Chat entry">
        <TextArea label="Expense or income" value={text} onChange={changeText}
          placeholder="Spent ₹30 on a rickshaw to work" maxLength={500} width="100%" rows={3} isDisabled={busy||!!draft} />
        <HStack gap={3} wrap="wrap">
          <Button label="Organize with AI" variant="primary" onClick={()=>void parse()} isDisabled={actionsDisabled||!text.trim()||text.length>500} isLoading={busy&&!draft} />
          <Button label="Add manually" onClick={startManual} isDisabled={actionsDisabled} />
        </HStack>
        <Text type="supporting">Try an entry</Text>
        <VStack gap={1} hAlign="start">
          {["Spent 30 Rs on Rickshaw to work","Got 15000 salary today"].map(example=><Button key={example} label={example} variant="ghost" onClick={()=>changeText(example)} isDisabled={actionsDisabled} />)}
        </VStack>
        <Text type="supporting">One complete entry at a time. You can always enter details manually.</Text>
            {draft && <Card>
              <VStack gap={4}>
                <Heading level={3} style={{ fontFamily: "var(--font-family-body)" }}>Review transaction</Heading>
                <Text type="supporting">Not saved yet · INR</Text>
                <Selector label="Type" options={[{value:"expense",label:"Expense"},{value:"income",label:"Income"}]} value={draft.entry.type}
                  onChange={(value) => changeType(value as Entry["type"])} isDisabled={busy || uncertainSave} />
                <TextInput label="Amount (INR)" value={draft.entry.amount} inputMode="decimal" onChange={(value) => edit("amount", value)} isDisabled={busy || uncertainSave} width="100%" />
                <Selector label="Category" options={categories.filter((category) => draft.entry.type === "income" ? ["salary","other-income"].includes(category) : !["salary","other-income"].includes(category)).map((category) => ({value:category,label:label(category)}))}
                  value={draft.entry.category} onChange={(value) => edit("category", value as Entry["category"])} isDisabled={busy || uncertainSave} />
                <TextInput label="Date (YYYY-MM-DD)" value={draft.entry.date} onChange={(value) => edit("date", value)} isDisabled={busy || uncertainSave} width="100%" />
                <TextInput label="Description" value={draft.entry.description} onChange={(value) => edit("description", value)} isDisabled={busy || uncertainSave} width="100%" />
                <HStack wrap="wrap" gap={3}>
                  <Button label={uncertainSave ? "Retry same save" : "Confirm and save"} variant="primary" onClick={() => void save()} isLoading={busy} />
                  <Button label="Cancel" onClick={cancelDraft} isDisabled={busy || uncertainSave} />
                </HStack>
              </VStack>
            </Card>}
      </VStack>
      <VStack as="aside" gap={5} aria-label="Month at a glance">
        <Heading level={2} style={{fontFamily:"var(--font-family-body)"}}>Your month, at a glance</Heading>
        <Text type="supporting">{ledger ? `Confirmed entries · ${ledger.month}` : "Loading your records…"}</Text>
        <Summary />
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <Text weight="semibold">Recent entries</Text><Button label="View all" href="/transactions" as={Link} variant="ghost" />
        </HStack>
        {ledger && <TransactionRows transactions={ledger.transactions.slice(0,5)} />}
        <Text type="supporting">Net cash flow is income minus expenses, not a bank balance.</Text>
      </VStack>
    </Grid>
  </>;
}
