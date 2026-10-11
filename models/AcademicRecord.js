const mongoose = require('mongoose');
const TYPES = ['Internal Examination', 'Assignment', 'Quiz', 'Practical', 'Semester Examination'];
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  assessmentName: { type: String, required: true, trim: true, maxlength: 100 },
  assessmentType: { type: String, enum: TYPES, required: true },
  marksObtained: { type: Number, required: true, min: 0 },
  maxMarks: { type: Number, required: true, min: [1, 'Maximum marks must be greater than 0'] },
  date: { type: Date, required: true },
  remarks: { type: String, trim: true, maxlength: 300 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, toJSON: { virtuals: true } });

schema.virtual('percentage').get(function () {
  return this.maxMarks > 0 ? Math.round((this.marksObtained / this.maxMarks) * 10000) / 100 : null;
});
schema.pre('validate', function (next) {
  if (this.marksObtained > this.maxMarks) this.invalidate('marksObtained', 'Marks obtained cannot exceed maximum marks');
  next();
});
schema.index({ student: 1, subject: 1, date: 1 });
schema.index({ subject: 1, date: 1 });
schema.statics.TYPES = TYPES;
module.exports = mongoose.model('AcademicRecord', schema);
