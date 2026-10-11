const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  scopeKey: { type: String, default: 'full' }, // 'full' = all data, 'faculty:<id>' = only that faculty's subjects
  status: { type: String, enum: ['ok', 'insufficient'], required: true },
  score: { type: Number, min: 0, max: 100, default: null },
  category: { type: String, default: null },
  factors: { type: Array, default: [] },
  missing: [String],
  dataCompleteness: { type: Number, min: 0, max: 100, default: 0 },
  explanation: String,
  algorithmVersion: { type: String, required: true },
  assessedAt: { type: Date, default: Date.now }
}, { timestamps: true });
schema.index({ student: 1, scopeKey: 1, assessedAt: -1 });
module.exports = mongoose.model('RiskAssessment', schema);
