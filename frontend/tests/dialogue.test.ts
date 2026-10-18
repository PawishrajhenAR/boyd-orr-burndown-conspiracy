import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import type { Case } from '../src/types/case.ts'
import { buildScripts, fillTemplate, REACTIONS, scriptVars } from '../src/flow/dialogue.ts'

const realCase = JSON.parse(
  readFileSync(new URL('../public/case.json', import.meta.url), 'utf8'),
) as Case

test('every placeholder is filled from the data', () => {
  const s = buildScripts(realCase)
  for (const line of [...s.level1, ...s.level2, ...s.level3, ...s.final]) {
    assert.doesNotMatch(line.text, /\{\w+\}/, line.text)
  }
})

test('every dialogue line has valid Mathew and Morag reaction sprites', () => {
  const scripts = buildScripts(realCase)
  const lines = [...scripts.level1, ...scripts.level2, ...scripts.level3, ...scripts.final, scripts.level3Asides.rewind, scripts.level3Asides.replayed]
  for (const line of lines) {
    const reaction = REACTIONS[line.reaction]
    assert.ok(reaction, `reaction exists for: ${line.text}`)
    assert.ok(existsSync(new URL(`../public/characters/mathew/${reaction.mathew}.webp`, import.meta.url)), reaction.mathew)
    assert.ok(existsSync(new URL(`../public/characters/morag/${reaction.morag}.webp`, import.meta.url)), reaction.morag)
  }
})

test('evidence moments are populated from case flags, suspects, and meetings', () => {
  const scripts = buildScripts(realCase)
  const breakerCue = scripts.level1.find(line => line.stage === 'breakers')?.evidence
  const suspectCue = scripts.level2.find(line => line.stage === 'six')?.evidence
  const meetingCue = scripts.level3.find(line => line.stage === 'reveal')?.evidence
  const expectedSuspects = realCase.suspects.filter(suspect => suspect.verdict === 'conspirator')

  assert.equal(breakerCue?.items.length, Math.min(3, new Set(realCase.flags.filter(flag => flag.severity > 0).map(flag => flag.rule)).size))
  assert.deepEqual(suspectCue?.items.map(item => item.label), expectedSuspects.map(suspect => realCase.students.find(student => student.id === suspect.student_id)?.name))
  assert.ok(meetingCue?.title.includes(`${expectedSuspects.length} of ${expectedSuspects.length}`))
  assert.ok(meetingCue?.items.length)
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

test('the mastermind reveal states the real places and times, never "same place, same time"', () => {
  const s = buildScripts(realCase)
  const reveal = s.level3.find(line => line.stage === 'reveal')!
  const v = scriptVars(realCase)
  assert.doesNotMatch(reveal.text, /same place|same time/i)
  const boss = realCase.suspects.find(x => x.verdict === 'mastermind')!.student_id
  const six = new Set(realCase.suspects.filter(x => x.verdict === 'conspirator').map(x => x.student_id))
  const met = realCase.meetings.filter(m => (m.a === boss && six.has(m.b)) || (m.b === boss && six.has(m.a)))
  assert.equal(v.meet_places, new Set(met.map(m => m.building_id)).size)
  assert.ok(reveal.text.includes(`${v.meet_places} different buildings`), reveal.text)
  assert.ok(reveal.text.includes(v.first_meet) && reveal.text.includes(v.last_meet), reveal.text)
})
