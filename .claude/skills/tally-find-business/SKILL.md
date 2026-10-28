---
name: tally-find-business
description: How to find NZ businesses whose online presence is badly set up, and how to confirm a business exists before judging it. Use whenever searching for leads, looking up a company by a short or odd name, or when a first search comes back empty, even if the request is just "research X" or "find boat builders in Orewa". The businesses Tally wants are by definition hard to find, so an empty first search is the expected case, not a dead end.
---

# Finding badly set-up businesses

Tally's best prospects are established businesses with a weak online presence. That means Google ranks them badly, their site sits on a domain that does not match their trading name, and their Google listing may be missing. A search for the bare name often returns nothing.

Example: "AOMAS, Orewa" finds nothing by name, yet the business trades as **AOMAS Marine** at **aomasmarine.com**. The trade word was missing from the search, and the domain is .com rather than .co.nz.

**Never conclude that a business cannot be found until you have tried every step below.** "Hard to find" is the `not_findable` gap Tally sells against, not a reason to pass.

## Confirming a business you were given

1. **Guess the domain first.** It costs no search quota. Call `find_domain` with the name, vertical and area. It tries the name plus trade words (marine, boats, pools, homes, hire…) across .co.nz, .nz, .com and .net.nz, and returns live sites with their titles. Any hit that mentions the name: open it with `fetch_page`.
2. **Search the name with a trade word and the place**, in quotes and without: "AOMAS Marine", "AOMAS Orewa boat", "AOMAS outboard", "AOMAS Hibiscus Coast". Try the name as initials and as words (A.O.M.A.S.), and with Ltd / Limited.
3. **Search the register through search engines**: "<name> NZBN", "<name> Limited" site:opencorporates.com, "<name>" site:app.companiesoffice.govt.nz. Registered names often add MARINE, SERVICES or a family surname.
4. **Search directories that rank where small sites don't**: Finda, Yellow (yellow.co.nz), NZ Marine Industry Association member lists, Boating NZ, Trade Me (dealer and business listings), NoCowboys, Builderscrack, Neighbourly, Localist, Hotfrog, Cylex.
5. **Social pages**: "<name>" site:facebook.com, "<name>" site:instagram.com. Many of these businesses live only on a Facebook page.
6. **The phone number**, if you have one: search it in quotes. It usually surfaces the real trading name.

Record in `identity.howFound` the step that worked, or everything you tried. Set `identity.resolved` true only when you have found the business itself. If it is still unresolved, say so: Zak will check the name. Do not score it.

## Lead-finding: where hidden businesses show up

- **Directories and associations** (list above). Members with no website, or with a broken one, are ideal leads.
- **Trade Me**: dealers and private sellers with repeat listings of expensive items (boats, pools, motorhomes) but no website link.
- **Businesses asking for help**: Trade Me Services, Builderscrack, NoCowboys and Neighbourly posts asking for a web designer, a website or marketing. Facebook "looking for a web designer" posts that appear in search results.
- **Companies Office through search**: recently filed annual returns for marine, pool or building companies in the area.
- **Google results for the trade plus a suburb** (e.g. "boat repairs Silverdale"): look past page one. Businesses on page three are the point.
- **Signs of a weak presence** worth noting in each lead: no website, a site on a free builder subdomain (wixsite.com, business.site), a domain that does not match the name, "Temporarily closed" on Google, a Facebook page with no posts this year, a phone number that differs between sources.

Never scrape Google Maps or LinkedIn. Use search results, the business's own pages and directories, and respect robots.txt (`fetch_page` does this for you).
