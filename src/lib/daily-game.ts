export function dailyGameKey(value: string | null) {
  if (!value || !/^\d{4}-\d\d-\d\d$/.test(value)) return null;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
