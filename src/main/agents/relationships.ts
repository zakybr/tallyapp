/*
  Relationship drafter. Writes one touch for one person from their own notes.
  The pitch gate is enforced here, in main: a pitch before "Invited to share"
  is refused unless Zak overrides, and the override is recorded once.
*/
import { z } from 'zod'
import { getRelRepo } from '../context'
import { emit } from '../ipc'
import { registerJob } from './jobs'
import { saveTool } from './tools'
import { skillText } from './skills'
import { localDate } from '@shared/rules'
import {
  INTERACTION_LABEL, PITCH_OPT_OUT, REL_STAGE_LABEL, SIGN_OFF, TOUCH_KINDS, TOUCH_LABEL, lintRelationship, pitchAllowed,
  type DraftChannel, type TouchKind
} from '@shared/relationships'

export const PITCH_GATE = 'PITCH_GATE'

const DraftSchema = z.object({
  subject: z.string().nullable().describe('Email only: under six words. null for text or LinkedIn.'),
  body: z.string().min(20).describe('The full message including the three-line sign-off')
})

function brief(personId: number): string {
  const d = getRelRepo().detail(personId)!
  const p = d.person
  return JSON.stringify({
    person: {
      name: p.name, role: p.role, company: p.companyName, howWeMet: p.howMet, introducedBy: p.introducedBy,
      interestsTheyMentioned: p.interests, tags: p.tags, stage: REL_STAGE_LABEL[p.stage], metOn: p.metOn
    },
    interactions: d.interactions.slice(0, 12).map((i) => ({
      on: i.occurredOn, how: INTERACTION_LABEL[i.kind], touch: i.touchKind, notes: i.notes,
      whatTheyToldMe: i.toldMe, adviceTheyGave: i.advice, whatIPromised: i.promised
    })),
    openPromises: d.promises.filter((x) => !x.doneAt).map((x) => x.text),
    keptPromises: d.promises.filter((x) => x.doneAt).map((x) => x.text)
  }, null, 1)
}

registerJob('relationship_touch', (payload) => {
  const personId = Number(payload.personId)
  const touchKind = String(payload.touchKind) as TouchKind
  const channel = (String(payload.channel ?? 'email') as DraftChannel)
  const context = String(payload.context ?? '').trim()
  const rel = getRelRepo()
  const p = rel.getPerson(personId)
  if (!p) throw new Error('Person not found')
  if (!TOUCH_KINDS.includes(touchKind)) throw new Error(`Unknown touch: ${touchKind}`)
  let overrode = false
  if (touchKind === 'pitch' && !pitchAllowed(p.stage)) {
    // Warn once; after one override for this person, don't ask again.
    if (!payload.overridePitch && !p.pitchOverrideAt) throw new Error(`${PITCH_GATE}: ${p.name} is at "${REL_STAGE_LABEL[p.stage]}". No pitching before they're invited to share what you're building.`)
    overrode = true
    // Recorded on the person (so the warning shows once) and on the draft; it is not a touch, so the schedule is untouched.
    if (!p.pitchOverrideAt) rel.db.prepare('UPDATE people SET pitch_override_at = ? WHERE id = ?').run(new Date().toISOString(), personId)
  }
  return {
    title: `Draft ${TOUCH_LABEL[touchKind].split(':')[0].toLowerCase()}: ${p.name}`,
    companyId: null,
    work: async (ctx) => {
      let saved = false
      const save = saveTool('save_touch_draft', 'Save the draft. It must pass the writing rules; fix anything reported and save again.', DraftSchema, (d) => {
        const subject = channel === 'email' ? d.subject?.trim() || null : null
        const issues = lintRelationship(subject, d.body, { channel, touchKind })
        if (issues.length) throw new Error(`Breaks the writing rules:\n- ${issues.join('\n- ')}`)
        rel.saveDraft({ personId, touchKind, channel, subject, body: d.body.trim(), overrodePitchGate: overrode })
        saved = true
        emit('data:changed', { table: 'people', companyId: personId })
        return 'Saved.'
      })
      await ctx.runAgent({
        name: 'relationship_touch',
        systemPrompt: `You write one message for Zak to send himself. Today is ${localDate()} (New Zealand). Nothing is sent automatically. Use only the facts in the notes you are given.${skillText(['tally-relationship-touch'])}`,
        prompt: [
          `Write the "${TOUCH_LABEL[touchKind]}" message as ${channel === 'email' ? 'an email' : channel === 'text' ? 'a text message' : 'a LinkedIn message'}.`,
          context ? `Zak's context for this message: ${context}` : '',
          `End with this sign-off, exactly, on three lines:\n${SIGN_OFF}`,
          touchKind === 'pitch' ? `After the sign-off, add this line on its own: ${PITCH_OPT_OUT}` : '',
          `Notes on this person:\n${brief(personId)}`,
          'Save it with save_touch_draft.'
        ].filter(Boolean).join('\n\n'),
        builtinTools: [],
        tools: [save],
        maxTurns: 8
      })
      if (!saved) throw new Error('The drafter finished without saving a draft.')
      ctx.log('finding', `Draft ready for ${p.name}. Open their page to edit, copy or open it in Mail.`)
    }
  }
})
