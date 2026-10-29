import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: ElectronApplication
let win: Page

test.beforeAll(async () => {
  const userData = mkdtempSync(join(tmpdir(), 'tally-rel-e2e-'))
  app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], env: { ...process.env, TALLY_E2E: '1', TALLY_FAKE_AGENTS: '1' } })
  win = await app.firstWindow()
  await win.waitForSelector('aside')
})
test.afterAll(async () => app?.close())

test('add a director, log the meeting, draft the thank-you, send it, see the next touch', async () => {
  await win.getByRole('link', { name: /Relationships/ }).click()
  await win.getByRole('button', { name: 'Add person' }).first().click()
  await win.getByPlaceholder('Sam Fictional').fill('Sam Fictional')
  await win.getByPlaceholder('Director').fill('Director')
  await win.getByPlaceholder('Harbour Hulls Ltd').fill('Fictional Hulls Ltd')
  await win.getByRole('dialog').getByRole('button', { name: 'Add person' }).click()
  await expect(win.getByRole('heading', { name: 'Sam Fictional' })).toBeVisible()
  await expect(win.locator('header').getByText('First contact: ask for advice or a visit')).toBeVisible()

  await win.getByRole('button', { name: 'Log interaction' }).click()
  await win.getByLabel('How').selectOption('met')
  await win.getByLabel('Which touch').selectOption('')
  await win.getByRole('dialog').getByRole('textbox').nth(1).fill('Hulls sell before launch or not at all')
  await win.getByRole('dialog').getByRole('textbox').nth(2).fill('Talk to the dealers, not the buyers')
  await win.getByRole('dialog').getByRole('textbox').nth(3).fill('Send the dealer list\nRead his book')
  await win.getByRole('button', { name: 'Log it' }).click()
  await expect(win.locator('header').getByText('Thank-you, naming one thing they said')).toBeVisible()
  await expect(win.getByText('Send the dealer list', { exact: true })).toBeVisible()
  await expect(win.getByText('“Hulls sell before launch or not at all”')).toBeVisible()

  await win.getByRole('button', { name: 'Draft next touch' }).click()
  await win.getByRole('button', { name: 'Draft it' }).click()
  await expect(win.getByLabel('Subject')).toHaveValue('Thanks for Tuesday', { timeout: 15_000 })
  await expect(win.getByText('Passes the writing rules.')).toBeVisible()

  await win.getByLabel('Message').fill('Hi Sam!\n\nThanks!')
  await expect(win.getByText(/exclamation mark/)).toBeVisible()
  await win.getByLabel('Message').fill('Hi Sam,\n\nThanks for the tour.\n\nYour point about hulls selling before launch stuck with me.\n\nZak\nTally\ntallynz.co')
  await win.getByRole('button', { name: 'I sent this' }).click()
  await expect(win.locator('header').getByText('Tell them what you did with their advice')).toBeVisible()

  await win.getByLabel('Done: Send the dealer list').check()
  await expect(win.getByText('1 open · 1 kept')).toBeVisible()
})

test('the pitch gate warns before "Invited to share"', async () => {
  await win.getByRole('button', { name: 'Draft next touch' }).click()
  await win.getByLabel('Touch', { exact: true }).selectOption('pitch')
  let message = ''
  win.once('dialog', (d) => { message = d.message(); void d.dismiss() })
  await win.getByRole('button', { name: 'Draft it' }).click()
  await expect.poll(() => message).toMatch(/No pitching before/)
})

test('board and due list show the person', async () => {
  await win.keyboard.press('Escape')
  await win.getByRole('link', { name: /Relationships/ }).click()
  await win.getByRole('link', { name: 'Board', exact: true }).click()
  await expect(win.locator('article', { hasText: 'Sam Fictional' })).toContainText('Touched today')
  await win.getByRole('link', { name: 'People' }).click()
  await expect(win.getByRole('cell', { name: /Fictional Hulls Ltd/ })).toBeVisible()
})
