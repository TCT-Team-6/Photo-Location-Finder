import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMissingPersonCaseQueryKey, getListMissingPersonCasesQueryKey, useCreateMissingPersonCase } from '@workspace/api-client-react';
import { CaseForm, emptyCase } from './case-form';
import { PrivacyNotice, errorMessage, newId } from './shared';
import { useDirtyGuard } from './use-dirty-guard';

export default function NewCasePage() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const requestId = useRef(newId());
  const [error, setError] = useState('');
  const { setDirty, confirmLeave } = useDirtyGuard();
  const create = useCreateMissingPersonCase({
    mutation: {
      onSuccess: (c) => {
        requestId.current = newId();
        qc.setQueryData(getGetMissingPersonCaseQueryKey(c.id), c);
        qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
        setDirty(false);
        nav(`/cases/${c.id}`);
      },
      onError: (e) => setError(errorMessage(e)),
    },
  });
  const leave = () => { if (confirmLeave()) { setDirty(false); nav('/cases'); } };
  return <div className="fade-up mx-auto max-w-4xl">
    <button type="button" onClick={leave} className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#718078] hover:text-[#385e51]" data-testid="link-back-cases"><ArrowLeft size={14} />Back to cases</button>
    <p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">Private case / intake</p>
    <h1 className="mt-3 font-editorial text-5xl tracking-[-.05em]">Open a case.</h1>
    <p className="mt-3 max-w-xl text-sm leading-6 text-[#718078]">Only a first name is required. Add what you know and are comfortable keeping here.</p>
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
      <CaseForm initial={emptyCase} submitLabel="Save case" pending={create.isPending} error={error} onDirtyChange={setDirty} onCancel={leave}
        onSubmit={(data) => { setError(''); create.mutate({ data: { ...data, clientRequestId: requestId.current } }); }} />
      <div className="lg:sticky lg:top-6 lg:self-start"><PrivacyNotice /></div>
    </div>
  </div>;
}
