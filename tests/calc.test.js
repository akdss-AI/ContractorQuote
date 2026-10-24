import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseNumber,
  poundsToPence,
  validateCostInputs,
  calculateJob,
  marginToMarkup,
  markupToMargin,
  pricingWarnings,
  customerLines,
  validateQuoteDetails,
  addDays,
  isIsoDate,
  makeQuoteNumber,
  formatPence,
  formatPercent,
  formatDate,
} from "../js/calc.js";

const approx = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected}, got ${actual}`);

const job = (over = {}) =>
  calculateJob({
    hours: 0, rate: 0, burdenPct: 0, materials: 0, subcontractors: 0, extras: 0,
    overheadPct: 0, marginPct: 0, ...over,
  });

test("parseNumber accepts common UK input styles", () => {
  assert.deepEqual(parseNumber(""), { ok: true, value: 0 });
  assert.deepEqual(parseNumber("   "), { ok: true, value: 0 });
  assert.deepEqual(parseNumber(undefined), { ok: true, value: 0 });
  assert.equal(parseNumber("£1,250.50").value, 1250.5);
  assert.equal(parseNumber(" 12 ").value, 12);
  assert.equal(parseNumber("20%").value, 20);
  assert.equal(parseNumber(".5").value, 0.5);
  assert.equal(parseNumber("7.").value, 7);
});

test("parseNumber rejects negatives, text and too many decimals", () => {
  assert.equal(parseNumber("-5").ok, false);
  assert.equal(parseNumber("abc").ok, false);
  assert.equal(parseNumber("12abc").ok, false);
  assert.equal(parseNumber("1.2.3").ok, false);
  assert.equal(parseNumber("1e5").ok, false);
  assert.equal(parseNumber("1.005").ok, false);
});

test("poundsToPence avoids floating-point drift", () => {
  assert.equal(poundsToPence(1.005), 101); // 1.005 * 100 would give 100.4999…
  assert.equal(poundsToPence(0.1 + 0.2), 30);
  assert.equal(poundsToPence(19.99), 1999);
  assert.equal(poundsToPence(1250.5), 125050);
});

test("worked example: £1,000 cost at 20% margin = £1,250 price, 25% markup", () => {
  const r = job({ materials: 100000, marginPct: 20 });
  assert.equal(r.totalCost, 100000);
  assert.equal(r.price, 125000);
  assert.equal(r.profit, 25000);
  approx(r.marginPct, 20);
  approx(r.markupPct, 25);
});

test("20% markup is NOT 20% margin", () => {
  approx(marginToMarkup(20), 25);
  approx(markupToMargin(20), 16.666666666666668);
  approx(markupToMargin(marginToMarkup(37.5)), 37.5);
  assert.equal(marginToMarkup(100), Infinity);
});

test("full calculation with every input", () => {
  // 40h × £30 = £1,200 labour; 20% burden = £240; direct = 1440 + 800 + 500 + 60 = £2,800
  // overhead 10% = £280; total £3,080; 25% margin -> £4,106.67
  const r = job({
    hours: 40, rate: 3000, burdenPct: 20, materials: 80000, subcontractors: 50000,
    extras: 6000, overheadPct: 10, marginPct: 25,
  });
  assert.equal(r.labour, 120000);
  assert.equal(r.burden, 24000);
  assert.equal(r.labourTotal, 144000);
  assert.equal(r.directCost, 280000);
  assert.equal(r.overhead, 28000);
  assert.equal(r.totalCost, 308000);
  assert.equal(r.price, 410667);
  assert.equal(r.profit, 102667);
  approx(r.marginPct, 25, 0.001);
  approx(r.markupPct, 33.333, 0.001);
});

test("fractional hours and rates round to the penny", () => {
  const r = job({ hours: 7.5, rate: 2333 }); // 7.5 × £23.33 = £174.975
  assert.equal(r.labour, 17498);
});

test("all-zero inputs give zero everywhere and no NaN", () => {
  const r = job();
  for (const v of Object.values(r)) assert.equal(v, 0);
});

test("0% margin: price equals cost", () => {
  const r = job({ materials: 50000, marginPct: 0 });
  assert.equal(r.price, 50000);
  assert.equal(r.profit, 0);
  assert.equal(r.markupPct, 0);
});

test("high margins: 89.9% and 90% stay finite", () => {
  const a = job({ materials: 100000, marginPct: 89.9 });
  assert.equal(a.price, 990099); // 1000 / 0.101
  const b = job({ materials: 100000, marginPct: 90 });
  assert.equal(b.price, 1000000);
  approx(b.markupPct, 900);
});

test("margin of 100% or more is refused", () => {
  assert.throws(() => job({ materials: 100, marginPct: 100 }), RangeError);
  assert.throws(() => job({ materials: 100, marginPct: 150 }), RangeError);
});

test("burden and overhead at 0% and 100%", () => {
  const zero = job({ hours: 10, rate: 2000, burdenPct: 0, overheadPct: 0 });
  assert.equal(zero.totalCost, 20000);
  const full = job({ hours: 10, rate: 2000, burdenPct: 100, overheadPct: 100 });
  assert.equal(full.labourTotal, 40000);
  assert.equal(full.overhead, 40000);
  assert.equal(full.totalCost, 80000);
});

test("burden applies to labour only", () => {
  const r = job({ hours: 10, rate: 1000, burdenPct: 50, materials: 100000 });
  assert.equal(r.burden, 5000);
  assert.equal(r.directCost, 115000);
});

test("negative or invalid numbers are treated as zero by the engine", () => {
  const r = calculateJob({ hours: -5, rate: NaN, materials: -100, marginPct: -10 });
  assert.equal(r.totalCost, 0);
  assert.equal(r.price, 0);
});

test("validateCostInputs converts and range-checks", () => {
  const ok = validateCostInputs({
    hours: "37.5", rate: "£25", burdenPct: "15", materials: "1,200.50",
    subcontractors: "", extras: "0", overheadPct: "12.5", marginPct: "20",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.values.rate, 2500);
  assert.equal(ok.values.materials, 120050);
  assert.equal(ok.values.subcontractors, 0);
  assert.equal(ok.values.hours, 37.5);

  const bad = validateCostInputs({
    hours: "2001", rate: "-1", burdenPct: "101", materials: "10000000.01",
    overheadPct: "abc", marginPct: "90.01",
  });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(),
    ["burdenPct", "hours", "marginPct", "materials", "overheadPct", "rate"]);

  const edge = validateCostInputs({ hours: "2000", materials: "10000000", marginPct: "90" });
  assert.equal(edge.ok, true);
});

test("pricingWarnings flags zero and high margins", () => {
  const r = job({ materials: 1000 });
  assert.equal(pricingWarnings({ marginPct: 0, hours: 0, rate: 0 }, r).length, 1);
  assert.equal(pricingWarnings({ marginPct: 60, hours: 0, rate: 0 }, r).length, 1);
  assert.equal(pricingWarnings({ marginPct: 20, hours: 0, rate: 0 }, r).length, 0);
  assert.equal(pricingWarnings({ marginPct: 20, hours: 5, rate: 0 }, r).length, 1);
  assert.equal(pricingWarnings({ marginPct: 0, hours: 0, rate: 0 }, job()).length, 0);
});

test("customerLines sum exactly to the price and hide internal figures", () => {
  const r = job({
    hours: 40, rate: 3000, burdenPct: 20, materials: 80000, subcontractors: 50000,
    extras: 6000, overheadPct: 10, marginPct: 25,
  });
  const lines = customerLines(r);
  assert.equal(lines.reduce((s, l) => s + l.amount, 0), r.price);
  assert.deepEqual(lines.map((l) => l.key), ["labour", "materials", "subcontractors", "extras"]);
  for (const l of lines) assert.deepEqual(Object.keys(l).sort(), ["amount", "key", "label"]);
});

test("customerLines handles awkward rounding across many seeds", () => {
  for (let i = 1; i < 500; i++) {
    const r = job({
      hours: (i % 13) + 0.25, rate: 1000 + i * 7, burdenPct: i % 30, materials: i * 333,
      subcontractors: (i * 77) % 5000, extras: i % 3 === 0 ? 101 : 0,
      overheadPct: (i % 17) + 0.5, marginPct: (i % 89) + 0.33,
    });
    const lines = customerLines(r);
    assert.equal(lines.reduce((s, l) => s + l.amount, 0), r.price, `seed ${i}`);
    for (const l of lines) assert.ok(l.amount >= 0, `seed ${i}`);
  }
});

test("customerLines omits empty categories and returns [] for zero cost", () => {
  assert.deepEqual(customerLines(job()), []);
  const lines = customerLines(job({ materials: 1000, marginPct: 20 }));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].amount, 1250);
});

test("validateQuoteDetails", () => {
  const good = { customerName: "A Smith", jobDescription: "Rewire kitchen", validityDays: "30", quoteDate: "2026-10-24" };
  assert.equal(validateQuoteDetails(good).ok, true);
  assert.equal(validateQuoteDetails({ ...good, customerName: "  " }).errors.customerName !== undefined, true);
  assert.ok(validateQuoteDetails({ ...good, jobDescription: "" }).errors.jobDescription);
  for (const d of ["0", "366", "1.5", "abc"]) assert.ok(validateQuoteDetails({ ...good, validityDays: d }).errors.validityDays, d);
  assert.equal(validateQuoteDetails({ ...good, validityDays: "365" }).ok, true);
  assert.ok(validateQuoteDetails({ ...good, quoteDate: "2026-02-30" }).errors.quoteDate);
  assert.ok(validateQuoteDetails({ ...good, customerEmail: "bad@" }).errors.customerEmail);
  assert.equal(validateQuoteDetails({ ...good, customerEmail: "a@b.co.uk" }).ok, true);
});

test("dates and quote numbers", () => {
  assert.equal(addDays("2026-10-24", 30), "2026-11-23");
  assert.equal(addDays("2026-03-20", 14), "2026-04-03"); // across UK clock change
  assert.equal(addDays("2028-02-28", 1), "2028-02-29"); // leap year
  assert.equal(isIsoDate("2026-13-01"), false);
  assert.equal(makeQuoteNumber("2026-10-24", 1), "CQ-20261024-01");
  assert.equal(makeQuoteNumber("2026-10-24", 123), "CQ-20261024-123");
  assert.equal(formatDate("2026-10-24"), "24 October 2026");
});

test("formatting", () => {
  assert.equal(formatPence(410667), "£4,106.67");
  assert.equal(formatPence(0), "£0.00");
  assert.equal(formatPercent(25), "25%");
  assert.equal(formatPercent(16.6666), "16.7%");
  assert.equal(formatPercent(Infinity), "–");
});
