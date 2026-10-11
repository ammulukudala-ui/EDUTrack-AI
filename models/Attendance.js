const mongoose = require('mongoose');
const STATUSES = ['Present', 'Absent', 'Late', 'Excused'];
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: STATUSES, required: true },
  remarks: { type: String, trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
schema.pre('validate', function (next) { if (this.date) this.date.setUTCHours(0, 0, 0, 0); next(); });
// One attendance entry per student + subject + day (prevents double counting)
schema.index({ student: 1, subject: 1, date: 1 }, { unique: true });
schema.index({ subject: 1, date: 1 });
schema.statics.STATUSES = STATUSES;
module.exports = mongoose.model('Attendance', schema);
