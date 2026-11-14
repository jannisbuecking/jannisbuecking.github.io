// Both calendars share the daily snapshot and a single browser request.
let request;
export function getContributionData() {
  return request ??= fetch(new URL('./data/contributions.json', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error('Contribution data unavailable');
    const data = await response.json();
    if (!Array.isArray(data.days) || !data.days.length || !Number.isFinite(data.total)) throw new Error('Invalid contribution calendar');
    return data;
  });
}
