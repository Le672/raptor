export type SiteVisitTotal = { visits: number; startedAt: string; updatedAt: string; metric: 'pageviews' };
export function validVisitTotal(value: unknown): value is SiteVisitTotal {
  const v = value as SiteVisitTotal;
  return !!v && Number.isSafeInteger(v.visits) && v.visits >= 0 && v.metric === 'pageviews' && Number.isFinite(Date.parse(v.startedAt)) && Number.isFinite(Date.parse(v.updatedAt));
}
