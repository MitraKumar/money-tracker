"use client";

import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
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
    <Text type="supporting">{ledger ? `Confirmed records for ${ledger.month}` : "Loading…"}</Text>
    <Summary />
    <Text type="supporting">Net cash flow means recorded income minus expenses. It is not your bank balance.</Text>
    <MonthlyReportCharts />
    <VStack as="section" gap={3} aria-labelledby="recent-title">
      <HStack wrap="wrap" hAlign="between" vAlign="center" gap={3}>
        <Heading level={2} id="recent-title" style={bodyHeading}>Recent entries</Heading>
        <Button label="View transactions" href="/transactions" as={Link} variant="ghost" />
      </HStack>
      {ledger && <TransactionRows transactions={ledger.transactions.slice(0,5)} />}
    </VStack>
  </>;
}

export { TransactionsScreen } from "./transactions-screen";

export function SettingsScreen() {
  const {user,signOut,busy}=useTracker();
  return <>
    <PageHeading eyebrow="YOUR SPACE" title="Keep things simple." description="Your account and ledger preferences." />
    <List edge="flush">
      <ListItem label="Currency" description="Your ledger uses one currency." endContent={<Text>INR · Indian rupee</Text>} />
      <ListItem label="Accounting timezone" description="Used to interpret today and yesterday." endContent={<Text>Asia/Kolkata</Text>} />
      <ListItem label="Access" description="Sign in with the same Google account to access your records on other devices." endContent={<Text>{user?.email}</Text>} />
      <ListItem label="Retention" description="Saved transactions belong to your account. Signing out or session expiry does not delete them." />
    </List>
    <VStack gap={3}>
      <Heading level={2} style={bodyHeading}>Before you add anything</Heading>
      <Text as="p" color="secondary">Keep your Google account secure. Monthly CSV exports are available in Transactions. Account-deletion controls are still being developed; this remains an early pilot.</Text>
      <HStack wrap="wrap" gap={3}><Button label="Sign out" onClick={()=>void signOut()} isDisabled={busy} /><Button label="View ledger defaults" href="/setup" as={Link} variant="ghost" /></HStack>
    </VStack>
  </>;
}

export function LoginScreen() {
  const {user,configured,authLoading,busy,signIn,message}=useTracker();
  return <VStack gap={6} maxWidth="36rem">
    <PageHeading eyebrow="WELCOME TO MONEY TRACKER" title="Your own little corner." description="Track your money, one message at a time. You review each entry before saving." />
    <Text as="p">Sign in with Google to keep your ledger private and access the same records across browsers and devices.</Text>
    {user ? <Button label="Continue to chat" href="/chat" as={Link} variant="primary" size="lg" /> :
      <Button label="Continue with Google" onClick={()=>void signIn()} variant="primary" size="lg" isLoading={busy} isDisabled={authLoading||!configured} />}
    {!authLoading && !configured && <Text as="p" role="status">Google sign-in setup is pending. The app owner needs to configure the OAuth credentials.</Text>}
    {configured && !user && <Text as="p" role="status">{message}</Text>}
    <Text type="supporting">We request your basic Google profile and email for sign-in. We do not request access to Gmail, Drive, or your financial accounts.</Text>
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
