import type { SVGProps } from "react";

const outline = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" {...outline} {...props}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2V11.5a10 10 0 0 1 20 0Z" /><path d="M7 9h8M7 13h5" /></svg>;
}

export function OverviewIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" {...outline} {...props}><path d="M4 3v17h17M8 16v-5M13 16V6M18 16V9" /></svg>;
}

export function TransactionsIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" {...outline} {...props}><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></svg>;
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" {...outline} {...props}><path d="m10 3-.5 2-2 .9-1.9-.6-2 3.4L5 10.2v2.3l-1.4 1.6 2 3.4 2-.6 2 .9.4 2.2h4l.5-2.2 2-.9 1.9.6 2-3.4-1.4-1.6v-2.3l1.4-1.5-2-3.4-2 .6-2-.9L14 3Z" /><circle cx="12" cy="11.5" r="3" /></svg>;
}
