import { Suspense } from "react";
import { Text } from "@astryxdesign/core/Text";
import { TransactionsScreen } from "@/components/transactions-screen";

export default function TransactionsPage() {
  return <Suspense fallback={<Text role="status">Loading transactions…</Text>}><TransactionsScreen /></Suspense>;
}
