/**
 * Resolves relative time expressions ("last month", "past 7 days",
 * "in October") into [start, end) instants.
 *
 * Calendar boundaries are computed in the user's local time, given as
 * `utcOffsetMinutes` (local minus UTC, e.g. +330 for India, -300 for New
 * York in winter), so "today" means the user's today, not the server's.
 */
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_ALIASES = new Map([
  ...MONTHS.map((m, i) => [m, i]),
  ...MONTHS.map((m, i) => [m.slice(0, 3), i]),
  ['sept', 8],
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const UNIT_WORDS = '(day|days|week|weeks|month|months|year|years)';
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, thirty: 30 };

/** Wall-clock helpers: a "local" Date stores local time in its UTC fields. */
const toLocal = (date, offset) => new Date(date.getTime() + offset * 60000);
const fromLocal = (local, offset) => new Date(local.getTime() - offset * 60000);

const startOfLocalDay = (local) => new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
const startOfLocalMonth = (year, month) => new Date(Date.UTC(year, month, 1));

/** Monday-based week start. */
function startOfLocalWeek(local) {
  const day = startOfLocalDay(local);
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - weekday * DAY_MS);
}

function addLocalMonths(local, months) {
  const result = new Date(local.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

const monthLabel = (year, month) => `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}`;

/**
 * @param {string} text normalised (lower-case) query
 * @param {{ now?: Date, utcOffsetMinutes?: number }} [options]
 * @returns {{ start: Date, end: Date, label: string, phrase: string } | null}
 */
function parseTimeRange(text, { now = new Date(), utcOffsetMinutes = 0 } = {}) {
  const q = ` ${String(text).toLowerCase().replace(/\s+/g, ' ')} `;
  const offset = utcOffsetMinutes;
  const local = toLocal(now, offset);
  const today = startOfLocalDay(local);
  const range = (startLocal, endLocal, label, phrase) => ({
    start: fromLocal(startLocal, offset),
    end: endLocal === null ? now : fromLocal(endLocal, offset),
    label,
    phrase,
  });

  let m;

  // last / past N days|weeks|months|years (rolling window ending now)
  m = q.match(new RegExp(`\\b(?:last|past|previous|in the last|in the past)\\s+(\\d{1,3}|${Object.keys(NUMBER_WORDS).join('|')})\\s+${UNIT_WORDS}\\b`));
  if (m) {
    const n = Number.isNaN(Number(m[1])) ? NUMBER_WORDS[m[1]] : Number(m[1]);
    const unit = m[2].replace(/s$/, '');
    if (n > 0) {
      let start;
      if (unit === 'day') start = new Date(local.getTime() - n * DAY_MS);
      else if (unit === 'week') start = new Date(local.getTime() - n * 7 * DAY_MS);
      else if (unit === 'month') start = addLocalMonths(local, -n);
      else start = addLocalMonths(local, -12 * n);
      return range(start, null, `in the last ${n} ${unit}${n === 1 ? '' : 's'}`, m[0].trim());
    }
  }

  if ((m = q.match(/\btoday\b/))) return range(today, null, 'today', m[0]);
  if ((m = q.match(/\byesterday\b/))) return range(new Date(today.getTime() - DAY_MS), today, 'yesterday', m[0]);

  if ((m = q.match(/\b(this week|so far this week|week to date)\b/))) return range(startOfLocalWeek(local), null, 'this week', m[0]);
  if ((m = q.match(/\b(last week|previous week)\b/))) {
    const thisWeek = startOfLocalWeek(local);
    return range(new Date(thisWeek.getTime() - 7 * DAY_MS), thisWeek, 'last week', m[0]);
  }
  if ((m = q.match(/\bpast week\b/))) return range(new Date(local.getTime() - 7 * DAY_MS), null, 'in the past 7 days', m[0]);

  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();

  if ((m = q.match(/\b(this month|so far this month|month to date|current month)\b/))) {
    return range(startOfLocalMonth(year, month), null, 'this month', m[0]);
  }
  if ((m = q.match(/\b(last month|previous month)\b/))) {
    const start = startOfLocalMonth(year, month - 1);
    return range(start, startOfLocalMonth(year, month), `last month (${monthLabel(start.getUTCFullYear(), start.getUTCMonth())})`, m[0]);
  }
  if ((m = q.match(/\bpast month\b/))) return range(addLocalMonths(local, -1), null, 'in the past month', m[0]);

  if ((m = q.match(/\b(this year|so far this year|year to date|ytd)\b/))) {
    return range(new Date(Date.UTC(year, 0, 1)), null, 'this year', m[0]);
  }
  if ((m = q.match(/\b(last year|previous year)\b/))) {
    return range(new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year, 0, 1)), `last year (${year - 1})`, m[0]);
  }
  if ((m = q.match(/\bpast year\b/))) return range(addLocalMonths(local, -12), null, 'in the past year', m[0]);

  // Named month, optionally with a year: "in october", "oct 2026", "for march 2025"
  const monthPattern = [...MONTH_ALIASES.keys()].sort((a, b) => b.length - a.length).join('|');
  m = q.match(new RegExp(`\\b(${monthPattern})\\b(?:\\s+(\\d{4}))?`));
  // "may" is also a verb ("may I ...") - only accept it as a month next to in/for/during/of or a year.
  if (m && (m[1] !== 'may' || m[2] || /\b(in|for|during|of|since)\s+may\b/.test(q))) {
    const monthIndex = MONTH_ALIASES.get(m[1]);
    let targetYear = m[2] ? Number(m[2]) : year;
    if (!m[2] && monthIndex > month) targetYear -= 1; // "in December" asked in March = last December
    const start = startOfLocalMonth(targetYear, monthIndex);
    const end = startOfLocalMonth(targetYear, monthIndex + 1);
    return range(start, end, `in ${monthLabel(targetYear, monthIndex)}`, m[0].trim());
  }

  return null;
}

module.exports = { parseTimeRange, MONTHS };
