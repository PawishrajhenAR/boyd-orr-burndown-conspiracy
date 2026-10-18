import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import type { Case } from '../src/types/case.ts'
import { EXPRESSIONS, REACTIONS, type Character } from '../src/flow/dialogue.ts'
import { buildBriefing } from '../src/flow/scenes.ts'

const realCase = JSON.parse(readFileSync(new URL('../public/case.json', import.meta.url), 'utf8')) as Case
const sprite = (character: Character, expression: string) =>
  new URL(`../public/characters/${character}/${expression}.webp`, import.meta.url)

test('every expression in the cast has a sprite file', () => {
  for (const character of Object.keys(EXPRESSIONS) as Character[]) {
    assert.equal(EXPRESSIONS[character].length, 8, character)
    for (const expression of EXPRESSIONS[character]) assert.ok(existsSync(sprite(character, expression)), `${character}/${expression}`)
  }
})

test('every reaction pair points at real sprites', () => {
  for (const [id, r] of Object.entries(REACTIONS)) {
    assert.ok(existsSync(sprite('mathew', r.mathew)), `${id}: mathew/${r.mathew}`)
    assert.ok(existsSync(sprite('morag', r.morag)), `${id}: morag/${r.morag}`)
  }
})

test('the briefing is one linear conversation between both characters', () => {
  const scene = buildBriefing(realCase)
  assert.ok(scene.lines.length >= 6)
  assert.deepEqual(new Set(scene.lines.map((l) => l.speaker)), new Set(['mathew', 'morag']))
  assert.ok(scene.lines.some((l) => l.impact), 'has at least one reveal beat')
})

test('briefing lines are filled from the data, use real sprites, and stay short', () => {
  const scene = buildBriefing(realCase)
  const text = JSON.stringify(scene)
  assert.doesNotMatch(text, /\{\w+\}/)
  assert.ok(text.includes(String(realCase.visits.length)), 'swipe count comes from the case')
  for (const line of scene.lines) {
    assert.ok(existsSync(sprite('mathew', line.mathew)), line.mathew)
    assert.ok(existsSync(sprite('morag', line.morag)), line.morag)
    assert.ok(line.text.split(/\s+/).length <= 22, line.text)
  }
})

test('every one of the 16 reactions is used somewhere in the story', () => {
  const scene = buildBriefing(realCase)
  const used = { mathew: new Set<string>(), morag: new Set<string>() }
  for (const l of scene.lines) { used.mathew.add(l.mathew); used.morag.add(l.morag) }
  for (const r of Object.values(REACTIONS)) { used.mathew.add(r.mathew); used.morag.add(r.morag) }
  for (const character of Object.keys(EXPRESSIONS) as Character[]) {
    for (const expression of EXPRESSIONS[character]) assert.ok(used[character].has(expression), `${character}/${expression} is never shown`)
  }
})
