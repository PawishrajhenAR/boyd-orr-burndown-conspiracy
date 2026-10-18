import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getShortlist } from '../src/flow/shortlist.ts'

const bundled = JSON.parse(readFileSync(new URL('../public/case.json', import.meta.url), 'utf8'))

test('bundled case retains scored students and handles missing meetings', () => {
  const result = getShortlist(bundled)
  const ids = bundled.suspects.filter(s => s.score > 0).map(s => s.student_id)
  assert.deepEqual(new Set(result.ruleBreakers.map(s => s.id)), new Set(ids))
  assert.equal(new Set(result.all.map(s => s.id)).size, result.all.length)
  assert.equal(getShortlist({ ...bundled, meetings: [] }).contacts.length, 0)
})

test('contacts rank by distinct partners, minutes, then name without duplicate partners', () => {
  const students = ['r1', 'r2', 'a', 'b', 'c', 'd', 'isolated'].map(id => ({ id, name: id }))
  const suspects = ['r1', 'r2'].map((student_id, rank) => ({ student_id, score: 1, rank }))
  const meetings = [['a','r1',10], ['a','r1',10], ['a','r2',10], ['b','r1',100], ['c','r1',100], ['d','r1',5]].map(([a,b,minutes]) => ({a,b,minutes}))
  const c = { students, suspects, meetings }
  const result = getShortlist(c, 5)
  assert.deepEqual(result.contacts.map(s => s.id), ['a', 'b', 'c'])
  assert.equal(result.stats.get('a').met.length, 2)
  assert.equal(result.stats.get('a').minutes, 30)
  assert.equal(getShortlist(c, 1).ruleBreakers.length, 2)
  assert.equal(getShortlist(c, 1).contacts.length, 0)
  assert.equal(getShortlist({ ...c, suspects: [] }).all.length, 0)
})
