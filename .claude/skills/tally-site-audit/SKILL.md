---
name: tally-site-audit
description: The checklist for auditing a prospect's website and off-site presence for Tally. Use whenever running a site audit, checking tracking tags, forms, tap-to-call, schema, Google Business Profile, socials, Meta Ad Library or Google Ads Transparency, or whenever about to claim that something is missing from a site.
---

# Tally site and presence audit

The audit produces the evidence for Zak's opener, his call script and the emailed audit PDF, so a claim only counts when someone else could check it by clicking the source.

## Check the page where it lives

The most common mistake is checking the homepage and concluding that something is missing. Before any "no X" claim:

1. Audit the homepage.
2. Find and audit the contact page: /contact, /contact-us, "Get in touch", "Enquire", and any footer contact link.
3. Find and audit any booking, quote or enquiry page: /book, /booking, /enquire, /quote, /hire, a "Book now" button target.
4. Only then record the gap, listing every URL you checked.

Use the `site_audit` tool with `pages` set to those URLs. It runs desktop and 375px mobile, respects robots.txt, rate-limits itself and saves screenshots. Never fetch LinkedIn or Google Maps pages; that is scraping and is not allowed.

## On-site checklist

| Check | Record |
|---|---|
| GA4 (`G-` measurement ID, gtag.js) | present / absent, and on which pages |
| Google Tag Manager (`GTM-`) | present / absent |
| Meta pixel (`fbq(`, connect.facebook.net) | present / absent |
| Universal Analytics (`UA-`, analytics.js) | a dead UA tag with no GA4 means nothing is measured |
| Forms | which page, what the form posts to, any visible errors (reCAPTCHA or config warnings, "form not configured") |
| Tap-to-call | tel: links on mobile, and whether the number matches Google |
| mailto: links | present, and well formed |
| Schema | LocalBusiness / Organization / Product JSON-LD present? |
| og:image | present? Shared links look broken without it |
| Broken links | internal links returning 4xx/5xx |
| Load and mobile | load time, horizontal overflow at 375px, console errors |
| Who built it | footer credit, platform (Wix, Squarespace, WordPress theme). This feeds the "agency-built" and "family-built" rule-outs |
| Domain state | parked, for sale, expired certificate, redirecting to another business |

Take a screenshot of each issue. The tool returns paths; attach the relevant one to each finding.

## Off-site checklist

- **Google Business Profile**: exists? status (open, temporarily closed), rating, review count, the website it links to, the phone it lists. Use web search results and the business's own links; do not scrape Maps. If you cannot see it, record "not checked" with the search URL, not "missing".
- **Instagram, Facebook, TikTok, YouTube**: handle, followers, date of the last post when visible. Duplicate Facebook pages count as `outdated_info`.
- **Trade Me**: listings and prices (evidence for the "expensive" gate).
- **Meta Ad Library** (facebook.com/ads/library, country NZ) and the **Google Ads Transparency Center** (adstransparency.google.com, region NZ): any active ads? Use the `ad_library_check` tool. If it cannot load, record the lookup URL so Zak can click it, and mark the finding unverified.
- **Companies Office**: legal name, company number, incorporation date, status, directors, last annual return filed. Use `companies_office_lookup`.

## Instagram peer benchmark

For the prospect and 2–3 similar-sized local competitors in the same vertical, record followers, posts in the last 30 days, Reels share, and average engagement (likes plus comments per post, divided by followers). Use only what is publicly visible. If a number is not visible, leave it null rather than estimating. Flag the prospect when it is well below the peer median (under half the median followers or posting frequency) and cite the rows.

## Writing findings

One finding per fact. Write it plainly, the way Zak would say it on the phone: "The Website button on the Google listing opens formulacruisers.com, a different business." Not "Suboptimal listing configuration".
