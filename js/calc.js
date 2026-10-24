// ContractorQuote calculation engine.
// Pure functions only: no DOM, no storage. All money is handled in whole pence
// (integers) so that floating-point errors cannot creep into totals.
// Percentages are plain numbers, e.g. 20 means 20%.

export const LIMITS = {
  maxMoneyPence: 1000000000, // £10,000,000
  maxHours: 2000,
  maxBurdenPct: 100,
  maxOverheadPct: 100,
  maxMarginPct: 90,
  highMarginWarnPct: 50,
  minValidityDays: 1,
  maxValidityDays: 365,
};

// Field definitions used by validateCostInputs.
// kind: "money" (pounds -> pence), "hours", or "percent".
export const FIELDS = {
  hours: { kind: "hours", label: "Labour hours", max: LIMITS.maxHours },
  rate: { kind: "money", label: "Hourly rate", max: LIMITS.maxMoneyPence },
  burdenPct: { kind: "percent", label: "Labour burden", max: LIMITS.maxBurdenPct },
  materials: { kind: "money", label: "Materials", max: LIMITS.maxMoneyPence },
  subcontractors: { kind: "money", label: "Subcontractors", max: LIMITS.maxMoneyPence },
  extras: { kind: "money", label: "Other job costs", max: LIMITS.maxMoneyPence },
  overheadPct: { kind: "percent", label: "Overhead", max: LIMITS.maxOverheadPct },
  marginPct: { kind: "percent", label: "Target profit margin", max: LIMITS.maxMarginPct },
};

/**
 * Parse a number typed by a person. Accepts "1,250.50", "£1250.5", " 12 ", "".
 * Empty input counts as 0. Returns { ok, value, error }.
 * value is a Number with at most 2 decimal places; it is never negative.
 */
export function parseNumber(raw) {
  const text = String(raw ?? "").trim().replace(/[£,\s]/g, "").replace(/%$/, "");
  if (text === "") return { ok: true, value: 0 };
  if (text.startsWith("-")) return { ok: false, error: "Enter 0 or more." };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return { ok: false, error: "Enter a number, e.g. 1250 or 1250.50." };
  const decimals = text.includes(".") ? text.split(".")[1].length : 0;
  if (decimals > 2) return { ok: false, error: "Use no more than 2 decimal places." };
  return { ok: true, value: Number(text) };
}

/** Convert a pounds value with ≤2 decimals to integer pence without float drift. */
export function poundsToPence(pounds) {
  // The exponent trick avoids e.g. 1.005 * 100 = 100.49999...
  return Math.round(Number(`${pounds}e2`));
}

/**
 * Validate raw form values (strings) for the cost and pricing step.
 * Returns { values, errors, ok } where values are pence for money fields and
 * plain numbers for hours/percent. errors maps field name -> message.
 */
export function validateCostInputs(raw) {
  const values = {};
  const errors = {};
  for (const [name, def] of Object.entries(FIELDS)) {
    const parsed = parseNumber(raw?.[name]);
    if (!parsed.ok) {
      errors[name] = parsed.error;
      continue;
    }
    if (def.kind === "money") {
      const pence = poundsToPence(parsed.value);
      if (pence > def.max) {
        errors[name] = "That amount looks too large (maximum £10,000,000).";
        continue;
      }
      values[name] = pence;
    } else {
      if (parsed.value > def.max) {
        errors[name] =
          def.kind === "hours"
            ? `Enter no more than ${def.max} hours.`
            : `Enter a percentage from 0 to ${def.max}.`;
        continue;
      }
      values[name] = parsed.value;
    }
  }
  return { values, errors, ok: Object.keys(errors).length === 0 };
}

/**
 * Core pricing calculation.
 * inputs: { hours, rate (pence), burdenPct, materials (pence), subcontractors (pence),
 *           extras (pence), overheadPct, marginPct }
 *
 *   Labour       = hours × rate
 *   Burden       = Labour × burden%
 *   Direct cost  = Labour + Burden + Materials + Subcontractors + Extras
 *   Overhead     = Direct cost × overhead%
 *   Total cost   = Direct cost + Overhead
 *   Price        = Total cost ÷ (1 − margin%)
 *   Profit       = Price − Total cost
 *   Margin %     = Profit ÷ Price
 *   Markup %     = Profit ÷ Total cost
 */
export function calculateJob(inputs) {
  const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  const hours = n(inputs.hours);
  const rate = n(inputs.rate);
  const burdenPct = n(inputs.burdenPct);
  const materials = n(inputs.materials);
  const subcontractors = n(inputs.subcontractors);
  const extras = n(inputs.extras);
  const overheadPct = n(inputs.overheadPct);
  const marginPct = n(inputs.marginPct);

  if (marginPct >= 100) {
    throw new RangeError("Margin must be below 100%: the price formula has no answer at 100% or more.");
  }

  const labour = Math.round(hours * rate);
  const burden = Math.round((labour * burdenPct) / 100);
  const labourTotal = labour + burden;
  const directCost = labourTotal + materials + subcontractors + extras;
  const overhead = Math.round((directCost * overheadPct) / 100);
  const totalCost = directCost + overhead;
  const price = Math.round((totalCost * 100) / (100 - marginPct));
  const profit = price - totalCost;

  return {
    labour,
    burden,
    labourTotal,
    materials,
    subcontractors,
    extras,
    directCost,
    overhead,
    totalCost,
    price,
    profit,
    // Actual figures after rounding to the penny.
    marginPct: price > 0 ? (profit / price) * 100 : 0,
    markupPct: totalCost > 0 ? (profit / totalCost) * 100 : 0,
  };
}

/** Markup % that gives the same price as a margin %. markup = m ÷ (1 − m). */
export function marginToMarkup(marginPct) {
  if (marginPct >= 100) return Infinity;
  return (marginPct / (100 - marginPct)) * 100;
}

/** Margin % that a given markup % actually produces. margin = k ÷ (1 + k). */
export function markupToMargin(markupPct) {
  return (markupPct / (100 + markupPct)) * 100;
}

/** Warnings that should not block a quote but deserve a second look. */
export function pricingWarnings(values, result) {
  const warnings = [];
  if (result.totalCost <= 0) return warnings;
  if (values.marginPct === 0) warnings.push("A 0% margin means this job makes no profit.");
  if (values.marginPct > LIMITS.highMarginWarnPct)
    warnings.push(`A margin above ${LIMITS.highMarginWarnPct}% is unusually high. Please double-check it.`);
  if (values.hours > 0 && values.rate === 0) warnings.push("You entered labour hours but no hourly rate.");
  if (values.rate > 0 && values.hours === 0) warnings.push("You entered an hourly rate but no labour hours.");
  return warnings;
}

/**
 * Customer-facing quote lines. Overhead and profit are spread across the
 * categories in proportion to their direct cost, so internal figures never
 * appear on the quote. Lines always add up exactly to the price: any rounding
 * remainder is added to the largest line.
 */
export function customerLines(result) {
  const categories = [
    { key: "labour", label: "Labour", cost: result.labourTotal },
    { key: "materials", label: "Materials", cost: result.materials },
    { key: "subcontractors", label: "Specialist / subcontracted work", cost: result.subcontractors },
    { key: "extras", label: "Other job costs", cost: result.extras },
  ].filter((c) => c.cost > 0);

  if (result.directCost <= 0 || categories.length === 0) return [];

  const lines = categories.map((c) => ({
    key: c.key,
    label: c.label,
    amount: Math.round((c.cost * result.price) / result.directCost),
  }));
  const remainder = result.price - lines.reduce((sum, l) => sum + l.amount, 0);
  if (remainder !== 0) {
    let largest = lines[0];
    for (const l of lines) if (l.amount > largest.amount) largest = l;
    largest.amount += remainder;
  }
  return lines;
}

/** Validate quote-detail fields. Returns { ok, errors }. */
export function validateQuoteDetails(details) {
  const errors = {};
  if (!String(details?.customerName ?? "").trim()) errors.customerName = "Enter the customer's name.";
  if (!String(details?.jobDescription ?? "").trim()) errors.jobDescription = "Describe the job.";
  const days = parseNumber(details?.validityDays);
  if (
    !days.ok ||
    !Number.isInteger(days.value) ||
    days.value < LIMITS.minValidityDays ||
    days.value > LIMITS.maxValidityDays
  ) {
    errors.validityDays = `Enter a whole number of days from ${LIMITS.minValidityDays} to ${LIMITS.maxValidityDays}.`;
  }
  if (!isIsoDate(details?.quoteDate)) errors.quoteDate = "Enter a valid date.";
  const email = String(details?.customerEmail ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.customerEmail = "Check the email address.";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Add whole days to an ISO date (YYYY-MM-DD). Works in UTC so DST cannot shift it. */
export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** e.g. makeQuoteNumber("2026-10-24", 1) -> "CQ-20261024-01" */
export function makeQuoteNumber(isoDate, sequence) {
  return `CQ-${isoDate.replace(/-/g, "")}-${String(sequence).padStart(2, "0")}`;
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export function formatPence(pence) {
  return gbp.format(pence / 100);
}

export function formatPercent(pct) {
  if (!Number.isFinite(pct)) return "–";
  return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
}

/** UK display date, e.g. "24 October 2026". */
export function formatDate(isoDate) {
  if (!isIsoDate(isoDate)) return "";
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
