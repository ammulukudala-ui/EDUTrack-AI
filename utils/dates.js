// Dates in this project are "calendar days" stored as UTC midnight so they never shift by timezone.
function dayStr(d) { return new Date(d).toISOString().slice(0, 10); }

function parseDay(value) {
  if (value instanceof Date) return isNaN(value) ? null : new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return isNaN(d) || dayStr(d) !== `${m[1]}-${m[2]}-${m[3]}` ? null : d; // rejects 2024-02-31
}
// "Today" according to the server's local calendar
function today() { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);
function weekStart(d) { const x = parseDay(d); return addDays(x, -((x.getUTCDay() + 6) % 7)); } // Monday

module.exports = { dayStr, parseDay, today, addDays, weekStart };
