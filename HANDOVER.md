# ContractorQuote: project handover

Last updated: 24 October 2026, against `main` at commit `cb0dd49` (the merge of PR #6).

This file is for whoever works on ContractorQuote next, whether that's a person or an AI coding assistant. Read it together with [`README.md`](README.md). If anything here disagrees with the code, the code is right. Fix this file in the same pull request as your change.

Each fact is labelled with how it was checked:

- **Checked in repo:** confirmed by reading the code, running the tests or looking at git history.
- **Checked in browser:** confirmed in headless Chrome against a local copy of `main`.
- **Checked live:** confirmed against the live website.
- **Reported by owner:** the owner told us this, and it can't be checked from the repository. This covers Google Search Console and Cloudflare dashboards.

---

## A. Project overview

### What it is

ContractorQuote is a free website that helps UK builders, sole traders, subcontractors and small contractors price a job properly and turn the price into a clear written quote.

### The problem it solves

Many small builders price jobs as "cost plus a bit". That misses hidden labour costs such as holidays, travel, insurance and unpaid admin. It also misses the business's running costs (overhead). Many builders also confuse markup with margin, so they make less profit than they think. ContractorQuote:

1. adds those costs up properly
2. works out the price from the profit margin the builder wants
3. produces a quote that shows the customer only the work and the price, never the builder's costs or profit

### Who it serves

UK builders and small contractors. All money is in pounds sterling. The site deliberately does **no VAT or tax calculations** and gives **no tax, legal or financial advice**.

### Addresses

| What | Address |
| --- | --- |
| Live website | https://akdss-ai.github.io/ContractorQuote/ |
| GitHub repository | https://github.com/akdss-AI/ContractorQuote |

The path `/ContractorQuote/` is case-sensitive. A lowercase `/contractorquote/` gives a 404.

### Hosting and how changes go live

- **Host:** GitHub Pages, which is free. It serves the files straight from the **`main` branch, repository root**. There is no build step, no server and no database.
- **How a change goes live:**
  1. Work on a branch.
  2. Open a pull request.
  3. The owner reviews and merges it into `main`.
  4. GitHub Pages republishes automatically, usually within a few minutes.
- **Status:** checked live. Merged changes from PRs #4–#6 appear on the live site. The Pages settings screen itself can't be seen from the repository. Its expected setup is described in `README.md` under "Hosting".
- The repository has **no GitHub Actions workflows** (there is no `.github/` folder). Checked in repo.
- `.nojekyll` tells GitHub Pages to serve the files exactly as they are.

---

## B. Current website

### Pages

All 7 public pages are in `sitemap.xml`, and the 404 page is not. Checked in repo.

| Page | Address | Purpose |
| --- | --- | --- |
| Home | https://akdss-ai.github.io/ContractorQuote/ | Explains the problem and how the tool works, with a worked example. Links to the calculator and guides. |
| Calculator | …/calculator.html | The main tool: costs → price → quote details → preview and print. |
| Quote template | …/builder-quote-template.html | A printable blank quote, a filled-in example and a checklist of what a quote should include. |
| Pricing guide | …/guides/how-to-price-a-building-job.html | A step-by-step guide to pricing a job, in the same order as the calculator. |
| Markup vs margin | …/guides/markup-vs-margin.html | Explains why a 20% markup isn't a 20% margin, with a conversion table. |
| True cost of labour | …/guides/true-cost-of-labour.html | Explains why an hour of labour costs more than the hourly rate, with a worked example of the labour burden. |
| Privacy | …/privacy.html | What's stored (in the browser only), what's sent (nothing typed) and the visitor statistics. |
| 404 | (any missing address) | Not-found page. It uses full links because a missing page can be at any depth. |

There is also `google864bd0fd8d74e2f3.html`. It's the Google Search Console ownership file. **Don't delete or rename it**, or Search Console loses verification.

### Navigation

Every content page has the same main menu, in this order: **Calculator · Markup vs margin · Pricing guide · Labour cost · Quote template**. The logo links home. The current page is marked with `aria-current="page"`. Checked in repo by tests, and checked in browser.

On phones the menu wraps onto 3 lines, and on desktop it fits on one line. The 404 page has no menu.

Footers are not identical across pages. For example, not every footer links to every guide, and none link to the labour cost guide yet. This is cosmetic and not a bug.

### The calculator

**Inputs** (`calculator.html`, defined in `js/calc.js` `FIELDS` and `LIMITS`):

| Input | Type | Allowed range |
| --- | --- | --- |
| Labour hours | hours | 0–2,000 |
| Hourly rate | £ | up to £10,000,000 |
| Labour burden | % | 0–100 |
| Materials | £ | up to £10,000,000 |
| Subcontractors | £ | up to £10,000,000 |
| Other job costs | £ | up to £10,000,000 |
| Overhead | % | 0–100 |
| Target profit margin | % | 0–90 |

Inputs accept everyday formats such as `1,250.50` and `£1250`. Blank counts as 0. Negative numbers and more than 2 decimal places are refused.

**Formulas.** All money is calculated in whole pence, so there are no rounding drift errors.

```
Labour       = Hours × Rate
Burden       = Labour × Burden %
Direct cost  = Labour + Burden + Materials + Subcontractors + Other
Overhead     = Direct cost × Overhead %
Total cost   = Direct cost + Overhead
Price        = Total cost ÷ (1 − Margin %)
Profit       = Price − Total cost
Markup %     = Profit ÷ Total cost
```

**Outputs:**

- Labour, burden, materials, subcontractors and other costs.
- Direct cost, overhead and total job cost.
- Recommended price, profit, margin and markup.
- A sentence comparing margin with markup.

These appear in a "Your numbers" panel marked "For you only".

**Warnings:**

- 0% margin
- margin above 50%
- hours entered with no hourly rate
- hourly rate entered with no hours

**Known correct results.** Checked in repo by tests, and checked in browser.

| Case | Inputs | Expected result |
| --- | --- | --- |
| Homepage example | 40 h × £30, 20% burden, £800 materials, £500 subcontractors, £60 other, 10% overhead, 25% margin | Direct cost £2,800.00. Overhead £280.00. Total cost £3,080.00. **Price £4,106.67.** Profit £1,026.67. Margin 25%. **Markup 33.3%.** |
| Homepage example, customer quote lines | same as above | Labour £2,112.01. Materials £1,173.33. Specialist / subcontracted work £733.33. Other job costs £88.00. **Total £4,106.67.** |
| Markup vs margin | £1,000 cost, 20% margin | Price £1,250. Markup 25%. |
| Labour guide example | 40 h × £20, 53% burden | Labour £800.00 + burden £424.00 = £1,224.00 |

### Quote generation, printing and privacy boundaries

- **Required quote details:**
  - customer name
  - job description
  - a valid quote date
  - quote validity of 1–365 days
  - a valid customer email, if one is entered

  Until those are filled in, the **Print or save as PDF** button stays disabled.
- **Quote number:** in the format `CQ-YYYYMMDD-NN`. The number counts up within a day and restarts each day.
- **What the customer sees on the quote:**
  - business details
  - quote number and dates
  - the customer
  - job title and description
  - up to four lines: Labour, Materials, Specialist / subcontracted work, Other job costs
  - the quote total
  - exclusions, payment terms and notes
  - a signature block
- **What the customer never sees:** costs, burden, overhead, profit, margin or markup. Overhead and profit are spread across the customer lines in proportion to cost. Any rounding remainder goes to the largest line, so the lines always add up exactly to the total. Checked in repo by tests, and checked in browser by printing to PDF and searching the text.
- **Printing:** `css/print.css` hides everything except the quote. A typical quote fits on 1 A4 page. If someone prints before the quote is complete, they get a "This quote isn't complete yet" page instead of a blank one. Checked in browser in Chrome only.
- **Saving as PDF:** this uses the browser's own print window. Choose "Save as PDF" as the printer. There's no PDF library.
- **Quote template page:** has a print button that prints only the blank template on 1 A4 page, using `css/template-print.css`. Checked in browser.

### Browser storage (localStorage)

Everything a user types stays in **their own browser** on that device. Nothing typed is sent anywhere. Checked in repo.

| Key | What's stored |
| --- | --- |
| `contractorquote:draft:v1` | The current draft: costs and quote details |
| `contractorquote:business:v1` | The user's business details, reused on every quote |
| `contractorquote:sequence:v1` | The day's quote-number counter |

- Work saves automatically about 0.3 seconds after typing stops, and again when the page is closed.
- **Start a new quote** asks for confirmation. It then clears the costs and customer details but keeps the business details.
- If storage is blocked or full (for example in private browsing), or holds corrupt data, the app keeps working and shows a warning banner. This is covered by `tests/storage.test.js`.
- Data doesn't move between devices, and it's lost if the user clears their browser data. The privacy page says so.

### Privacy and analytics

- **Cloudflare Web Analytics** runs on all 7 sitemap pages, with exactly one snippet per page, and not on the 404 page. Checked in repo by tests. It's cookieless and doesn't store anything on the device.
- The snippet's token (`e0270390…587ac1`) is public by design. It isn't a secret.
- The privacy page has a "Visitor statistics" section describing Cloudflare Web Analytics. Keep it accurate if analytics ever changes.
- There are no cookies, no accounts, no ads and no other third-party scripts.

---

## C. Technical structure

### Files and folders

```
index.html                         Home page
calculator.html                    Calculator, quote builder, preview and print
builder-quote-template.html        Printable blank quote template and example
guides/how-to-price-a-building-job.html   Pricing guide
guides/markup-vs-margin.html       Markup vs margin guide
guides/true-cost-of-labour.html    Labour cost guide
privacy.html                       Privacy page
404.html                           Not-found page (self-contained, full links)
google864bd0fd8d74e2f3.html        Google Search Console verification (keep)
robots.txt                         Informational only (see below)
sitemap.xml                        The 7 public pages
.nojekyll                          Serve files as-is on GitHub Pages
css/styles.css                     All screen styles
css/print.css                      Prints only the customer quote
css/template-print.css             Prints only the blank quote template
js/calc.js                         Calculation engine: pure functions, no page code
js/storage.js                      Safe localStorage wrapper
js/app.js                          Calculator page wiring (form, results, preview, print)
js/template.js                     Print button on the quote template page
assets/favicon.svg, og-image.png   Icon and social-sharing image
tests/calc.test.js                 Calculator maths, validation, quote lines, formatting
tests/storage.test.js              Saving and loading, broken or blocked storage
tests/seo.test.js                  Sitemap, canonicals, titles, descriptions, JSON-LD, links, analytics, menu
tests/template.test.js             Quote template example and print wiring
tests/labour-guide.test.js         Labour guide example and links
package.json                       Only defines `npm test`
README.md                          Technical notes, formulas, hosting
HANDOVER.md, NEXT_STEPS.md         This handover and the 30-day checklist
HANDOVER.pdf                       Printable copy of this file (the .md is the source of truth)
```

### Languages and tools actually used

- Plain **HTML, CSS and JavaScript** (ES modules). There are **no frameworks, libraries, npm packages or build step**.
- **Tests:** Node.js's built-in test runner (`node --test`), which needs Node 18 or newer. The tests have been run on Node 22.
- **External services:**
  - GitHub Pages (hosting)
  - Cloudflare Web Analytics (visitor statistics)
  - Google Search Console (search indexing; the owner's account)

### Running it locally

ES modules need a web server, so opening the files with `file://` won't work.

```
python3 -m http.server 8000
# open http://localhost:8000
```

### Running the tests

```
npm test
```

Latest result on `main` (`cb0dd49`): **45 tests, 45 passed, 0 failed.** Checked in repo, 24 October 2026.

What the tests cover:

- **Calculator maths:**
  - number parsing, pence conversion and rounding
  - every formula, 0% and 90% margins, and refusing 100% margin
  - burden applying to labour only
  - warnings and range checks
- **Customer quote lines:** they always add up to the price, hide internal figures, and drop empty lines.
- **Quote details:** required fields, dates, validity, quote numbers and formatting.
- **Storage:**
  - round-trips
  - corrupt data
  - blocked storage, failing storage and a full quota
  - the business details and quote-number counter
- **SEO and site checks:**
  - every sitemap file exists
  - self-referencing canonicals
  - unique titles and descriptions, with descriptions of 160 characters or fewer
  - valid JSON-LD
  - every internal link and section anchor resolves
  - the analytics snippet appears exactly once per page and not on the 404 page
  - the menu includes the quote template and labour guide on every page
- **Content examples:** the quote template's example and the labour guide's numbers match the calculator.

What the tests **don't** cover: real-browser behaviour. Use the manual browser checks below for that.

### Checking a change safely before merging

1. Run `npm test`. Everything must pass.
2. Run the local server and open the pages you changed, at phone width (about 360px) and desktop width.
   - Look for sideways scrolling, broken layout and errors in the browser console.
3. If you touched the calculator or quote, check these:
   - Enter the homepage example and confirm the price is **£4,106.67**.
   - Fill in the customer name and job description, then use **Print or save as PDF**.
   - The quote should fit on one page and show no costs, profit or margin.
4. If you added or renamed a page, update:
   - `sitemap.xml`, including `<lastmod>`
   - the page's canonical and Open Graph URLs
   - the menu on every page, if it belongs in the menu
   - the README file list
   - one analytics snippet, copied from an existing page
5. Open a pull request. The owner merges it. Then check the live site a few minutes later.

---

## D. Completed work

All checked in repo from git history.

| PR | What it did |
| --- | --- |
| (initial commits) | The MVP static site: calculator, quote builder, print layout, guides, privacy page and unit tests. |
| #1 Technical SEO | Canonical URLs, Open Graph tags, JSON-LD structured data, sitemap, robots.txt note, 404 links, and the static SEO tests. |
| #2 Analytics | Added the Cloudflare Web Analytics beacon to the public pages and the "Visitor statistics" section on the privacy page. |
| #3 Quote template | New page `builder-quote-template.html`: printable blank template, filled-in example, checklist and 1-page print layout. Also retitled pages. |
| #4 Navigation and metadata | Added "Quote template" to the menu. Homepage cards now link to the relevant guide sections. Tightened titles and descriptions to 160 characters or fewer. New homepage title, "ContractorQuote: Free Builder Pricing Calculator & Quotes (UK)", with a matching `og:title`. |
| #5 Labour cost guide | New guide `guides/true-cost-of-labour.html` with a worked example (all figures marked as made up), plus tests. The pricing guide links to it. |
| #6 Labour guide in menu | Added "Labour cost" to the main menu on every page. |

### Verified behaviour

These were checked on 24 October 2026, in headless Chrome at 360px and 1280px, against `main` at `cb0dd49`.

- All 7 pages and the 404 page load with no errors and no sideways scrolling.
- The menu is identical on every page, and the current page is highlighted.
- All 14 distinct internal links and section anchors resolve.
- The calculator gives the known results above.
- The customer quote prints to a 1-page PDF with only customer lines and the total.
- Printing an incomplete quote gives the "not complete" notice.
- The blank template prints on 1 page.
- The live site serves the latest menu, and its sitemap lists all 7 pages.

### Known limitations

- **Single device only.** There are no accounts and no sync, and clearing browser data loses saved work. This is deliberate.
- **No VAT or tax calculations.** This is deliberate.
- Printing has been checked in **Chrome only**. It hasn't been checked on Safari, Firefox or real phones.
- The guides' example numbers are illustrative, not industry data.
- `robots.txt` in this folder is never read by search engines. They only read `robots.txt` at the domain root, `akdss-ai.github.io/robots.txt`. That's expected for a GitHub Pages project site and isn't a problem.
- The site lives on a `github.io` address. Moving to a custom domain later would mean updating every full URL. See `README.md`.

---

## E. Current unresolved status

### Google Search Console (reported by owner)

- The sitemap has been submitted. Pages are **not yet indexed**, and the owner has requested indexing for pages.
- The repository side was investigated several times:
  - The sitemap is valid XML.
  - Every URL returns HTTP 200.
  - Every canonical points to its own page.
  - No page is marked `noindex`.
  - The verification file is present.

  No repository fault was found.
- The most likely explanation is that the site is new and Google hasn't prioritised crawling it yet. This is a hypothesis, not a confirmed cause.
- **What to do:** check it every week or two. **Don't keep resubmitting the sitemap or re-requesting indexing.** One request after a real fix is enough. Real links from other websites, such as directories, forums and social posts, are what usually speed up discovery.

### Cloudflare Web Analytics (reported by owner)

- There are **two** Web Analytics entries in the owner's Cloudflare account. One shows increasing visits and the other shows zero.
- **Not yet investigated with dashboard evidence.** Possible explanations, all unconfirmed:
  - The site was added twice.
  - The second entry belongs to the old QuoteRepair Worker's hostname.
  - The second entry is a different view of the same data.
- **Don't delete or recreate either entry** without first comparing them. Compare each entry's hostname, its snippet token against the one on the site (ending `…587ac1`), and its recent visits. Get the owner's explicit approval before changing anything.

### The old QuoteRepair Worker (separate from ContractorQuote)

- Every pull request shows a failing check called **"Workers Builds: quoterepair"**.
- A separate investigation found:
  - It comes from an old Cloudflare Worker named `quoterepair`.
  - That Worker's Git build is still connected to this repository.
  - It fails on every commit, including `main`.
  - This repository has **no** Cloudflare or Wrangler files and no workflows, so there is nothing to clean up in the repo.
  - There is evidence this repository was renamed from the old QuoteRepair project.
- **It does not affect the live website.** GitHub Pages builds and serves the site independently. Safe to ignore when reviewing PRs.
- Cleanup is in the Cloudflare dashboard and is the owner's decision:
  1. Check the Worker's domains, routes and storage.
  2. Disconnect its Git repository.
  3. Delete it if nothing depends on it.

  **Don't delete external resources without the owner's approval.**

### Other outstanding items found in the repository

- **The GitHub repository description is out of date.** It still describes the old proofreading tool ("A private, client-side proofreading instrument…"). The owner can change it on the repository page, using the gear icon next to "About". It isn't a code change.
- Footers differ slightly between pages, and none link to the labour cost guide. This is cosmetic and low priority.
- `README.md` says "Live address once published". The site is now live. This is a small wording update for a future docs PR.

### Manual checks still to do

- [ ] Print or save a quote as PDF on a real iPhone (Safari), a real Android phone (Chrome) and a desktop browser. Confirm it fits on one page and shows no costs or profit.
- [ ] Print the blank quote template on a real printer or to PDF.
- [ ] In Search Console, look at the sitemap status and Pages report every week or two.
- [ ] In Cloudflare, confirm which analytics entry receives the visits, and investigate the second entry before touching it.

---

## F. Future plan, in priority order

1. **Finish the remaining manual launch checks** (listed above).
2. **Start outreach to real UK builders and small contractors online**, for example in UK trade forums, builders' Facebook groups, relevant Reddit communities and local business groups. Follow each community's rules on self-promotion.
3. **Ask potential users to test** the calculator and the quote template on a real job.
4. **Collect feedback** and write it down: what confused people, what was missing, and what they actually need.
5. **Prioritise improvements based on repeated feedback**, not guesses. Change something when several people raise it.
6. **Monitor Search Console and analytics periodically**, every week or two, not daily.
7. **Explore monetisation only after there's evidence of demand**, such as regular returning users or people asking for more.

The 30-day version of this plan is in [`NEXT_STEPS.md`](NEXT_STEPS.md).

---

## G. Safe working rules for the next AI assistant

1. **Inspect first.**
   - Run `git status` and `git log`, and make sure you're up to date with `main` before editing.
   - Read `HANDOVER.md` and `README.md` first.
2. **Use one branch and one small, focused pull request per task.** Never commit straight to `main`. **Never merge.** The owner reviews and merges.
3. **Don't change these unless the task genuinely requires it:**
   - calculator logic or pricing formulas
   - what the customer quote shows (quote privacy)
   - the analytics snippet or privacy wording
   - SEO metadata (titles, descriptions, canonicals, sitemap)
   - hosting or deployment
4. **Never claim tests or browser checks passed unless you actually ran them.** Say exactly what you ran and what you couldn't check.
5. **After any change:**
   - run `npm test`
   - check the changed pages at phone and desktop widths where possible
   - for calculator or quote changes, check the printed quote
6. **Avoid:** redesigns nobody asked for, extra pages without a reason, monetisation features before there's demand, new dependencies, build tools, frameworks, backends and paid services.
7. **No VAT or tax calculations, and no legal, tax, financial or regulatory claims.** Never invent search volumes, rankings, traffic or revenue figures.
8. **Explain every change in plain, beginner-friendly language:**
   - what changed
   - which files
   - how it was tested
   - what the owner needs to check
9. **Never commit secrets, API keys or credentials.** The analytics token in the pages is public by design. Don't add any others.
10. **Don't delete or recreate external resources** without the owner's explicit approval. That includes Cloudflare entries, the QuoteRepair Worker, the Search Console property and the Google verification file.
