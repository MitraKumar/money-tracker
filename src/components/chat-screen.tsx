"use client";
import { useEffect, useRef } from "react";
import { ChatLayout, ChatComposer, ChatComposerInput, ChatSendButton, ChatMessage, ChatMessageBubble, ChatMessageList, ChatSystemMessage, type ChatComposerInputHandle } from "@astryxdesign/core/Chat";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { type PreviewScenario } from "@/lib/chat-preview";
import { TransactionPreview } from "./transaction-preview";
import { categories, type Entry } from "@/lib/ledger";
import { label, useTracker } from "./tracker-provider";
import { ConnectionStatus, PageHeading, Summary, TransactionRows } from "./tracker-parts";

export function ChatScreen() {
  const {ready,busy,text,draft,ledger,uncertainSave,parse,save,edit,startManual,cancelDraft,changeText,changeType,chatLines,chatError,failNextChat,setFailNextChat,historyLoaded,loadChatHistory,previews,previewScenario,setPreviewScenario,activePreview,startSeparateEntry}=useTracker();
  const composing = useRef(false);
  const input = useRef<ChatComposerInputHandle>(null);
  const focusSeparateEntry = useRef(false);
  useEffect(() => {
    if (!activePreview && focusSeparateEntry.current) {
      input.current?.focus();
      focusSeparateEntry.current = false;
    }
  }, [activePreview]);
  const groups = Map.groupBy(chatLines, line => new Date(line.at).toLocaleDateString("en-IN", {year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Kolkata"}));
  const entryBlocked = !!activePreview;
  const actionsDisabled=busy||!ready||!!draft||(entryBlocked && activePreview?.status !== "needs-clarification");
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
        <Selector label="Example response scenario" width="100%" value={previewScenario}
          options={[{value:"expense",label:"Lunch expense"},{value:"income",label:"Salary income"},{value:"clarification",label:"Missing amount"},{value:"unavailable",label:"Service unavailable"}]}
          onChange={value => setPreviewScenario(value as PreviewScenario)} isDisabled={entryBlocked||busy||!!draft} />
        <Text type="supporting">Scenario chooses the sample response; your message is not analyzed.</Text>
        <VStack style={{height:"min(65dvh, 44rem)", minHeight:"22rem", width:"100%"}} gap={0}>
          <ChatLayout density="compact" composer={
            <VStack gap={2} onCompositionStartCapture={() => {composing.current=true;}}
              onCompositionEndCapture={() => {composing.current=false;}}>
              {activePreview?.status === "needs-clarification" && <VStack gap={1}>
                <Text weight="semibold">Replying to: {activePreview.entry.description}</Text>
                <Text>How much did you spend? Reply with an amount, such as 120.</Text>
              </VStack>}
              {activePreview && !["saving","unknown","checking"].includes(activePreview.status) &&
                <Button label="Start separate entry" onClick={() => {focusSeparateEntry.current=true;startSeparateEntry();}} />}
              <ChatComposer value={text} onChange={changeText} onSubmit={parse} isDisabled={actionsDisabled}
                input={<ChatComposerInput handleRef={input} label="Expense or income" value={text} onChange={changeText}
                  placeholder="Type an expense or income…" maxRows={4} isDisabled={actionsDisabled}
                  pasteAsToken={false} hasHistory={false} enterKeyHint="enter"
                  onKeyDown={event => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                    if (composing.current) {event.preventDefault();return;}
                    // Own submission so rejected/failed sends retain the controlled draft.
                    event.preventDefault();
                    if (window.matchMedia("(pointer: coarse)").matches) input.current?.insertText("\n");
                    else parse();
                  }} />}
                headerContext={<Text type="supporting">{text.length}/500</Text>}
                sendButton={<ChatSendButton onSend={parse} isDisabled={actionsDisabled||!text.trim()||text.length>500} />}
                footerActions={<Button label="Add manually" onClick={startManual} isDisabled={actionsDisabled||entryBlocked} />}
                status={chatError ? {type:"error",message:"Simulated send error. Your message is still here. Try Send again or add it manually."} : text.length>500 ? {type:"error",message:"Keep your message within 500 characters before sending."} : undefined} />
              <Text type="supporting">Enter sends on desktop · Shift+Enter adds a line. On mobile, tap Send.</Text>
            </VStack>
          }>
            <ChatMessageList align="top">
              {chatLines.length === 0 ? <VStack gap={3} padding={3}>
                <Heading level={2} style={{fontFamily:"var(--font-family-body)"}}>What came in or went out?</Heading>
                <Text>Try an entry. Choose a prompt to edit it before sending.</Text>
                {["Spent ₹120 on lunch", "Received ₹25,000 salary today", "Paid ₹800 for groceries yesterday"].map(example =>
                  <Button key={example} label={example} variant="ghost" isDisabled={actionsDisabled||entryBlocked} onClick={() => {changeText(example);input.current?.focus();}} />)}
              </VStack> : [...groups].map(([day, lines]) => <VStack key={day} gap={4} as="section" aria-label={day}>
                <ChatSystemMessage variant="divider">{day}</ChatSystemMessage>
                {lines.map(line => <ChatMessage key={line.id} sender={line.sender}>
                  <ChatMessageBubble variant={line.sender === "user" ? "filled" : "ghost"}
                    name={line.sender === "user" ? "You" : "Money Tracker · example"}
                    metadata={!line.previewId ? <Timestamp value={line.at} format="time" timezoneID="Asia/Kolkata" /> : undefined}>
                    <Text style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{line.text}</Text>
                  </ChatMessageBubble>
                  {line.previewId && <ChatMessageBubble variant="ghost" width="100%"
                    metadata={<Timestamp value={line.at} format="time" timezoneID="Asia/Kolkata" />}>
                    {previews.filter(preview => preview.id === line.previewId).map(preview => <TransactionPreview key={preview.id} preview={preview} />)}
                  </ChatMessageBubble>}
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
