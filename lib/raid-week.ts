/**
 * Raid lockout display weeks start Wednesday 00:00 Europe/Oslo.
 *
 * The week number is the ISO-8601 week containing that Wednesday, with its
 * ISO week-year (important around New Year). This is a display convention;
 * actual lockout eligibility remains enforced by Supabase's raid_week_start.
 */
const osloCalendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export type RaidWeek = {
  week: number;
  year: number;
  start: string;
  end: string;
  title: string;
  dateRange: string;
  key: string;
};

export function raidLockoutWeek(instant: string): RaidWeek {
  // Read the *calendar date in Oslo* first. Doing UTC arithmetic directly on
  // the source timestamp would mislabel events close to midnight and DST.
  const parts = osloCalendar.formatToParts(new Date(instant));
  const numberPart = (type: string) =>
    Number(parts.find(part => part.type === type)?.value);
  const local = new Date(Date.UTC(
    numberPart('year'), numberPart('month') - 1, numberPart('day'),
  ));
  // UTC day 0=Sunday, 3=Wednesday.
  const daysSinceWednesday = (local.getUTCDay() + 4) % 7;
  const startDate = new Date(local);
  startDate.setUTCDate(local.getUTCDate() - daysSinceWednesday);
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 7);

  // Wednesday belongs to the same ISO week as Thursday. Thursday determines
  // the correct ISO week-year at December / January boundaries.
  const thursday = new Date(startDate);
  thursday.setUTCDate(startDate.getUTCDate() + 1);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstIsoThursday = new Date(firstThursday);
  firstIsoThursday.setUTCDate(
    firstThursday.getUTCDate() + (4 - ((firstThursday.getUTCDay() + 6) % 7 + 1)),
  );
  // The above expression is equivalent to advancing to that ISO week's Thu.
  const week = 1 + Math.round(
    (thursday.getTime() - firstIsoThursday.getTime()) / (7 * 86400000),
  );
  const dateRange = `Wed ${dayLabel.format(startDate)} – Wed ${dayLabel.format(endDate)}`;
  return {
    week, year,
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
    key: `${year}-W${String(week).padStart(2, '0')}`,
    title: `Week ${week}, ${year}`,
    dateRange,
  };
}
