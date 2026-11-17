import { useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { FolderPlus } from 'lucide-react';
import { useListMissingPersonCases } from '@workspace/api-client-react';
import { ErrorBanner, PrivacyNotice, Skeleton, errorMessage, primaryBtn } from './shared';
import { DeskHeadline } from '@/components/field-desk';
import { FileDrawer } from '@/components/physical-controls';

export function displayName(c: { firstName: string; lastName?: string; nickname?: string }) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') + (c.nickname ? ` ("${c.nickname}")` : '');
}
export default function CasesPage() {
  const query = useListMissingPersonCases(), rows = query.data ?? [];
  const createRef=useRef<(()=>Promise<void>)|null>(null),[,navigate]=useLocation();
  return <div className="wa-case-list fade-up">
    <div className="mb-9"><p className="font-data text-[9px] uppercase tracking-[.2em]">Private cases</p><DeskHeadline className="mt-3 text-5xl md:text-6xl">Case files.</DeskHeadline><p className="mt-3 max-w-lg text-sm">A careful place to organize authorized photos, links and tips. Visible only to you.</p></div>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>{query.isLoading ? <Skeleton className="h-[360px]" /> : query.isError ? <ErrorBanner message={errorMessage(query.error)} onRetry={() => query.refetch()} /> : <FileDrawer createRef={createRef} items={rows.map(c => ({ id: c.id, title: displayName(c) }))} />}
        {!query.isError && <Link href="/cases/new" data-testid={rows.length ? 'button-new-case' : 'link-empty-new-case'} className={`${primaryBtn} mt-6`} style={{width:220,height:48,whiteSpace:'nowrap'}} onClick={async event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();await createRef.current?.();navigate('/cases/new');}}><FolderPlus size={16} />{rows.length ? 'Open a case' : 'Open your first case'}</Link>}
      </div><PrivacyNotice compact />
    </div>
  </div>;
}
