export const filterDesks = ['original', 'recreation', 'fake-news'] as const;
export function toggleDeskFilter(value: number, index: number) { return value ^ (1 << index); }
export function deskMatchesFilter(desk: string, value: number) { return value === 0 || filterDesks.some((id, i) => id === desk && Boolean(value & (1 << i))); }
