/* Demo data: eight fictional directors across the relationship stages. node scripts/seed-relationships.mjs <userDataDir> */
import { _electron as electron } from 'playwright'
const dir = process.argv[2]
const app = await electron.launch({ args: ['.', `--user-data-dir=${dir}`], env: { ...process.env, TALLY_E2E: '1' } })
const win = await app.firstWindow()
await win.waitForSelector('aside')
await win.evaluate(async () => {
  const t = window.tally
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
  const people = [
    { name: 'Rowan Fictional', role: 'Managing Director', company: 'Gulfside Launches Ltd', tags: ['Boat builders', 'Hibiscus Coast'], interests: 'Restoring a 1968 Davidson launch', how: 'Auckland Boat Show',
      log: [[30, 'email', 'first_contact', 'Asked for 20 minutes of advice'], [24, 'met', null, 'Toured the yard', 'We never discount. We add a trailer instead.', 'Build the marketing around the launch day, not the hull', 'Send photos of the Matakana build\nAsk Tom about the dealer day'], [24, 'email', 'thank_you']] },
    { name: 'Priya Fictional', role: 'Owner', company: 'Shore Spas & Pools', tags: ['Pool builders', 'North Shore'], how: 'Introduced by Rowan',
      log: [[9, 'email', 'first_contact', 'Asked to visit a pool install'], [8, 'met', null, 'Coffee in Takapuna', 'Half our leads come from neighbours watching the dig', 'Put a sign on every site from day one', 'Draft a site-sign mock-up']] },
    { name: 'Hemi Fictional', role: 'Director', company: 'Westgate Motorhomes', tags: ['Motorhome dealers', 'West Auckland'], how: 'Cold email',
      log: [[9, 'email', 'first_contact', 'Asked for advice on dealer marketing']] },
    { name: 'Grace Fictional', role: 'Founder', company: 'Matakana Wedding Barn', tags: ['Wedding venues', 'Rodney'], how: 'Neighbourly post',
      log: [[40, 'email', 'first_contact'], [35, 'met', null, 'Walked the venue', 'Winter is dead. We need corporate bookings.', 'Talk to event planners before couples', 'Send the list of Auckland planners'], [35, 'email', 'thank_you'], [27, 'email', 'acted_on_advice', 'Told her I met two planners'], [17, 'email', 'value_touch', 'Sent an article on winter corporate retreats']] },
    { name: 'Tom Fictional', role: 'Director', company: 'Harbour Hulls Ltd', tags: ['Aluminium boat builders', 'Hibiscus Coast'], how: 'Introduced by Rowan', log: [] },
    { name: 'Aroha Fictional', role: 'General Manager', company: 'Bay Jet Ski Hire', tags: ['Jet ski hire', 'Orewa'], how: 'Saw her at the Orewa market',
      log: [[50, 'met', null, 'Chat at the hire stand', 'Bookings come from walk-ups, not the website', 'Get the Google listing right first'], [50, 'text', 'thank_you'], [43, 'email', 'acted_on_advice'], [32, 'email', 'value_touch'], [22, 'email', 'invite_to_share', 'Asked if she wanted to hear what I am building. She said yes.']] },
    { name: 'Daniel Fictional', role: 'Owner', company: 'Kumeu Luxury Builds', tags: ['Luxury home builders', 'Kumeū'], how: 'LinkedIn', log: [[60, 'met', null, 'Site visit'], [60, 'email', 'thank_you']], stage: 'advisor_only' },
    { name: 'Mere Fictional', role: 'Director', company: 'Albany Cosmetic Clinic', tags: ['Cosmetic clinics', 'Albany'], how: 'Event', log: [[4, 'call', 'meeting', 'Phone call about patient enquiries', 'Most patients find us through Instagram', 'Answer DMs within the hour']] }
  ]
  for (const p of people) {
    const c = await t.createCompany({ name: p.company, source: 'demo' })
    const person = await t.createPerson({ name: p.name, role: p.role, companyId: c.id, tags: p.tags, interests: p.interests ?? null, howMet: p.how })
    for (const [ago, kind, touchKind, notes, toldMe, advice, promised] of p.log) {
      await t.logInteraction({ personId: person.id, occurredOn: d(ago), kind, touchKind, notes: notes ?? null, toldMe: toldMe ?? null, advice: advice ?? null, promised: promised ?? null })
    }
    if (p.stage) await t.updatePerson(person.id, { stage: p.stage })
  }
})
await app.close()
console.log('seeded')
