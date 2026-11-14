// Adapted from Astryx's shell-side-nav template: shared rail + Layout content/footer.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Popover } from "@astryxdesign/core/Popover";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { TopNav } from "@astryxdesign/core/TopNav";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { useTracker } from "./tracker-provider";
import { money } from "@/lib/ledger";
import { LoginScreen } from "./tracker-pages";

const destinations = [
  { href: "/chat", label: "Chat" },
  { href: "/overview", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
];
function useCurrentPath() { return usePathname().replace(/\/$/, "") || "/chat"; }

function MonthlyTotals({ compact = false }: { compact?: boolean }) {
  const { ledger } = useTracker();
  return <VStack gap={2} aria-label="Monthly confirmed totals">
    <Text type="supporting">Confirmed entries · {ledger?.month ?? "Loading…"}</Text>
    <HStack gap={3} wrap="wrap" hAlign="between">
      {[
        ["Income", ledger?.summary.income],
        ["Expenses", ledger?.summary.expenses],
        ["Net cash flow", ledger ? ledger.summary.income - ledger.summary.expenses : undefined],
      ].map(([name, value]) => <VStack key={String(name)} gap={0}>
        <Text type="supporting">{name}</Text>
        <Text type={compact ? "supporting" : "body"} hasTabularNumbers weight="semibold">{value === undefined ? "—" : money(Number(value))}</Text>
      </VStack>)}
    </HStack>
  </VStack>;
}

function Profile() {
  const [open, setOpen] = useState(false);
  const { user, signOut, busy } = useTracker();
  return <Popover label="Your profile" isOpen={open} onOpenChange={setOpen} alignment="end" presentation="adaptive"
    content={<VStack gap={4}>
      <Text weight="semibold">{user?.name}</Text>
      <Text type="supporting">{user?.email}</Text>
      <VStack as="nav" aria-label="Profile navigation" gap={2}>
        <Button label="Settings" href="/settings" as={Link} onClick={() => setOpen(false)} />
      </VStack>
      <Button label="Sign out" variant="ghost" isDisabled={busy} onClick={() => { setOpen(false); void signOut(); }} />
    </VStack>}>
    <Button label="Profile" aria-label="Profile" variant="secondary" icon={<Avatar src={user?.image ?? undefined} name={user?.name || user?.email} size="sm" tooltip={false} />} />
  </Popover>;
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const { isMobile } = useAppShellMobile();
  const { user, authLoading } = useTracker();
  const current = useCurrentPath();
  return <Layout height="fill" contentWidth="72rem" content={
    <LayoutContent padding={isMobile ? 4 : 8}>
      <VStack gap={6}>{authLoading
        ? <Heading level={1}>Checking your sign-in…</Heading>
        : !user ? <LoginScreen /> : children}</VStack>
    </LayoutContent>
  } footer={isMobile && user ? <LayoutFooter hasDivider padding={3}>
    <VStack gap={3}>
    {current === "/chat" && <MonthlyTotals compact />}
    <HStack as="nav" aria-label="Mobile navigation" gap={1}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {destinations.map(({ href, label }) => <Button key={href} label={label === "Transactions" ? "Entries (Transactions)" : label} href={href} as={Link}
        width="100%" size="lg" variant={current === href ? "primary" : "ghost"}
        style={{ paddingInline: "var(--spacing-1)" }}
        aria-current={current === href ? "page" : undefined}>{label === "Transactions" ? "Entries" : label}</Button>)}
    </HStack>
    </VStack>
  </LayoutFooter> : undefined} />;
}

export function TrackerShell({ children }: { children: React.ReactNode }) {
  const current = useCurrentPath();
  const { user } = useTracker();
  return <AppShell height="fill" variant="wash" contentPadding={0} mobileNav={{ hasToggle: false }}
    topNav={<TopNav label="App header" heading={<VStack gap={0}>
      <Text type="large" weight="bold">Money Tracker</Text><Text type="supporting">Your money, one entry at a time</Text>
    </VStack>} endContent={user ? <Profile /> : undefined} />}
    sideNav={user ? <SideNav aria-label="Primary navigation" footer={<VStack gap={2} padding={4}>
      {current === "/chat" && <MonthlyTotals />}
      <Text type="label">A little clarity, every day.</Text>
      <Text type="supporting">INR · Asia/Kolkata</Text>
      <Text type="supporting">Signed in with Google</Text>
    </VStack>}>
      <SideNavSection title="Your money">
        {destinations.map(({href,label}) => <SideNavItem key={href} label={label} href={href} as={Link} isSelected={current === href} />)}
      </SideNavSection>
      <SideNavSection title="Your space">
        <SideNavItem label="Settings" href="/settings" as={Link} isSelected={current === "/settings"} />
      </SideNavSection>
    </SideNav> : undefined}>
    <ShellContent>{children}</ShellContent>
  </AppShell>;
}
