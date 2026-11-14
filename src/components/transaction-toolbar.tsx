"use client";

import { useState } from "react";
import { useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Popover } from "@astryxdesign/core/Popover";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { categories, dateSchema } from "@/lib/ledger";
import { label } from "./tracker-provider";
import { useMonthlyExport } from "./monthly-report";

export type TransactionFilters = { type: string; category: string; from: string; to: string };
export const emptyFilters: TransactionFilters = { type: "all", category: "all", from: "", to: "" };
const sorts = [
  { value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest amount" }, { value: "lowest", label: "Lowest amount" },
];

export function TransactionToolbar({search,onSearch,filters,onFilters,sort,onSort,disabled}: {
  search: string; onSearch: (value: string) => void; filters: TransactionFilters;
  onFilters: (value: TransactionFilters) => void; sort: string; onSort: (value: string) => void; disabled: boolean;
}) {
  const { isMobile } = useAppShellMobile();
  const { ledger, busy, ready, exporting, error: exportError, download } = useMonthlyExport();
  const [open,setOpen] = useState(false);
  const [sortOpen,setSortOpen] = useState(false);
  const [draft,setDraft] = useState(filters);
  const error = draft.from && !dateSchema.safeParse(draft.from).success ? "Enter a valid start date (YYYY-MM-DD)."
    : draft.to && !dateSchema.safeParse(draft.to).success ? "Enter a valid end date (YYYY-MM-DD)."
    : draft.from && draft.to && draft.from > draft.to ? "The end date must be on or after the start date." : "";
  const chips = [
    ...(search.trim() ? [{ key: "search", text: `Search: ${search.trim()}`, remove: () => onSearch("") }] : []),
    ...(filters.type !== "all" ? [{ key: "type", text: filters.type === "expense" ? "Expenses" : "Income", remove: () => onFilters({...filters,type:"all"}) }] : []),
    ...(filters.category !== "all" ? [{ key: "category", text: label(filters.category), remove: () => onFilters({...filters,category:"all"}) }] : []),
    ...(filters.from ? [{ key: "from", text: `From ${filters.from}`, remove: () => onFilters({...filters,from:""}) }] : []),
    ...(filters.to ? [{ key: "to", text: `To ${filters.to}`, remove: () => onFilters({...filters,to:""}) }] : []),
  ];
  const count = chips.filter(chip => chip.key !== "search").length;
  const filterLabel = count ? `Filters (${count})` : "Filters";
  return <VStack as="section" aria-label="Transaction filters" gap={3}>
    <HStack gap={2} vAlign="center">
      <TextInput label="Search descriptions" isLabelHidden startIcon="search" placeholder="Search" type="search"
        value={search} onChange={onSearch} hasClear isDisabled={disabled} containerStyle={{flex:"1 1 0",minWidth:0}} />
      <Popover label="Filter transactions" isOpen={open} onOpenChange={next=>{if(next)setDraft(filters);setOpen(next);}}
        presentation={isMobile ? "bottom-sheet" : "popover"} alignment="end" width="22rem" padding={4}
        content={<VStack gap={4}>
          <Heading level={2} style={{fontFamily:"var(--font-family-body)"}}>Filter transactions</Heading>
          <Selector label="Type" width="100%" value={draft.type} onChange={type=>setDraft({...draft,type})}
            options={[{value:"all",label:"All types"},{value:"expense",label:"Expenses"},{value:"income",label:"Income"}]} />
          <Selector label="Category" width="100%" value={draft.category} onChange={category=>setDraft({...draft,category})}
            options={[{value:"all",label:"All categories"},...categories.map(value=>({value,label:label(value)}))]} />
          <TextInput label="From date (YYYY-MM-DD)" value={draft.from} onChange={from=>setDraft({...draft,from})} width="100%" placeholder="YYYY-MM-DD" />
          <TextInput label="To date (YYYY-MM-DD)" value={draft.to} onChange={to=>setDraft({...draft,to})} width="100%" placeholder="YYYY-MM-DD" />
          {error && <Text role="alert">{error}</Text>}
          <HStack gap={2} wrap="wrap" hAlign="end">
            <Button label="Reset" variant="ghost" onClick={()=>setDraft(emptyFilters)} />
            <Button label="Cancel" variant="secondary" onClick={()=>setOpen(false)} />
            <Button label="Apply filters" variant="primary" isDisabled={!!error} onClick={()=>{onFilters(draft);setOpen(false);}} />
          </HStack>
        </VStack>}>
        {isMobile ? <IconButton label={filterLabel} tooltip={filterLabel} icon={<Icon icon="funnel" />} isDisabled={disabled} />
          : <Button label={filterLabel} icon={<Icon icon="funnel" />} isDisabled={disabled} />}
      </Popover>
      <Popover label="Sort transactions" isOpen={sortOpen} onOpenChange={setSortOpen} alignment="end" presentation={isMobile ? "bottom-sheet" : "popover"}
        content={<VStack gap={1}>{sorts.map(option=><Button key={option.value} label={option.label} aria-pressed={sort===option.value}
          variant={sort===option.value?"secondary":"ghost"} icon={sort===option.value?<Icon icon="check" />:undefined}
          onClick={()=>{onSort(option.value);setSortOpen(false);}} />)}</VStack>}>
        {isMobile ? <IconButton label="Sort transactions" tooltip={sorts.find(option=>option.value===sort)?.label} icon={<Icon icon="arrowsUpDown" />} isDisabled={disabled} />
          : <Button label={sorts.find(option=>option.value===sort)!.label} aria-label="Sort transactions" icon={<Icon icon="arrowsUpDown" />} isDisabled={disabled} />}
      </Popover>
      <Button label="Export" onClick={()=>void download()} isLoading={exporting}
        isDisabled={!ready || !ledger || busy || exporting} variant="secondary"
        aria-description={ledger ? `Download CSV of all confirmed ${ledger.month} records in INR. Search and filters do not change the export.` : "Download monthly CSV."} />
    </HStack>
    {exportError && <Text role="alert">{exportError}</Text>}
    {!!chips.length && <HStack gap={2} wrap="wrap" vAlign="center" aria-label="Active filters">
      {chips.map(chip=><Button key={chip.key} label={chip.text} aria-label={`Remove filter: ${chip.text}`} size="sm" variant="secondary"
        endContent={<Icon icon="close" />} style={{maxWidth:"100%"}} onClick={chip.remove} />)}
      <Button label="Clear all" size="sm" variant="ghost" onClick={()=>{onSearch("");onFilters(emptyFilters);}} />
    </HStack>}
  </VStack>;
}
