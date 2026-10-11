const mongoose = require('mongoose');
const ApiError = require('./ApiError');
const AuditLog = require('../models/AuditLog');

const isId = (v) => mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === String(v);
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function paginate(query, maxLimit = 100) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}
const pageMeta = (page, limit, total) => ({ page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) });

// Parses 'YYYY-MM-DD' into a UTC-midnight Date. Returns null if invalid/empty.
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d;
}
function dayStart(v) { const d = parseDate(v); if (d) d.setUTCHours(0, 0, 0, 0); return d; }

// Builds {field: {$gte, $lte}} from ?from=&to= query values.
function dateRange(field, from, to) {
  const f = dayStart(from), t = parseDate(to);
  if (!f && !t) return {};
  const q = {};
  if (f) q.$gte = f;
  if (t) { t.setUTCHours(23, 59, 59, 999); q.$lte = t; }
  return { [field]: q };
}

async function audit(req, action, entity, entityId, details) {
  try {
    await AuditLog.create({ actor: req.user._id, actorName: req.user.name, action, entity, entityId, details, ip: req.ip });
  } catch (e) { console.error('Audit log failed:', e.message); }
}

function mustFind(doc, label = 'Record') {
  if (!doc) throw new ApiError(404, `${label} not found.`);
  return doc;
}
module.exports = { isId, oid, escapeRegex, paginate, pageMeta, parseDate, dayStart, dateRange, audit, mustFind };
