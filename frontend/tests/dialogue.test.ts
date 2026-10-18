import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Case } from '../src/types/case.ts'
import { buildScripts, fillTemplate, scriptVars } from '../src/flow/dialogue.ts'

const realCase = JSON.parse(
  readFileSync(new URL('../public/case.json', import.meta.url), 'utf8'),
) as Case

test('every placeholder is filled from the data', () => {
  const s = buildScripts(realCase)
  for (const line of [...s.level1, ...s.level2, ...s.level3, ...s.final]) {
    assert.doesNotMatch(line.text, /\{\w+\}/, line.text)
  }
})

test('lines stay short (≈20 words, readable in 2 s)', () => {
  const s = buildScripts(realCase)
  for (const line of [...s.level1, ...s.level2, ...s.level3, ...s.final]) {
    assert.ok(line.text.split(/\s+/).length <= 22, line.text)
  }
})

test('numbers and names come from the available case', () => {
  const v = scriptVars(realCase)
  assert.equal(v.total, realCase.students.length)
  assert.equal(v.n_breakers, realCase.suspects.filter(s => s.score > 0).length)
  assert.equal(v.shortlist, v.n_breakers + v.n_contacts)
  assert.equal(v.conspirator_count, realCase.suspects.filter(s => s.verdict === 'conspirator').length)
  const boss = realCase.suspects.find(s => s.verdict === 'mastermind')
  assert.equal(v.mastermind, realCase.students.find(s => s.id === boss?.student_id)?.name ?? 'Nobody')
})
test('watch-list dialogue appears only when a suspicious verdict exists', () => {
  const noWatch = { ...realCase, suspects: realCase.suspects.filter(s => s.verdict !== 'suspicious') }
  const watch = { ...noWatch, suspects: [...noWatch.suspects, { ...realCase.suspects[0], student_id: realCase.students[0].id, verdict: 'suspicious' as const }] }
  assert.equal(buildScripts(noWatch).level2.length, 3)
  assert.equal(buildScripts(watch).level2.length, 5)
})
test('unknown placeholders remain visible', () => {
  assert.equal(fillTemplate('{total} and {nope}', scriptVars(realCase)), `${realCase.students.length} and {nope}`)
})