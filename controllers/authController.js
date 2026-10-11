const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
const hash = (pw) => bcrypt.hash(pw, ROUNDS);

const startSession = (req, user) => new Promise((resolve, reject) => {
  req.session.regenerate((err) => { // new session id on login prevents session fixation
    if (err) return reject(err);
    req.session.userId = String(user._id);
    req.session.role = user.role;
    req.session.csrf = crypto.randomBytes(24).toString('hex');
    resolve();
  });
});

async function profileOf(user) {
  const student = user.role === 'student' ? await Student.findOne({ user: user._id }).populate('subjects', 'code name') : null;
  return { user, student };
}

exports.csrf = (req, res) => res.json({ success: true, token: req.session.csrf });

exports.register = asyncHandler(async (req, res) => {
  const { name, email, studentId, department, semester, year, password } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'This email is already registered.');
  if (await Student.exists({ studentId: String(studentId).toUpperCase() })) throw new ApiError(409, 'This Student ID already exists.');
  const user = await User.create({ name, email, passwordHash: await hash(password), role: 'student' }); // role is ALWAYS student here
  try {
    const subjects = await Subject.find({ department, semester, active: true }).distinct('_id'); // auto-enrol matching subjects
    await Student.create({ studentId, user: user._id, department, semester, year, subjects });
  } catch (e) { await User.deleteOne({ _id: user._id }); throw e; }
  await startSession(req, user);
  res.status(201).json({ success: true, message: 'Account created.', token: req.session.csrf, ...(await profileOf(user)) });
});

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) throw new ApiError(401, 'Invalid email or password.');
  if (!user.active) throw new ApiError(403, 'This account has been deactivated. Contact the administrator.');
  await startSession(req, user);
  res.json({ success: true, message: 'Logged in.', token: req.session.csrf, ...(await profileOf(user)) });
});

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('edutrack.sid');
    res.json({ success: true, message: 'Logged out.' });
  });
};

exports.me = asyncHandler(async (req, res) => res.json({ success: true, token: req.session.csrf, ...(await profileOf(req.user)) }));

exports.updateProfile = asyncHandler(async (req, res) => {
  if (req.body.name) req.user.name = req.body.name;
  await req.user.save();
  if (req.user.role === 'student' && req.body.phone !== undefined) await Student.updateOne({ user: req.user._id }, { phone: req.body.phone });
  res.json({ success: true, message: 'Profile updated.', ...(await profileOf(req.user)) });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw new ApiError(400, 'Current password is incorrect.');
  user.passwordHash = await hash(req.body.newPassword);
  await user.save();
  res.json({ success: true, message: 'Password changed.' });
});
exports.hash = hash;
