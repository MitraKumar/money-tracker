"use client";

import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { useAppearance } from "./app-theme";
import { VStack } from "@astryxdesign/core/VStack";
import { useTracker } from "./tracker-provider";
import { ConnectionStatus, MonthFilter, PageHeading, Summary, TransactionRows } from "./tracker-parts";

import { MonthlyReportCharts } from "./monthly-report";

const bodyHeading = { fontFamily: "var(--font-family-body)" };

export function OverviewScreen() {
  const {ledger}=useTracker();
  return <>
    <PageHeading eyebrow="THE BIGGER PICTURE" title="A month in perspective." description="A clear look at what you’ve recorded, with room to notice the little things." />
    <ConnectionStatus /><MonthFilter />
    <Text type="supporting">{ledger ? `Records for ${ledger.month}` : "Loading…"}</Text>
    <Summary />
    <MonthlyReportCharts />
    <VStack as="section" gap={3} aria-labelledby="recent-title">
      <HStack wrap="wrap" hAlign="between" vAlign="center" gap={3}>
        <Heading level={2} id="recent-title" style={bodyHeading}>Recent entries</Heading>
        <Button label="View transactions" href="/transactions" as={Link} variant="secondary" />
      </HStack>
      {ledger && <TransactionRows transactions={ledger.transactions.slice(0,5)} />}
    </VStack>
  </>;
}

export { TransactionsScreen } from "./transactions-screen";

export function SettingsScreen() {
  const {signOut,busy}=useTracker();
  const {appearance,setAppearance}=useAppearance();
  return <>
    <PageHeading eyebrow="YOUR SPACE" title="Keep things simple." description="Your account and ledger preferences." />
    <Selector label="Appearance" value={appearance} onChange={value => {
      if (value === "light" || value === "dark" || value === "system") setAppearance(value);
    }}
      options={[{value:"system",label:"System"},{value:"light",label:"Light"},{value:"dark",label:"Dark"}]} />
    <Text type="supporting">System follows your device’s appearance. Your choice is saved in this browser.</Text>
    <List edge="flush">
      <ListItem label="Currency" description="Your ledger uses one currency." endContent={<Text>INR · Indian rupee</Text>} />
      <ListItem label="Accounting timezone" description="Used to interpret today and yesterday." endContent={<Text>Asia/Kolkata</Text>} />
    </List>
    <VStack gap={3}>
      <HStack wrap="wrap" gap={3}><Button label="Sign out" variant="destructive" style={{color:"var(--color-on-dark)",backgroundColor:"var(--color-text-error)"}} onClick={()=>void signOut()} isDisabled={busy} /><Button label="View ledger defaults" href="/setup" as={Link} variant="ghost" /></HStack>
    </VStack>
  </>;
}

export function LoginScreen() {
  const {user,configured,authLoading,busy,signIn,message}=useTracker();
  return <VStack gap={6} maxWidth="36rem">
    <PageHeading eyebrow="WELCOME TO MONEY TRACKER" title="Your own little corner." description="Track your money, one message at a time. You review each entry before saving." />
    {user ? <Button label="Continue to chat" href="/chat" as={Link} variant="primary" size="lg" /> :
      <Button label="Continue with Google" onClick={()=>void signIn()} variant="primary" size="lg" isLoading={busy} isDisabled={authLoading||!configured} />}
    {!authLoading && !configured && <Text as="p" role="status">Google sign-in setup is pending. The app owner needs to configure the OAuth credentials.</Text>}
    {configured && !user && <Text as="p" role="status">{message}</Text>}
  </VStack>;
}

export function SetupScreen() {
  return <VStack gap={6} maxWidth="36rem">
    <PageHeading eyebrow="A GOOD PLACE TO START" title="A few simple defaults." description="Your ledger is set up for everyday entries in Indian rupees." />
    <TextInput label="Ledger currency" value="INR · Indian rupee" isReadOnly width="100%" />
    <TextInput label="Accounting timezone" value="Asia/Kolkata" isReadOnly width="100%" />
    <Text type="supporting">These are the current ledger defaults. Editable preferences will follow. Historical entries will keep their original accounting dates.</Text>
    <Button label="Continue to chat" href="/chat" as={Link} variant="primary" size="lg" />
  </VStack>;
}
