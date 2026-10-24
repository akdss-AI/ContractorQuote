# ContractorQuote

A free, mobile-friendly pricing calculator and quote builder for UK sole-trader builders and subcontractors.

It's a static site with plain HTML, CSS and JavaScript. There are no dependencies, no build step, no backend and no login. Everything a user enters stays in their browser's `localStorage`.

## What's in the box

```
index.html                         Landing page
calculator.html                    Calculator, quote builder, preview and print
guides/markup-vs-margin.html       Educational guide
guides/how-to-price-a-building-job.html
privacy.html                       Data stays in the browser
404.html                           Not-found page (self-contained)
robots.txt, sitemap.xml
css/styles.css                     All screen styles
css/print.css                      Prints only the customer quote
js/calc.js                         Pure calculation engine (no DOM)
js/storage.js                      Safe localStorage wrapper
js/app.js                          Calculator page wiring
assets/favicon.svg, og-image.png
tests/*.test.js                    Unit tests (Node's built-in runner)
```

## Formulas

All money is calculated in whole pence.

```
Labour       = hours × rate
Burden       = Labour × burden%
Direct cost  = Labour + Burden + Materials + Subcontractors + Other
Overhead     = Direct cost × overhead%
Total cost   = Direct cost + Overhead
Price        = Total cost ÷ (1 − margin%)     margin 0–90%
Profit       = Price − Total cost
Margin %     = Profit ÷ Price
Markup %     = Profit ÷ Total cost
```

The printed quote shows customer lines (Labour, Materials, Specialist/subcontracted work, Other job costs). Overhead and profit are spread across these lines in proportion to their cost. Any rounding remainder goes to the largest line, so the lines always add up exactly to the total. Internal cost, overhead, margin and profit figures are never printed.

## Run locally

ES modules need a web server; opening the file directly with `file://` won't work.

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

You need Node 18 or newer. There's nothing to install.

```
npm test
```

## Hosting (GitHub Pages, free)

Live address once published: **https://akdss-ai.github.io/ContractorQuote/**

The website files live in the **repository root**, with `index.html` at the top level. No build step is needed.

1. In the repository go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and the folder to `/ (root)`, then click **Save**.
4. After a minute or two, the Pages settings show "Your site is live at …".

Notes:
- All page links are relative, so the site works under the `/ContractorQuote/` sub-path.
- `.nojekyll` tells GitHub to serve the files as they are, without running Jekyll.
- Canonical, Open Graph, sitemap and structured-data URLs use the full address above. If you move to a custom domain later, replace `https://akdss-ai.github.io/ContractorQuote` everywhere.
- `404.html` links use the full address because a missing page can be at any depth.
- Search engines only read `robots.txt` at a domain's root, so on a project site the file here is informational. Submit `sitemap.xml` in Google Search Console instead.

## Not included (by design)

- VAT or tax calculations, and any tax, legal or compliance advice.
- Accounts, a backend, analytics, or paid services.
