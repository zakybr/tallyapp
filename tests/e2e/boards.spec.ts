import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const userData = mkdtempSync(join(tmpdir(), 'tally-boards-e2e-'))
let app: ElectronApplication
let win: Page
const open = async () => {
  app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], env: { ...process.env, TALLY_E2E: '1' } })
  win = await app.firstWindow()
  await win.setViewportSize({ width: 1440, height: 900 })
  await win.waitForSelector('aside')
}
test.afterAll(async () => app?.close())

test('create a board, draw, and find it again after a restart', async () => {
  await open()
  await win.getByRole('link', { name: /Boards/ }).click()
  await win.getByRole('button', { name: 'New board' }).first().click()
  await win.getByPlaceholder('Enquiry-to-revenue system').fill('E2E board')
  await win.getByRole('button', { name: 'Create board' }).click()
  await win.waitForFunction(() => !!(window as unknown as { __tallyBoard?: unknown }).__tallyBoard)
  await win.mouse.click(1300, 820)
  await win.keyboard.press('r')
  await win.mouse.move(700, 300); await win.mouse.down(); await win.mouse.move(800, 380, { steps: 6 }); await win.mouse.up()
  await win.keyboard.press('Escape')
  await expect(win.getByText('Saved')).toBeVisible({ timeout: 10_000 })
  await win.getByRole('button', { name: 'Versions' }).click()
  await win.getByPlaceholder(/Name this version/).fill('First cut')
  await win.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(win.getByText('First cut')).toBeVisible()
  await app.close()

  await open()
  await win.getByRole('link', { name: /Boards/ }).click()
  await win.getByRole('button', { name: 'Open E2E board' }).click()
  await win.waitForFunction(() => !!(window as unknown as { __tallyBoard?: unknown }).__tallyBoard)
  const types = await win.evaluate(() => (window as unknown as { __tallyBoard: { excal: { getSceneElements(): { type: string }[] } } }).__tallyBoard.excal.getSceneElements().map((e) => e.type))
  expect(types).toEqual(['rectangle'])
  await win.getByLabel('Back to boards').click()
  await win.getByRole('button', { name: 'Board menu' }).click()
  await win.getByRole('button', { name: 'Delete' }).click()
  await win.getByRole('link', { name: 'Trash' }).click()
  await expect(win.getByText('E2E board')).toBeVisible()
})
