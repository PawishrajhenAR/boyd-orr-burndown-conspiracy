import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
// Defaults to Microsoft Edge; set BROWSER_PATH to any Chromium binary (e.g. on Linux CI) and FLOW_URL for another server.
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH, headless: true } : { channel: 'msedge', headless: true })
const FLOW_URL = process.env.FLOW_URL ?? 'http://127.0.0.1:5173/'
const out = new URL('../artifacts/flow/', import.meta.url).pathname.replace(/^\/(.:)/, '$1')
await mkdir(out, { recursive: true })
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/case', route => route.fulfill({ status: 503, body: 'offline' }))
    await page.goto(FLOW_URL)
    await page.getByRole('button', { name: 'Open the file' }).waitFor()
    await page.getByRole('button', { name: 'Open the file' }).click()
    await page.getByRole('alert').filter({ hasText: 'Access denied' }).waitFor()
    await page.getByRole('textbox', { name: 'Investigator ID' }).fill('investigator')
    await page.getByLabel('Passcode', { exact: true }).fill('bonfire1105')
    await page.getByRole('button', { name: 'Open the file' }).click()
    // the opening briefing scene plays first; skip it here (it has its own coverage in e2e/smoke.py)
    await page.getByRole('dialog', { name: 'Case briefing' }).waitFor()
    await page.getByRole('button', { name: 'Skip scene ⏭' }).click()
    await page.getByRole('dialog', { name: 'Case briefing' }).waitFor({ state: 'detached' })
    const nav = page.getByRole('navigation', { name: 'Investigation progress' })
    await nav.waitFor()
    for (const stage of ['Register', 'Level 1', 'Level 2', 'Movement', 'Closed']) {
      await nav.getByRole('button', { name: stage, exact: true }).click()
      await page.waitForTimeout(1800)
      if (stage === 'Register') {
        await page.getByRole('textbox', { name: 'Search students by ID or name' }).fill('no-such-student-xyz')
        await page.getByText(/No student matches/).waitFor()
        await page.getByRole('textbox', { name: 'Search students by ID or name' }).fill('')
      }
      if (stage === 'Movement') {
        await page.getByRole('slider', { name: 'Scrub time' }).fill('1450')
        await page.getByRole('button', { name: /Replay analysis/ }).click()
        await page.getByTestId('analysis-progress').filter({ hasText: 'Pattern found' }).waitFor()
        assert.ok(await page.locator('[data-step="4"] svg path').count() > 0, 'movement paths drawn')
      }
      await page.screenshot({ path: `${out}/${viewport.width}-${stage.replaceAll(' ', '-')}.png` })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${stage}: horizontal overflow`)
    }
    await page.getByRole('button', { name: /Replay investigation/ }).click()
    await page.waitForTimeout(1800)
    await page.getByRole('button', { name: 'Mute sound', exact: true }).click()
    assert.equal(await page.evaluate(() => localStorage.getItem('investigation-flow-muted')), '1')
    assert.deepEqual(errors, [], 'browser runtime errors')
    await page.goto(new URL('?judge=1', FLOW_URL).href)
    await nav.waitFor()
    assert.equal(await page.getByRole('button', { name: 'Open the file' }).count(), 0)
    await page.close()
    console.log(`PASS ${viewport.width}px: envelope validation, five stages, replay, mute, judge mode, no runtime errors`)
  }
} finally { await browser.close() }
