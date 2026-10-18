import { test } from 'node:test'
import assert from 'node:assert/strict'
import { movementAt, resultEvidence } from '../src/flow/movement.ts'
import { clock } from '../src/flow/shortlist.ts'
const students = ['boss', 'a', 'b'].map(id => ({ id, name: id }))
const suspects = [{ student_id: 'boss', verdict: 'mastermind', rank: 3 }, { student_id: 'a', verdict: 'conspirator', rank: 1 }, { student_id: 'b', verdict: 'conspirator', rank: 2 }]
const meetings = [{ id: '1', a: 'boss', b: 'a', start: 1430, end: 1460, minutes: 30 }, { id: '2', a: 'b', b: 'boss', start: 1440, end: 1450, minutes: 10 }]
const c = { students, suspects, meetings, visits: [{ student_id: 'boss', start: 1430, end: 1460 }] }
test('movement uses half-open intervals across midnight', () => {
  assert.equal(movementAt(c, 'boss', 1445).visits.length, 1)
  assert.equal(movementAt(c, 'boss', 1445).meetings.length, 2)
  assert.equal(movementAt(c, 'boss', 1450).meetings.length, 1)
  assert.equal(movementAt(c, 'boss', 1460).visits.length, 0)
  assert.equal(clock(1450), '00:10 (+1)')
})
test('results require a meeting with every conspirator and handle missing verdicts', () => {
  assert.equal(resultEvidence(c).metAll, true)
  assert.equal(resultEvidence({ ...c, meetings: meetings.slice(0, 1) }).metAll, false)
  assert.equal(resultEvidence({ ...c, suspects: [] }).metAll, false)
  assert.equal(resultEvidence({ ...c, suspects: suspects.slice(1) }).boss, undefined)
  const longer = { ...meetings[0], id: '3', minutes: 60 }
  assert.equal(resultEvidence({ ...c, meetings: [...meetings, longer] }).links[0].meetings[0].id, '3')
})
