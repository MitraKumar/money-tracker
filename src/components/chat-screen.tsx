"use client";
import { useRef } from "react";
import { ChatLayout, ChatComposer, ChatMessage, ChatMessageList } from "@astryxdesign/core/Chat";
import { Timestamp } from "@astryxdesign/core/Timestamp";
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
  const {ready,busy,text,draft,ledger,uncertainSave,parse,save,edit,startManual,cancelDraft,changeText,changeType,chatLines,chatError,failNextChat,setFailNextChat,historyLoaded,loadChatHistory}=useTracker();
  const composing = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const groups = Map.groupBy(chatLines, line => new Date(line.at).toLocaleDateString("en-IN", {year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Kolkata"}));
  const actionsDisabled=busy||!ready||!!draft;
  return <>
    <PageHeading eyebrow="YOUR DAILY CHECK-IN" title="Small entries. A clearer picture." description="Tell us what came in or went out. Review every detail before it becomes a record." />
    <ConnectionStatus />
    <Grid columns={{minWidth:280,max:2}} gap={8} align="start">
      <VStack as="section" gap={5} aria-label="Chat entry">
        <Text type="supporting">Chat preview · example responses only. Messages stay in this tab until reload or sign-out; they are not saved to your account.</Text>
        <HStack gap={2} wrap="wrap">
          <Button label="Show example history" onClick={loadChatHistory} isDisabled={historyLoaded} />
          <Button label={failNextChat ? "Error simulation armed" : "Simulate next send error"} onClick={() => setFailNextChat(true)} isDisabled={failNextChat} />
        </HStack>
        <VStack style={{height:"min(65dvh, 44rem)", minHeight:"22rem", width:"100%"}} gap={0}>
          <ChatLayout density="compact" composer={
            <VStack gap={2} onCompositionStartCapture={() => {composing.current=true;}}
              onCompositionEndCapture={() => {composing.current=false;}}
              onKeyDownCapture={event => {
                if(event.target === input.current && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229 && !window.matchMedia("(pointer: coarse)").matches) {
                  event.preventDefault(); parse();
                }
              }}>
              <ChatComposer value={text} onChange={changeText} onSubmit={parse} isDisabled={actionsDisabled}
                input={<TextArea ref={input} label="Expense or income" value={text} onChange={changeText}
                  placeholder="Type an expense or income…" htmlMaxLength={500} width="100%" rows={2} isDisabled={actionsDisabled} />}
                sendButton={<Button label="Send message" variant="primary" onClick={parse} isDisabled={actionsDisabled||!text.trim()||text.length>500} />}
                footerActions={<Button label="Add manually" onClick={startManual} isDisabled={actionsDisabled} />}
                status={chatError ? {type:"error",message:"Simulated send error. Your message is still here. Try Send message again or add it manually."} : undefined} />
              <Text type="supporting">Enter sends on desktop · Shift+Enter adds a line. On mobile, tap Send.</Text>
            </VStack>
          }>
            <ChatMessageList align="top">
              {chatLines.length === 0 ? <VStack gap={3} padding={3}>
                <Heading level={2} style={{fontFamily:"var(--font-family-body)"}}>What came in or went out?</Heading>
                <Text>Try an entry. Choose a prompt to edit it before sending.</Text>
                {["Spent ₹120 on lunch", "Received ₹25,000 salary today", "Paid ₹800 for groceries yesterday"].map(example =>
                  <Button key={example} label={example} variant="ghost" isDisabled={actionsDisabled} onClick={() => {changeText(example);input.current?.focus();}} />)}
              </VStack> : [...groups].map(([day, lines]) => <VStack key={day} gap={4} as="section" aria-label={day}>
                <Text type="supporting" weight="semibold">{day}</Text>
                {lines.map(line => <ChatMessage key={line.id} sender={line.sender} name={line.sender === "user" ? "You" : "Money Tracker · example"}
                  metadata={<Timestamp value={line.at} format="time" timezoneID="Asia/Kolkata" />}>
                  <Text style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{line.text}</Text>
                </ChatMessage>)}
              </VStack>)}
            </ChatMessageList>
          </ChatLayout>
        </VStack>
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
