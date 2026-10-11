// Safe CSV builder: escapes commas, quotes, new lines and blocks spreadsheet formula injection.
function cell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) v = v.toISOString().slice(0, 10);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV/Excel formula injection protection
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(',')];
  rows.forEach((r) => lines.push(r.map(cell).join(',')));
  return lines.join('\r\n') + '\r\n';
}
module.exports = { toCsv, cell };
