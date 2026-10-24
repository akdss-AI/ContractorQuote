// The true cost of labour guide: its worked example must add up, its labour
// burden must give the job figures the calculator produces, and it must link
// to the calculator, quote template and pricing guides.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCostInputs, calculateJob, formatPence } from "../js/calc.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "guides/true-cost-of-labour.html"), "utf8");

test("worked example adds up", () => {
  const yearlyCost = 52 * 40 * 20 + 5000 + 600 + 700;
  const chargeable = (52 - 6) * 40 * 0.85;
  assert.equal(yearlyCost, 47900);
  assert.equal(chargeable, 1564);
  assert.ok(html.includes("£47,900</td>"));
  assert.ok(html.includes("<td class=\"num\">1,564</td>"));
  assert.ok(html.includes(`= £${(yearlyCost / chargeable).toFixed(2)} per chargeable hour`));
  assert.equal(Math.round((yearlyCost / (chargeable * 20) - 1) * 100), 53);
});

test("40-hour job figures match the calculator", () => {
  const { values, ok } = validateCostInputs({
    hours: "40", rate: "20", burdenPct: "53", materials: "0",
    subcontractors: "0", extras: "0", overheadPct: "0", marginPct: "0",
  });
  assert.ok(ok);
  const result = calculateJob(values);
  assert.ok(html.includes(`<td class="num">${formatPence(result.labour)}</td>`));
  assert.ok(html.includes(`<td class="num">${formatPence(result.burden)}</td>`));
  assert.ok(html.includes(`<td class="num">${formatPence(result.labourTotal)}</td>`));
});

test("links to the calculator, quote template and pricing guides", () => {
  const article = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
  for (const href of ["../calculator.html", "../builder-quote-template.html", "how-to-price-a-building-job.html", "markup-vs-margin.html"]) {
    assert.ok(article.includes(`href="${href}`), href);
  }
});

test("the pricing guide links to this guide", () => {
  const pricing = readFileSync(join(ROOT, "guides/how-to-price-a-building-job.html"), "utf8");
  assert.match(pricing, /href="true-cost-of-labour.html"/);
});
