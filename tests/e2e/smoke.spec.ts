import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: ElectronApplication
let win: Page

test.beforeAll(async () => {
  const userData = mkdtempSync(join(tmpdir(), 'tally-e2e-'))
  app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], env: { ...process.env, TALLY_E2E: '1' } })
  win = await app.firstWindow()
  await win.waitForSelector('aside')
})
test.afterAll(async () => app?.close())

test('add a prospect, see it on the board, move it, delete a person', async () => {
  await win.getByRole('link', { name: /Pipeline/ }).click()
  await win.getByRole('button', { name: 'Add prospect' }).click()
  await win.getByPlaceholder('White Pointer Boats').fill('E2E Marine Ltd')
  await win.getByPlaceholder('whitepointerboats.co.nz').fill('e2emarine.co.nz')
  await win.getByRole('button', { name: 'Add prospect' }).last().click()

  await expect(win.getByRole('heading', { name: 'E2E Marine Ltd' })).toBeVisible()
  await win.getByLabel('Stage').selectOption('researched')
  await expect(win.getByText('Stage: discovered → researched')).toBeVisible()

  await win.getByRole('button', { name: 'Add contact' }).click()
  await win.getByPlaceholder('name@business.co.nz').fill('owner@e2emarine.co.nz')
  await win.getByPlaceholder('name@business.co.nz').press('Enter')
  await expect(win.getByText('Not confirmed as conspicuously published.')).toBeVisible()

  win.once('dialog', (d) => d.accept())
  await win.getByTitle('Delete this person (Privacy Act)').click({ force: true })
  await expect(win.getByText('A contact was deleted at their request (Privacy Act).')).toBeVisible()

  await win.getByRole('link', { name: /Pipeline/ }).click()
  await expect(win.locator('article', { hasText: 'E2E Marine Ltd' })).toBeVisible()
})

test('settings persist and the duplicate guard works', async () => {
  await win.getByRole('link', { name: /Settings/ }).click()
  await expect(win.getByText('Rate card')).toBeVisible()
  const cap = win.getByLabel('Live proposal cap')
  await cap.fill('4')
  await cap.blur()
  await win.getByRole('link', { name: /Home/ }).click()
  await win.getByRole('link', { name: /Settings/ }).click()
  await expect(win.getByLabel('Live proposal cap')).toHaveValue('4')

  await win.getByRole('link', { name: /Pipeline/ }).click()
  await win.getByRole('button', { name: 'Add prospect' }).click()
  await win.getByPlaceholder('White Pointer Boats').fill('Other name')
  await win.getByPlaceholder('whitepointerboats.co.nz').fill('https://www.e2emarine.co.nz')
  await win.getByRole('button', { name: 'Add prospect' }).last().click()
  await expect(win.getByText('Already in the pipeline. Opening it.')).toBeVisible()
})
