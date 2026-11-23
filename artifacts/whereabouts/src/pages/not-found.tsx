import { Link } from 'wouter';
import { DeskRuler, FieldSheet, SpecimenTray } from '@/components/field-desk';

export default function NotFound(){
  return <main className="min-h-[100dvh] px-6 py-7 md:px-12">
    <header className="mb-6 font-data text-[13px]"><Link href="/">whereabouts / address index</Link></header>
    <DeskRuler/><div className="max-w-4xl py-12"><FieldSheet code="404 / UNFILED ADDRESS"><SpecimenTray label="INDEX EMPTY / NO MATCHING ADDRESS" title="404 Page Not Found" text="This address is not in the index. Return to Whereabouts or open the sample collection." action={<div className="mt-7 flex flex-wrap gap-4"><Link href="/" className="fd-primary px-5 py-3 text-sm">Return to Whereabouts</Link><Link href="/demo" className="border border-current px-5 py-3 text-sm">Open samples</Link></div>}/></FieldSheet></div>
  </main>;
}
