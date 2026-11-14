// Adapted from Astryx's shell-side-nav template: shared rail + Layout content/footer.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Popover } from "@astryxdesign/core/Popover";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { TopNav } from "@astryxdesign/core/TopNav";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";

const destinations = [
  { href: "/chat", label: "Chat" },
  { href: "/overview", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
];
function useCurrentPath() { return usePathname().replace(/\/$/, "") || "/chat"; }

function Profile() {
  const [open, setOpen] = useState(false);
  return <Popover label="Your demo profile" isOpen={open} onOpenChange={setOpen} alignment="end" presentation="adaptive"
    content={<VStack gap={4}>
      <Text weight="semibold">Your demo space</Text>
      <Text type="supporting">Private to this browser. No Google account connected.</Text>
      <VStack as="nav" aria-label="Profile navigation" gap={2}>
        <Button label="Settings" href="/settings" as={Link} onClick={() => setOpen(false)} />
        <Button label="Account options" href="/login" as={Link} onClick={() => setOpen(false)} variant="ghost" />
      </VStack>
    </VStack>}>
    <Button label="Profile" variant="secondary" />
  </Popover>;
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const { isMobile } = useAppShellMobile();
  const current = useCurrentPath();
  return <Layout height="fill" contentWidth="72rem" content={
    <LayoutContent padding={isMobile ? 4 : 8}>
      <VStack gap={6}>{children}</VStack>
    </LayoutContent>
  } footer={isMobile ? <LayoutFooter hasDivider padding={3}>
    <HStack as="nav" aria-label="Mobile navigation" gap={1}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {destinations.map(({ href, label }) => <Button key={href} label={label === "Transactions" ? "Entries (Transactions)" : label} href={href} as={Link}
        width="100%" size="lg" variant={current === href ? "primary" : "ghost"}
        style={{ paddingInline: "var(--spacing-1)" }}
        aria-current={current === href ? "page" : undefined}>{label === "Transactions" ? "Entries" : label}</Button>)}
    </HStack>
  </LayoutFooter> : undefined} />;
}

export function TrackerShell({ children }: { children: React.ReactNode }) {
  const current = useCurrentPath();
  return <AppShell height="fill" variant="wash" contentPadding={0} mobileNav={{ hasToggle: false }}
    topNav={<TopNav label="App header" heading={<VStack gap={0}>
      <Text type="large" weight="bold">Money Tracker</Text><Text type="supporting">Browser demo · Test data only</Text>
    </VStack>} endContent={<Profile />} />}
    sideNav={<SideNav aria-label="Primary navigation" footer={<VStack gap={2} padding={4}>
      <Text type="label">A little clarity, every day.</Text>
      <Text type="supporting">INR · Asia/Kolkata</Text>
      <Text type="supporting">Browser demo · Test data only</Text>
    </VStack>}>
      <SideNavSection title="Your money">
        {destinations.map(({href,label}) => <SideNavItem key={href} label={label} href={href} as={Link} isSelected={current === href} />)}
      </SideNavSection>
      <SideNavSection title="Your space">
        <SideNavItem label="Settings" href="/settings" as={Link} isSelected={current === "/settings"} />
      </SideNavSection>
    </SideNav>}>
    <ShellContent>{children}</ShellContent>
  </AppShell>;
}
