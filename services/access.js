/**
 * Central authorization helper ("who may see which students / subjects").
 *  - student : only their own Student profile
 *  - faculty : subjects assigned to them + students enrolled in those subjects
 *  - admin   : everything
 * Backend routes ALWAYS use this; never trust an ID sent by the browser.
 */
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const ApiError = require('../utils/ApiError');

async function getOwnStudent(user) {
  const s = await Student.findOne({ user: user._id });
  if (!s) throw new ApiError(404, 'No student profile is linked to this account.');
  return s;
}

/** Returns { studentIds: null|[ObjectId], subjectIds: null|[ObjectId], ownStudent?: doc } (null = unrestricted). */
async function getScope(user, requestedStudentId) {
  if (user.role === 'admin') {
    if (requestedStudentId) {
      if (!(await Student.exists({ _id: requestedStudentId }))) throw new ApiError(404, 'Student not found.');
      return { studentIds: [requestedStudentId], subjectIds: null, single: true };
    }
    return { studentIds: null, subjectIds: null };
  }
  if (user.role === 'faculty') {
    const subjectIds = await Subject.find({ faculty: user._id, active: true }).distinct('_id');
    const studentIds = await Student.find({ subjects: { $in: subjectIds }, active: true }).distinct('_id');
    if (requestedStudentId) {
      if (!studentIds.some((id) => String(id) === String(requestedStudentId))) throw new ApiError(403, 'This student is not assigned to you.');
      return { studentIds: [requestedStudentId], subjectIds, single: true };
    }
    return { studentIds, subjectIds };
  }
  const own = await getOwnStudent(user);
  if (requestedStudentId && String(requestedStudentId) !== String(own._id)) throw new ApiError(403, 'You can only view your own records.');
  return { studentIds: [own._id], subjectIds: null, ownStudent: own, single: true };
}

/** Mongo filter for collections having `student` and `subject` fields (records, attendance, study logs). */
function recordFilter(scope) {
  const f = {};
  if (scope.studentIds) f.student = { $in: scope.studentIds };
  if (scope.subjectIds) f.subject = { $in: scope.subjectIds };
  return f;
}
module.exports = { getScope, getOwnStudent, recordFilter };

const { oid, dateRange } = require('../utils/helpers');
const mongoose = require('mongoose');

/** Builds a safe Mongo filter from the query string + the user's scope (used by list endpoints). */
async function buildFilter(req, dateField = 'date') {
  const scope = await getScope(req.user, req.query.student || req.query.studentId || undefined);
  const f = recordFilter(scope);
  if (req.query.subject) {
    if (scope.subjectIds && !scope.subjectIds.some((id) => String(id) === String(req.query.subject))) throw new ApiError(403, 'This subject is not assigned to you.');
    f.subject = oid(req.query.subject);
  }
  if (req.query.semester) {
    const ids = await Subject.find({ semester: Number(req.query.semester) }).distinct('_id');
    const allowed = f.subject && f.subject.$in ? f.subject.$in.filter((i) => ids.some((x) => String(x) === String(i))) : f.subject ? [f.subject].filter((i) => ids.some((x) => String(x) === String(i))) : ids;
    f.subject = { $in: allowed };
  }
  if (req.query.assessmentType) f.assessmentType = String(req.query.assessmentType);
  if (req.query.status) f.status = String(req.query.status);
  Object.assign(f, dateRange(dateField, req.query.from, req.query.to));
  return { f, scope };
}

/** Admin: any student+subject. Faculty: only their subjects AND students enrolled in them. */
async function assertCanWrite(user, studentId, subjectId) {
  const [student, subject] = await Promise.all([Student.findById(studentId), Subject.findById(subjectId)]);
  if (!student) throw new ApiError(404, 'Student not found.');
  if (!subject) throw new ApiError(404, 'Subject not found.');
  if (!student.active) throw new ApiError(422, 'This student account is inactive.');
  if (!student.subjects.some((s) => String(s) === String(subjectId))) throw new ApiError(422, 'The student is not enrolled in this subject.');
  if (user.role === 'faculty' && String(subject.faculty) !== String(user._id)) throw new ApiError(403, 'You can only record data for your own subjects.');
  return { student, subject };
}
module.exports.buildFilter = buildFilter;
module.exports.assertCanWrite = assertCanWrite;
