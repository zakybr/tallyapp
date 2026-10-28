---
name: tally-qualify
description: Decide whether a New Zealand business is a Tally prospect. Use whenever researching, scoring or ruling out a company, recording gaps, or deciding Go / Conversation / Pass, even if the request only says "is X a fit", "score this", "research this company" or "check this lead". Holds the four gates, the six gap families, the rule-outs and the evidence rule.
---

# Qualifying a Tally prospect

Tally Marketing Limited is a one-person Auckland marketing agency (Zak). The pitch has no targets and no guarantees: **fix what is broken, start measuring, then fill the funnel.** The rate is $1,400 onboarding ($700 if signed and paid the same day), then $3,000/month, four-month minimum.

So the ideal prospect is an **established, owner-run business selling something expensive, with a weak or broken online presence, that can afford $2,500+/month.** It also covers registered NZ businesses that are missing a Google Maps listing, Instagram or Facebook, or that need a new website, including businesses visibly asking for website builders or marketers.

Current verticals: boat builders and marine, pools, motorhomes, luxury homes, seasonal leisure operators (jet ski hire, venues). Auckland first: North Shore, Hibiscus Coast, West Auckland, Wairau Valley. Settings in the app can change these.

## The four gates: all must pass

| Gate | What counts | How to check |
|---|---|---|
| Real and active | Registered company, trading, recent activity | NZ Companies Office: incorporation date, directors, annual return filed. Recent posts, reviews, listings |
| Sells something expensive | One sale covers months of fees | Prices on the site, Trade Me listings, spec sheets |
| Can afford $2.5k+/month | Volume and margin | Usually cannot be verified. Mark it `unverified` and write it as the first-call question. That alone never fails a prospect |
| Easy to market | A visual product, a clear buyer, a season | Your judgement. Give the reasons |

A gate is `pass` only when you have evidence. It is `fail` when the evidence says no. Otherwise it is `unverified`.

## At least one clear, verifiable gap

| Gap family (`gapType`) | Examples |
|---|---|
| `not_findable` | No Google Business Profile, no socials, "Temporarily closed" on Google, decades in business with zero reviews |
| `broken_contact` | Broken tel:/mailto: links, a form showing config errors, domain for sale, a listing that links to the wrong site |
| `outdated_info` | Different phone numbers on the site and Google, duplicate Facebook pages, specs that contradict each other |
| `nothing_measured` | No GA4, no Meta pixel, only a dead Universal Analytics tag |
| `no_paid` | Nothing in the Meta Ad Library or the Google Ads Transparency Center |
| `weak_social` | A big review count but a small or inactive Instagram, measured against the peer benchmark |

## Rule-outs: any one means Pass

- `already_marketed`: Meta pixel **and** GA4 **and** an agency-built site (agency credit in the footer, a known agency platform). They already have someone.
- `operational_risk`: recalls, a retired product, a dead domain, liquidation, a removed or struck-off company.
- `competes_with_prospect`: same vertical and area as a company already in the live pipeline. Flag it; Zak picks one.
- `family_built_site`: built by family or friends, so criticising it costs the relationship. Flag it and pitch off-site work only (Google, socials, ads). This is a flag, not an automatic Pass, unless off-site work has nothing to fix.
- `client_conflict`: matches the conflicts list in Settings.

## The evidence rule (from experience)

Every gap must be verified **on the page where it would actually live**. Contact forms live on /contact, not on the homepage. Before you record "no contact form", "no tracking", "no booking path" or anything similar, check the homepage, /contact (or the equivalent "Get in touch" page), and any booking or enquiry page. Record every URL you checked in `pagesChecked`, plus a screenshot when the site audit tool gives you one.

Every claim carries a source URL and a checked-at time. If a figure is not published, write "not published". Never estimate revenue, staff or follower counts. A wrong claim on a cold call ends the call, so an honest "not published" is worth more than a confident guess.

## Hard to find is the point

These businesses rank badly by design of the brief. Before saying a business cannot be found, follow the tally-find-business skill (domain guessing, trade-word searches, directories, Facebook). "Could not find it" means the research is incomplete: leave it unscored for Zak to check. It is never a Pass reason. A business that exists but is hard to find has the `not_findable` gap.

## Verdict

- **Go**: real, expensive and easy to market all pass, at least one verified gap, no rule-outs. Affordability can stay unverified.
- **Conversation**: no rule-outs and at least one verified gap, but a hard gate is still unverified. Worth a call to find out.
- **Pass**: any failed gate, any rule-out, or no verified gap. Always store the single reason, so nobody researches the company twice.

Give **one** reason for the verdict: the single fact that decided it, in one plain sentence.
