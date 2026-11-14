"use client";

import { useState } from "react";
import { Grid } from "@astryxdesign/core/Grid";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { categories, entrySchema, type Entry } from "@/lib/ledger";
import { label } from "./tracker-provider";

export type TransactionFieldsProps = {
  value: Entry;
  onChange: (value: Entry) => void;
  isDisabled?: boolean;
  showErrors?: boolean;
};
export type TransactionSubmit = (entry: Entry) => Promise<void>;
export function TransactionFields({value,onChange,isDisabled=false,showErrors=false}:TransactionFieldsProps) {
  const [touched,setTouched]=useState<Partial<Record<keyof Entry,boolean>>>({});
  const result=entrySchema.safeParse(value);
  const status=(field:keyof Entry) => {
    if(result.success || (!showErrors && !touched[field]))return undefined;
    const issue=result.error.issues.find(issue=>issue.path[0]===field || (field==="category" && issue.path.length===0));
    return issue ? {type:"error" as const,message:issue.message} : undefined;
  };
  function change(field:keyof Entry, next:string) {
    setTouched(previous=>({...previous,[field]:true}));
    if(field==="type") {
      const type=next as Entry["type"];
      onChange({...value,type,category:type==="income"?"other-income":"other-expense"});
    } else onChange({...value,[field]:next});
  }
  return <VStack gap={4}>
    <Grid columns={{minWidth:200,max:2}} gap={4}>
      <Selector label="Type" width="100%" value={value.type} options={[{value:"expense",label:"Expense"},{value:"income",label:"Income"}]}
        onChange={next=>change("type",next)} isDisabled={isDisabled} />
      <TextInput label="Amount (INR)" value={value.amount} inputMode="decimal" width="100%" onChange={next=>change("amount",next)}
        onBlur={()=>setTouched(previous=>({...previous,amount:true}))} status={status("amount")} isDisabled={isDisabled} />
      <Selector label="Category" width="100%" value={value.category}
        options={categories.filter(category=>value.type==="income"?["salary","other-income"].includes(category):!["salary","other-income"].includes(category)).map(category=>({value:category,label:label(category)}))}
        onChange={next=>change("category",next)} status={status("category")} isDisabled={isDisabled} />
      <TextInput label="Date (YYYY-MM-DD)" value={value.date} width="100%" onChange={next=>change("date",next)}
        onBlur={()=>setTouched(previous=>({...previous,date:true}))} status={status("date")} isDisabled={isDisabled} />
    </Grid>
    <TextInput label="Description" value={value.description} width="100%" onChange={next=>change("description",next)}
      onBlur={()=>setTouched(previous=>({...previous,description:true}))} status={status("description")} isDisabled={isDisabled} />
  </VStack>;
}
