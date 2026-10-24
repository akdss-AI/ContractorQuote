// Static SEO checks: sitemap URLs point at real pages, each indexable page
// has a unique title and description, a canonical matching its own URL, valid
// JSON-LD, and relative links that resolve to files in the repository.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://akdss-ai.github.io/ContractorQuote/";
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const sitemapUrls = [...read("sitemap.xml").matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
const pathOf = (url) => url.slice(BASE.length) || "index.html";
const pages = sitemapUrls.map(pathOf);

const first = (html, re) => (html.match(re) || [])[1];

test("sitemap lists only real files under the project path", () => {
  assert.ok(sitemapUrls.length > 0);
  for (const url of sitemapUrls) {
    assert.ok(url.startsWith(BASE), `${url} is outside ${BASE}`);
    assert.ok(existsSync(join(ROOT, pathOf(url))), `${url} has no file`);
  }
});

test("every sitemap page is indexable with a self-referencing canonical", () => {
  for (const p of pages) {
    const html = read(p);
    assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/, `${p} is noindex`);
    const canonical = first(html, /<link rel="canonical" href="([^"]+)"/);
    assert.equal(canonical, p === "index.html" ? BASE : BASE + p, `${p} canonical`);
  }
});

test("titles and descriptions are present and unique", () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const p of pages) {
    const html = read(p);
    const title = first(html, /<title>([^<]+)<\/title>/);
    const description = first(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(title, `${p} title`);
    assert.ok(description, `${p} description`);
    assert.ok(!titles.has(title), `duplicate title ${title}`);
    assert.ok(!descriptions.has(description), `duplicate description on ${p}`);
    titles.add(title);
    descriptions.add(description);
  }
});

test("JSON-LD blocks parse", () => {
  for (const p of pages) {
    for (const m of read(p).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(m[1]), `${p} JSON-LD`);
    }
  }
});

test("relative links and absolute site links resolve to files", () => {
  for (const p of [...pages, "404.html"]) {
    for (const [, url] of read(p).matchAll(/(?:href|src)="([^"#]+)/g)) {
      if (url.startsWith(BASE)) {
        assert.ok(existsSync(join(ROOT, pathOf(url))), `${p} links to missing ${url}`);
      } else if (!/^[a-z]+:/.test(url)) {
        assert.ok(existsSync(join(ROOT, normalize(join(dirname(p), url)))), `${p} links to missing ${url}`);
      }
    }
  }
});
