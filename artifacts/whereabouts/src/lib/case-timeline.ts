export interface TimelineLeadInput { id: string; reportedTakenOn?: string | null; postedOn?: string | null; createdAt: string }
export type TimelineBasis = 'reported' | 'posted';
export interface TimelineEntry<T> { lead: T; basis: TimelineBasis; date: string }
export interface CaseTimeline<T> { dated: TimelineEntry<T>[]; undated: T[] }

/** Orders by reported-taken date, falling back to posted date (labelled as such). Never invents dates. */
export function buildCaseTimeline<T extends TimelineLeadInput>(leads: readonly T[]): CaseTimeline<T> {
  const dated: TimelineEntry<T>[] = [];
  const undated: T[] = [];
  for (const lead of leads) {
    if (lead.reportedTakenOn) dated.push({ lead, basis: 'reported', date: lead.reportedTakenOn });
    else if (lead.postedOn) dated.push({ lead, basis: 'posted', date: lead.postedOn });
    else undated.push(lead);
  }
  const rank = (b: TimelineBasis) => (b === 'reported' ? 0 : 1);
  dated.sort((a, b) => a.date.localeCompare(b.date) || rank(a.basis) - rank(b.basis) || a.lead.createdAt.localeCompare(b.lead.createdAt) || a.lead.id.localeCompare(b.lead.id));
  undated.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { dated, undated };
}
