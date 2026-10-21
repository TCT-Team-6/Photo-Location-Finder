import { Link } from 'wouter';
import { ArrowRight, FolderPlus, UserRound } from 'lucide-react';
import { useListMissingPersonCases } from '@workspace/api-client-react';
import { ErrorBanner, PrivacyNotice, Skeleton, errorMessage, photoUrl, primaryBtn } from './shared';

export function displayName(c: { firstName: string; lastName?: string; nickname?: string }) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') + (c.nickname ? ` ("${c.nickname}")` : '');
}

export default function CasesPage() {
  const q = useListMissingPersonCases();
  const rows = q.data ?? [];
  return <div className="fade-up">
    <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">Private cases</p><h1 className="mt-3 font-editorial text-5xl tracking-[-.05em] md:text-6xl">Case files.</h1><p className="mt-3 max-w-lg text-sm text-[#718078]">A careful place to organize authorized photos, links and tips. Visible only to you.</p></div>
      <Link href="/cases/new" data-testid="button-new-case" className={primaryBtn}><FolderPlus size={16} />Open a case</Link>
    </div>
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div>
        {q.isLoading ? <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
          : q.isError ? <ErrorBanner message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-[#b9c4b5] bg-[#f8f5ec] p-10 text-center" data-testid="empty-cases">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e9ede3] text-[#385e51]"><UserRound size={20} /></span>
              <h2 className="mt-4 font-editorial text-2xl">No cases yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[#718078]">Open a case to keep leads organized and unverified until you review them.</p>
              <Link href="/cases/new" className={`${primaryBtn} mt-5`} data-testid="link-empty-new-case">Open your first case</Link>
            </div>
          : <ul className="grid gap-4 sm:grid-cols-2">{rows.map((c) => <li key={c.id}>
              <Link href={`/cases/${c.id}`} data-testid={`card-case-${c.id}`} className="group flex h-full gap-4 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4 transition hover:-translate-y-0.5 hover:border-[#668675]">
                {c.headshot ? <img src={photoUrl(c.headshot)} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-[#e6ecf6] text-[#385e51]"><UserRound size={24} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-editorial text-2xl">{displayName(c)}</p>
                  <p className="mt-1 truncate text-xs text-[#718078]">{c.lastKnownArea || 'No area noted'}</p>
                  <p className="mt-3 flex items-center justify-between font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]"><span>{c.leads.length} saved lead{c.leads.length === 1 ? '' : 's'}</span><ArrowRight size={13} className="transition group-hover:translate-x-1" /></p>
                </div>
              </Link></li>)}</ul>}
      </div>
      <PrivacyNotice compact />
    </div>
  </div>;
}
