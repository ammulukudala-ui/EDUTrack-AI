const mongoose = require('mongoose');
const subjectSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 20 },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  department: { type: String, required: true, trim: true, maxlength: 80 },
  semester: { type: Number, required: true, min: 1, max: 12 },
  credits: { type: Number, min: 0, max: 20, default: 3 },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });
subjectSchema.index({ department: 1, semester: 1 });
subjectSchema.index({ faculty: 1 });
module.exports = mongoose.model('Subject', subjectSchema);
