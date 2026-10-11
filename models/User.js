const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true, default: 'student' },
  active: { type: Boolean, default: true },
  department: { type: String, trim: true, maxlength: 80 } // used for faculty/admin
}, { timestamps: true });

userSchema.set('toJSON', { transform: (doc, ret) => { delete ret.passwordHash; delete ret.__v; return ret; } });
module.exports = mongoose.model('User', userSchema);
