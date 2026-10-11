const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  date: { type: Date, required: true },
  durationMinutes: { type: Number, required: true, min: [1, 'Duration must be at least 1 minute'], max: [1440, 'Duration cannot exceed 24 hours'] },
  topic: { type: String, required: true, trim: true, maxlength: 150 },
  notes: { type: String, trim: true, maxlength: 500 },
  completed: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ student: 1, date: -1 });
schema.index({ student: 1, subject: 1 });
module.exports = mongoose.model('StudyLog', schema);
