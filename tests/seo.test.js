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

test("analytics snippet appears exactly once on every sitemap page and not on 404", () => {
  for (const p of pages) {
    const count = read(p).split("static.cloudflareinsights.com/beacon.min.js").length - 1;
    assert.equal(count, 1, `${p} analytics count`);
  }
  assert.doesNotMatch(read("404.html"), /cloudflareinsights/);
});

test("meta descriptions fit in a typical search snippet (160 characters)", () => {
  for (const p of pages) {
    const description = first(read(p), /<meta name="description" content="([^"]+)"/);
    assert.ok(description.length <= 160, `${p} description is ${description.length} characters`);
  }
});

test("main navigation links to the quote template on every content page", () => {
  for (const p of pages) {
    const nav = first(read(p), /<nav aria-label="Main">([\s\S]*?)<\/nav>/);
    assert.match(nav, /builder-quote-template\.html"[^>]*>Quote template<\/a>/, `${p} nav`);
  }
});

test("main navigation links to the labour cost guide once on every content page", () => {
  for (const p of pages) {
    const nav = first(read(p), /<nav aria-label="Main">([\s\S]*?)<\/nav>/);
    const links = nav.match(/true-cost-of-labour\.html"[^>]*>Labour cost<\/a>/g) || [];
    assert.equal(links.length, 1, `${p} nav`);
    assert.equal(/true-cost-of-labour\.html" aria-current="page"/.test(nav), p === "guides/true-cost-of-labour.html", `${p} aria-current`);
  }
});

test("links to guide sections point at headings that exist", () => {
  for (const p of [...pages, "404.html"]) {
    for (const [, file, id] of read(p).matchAll(/href="([^"#]*guides\/[^"#]+)#([^"]+)"/g)) {
      const target = read(normalize(join(dirname(p), file)));
      assert.match(target, new RegExp(`id="${id}"`), `${p} links to missing #${id}`);
    }
  }
});
