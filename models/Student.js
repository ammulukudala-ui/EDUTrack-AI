const mongoose = require('mongoose');
const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 30 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  department: { type: String, required: true, trim: true, maxlength: 80 },
  semester: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true, min: 1, max: 6 },
  phone: { type: String, trim: true, maxlength: 20 },
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }], // enrolled subjects
  active: { type: Boolean, default: true }
}, { timestamps: true });
studentSchema.index({ department: 1, semester: 1, year: 1 });
studentSchema.index({ subjects: 1 });
module.exports = mongoose.model('Student', studentSchema);
