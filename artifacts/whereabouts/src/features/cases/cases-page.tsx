import { Link } from 'wouter';
import { ArrowRight, FolderPlus, UserRound } from 'lucide-react';
import { useListMissingPersonCases } from '@workspace/api-client-react';
import { ErrorBanner, PrivacyNotice, Skeleton, errorMessage, photoUrl, primaryBtn } from './shared';
import { DeskHeadline, FolderFront, SpecimenTray, animateFolderOpen } from '@/components/field-desk';

export function displayName(c: { firstName: string; lastName?: string; nickname?: string }) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') + (c.nickname ? ` ("${c.nickname}")` : '');
}

export default function CasesPage() {
  const q = useListMissingPersonCases();
  const rows = q.data ?? [];
  return <div className="wa-case-list fade-up">
    <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">Private cases</p><DeskHeadline className="mt-3 text-5xl md:text-6xl">Case files.</DeskHeadline><p className="mt-3 max-w-lg text-sm text-[#718078]">A careful place to organize authorized photos, links and tips. Visible only to you.</p></div>
      {(!q.isSuccess||rows.length>0)&&<Link href="/cases/new" data-testid="button-new-case" className={primaryBtn}><FolderPlus size={16} />Open a case</Link>}
    </div>
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div>
        {q.isLoading ? <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
          : q.isError ? <ErrorBanner message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          : rows.length === 0 ? <SpecimenTray testId="empty-cases" title="No cases yet" text="Open a case to keep leads organized and unverified until you review them." action={<Link href="/cases/new" className={`${primaryBtn} mt-5`} data-testid="link-empty-new-case">Open your first case</Link>}/>
          : <ul className="grid gap-8 sm:grid-cols-2">{rows.map((c,i) => <li key={c.id}>
              <Link href={`/cases/${c.id}`} data-testid={`card-case-${c.id}`} className="fd-folder" onClick={event=>animateFolderOpen(event.currentTarget)}>
                <FolderFront number={i+1} date={new Date(c.createdAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}>
                {c.headshot ? <img src={photoUrl(c.headshot)} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-[#e6ecf6] text-[#385e51]"><UserRound size={24} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-editorial text-2xl">{displayName(c)}</p>
                  <p className="mt-1 truncate text-xs text-[#718078]">{c.lastKnownArea || 'No area noted'}</p>
                  <p className="mt-3 flex items-center justify-between font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]"><span>{c.leads.length} saved lead{c.leads.length === 1 ? '' : 's'}</span><ArrowRight size={13} className="transition group-hover:translate-x-1" /></p>
                </div>
                </FolderFront>
              </Link></li>)}</ul>}
      </div>
      <PrivacyNotice compact />
    </div>
  </div>;
}
