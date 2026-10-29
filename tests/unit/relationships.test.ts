import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../../src/main/db/repo'
import { RelRepo } from '../../src/main/db/relationships'
import { DEFAULT_CADENCE, PITCH_OPT_OUT, SIGN_OFF, addDays, lintRelationship, nextTouch, pitchAllowed, splitPromises } from '@shared/relationships'

const fresh = () => new RelRepo(openDatabase(join(mkdtempSync(join(tmpdir(), 'tally-rel-')), 'r.db')))

describe('cadence', () => {
  it('counts every post-meeting touch from the meeting day', () => {
    const base = { metOn: '2026-10-01', lastTouchOn: '2026-10-09', cadence: DEFAULT_CADENCE }
    expect(nextTouch({ ...base, stage: 'met' })).toEqual({ kind: 'thank_you', on: '2026-10-01' })
    expect(nextTouch({ ...base, stage: 'thanked' })).toEqual({ kind: 'acted_on_advice', on: '2026-10-08' })
    expect(nextTouch({ ...base, stage: 'acted_on_advice' })).toEqual({ kind: 'value_touch', on: '2026-10-19' })
    expect(nextTouch({ ...base, stage: 'value_touch' })).toEqual({ kind: 'invite_to_share', on: '2026-10-29' })
    expect(nextTouch({ ...base, stage: 'parked' })).toBeNull()
  })
  it('respects a per-person cadence and crosses month ends', () => {
    expect(nextTouch({ stage: 'thanked', metOn: '2026-10-28', lastTouchOn: null, cadence: { ...DEFAULT_CADENCE, acted: 5 } })?.on).toBe('2026-11-02')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
  it('gates pitching until they are invited to share', () => {
    expect(pitchAllowed('value_touch')).toBe(false)
    expect(pitchAllowed('invited_to_share')).toBe(true)
    expect(pitchAllowed('parked')).toBe(false)
  })
  it('splits several promises', () => {
    expect(splitPromises('- Send the Hamilton supplier list\n- Read his book; Call back in March')).toEqual(['Send the Hamilton supplier list', 'Read his book', 'Call back in March'])
  })
})

describe('relationship writing rules', () => {
  const ok = `Hi Sam,\n\nThanks for the time at the yard on Tuesday.\n\nYour point about selling the second boat before the first one launches has stuck with me.\n\nI'm going to try it with the next prospect I meet.\n\n${SIGN_OFF}`
  it('passes a plain, warm message', () => {
    expect(lintRelationship('Thanks for Tuesday', ok, { channel: 'email', touchKind: 'thank_you' })).toEqual([])
  })
  it('catches exclamations, emoji, calendar links, guarantees, dashes and the wrong sign-off', () => {
    const bad = 'Hi Sam!\n\nGreat chat \u{1F600} book a time here calendly.com/zak and we guarantee results — really.\n\nCheers, Zak'
    const issues = lintRelationship('Thanks', bad, { channel: 'email', touchKind: 'thank_you' }).join(' | ')
    for (const re of [/exclamation/, /emoji/, /calendar link/, /Guarantee/, /dash/, /sign-off/]) expect(issues).toMatch(re)
  })
  it('does not mistake ordinary uses of "target" for guarantees', () => {
    const t = `Hi Sam,\n\nYour buyers are the target of every dealer ad in Auckland.\n\n${SIGN_OFF}`
    expect(lintRelationship(null, t, { channel: 'text', touchKind: 'value_touch' })).toEqual([])
    expect(lintRelationship(null, t.replace('Your buyers', 'We will hit your target. Your buyers'), { channel: 'text', touchKind: 'value_touch' }).join()).toMatch(/Guarantee/)
  })
  it('flags AI tells', () => {
    const tell = `Hi Sam,\n\nSimple. Clear. Done.\n\nConsistency is everything.\n\n${SIGN_OFF}`
    const issues = lintRelationship(null, tell, { channel: 'text', touchKind: 'value_touch' }).join(' | ')
    expect(issues).toMatch(/clipped fragments/)
    expect(issues).toMatch(/slogan/)
  })
  it('needs the opt-out line on a pitch', () => {
    expect(lintRelationship('An idea for the yard', ok.replace('Thanks for the time', 'Here is what I build'), { channel: 'email', touchKind: 'pitch' }).join()).toMatch(/opt-out/)
    expect(lintRelationship('An idea for the yard', `${ok}\n\n${PITCH_OPT_OUT}`, { channel: 'email', touchKind: 'pitch' })).toEqual([])
  })
})

describe('relationships repo', () => {
  it('walks a person through the month: meeting, thank-you, advice, value, invite', () => {
    const r = fresh()
    const p = r.createPerson({ name: 'Sam Fictional', role: 'Director', tags: ['marine'] })
    expect(p.nextTouchKind).toBe('first_contact')
    r.logInteraction({ personId: p.id, occurredOn: '2026-10-01', kind: 'email', touchKind: 'first_contact', notes: 'Asked to visit the yard', toldMe: null, advice: null, promised: null })
    expect(r.getPerson(p.id)!.stage).toBe('first_contact')
    const met = r.logInteraction({ personId: p.id, occurredOn: '2026-10-10', kind: 'met', touchKind: null, notes: 'Yard tour', toldMe: 'Hulls sell before launch or not at all', advice: 'Talk to the dealers, not the buyers', promised: 'Send the dealer list; Read his book' })
    expect(met.person.stage).toBe('met')
    expect(met.person.metOn).toBe('2026-10-10')
    expect(met.person.nextTouchKind).toBe('thank_you')
    expect(r.listPromises(p.id)).toHaveLength(2)
    r.logInteraction({ personId: p.id, occurredOn: '2026-10-10', kind: 'email', touchKind: 'thank_you', notes: null, toldMe: null, advice: null, promised: null })
    expect(r.getPerson(p.id)).toMatchObject({ stage: 'thanked', nextTouchKind: 'acted_on_advice', nextTouchOn: '2026-10-17' })
    expect(r.due('2026-10-20').map((d) => d.person.id)).toEqual([p.id])
    expect(r.due('2026-10-16')).toEqual([])
    expect(r.dueCount('2026-10-20')).toBe(1)
    // Logging an earlier touch never moves the stage backwards.
    r.logInteraction({ personId: p.id, occurredOn: '2026-10-11', kind: 'email', touchKind: 'first_contact', notes: null, toldMe: null, advice: null, promised: null })
    expect(r.getPerson(p.id)!.stage).toBe('thanked')
  })
  it('keeps a hand-set next touch until the next logged touch, and erases everything on delete', () => {
    const r = fresh()
    const p = r.createPerson({ name: 'Jo Fictional' })
    r.updatePerson(p.id, { nextTouchOn: '2027-01-15', nextTouchKind: 'check_in' })
    expect(r.getPerson(p.id)).toMatchObject({ nextTouchOn: '2027-01-15', nextTouchManual: true })
    const d = r.saveDraft({ personId: p.id, touchKind: 'first_contact', channel: 'email', subject: 'Advice', body: 'x', overrodePitchGate: false })
    expect(r.markDraftSent(d.id).stage).toBe('first_contact')
    expect(r.getPerson(p.id)!.nextTouchManual).toBe(false)
    r.updatePerson(p.id, { nextTouchKind: null })
    expect(r.getPerson(p.id)).toMatchObject({ nextTouchKind: null, nextTouchOn: null })
    expect(r.dueCount('2099-01-01')).toBe(0)
    r.erasePerson(p.id)
    expect(r.detail(p.id)).toBeNull()
    expect(r.db.prepare('SELECT COUNT(*) n FROM interactions').get()).toEqual({ n: 0 })
  })
})
