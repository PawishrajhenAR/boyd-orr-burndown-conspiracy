import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSuspectReview } from '../src/flow/suspectReview.ts'

test('review preserves verdicts rather than selecting six by score', () => {
  const students = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id }))
  const suspects = [
    { student_id: 'a', rank: 2, score: 4, verdict: 'conspirator' },
    { student_id: 'b', rank: 1, score: 10, verdict: 'suspicious' },
    { student_id: 'c', rank: 3, score: 0, verdict: 'mastermind' },
  ]
  const meetings = [{ a: 'c', b: 'a', minutes: 12 }, { a: 'd', b: 'b', minutes: 5 }]
  const review = buildSuspectReview({ students, suspects, meetings })
  assert.deepEqual(review.ranked.map(row => row.student.id), ['b', 'a', 'c', 'd'])
  assert.deepEqual(review.conspirators.map(row => row.student.id), ['a'])
  assert.deepEqual(review.watchList.map(row => row.student.id), ['b'])
  assert.equal(review.maxScore, 10)
  assert.equal(suspects[0].student_id, 'a')
})

test('empty analysis produces safe score scale and empty groups', () => {
  const review = buildSuspectReview({ students: [], suspects: [], meetings: [] })
  assert.deepEqual(review.ranked, [])
  assert.deepEqual(review.conspirators, [])
  assert.deepEqual(review.watchList, [])
  assert.equal(review.maxScore, 1)
})
