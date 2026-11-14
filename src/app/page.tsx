"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

export default function Home() {
  const [showExample, setShowExample] = useState(false);

  return (
    <VStack minHeight="100svh" padding={6} gap={10}
      style={{ background: "var(--color-background-body)", color: "var(--color-text-primary)" }}>
      <HStack as="header" hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Text type="large" weight="bold">Money Tracker</Text>
        <Text type="supporting">A little clarity, every day.</Text>
      </HStack>

      <VStack as="main" id="main-content" width="100%" maxWidth="70rem" gap={10}
        style={{ marginInline: "auto" }}>
        <Grid columns={{ minWidth: 280, max: 2 }} gap={10} align="center">
          <VStack as="section" gap={6} aria-labelledby="welcome-title">
            <Text type="supporting">MAKE ROOM FOR THE EVERYDAY</Text>
            <Heading id="welcome-title" level={1}>Your money, a little clearer.</Heading>
            <Text as="p" type="large" color="secondary">
              A lunch out. A ride to work. Payday. Turn the little things into a
              clearer picture of your money, one message at a time.
            </Text>
            <HStack wrap="wrap" gap={4} vAlign="center">
              <Button
                label={showExample ? "Hide example" : "Explore an example"}
                variant="primary" size="lg"
                onClick={() => setShowExample((value) => !value)}
                aria-expanded={showExample} aria-controls="example-entry"
              />
              <Text type="supporting">A preview of what we’re building.</Text>
            </HStack>
          </VStack>

          <Card variant="muted">
            <VStack gap={6}>
              <HStack hAlign="between" wrap="wrap" gap={2}>
                <Text type="label">The small things add up</Text>
                <Text type="supporting">Sample entry</Text>
              </HStack>
              <VStack gap={2}>
                <Text type="supporting">You</Text>
                <Text as="p">Spent ₹30 on a rickshaw to work</Text>
              </VStack>
              <Card>
                <VStack gap={4}>
                  <HStack hAlign="between" vAlign="center" wrap="wrap" gap={4}>
                    <VStack gap={1}>
                      <Text weight="semibold">Rickshaw to work</Text>
                      <Text type="supporting">Transport · Expense</Text>
                    </VStack>
                    <Text type="large" hasTabularNumbers weight="semibold">₹30.00</Text>
                  </HStack>
                  <Text type="supporting">Not saved yet · Review before saving</Text>
                </VStack>
              </Card>
              <VStack id="example-entry" gap={3} hidden={!showExample}>
                {showExample && <>
                  <Text as="p">
                    Chat entry will organize the amount, category, and date into
                    an editable draft. You’ll confirm it before it reaches your records.
                  </Text>
                  <Text type="supporting">This is sample content. Nothing is saved or sent to AI.</Text>
                </>}
              </VStack>
              <Text type="supporting">Less effort to record. More space to understand.</Text>
            </VStack>
          </Card>
        </Grid>

        <Grid columns={{ minWidth: 240, max: 3 }} gap={6}>
          {[
            ["01", "Just say it", "Record an expense or income in your own words."],
            ["02", "Make it yours", "Review the details and choose the right category."],
            ["03", "See the picture", "Understand your month through clear summaries."],
          ].map(([number, title, description]) => (
            <VStack as="section" key={number} gap={3}>
              <Text type="supporting">{number}</Text>
              <Heading level={2} style={{ fontFamily: "var(--font-family-body)" }}>{title}</Heading>
              <Text as="p" color="secondary">{description}</Text>
            </VStack>
          ))}
        </Grid>
      </VStack>

      <HStack as="footer" hAlign="between" wrap="wrap" gap={3}>
        <Text type="supporting">Money Tracker</Text>
        <Text type="supporting">Built with a little matcha.</Text>
      </HStack>
    </VStack>
  );
}
