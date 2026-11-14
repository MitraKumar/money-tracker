// Adapted from Astryx's shell-side-nav template: shared rail + Layout content/footer.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { ChatIcon, OverviewIcon, TransactionsIcon, SettingsIcon } from "./navigation-icons";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Popover } from "@astryxdesign/core/Popover";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { TopNav } from "@astryxdesign/core/TopNav";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { useTracker } from "./tracker-provider";
import { money } from "@/lib/ledger";
import { LoginScreen } from "./tracker-pages";

const destinations = [
  { href: "/chat", label: "Chat", icon: ChatIcon },
  { href: "/overview", label: "Overview", icon: OverviewIcon },
  { href: "/transactions", label: "Transactions", icon: TransactionsIcon },
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
  const { isMobile } = useAppShellMobile();
  const [open, setOpen] = useState(false);
  const { user, signOut, busy } = useTracker();
  return <Popover label="Your profile" isOpen={open} onOpenChange={setOpen} alignment="end" presentation="adaptive"
    content={<VStack gap={4}>
      <Text weight="semibold">{user?.name}</Text>
      <Text type="supporting">{user?.email}</Text>
      <VStack as="nav" aria-label="Profile navigation" gap={2}>
        {isMobile ? <IconButton label="Settings" tooltip="Settings" icon={<Icon icon={SettingsIcon} />} href="/settings" as={Link} onClick={() => setOpen(false)} />
          : <Button label="Settings" icon={<Icon icon={SettingsIcon} />} href="/settings" as={Link} onClick={() => setOpen(false)} />}
      </VStack>
      <Button label="Sign out" variant="destructive" style={{color:"var(--color-on-dark)",backgroundColor:"var(--color-text-error)"}} isDisabled={busy} onClick={() => { setOpen(false); void signOut(); }} />
    </VStack>}>
    <Button label="Profile" aria-label="Profile" variant="secondary" icon={<Avatar src={user?.image ?? undefined} name={user?.name || user?.email} size="sm" tooltip={false} />} />
  </Popover>;
}

function ShellContent({ children, availableHeight }: { children: React.ReactNode; availableHeight?: number }) {
  const { isMobile } = useAppShellMobile();
  const { user, authLoading } = useTracker();
  const current = useCurrentPath();
  const mobileChat = isMobile && current === "/chat" && !!user;
  return <Layout height="fill" contentWidth="72rem" content={
    <LayoutContent padding={isMobile ? 4 : 8} isScrollable={!mobileChat} style={mobileChat ? {minHeight:0, overflow:"hidden"} : undefined}>
      <VStack gap={mobileChat ? 3 : 6} style={mobileChat ? {height:"100%",minHeight:0} : undefined}>{authLoading
        ? <Heading level={1}>Checking your sign-in…</Heading>
        : !user ? <LoginScreen /> : children}</VStack>
    </LayoutContent>
  } footer={isMobile && user ? <LayoutFooter hasDivider padding={3}>
    <VStack gap={3}>
    {current === "/chat" && !(availableHeight !== undefined && availableHeight < 576) && <MonthlyTotals compact />}
    <HStack as="nav" aria-label="Mobile navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <Grid columns={4} gap={1} width="100%">
      {[...destinations, { href: "/settings", label: "Settings", icon: SettingsIcon }].map(({ href, label, icon }) => <IconButton key={href} label={label} tooltip={label} icon={<Icon icon={icon} />}
        href={href} as={Link} width="100%" size="lg" variant={current === href ? "primary" : "ghost"}
        aria-current={current === href ? "page" : undefined} />)}
      </Grid>
    </HStack>
    </VStack>
  </LayoutFooter> : undefined} />;
}

export function TrackerShell({ children }: { children: React.ReactNode }) {
  const current = useCurrentPath();
  const { user } = useTracker();
  const [viewport, setViewport] = useState<{height:number;top:number} | null>(null);
  useEffect(() => {
    const visual = window.visualViewport;
    const query = window.matchMedia("(max-width: 767px)");
    function update() {
      setViewport(current === "/chat" && query.matches && visual && visual.scale === 1
        ? {height:visual.height, top:visual.offsetTop} : null);
    }
    update();
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    query.addEventListener("change", update);
    return () => {
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
      query.removeEventListener("change", update);
    };
  }, [current]);
  return <AppShell style={viewport && user ? {height:viewport.height, minHeight:0, position:"fixed", top:viewport.top, insetInline:0} : undefined} height="fill" variant="wash" contentPadding={0} mobileNav={{ hasToggle: false }}
    topNav={<TopNav label="App header" heading={<VStack gap={0}>
      <Text type="large" weight="bold">Money Tracker</Text><Text type="supporting">Your money, one entry at a time</Text>
    </VStack>} endContent={user ? <Profile /> : undefined} />}
    sideNav={user ? <SideNav aria-label="Primary navigation" footer={<VStack gap={2} padding={4}>
      {current === "/chat" && <MonthlyTotals />}
      <Text type="label">A little clarity, every day.</Text>
      <Text type="supporting">INR · Asia/Kolkata</Text>
    </VStack>}>
      <SideNavSection title="Your money">
        {destinations.map(({href,label,icon}) => <SideNavItem key={href} label={label} icon={icon} href={href} as={Link} isSelected={current === href} />)}
      </SideNavSection>
      <SideNavSection title="Your space">
        <SideNavItem icon={SettingsIcon} label="Settings" href="/settings" as={Link} isSelected={current === "/settings"} />
      </SideNavSection>
    </SideNav> : undefined}>
    <ShellContent availableHeight={viewport?.height}>{children}</ShellContent>
  </AppShell>;
}
