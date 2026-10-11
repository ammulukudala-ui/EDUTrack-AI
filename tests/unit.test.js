// Pure-logic tests: need NO database.  Run: npm run test:unit
const test = require('node:test');
const assert = require('node:assert');
const A = require('../services/analyticsService');
const { assess } = require('../services/riskAnalyzer');
const { buildRecommendations } = require('../services/recommendationService');
const { toCsv } = require('../utils/csv');

const rec = (i, pct, subj = 's1') => ({ date: new Date(2026, 0, i + 1), percentage: pct, subjectId: subj, subjectName: subj.toUpperCase(), name: 'T' + i });

test('percentage handles invalid and zero max marks', () => {
  assert.strictEqual(A.percentage(45, 50), 90);
  assert.strictEqual(A.percentage(5, 0), null);
  assert.strictEqual(A.percentage(-1, 10), null);
});
test('attendance: excused not counted; no sessions -> null', () => {
  assert.deepStrictEqual(A.calcAttendance({ Present: 6, Late: 1, Absent: 3, Excused: 5 }), { attended: 7, total: 10, excused: 5, percentage: 70 });
  assert.strictEqual(A.calcAttendance({}).percentage, null);
});
test('classesNeeded reaches target', () => {
  const n = A.classesNeeded(7, 10, 75);
  assert.ok((7 + n) / (10 + n) >= 0.75 && (7 + n - 1) / (10 + n - 1) < 0.75);
  assert.strictEqual(A.classesNeeded(9, 10, 75), 0);
  assert.strictEqual(A.classesNeeded(9, 10, 100), null);
});
test('formatMinutes', () => { assert.strictEqual(A.formatMinutes(135), '2h 15m'); assert.strictEqual(A.formatMinutes(60), '1h'); });
test('risk: insufficient data gives no score', () => {
  const r = assess({ records: [rec(1, 20), rec(2, 20)], attendanceBySubject: [], tasks: [] });
  assert.strictEqual(r.status, 'insufficient'); assert.strictEqual(r.score, null); assert.ok(r.missing.length);
});
test('risk: low marks + low attendance -> high, bounded 0-100', () => {
  const r = assess({ records: [1, 2, 3, 4, 5, 6].map((i) => rec(i, 30 - i)), attendanceBySubject: [{ attended: 4, total: 10 }], tasks: [] });
  assert.strictEqual(r.status, 'ok'); assert.ok(r.score >= 0 && r.score <= 100); assert.strictEqual(r.category, 'High Risk');
  assert.ok(r.dataCompleteness < 100 && r.explanation.includes('partial data'));
});
test('risk: strong student is low risk', () => {
  const r = assess({ records: [1, 2, 3].map((i) => rec(i, 90)), attendanceBySubject: [{ attended: 19, total: 20 }], tasks: [] });
  assert.strictEqual(r.category, 'Low Risk');
});
test('recommendations are data driven; empty data -> getting started', () => {
  const none = buildRecommendations({ records: [], attendanceBySubject: [], tasks: [], studyLogs: [] });
  assert.strictEqual(none[0].type, 'getting-started');
  const weak = buildRecommendations({ records: [rec(1, 30), rec(2, 35), rec(3, 90, 's2')], attendanceBySubject: [], tasks: [], studyLogs: [] });
  assert.ok(weak.some((x) => x.type === 'weak-subject' && x.explanation.includes('S1')));
});
test('csv escaping and formula-injection guard', () => {
  const out = toCsv(['a', 'b'], [['x,y', 'say "hi"\nnow'], ['=1+1', null]]);
  assert.ok(out.includes('"x,y"')); assert.ok(out.includes('"say ""hi""\nnow"')); assert.ok(out.includes("'=1+1"));
});
