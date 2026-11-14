"use client";

import { useState } from "react";
import { useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Popover } from "@astryxdesign/core/Popover";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function MonthPicker({ value, onChange, disabled }: {
  value: string; onChange: (month: string) => void; disabled: boolean;
}) {
  const { isMobile } = useAppShellMobile();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(1);
  const [yearError, setYearError] = useState(false);
  const validValue = /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  const selectedYear = validValue ? Number(value.slice(0, 4)) : null;
  const selectedMonth = validValue ? Number(value.slice(5)) - 1 : null;
  const display = selectedMonth !== null ? `${months[selectedMonth]} ${value.slice(0, 4)}` : "Choose month";
  return <VStack gap={2}>
    <Text type="label">Month</Text>
    <Popover label="Choose month and year" isOpen={open} onOpenChange={next => {
      if (next) {
        setYear(selectedYear || Number(new Intl.DateTimeFormat("en", {year:"numeric", timeZone:"Asia/Kolkata"}).format(new Date())));
        setYearError(false);
      }
      setOpen(next);
    }} presentation={isMobile ? "bottom-sheet" : "popover"} width="22rem" padding={4}
      content={<VStack gap={4}>
        <Text weight="semibold">Choose month and year</Text>
        <HStack gap={2} vAlign="end">
          <IconButton label="Previous year" tooltip="Previous year" icon={<Icon icon="chevronLeft" />}
            isDisabled={year <= 1 || yearError} onClick={() => setYear(year - 1)} />
          <NumberInput label="Year" value={year} onChange={setYear} min={1} max={9999} step={1}
            isIntegerOnly isWheelEnabled={false} hasNumberSteppers={false}
            onEntryErrorChange={error => setYearError(!!error)} containerStyle={{flex:"1 1 0",minWidth:0}} />
          <IconButton label="Next year" tooltip="Next year" icon={<Icon icon="chevronRight" />}
            isDisabled={year >= 9999 || yearError} onClick={() => setYear(year + 1)} />
        </HStack>
        <Grid columns={3} gap={2} aria-label="Months">
          {months.map((month, index) => <Button key={month} label={month} aria-label={month}
            variant={selectedYear === year && selectedMonth === index ? "primary" : "ghost"}
            aria-pressed={selectedYear === year && selectedMonth === index} isDisabled={yearError}
            onClick={() => {onChange(`${String(year).padStart(4,"0")}-${String(index + 1).padStart(2,"0")}`);setOpen(false);}}>{month.slice(0,3)}</Button>)}
        </Grid>
        <Button label="Cancel" variant="secondary" onClick={() => setOpen(false)} />
      </VStack>}>
      <Button label={display} aria-label={`Month: ${display}`} icon={<Icon icon="calendar" />} isDisabled={disabled} />
    </Popover>
  </VStack>;
}
