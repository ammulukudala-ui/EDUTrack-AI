const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  key: { type: String, required: true }, // dedupe key e.g. "weak-subject:<id>:2026-W41"
  type: { type: String, required: true, enum: ['weak-subject', 'attendance', 'tasks', 'overdue', 'trend', 'study-habit', 'study-time', 'maintain', 'getting-started'] },
  title: { type: String, required: true },
  explanation: { type: String, required: true }, // WHY it was generated
  action: { type: String, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
  priority: { type: Number, default: 2 }, // 1 high, 2 medium, 3 low
  status: { type: String, enum: ['Active', 'Completed', 'Dismissed'], default: 'Active' },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });
schema.index({ student: 1, key: 1 }, { unique: true });
schema.index({ student: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model('Recommendation', schema);
