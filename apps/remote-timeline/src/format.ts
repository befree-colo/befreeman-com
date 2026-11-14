const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatYearMonth(ym: string | null): string {
  if (!ym) return 'Present';
  return `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
}

export function formatRange(start: string, end: string | null): string {
  return `${formatYearMonth(start)} – ${formatYearMonth(end)}`;
}
