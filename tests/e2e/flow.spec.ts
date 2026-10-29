/*
  The whole pipeline with TALLY_FAKE_AGENTS=1: agents call their real save
  tools with fixture data, so validation, compliance, saving, the PDF and
  every screen are exercised without a model or network.
*/
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: ElectronApplication
let win: Page

test.beforeAll(async () => {
  const userData = mkdtempSync(join(tmpdir(), 'tally-flow-'))
  app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], env: { ...process.env, TALLY_E2E: '1', TALLY_FAKE_AGENTS: '1' } })
  win = await app.firstWindow()
  await win.waitForSelector('aside')
})
test.afterAll(async () => app?.close())

test('find leads, then research and score from the Find screen', async () => {
  await win.getByRole('link', { name: /Find/ }).click()
  await win.getByRole('combobox', { name: 'Category' }).fill('Boat builders')
  await win.keyboard.press('Escape')
  await win.getByRole('combobox', { name: 'Area' }).fill('Hibiscus Coast')
  await win.keyboard.press('Escape')
  await win.getByRole('button', { name: 'Find leads' }).click()
  await expect(win.getByRole('cell', { name: 'Harbour Hulls Ltd', exact: true })).toBeVisible()
  await win.getByLabel('Select Harbour Hulls Ltd').check()
  await win.getByRole('button', { name: /Research selected/ }).click()
  await expect(win.getByText(/Research: Harbour Hulls Ltd/).first()).toBeVisible()
  await win.getByRole('link', { name: /Pipeline/ }).click()
  await expect(win.locator('article', { hasText: 'Harbour Hulls Ltd' })).toBeVisible()
})

test('research, score, prepare, call, debrief', async () => {
  await win.getByRole('link', { name: /Pipeline/ }).click()
  await win.getByRole('button', { name: 'Add prospect' }).click()
  await win.getByPlaceholder('White Pointer Boats').fill('E2E Marine')
  await win.getByPlaceholder('whitepointerboats.co.nz').fill('e2emarine.example.co.nz')
  await win.getByRole('button', { name: 'Add prospect' }).last().click()
  await expect(win.getByRole('heading', { name: 'E2E Marine' })).toBeVisible()

  // Research → Score (fake). The evidence rule downgrades the booking claim checked on the homepage only.
  await win.locator('#prospect-actions').getByRole('button', { name: 'Research' }).click()
  await expect(win.getByText('Established builder with 62 strong reviews and nothing measured on the site.').first()).toBeVisible()
  await expect(win.getByText(/No booking form found\. \(not verified/)).toBeVisible()
  await expect(win.getByText('Well below the peer median', { exact: false })).toBeVisible()
  await expect(win.getByLabel('Stage')).toHaveValue('go')

  // Prepare: opener, script, emails, audit PDF.
  await win.getByRole('button', { name: 'Prepare opener, script, emails and audit' }).click()
  await expect(win.getByLabel('Opener text')).toHaveValue(/62 five-star reviews/)
  await expect(win.getByLabel('Call script text')).toHaveValue(/6\. Qualifying question/)
  await expect(win.getByLabel('First email subject')).toHaveValue('Your contact page')
  await expect(win.getByLabel('First email body')).toHaveValue(/reply "no thanks"/)
  await expect(win.getByLabel('Email to')).toHaveValue(/\d+/)
  await expect(win.getByText(/e2e-marine-\d+-audit-\d{4}-\d{2}-\d{2}\.pdf/)).toBeVisible()

  const info = await win.evaluate(() => (window as unknown as { tally: { appInfo(): Promise<{ userDataPath: string }> } }).tally.appInfo())
  const auditDir = join(info.userDataPath, 'audits')
  const pdfName = (await win.getByText(/e2e-marine-\d+-audit-.*\.pdf/).textContent())!.trim()
  const pdf = join(auditDir, pdfName)
  expect(existsSync(pdf)).toBe(true)
  expect(statSync(pdf).size).toBeGreaterThan(10_000)

  // Editing a draft persists; lint warnings show live.
  const subject = win.getByLabel('First email subject')
  await subject.fill('A subject line that is far too long')
  await subject.blur()
  await expect(win.getByText(/Subject is 8 words/)).toBeVisible()
  await subject.fill('Your contact page')
  await subject.blur()

  // Logging a send is Zak's action, never automatic.
  await win.getByRole('button', { name: 'I sent this' }).first().click()
  await expect(win.getByText(/Sent by you/).first()).toBeVisible()

  // Call mode → meeting booked → Debrief Agent.
  await win.getByRole('button', { name: 'Call mode' }).click()
  await expect(win.getByRole('button', { name: 'Meeting booked' })).toBeVisible()
  await expect(win.getByText('Ask before you hang up')).toBeVisible()
  await win.getByLabel(/Notes · go to the Debrief Agent/).fill('Spoke to Sam, keen, Zoom booked.')
  await win.getByRole('button', { name: 'Meeting booked' }).click()
  await expect(win.getByRole('heading', { name: 'E2E Marine' })).toBeVisible()
  await expect(win.getByLabel('Stage')).toHaveValue('meeting')
  await expect(win.getByText('Spoke to Sam. Interested, booked a Zoom.').first()).toBeVisible()
  await expect(win.getByLabel('Debrief follow-up subject')).toHaveValue('Zoom confirmed')
})

test('a guessed address needs confirmation before emails are drafted', async () => {
  const basis = win.locator('select:has(option[value="guessed"])').first()
  await basis.selectOption('guessed')
  await expect(win.getByText('Not confirmed as conspicuously published.')).toBeVisible()
  const emails = win.locator('section', { has: win.getByRole('heading', { name: 'Emails' }) })
  const asked = new Promise<string>((resolve) => win.once('dialog', (d) => { resolve(d.message()); void d.dismiss() }))
  await emails.getByRole('button', { name: 'Redo' }).click()
  expect(await asked).toMatch(/guessed, not published/)
  await basis.selectOption('conspicuously_published')
})

test('an opt-out blocks all email to that company', async () => {
  await win.getByLabel('Debrief notes').fill("Sam said don't contact us again")
  await win.getByRole('button', { name: /Debrief/ }).last().click()
  await expect(win.getByText('This company opted out. Tally will not draft email to them again.')).toBeVisible()
  await expect(win.getByLabel('Stage')).toHaveValue('lost')
  await win.getByRole('link', { name: /Settings/ }).click()
  await expect(win.getByText('sam@e2emarine.example.co.nz')).toBeVisible()
})

test('Today and the command palette', async () => {
  await win.getByRole('link', { name: /Home/ }).click()
  await expect(win.getByRole('heading', { name: 'Calls to make' })).toBeVisible()
  await expect(win.getByText('Live proposals')).toBeVisible()
  await win.keyboard.press('Meta+k')
  await win.getByLabel('Search commands').fill('e2e mar')
  await win.keyboard.press('Enter')
  await expect(win.getByRole('heading', { name: 'E2E Marine' })).toBeVisible()
})
