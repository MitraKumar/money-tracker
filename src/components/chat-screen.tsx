"use client";
import { useEffect, useRef } from "react";
import { ChatComposer, ChatComposerInput, ChatSendButton, ChatMessage, ChatMessageBubble, ChatMessageList, ChatSystemMessage, type ChatComposerInputHandle } from "@astryxdesign/core/Chat";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { TransactionPreview } from "./transaction-preview";
import { TransactionFields } from "./transaction-fields";
import { useTracker } from "./tracker-provider";
import { ConnectionStatus, PageHeading } from "./tracker-parts";

export function ChatScreen() {
  const {ready,busy,message,text,draft,uncertainSave,parse,save,setEntry,startManual,cancelDraft,changeText,chatLines,chatError,previews,activePreview,startSeparateEntry}=useTracker();
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
    <VStack gap={8} width="100%">
      <VStack as="section" gap={5} aria-label="Chat entry">
        <Text type="supporting">AI suggests one income or expense for you to review. Transactions are saved only after confirmation. Chat history stays in this tab until reload or sign-out.</Text>
        <VStack style={{height:"min(65dvh, 44rem)", minHeight:"22rem", width:"100%"}} gap={0}>
          <VStack gap={3} style={{height:"100%", minHeight:0}}>
            <ChatMessageList align="top" style={{flex:"1 1 0%", minHeight:0, overflowY:"auto", overflowX:"hidden"}}>
              {chatLines.length === 0 ? <VStack gap={3} padding={3}>
                <Heading level={2} style={{fontFamily:"var(--font-family-body)"}}>What came in or went out?</Heading>
                <Text>Try an entry. Choose a prompt to edit it before sending.</Text>
                {["Spent ₹120 on lunch", "Received ₹25,000 salary today", "Paid ₹800 for groceries yesterday"].map(example =>
                  <Button key={example} label={example} variant="ghost" isDisabled={actionsDisabled||entryBlocked} onClick={() => {changeText(example);input.current?.focus();}} />)}
              </VStack> : [...groups].map(([day, lines]) => <VStack key={day} gap={4} as="section" aria-label={day}>
                <ChatSystemMessage variant="divider">{day}</ChatSystemMessage>
                {lines.map(line => <ChatMessage key={line.id} sender={line.sender}>
                  <ChatMessageBubble variant={line.sender === "user" ? "filled" : "ghost"}
                    name={line.sender === "user" ? "You" : "Money Tracker"}
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
            <VStack gap={2} style={{flexShrink:0}} onCompositionStartCapture={() => {composing.current=true;}}
              onCompositionEndCapture={() => {composing.current=false;}}>
              {activePreview?.status === "needs-clarification" && <VStack gap={1}>
                <Text weight="semibold">Replying to: {activePreview.entry.description}</Text>
                <Text>How much did you spend? Reply with an amount, such as 120.</Text>
              </VStack>}
              {activePreview && !["saving","unknown","checking"].includes(activePreview.status) &&
                <Button label="Start separate entry" onClick={() => {focusSeparateEntry.current=true;startSeparateEntry();}} />}
              <ChatComposer value={text} onChange={changeText} onSubmit={() => {void parse();}} isDisabled={actionsDisabled}
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
                    else void parse();
                  }} />}
                headerContext={<Text type="supporting">{text.length}/500</Text>}
                sendButton={<ChatSendButton onSend={() => {void parse();}} isDisabled={actionsDisabled||!text.trim()||text.length>500} />}
                footerActions={<Button label="Add manually" onClick={startManual} isDisabled={actionsDisabled||entryBlocked} />}
                status={chatError ? {type:"error",message:message} : text.length>500 ? {type:"error",message:"Keep your message within 500 characters before sending."} : undefined} />
              <Text type="supporting">Enter sends on desktop · Shift+Enter adds a line. On mobile, tap Send.</Text>
            </VStack>
          </VStack>
        </VStack>
            <Dialog isOpen={!!draft} onOpenChange={open => {if (!open && !busy && !uncertainSave) cancelDraft();}}
              purpose={busy || uncertainSave ? "required" : "info"} width="36rem" padding={0} maxHeight="calc(100dvh - var(--spacing-8))">
              <VStack padding={5} gap={0} style={{flexShrink:0}}>
                <DialogHeader title={<Text type="large" weight="semibold" style={{fontFamily:"var(--font-family-body)"}}>{draft?.draftId ? "Review AI suggestion" : "Add transaction"}</Text>}
                  subtitle={draft?.draftId ? "Check every detail before saving · INR" : "Enter an income or expense · INR"} hasDivider={false}
                  onOpenChange={busy || uncertainSave ? undefined : open => {if (!open) cancelDraft();}} />
              </VStack>
              {draft && <>
              <VStack gap={4} paddingInline={5} paddingBlock={3} style={{minHeight:0, overflowY:"auto", flex:"1 1 auto"}}>
                {message !== "Enter the details and confirm to save." && <Text as="p" role="status" aria-live="polite">{message}</Text>}
                <TransactionFields value={draft.entry} onChange={setEntry} isDisabled={busy || uncertainSave} showErrors />
              </VStack>
                <HStack wrap="wrap" hAlign="end" gap={3} padding={5} style={{flexShrink:0}}>
                  <Button label="Cancel" variant="ghost" onClick={cancelDraft} isDisabled={busy || uncertainSave} />
                  <Button label={uncertainSave ? "Retry same save" : "Confirm and save"} variant="primary" onClick={() => void save()} isLoading={busy} />
                </HStack>
              </>}
            </Dialog>
      </VStack>
    </VStack>
  </>;
}
