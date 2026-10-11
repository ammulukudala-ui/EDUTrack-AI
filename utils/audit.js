const AuditLog = require('../models/AuditLog');

// Records important admin actions. Never throws (auditing must not break the request).
async function audit(req, action, targetType, targetId, details) {
  try {
    await AuditLog.create({ actor: req.user._id, actorName: req.user.name, action, targetType,
      targetId: targetId ? String(targetId) : undefined, details, ip: req.ip });
  } catch (e) { console.error('Audit log failed:', e.message); }
}
module.exports = audit;
