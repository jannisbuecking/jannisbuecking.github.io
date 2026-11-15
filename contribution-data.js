// The phone calendar uses the daily snapshot and a cached browser request.
let request;
export function contributionCalendarLayout(days) {
  const parseDate = value => new Date(`${value}T00:00:00Z`);
  const offset = parseDate(days[0].date).getUTCDay();
  const columns = Math.ceil((days.length + offset) / 7);
  const months = [];
  let previous = '';
  days.forEach((day, index) => {
    const date = parseDate(day.date), key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (key !== previous) {
      months.push({ column: Math.floor((index + offset) / 7) + 1, label: date.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }) });
      previous = key;
    }
  });
  return { offset, columns, months: months.map((month, index) => ({ ...month,
    span: (months[index + 1]?.column ?? columns + 1) - month.column,
  })).filter(month => month.span >= 3) };
}
export function getContributionData() {
  return request ??= fetch(new URL('./data/contributions.json', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error('Contribution data unavailable');
    const data = await response.json();
    if (!Array.isArray(data.days) || !data.days.length || !Number.isFinite(data.total)) throw new Error('Invalid contribution calendar');
    return data;
  });
}
