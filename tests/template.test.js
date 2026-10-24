// The quote template page: its worked example must match what the calculator
// produces for the homepage example, and it must print only the blank template.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCostInputs, calculateJob, customerLines, formatPence } from "../js/calc.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "builder-quote-template.html"), "utf8");

test("example quote lines and total match the calculator", () => {
  const { values, ok } = validateCostInputs({
    hours: "40", rate: "30", burdenPct: "20", materials: "800",
    subcontractors: "500", extras: "60", overheadPct: "10", marginPct: "25",
  });
  assert.ok(ok);
  const result = calculateJob(values);
  const example = html.slice(html.indexOf('aria-label="Example quote"'), html.indexOf('id="blank-template"'));
  for (const line of customerLines(result)) {
    assert.ok(example.includes(`<th scope="row">${line.label}</th><td class="num">${formatPence(line.amount)}</td>`), line.label);
  }
  assert.ok(example.includes(`<th scope="row">Quote total</th><td class="num">${formatPence(result.price)}</td>`));
});

test("page links its print stylesheet and print button", () => {
  assert.match(html, /<link rel="stylesheet" href="css\/template-print.css" media="print">/);
  assert.match(html, /id="print-template"/);
  assert.match(html, /<script type="module" src="js\/template.js"><\/script>/);
  assert.match(html, /class="template-section" id="blank-template"/);
});
