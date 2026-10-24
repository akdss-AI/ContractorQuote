// ContractorQuote calculator page: connects the form to the calculation
// engine, storage and quote preview. User text is only ever written with
// textContent, never as HTML.

import {
  validateCostInputs,
  calculateJob,
  pricingWarnings,
  customerLines,
  validateQuoteDetails,
  marginToMarkup,
  markupToMargin,
  addDays,
  isIsoDate,
  makeQuoteNumber,
  formatPence,
  formatPercent,
  formatDate,
  parseNumber,
} from "./calc.js";
import { createStore, COST_FIELDS, QUOTE_FIELDS, BUSINESS_FIELDS } from "./storage.js";

const DEFAULT_PAYMENT_TERMS = "Payment due within 14 days of completion.";
const DEFAULT_VALIDITY_DAYS = "30";

const $ = (id) => document.getElementById(id);
const form = $("cq-form");
const store = createStore();

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function freshQuote() {
  const date = todayIso();
  const quote = Object.fromEntries(QUOTE_FIELDS.map((f) => [f, ""]));
  quote.quoteDate = date;
  quote.quoteNumber = makeQuoteNumber(date, store.nextSequence(date));
  quote.validityDays = DEFAULT_VALIDITY_DAYS;
  quote.paymentTerms = DEFAULT_PAYMENT_TERMS;
  return quote;
}

// ---- reading and writing the form ----------------------------------------

function readGroup(fields) {
  const out = {};
  for (const f of fields) out[f] = form.elements[f]?.value ?? "";
  return out;
}

function writeGroup(values, fields) {
  for (const f of fields) if (form.elements[f]) form.elements[f].value = values?.[f] ?? "";
}

function readState() {
  return {
    costs: readGroup(COST_FIELDS),
    quote: readGroup(QUOTE_FIELDS),
    business: readGroup(BUSINESS_FIELDS),
  };
}

// ---- messages --------------------------------------------------------------

function showStorageBanner(message) {
  const el = $("storage-banner");
  el.textContent = message;
  el.hidden = !message;
}

let saveStatusTimer;
function showSaveStatus(text) {
  const el = $("save-status");
  el.textContent = text;
  clearTimeout(saveStatusTimer);
  if (text) saveStatusTimer = setTimeout(() => (el.textContent = ""), 2500);
}

function setFieldError(name, message) {
  const input = form.elements[name];
  const errorEl = $(`${name}-error`);
  if (!input) return;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  if (errorEl) errorEl.textContent = message || "";
}

// Only show "required" errors once a person has touched a field, so a blank
// form isn't covered in red.
const touched = new Set();

// ---- rendering -------------------------------------------------------------

function setText(id, text) {
  $(id).textContent = text;
}

function renderResults(costCheck, result) {
  const hasCosts = result && result.totalCost > 0;
  $("results-empty").hidden = hasCosts;
  $("results-body").hidden = !hasCosts;
  $("price-bar").hidden = !hasCosts;
  $("results-empty").textContent = costCheck.ok
    ? "Enter some costs to see a recommended price."
    : "Fix the highlighted fields to see a price.";
  if (!hasCosts) return;

  setText("r-labour", formatPence(result.labour));
  setText("r-burden", formatPence(result.burden));
  setText("r-materials", formatPence(result.materials));
  setText("r-subcontractors", formatPence(result.subcontractors));
  setText("r-extras", formatPence(result.extras));
  setText("r-direct", formatPence(result.directCost));
  setText("r-overhead", formatPence(result.overhead));
  setText("r-total", formatPence(result.totalCost));
  setText("r-price", formatPence(result.price));
  setText("r-profit", formatPence(result.profit));
  setText("r-margin", formatPercent(result.marginPct));
  setText("r-markup", formatPercent(result.markupPct));
  setText("pb-price", formatPence(result.price));
  setText("pb-profit", formatPence(result.profit));

  const m = costCheck.values.marginPct;
  if (m > 0) {
    // What would have happened if the same number were used as a markup instead.
    const markupPrice = Math.round((result.totalCost * (100 + m)) / 100);
    setText(
      "r-explain",
      `A ${formatPercent(m)} margin means adding ${formatPercent(marginToMarkup(m))} on top of your cost. ` +
        `If you added a ${formatPercent(m)} markup instead, you'd charge ${formatPence(markupPrice)} ` +
        `and your margin would only be ${formatPercent(markupToMargin(m))}.`
    );
  } else {
    setText("r-explain", "With no margin, the price only covers your costs.");
  }
}

function renderWarnings(costCheck, result) {
  const box = $("pricing-warnings");
  box.replaceChildren();
  if (!costCheck.ok || !result) return;
  for (const w of pricingWarnings(costCheck.values, result)) {
    const p = document.createElement("p");
    p.className = "banner banner-warn";
    p.textContent = w;
    box.append(p);
  }
}

function renderValidUntil(quote) {
  const days = parseNumber(quote.validityDays);
  const ok = isIsoDate(quote.quoteDate) && days.ok && Number.isInteger(days.value) && days.value >= 1 && days.value <= 365;
  const until = ok ? addDays(quote.quoteDate, days.value) : "";
  setText("valid-until", until ? formatDate(until) : "–");
  return until;
}

function fillOptional(id, text) {
  const el = $(id);
  el.textContent = text.trim();
  el.hidden = !text.trim();
}

function renderQuote(state, costCheck, result, quoteCheck, validUntil) {
  const blocked = [];
  if (!costCheck.ok) blocked.push("fix the highlighted cost fields");
  else if (!result || result.totalCost <= 0) blocked.push("enter the job costs in step 1");
  if (quoteCheck.errors.customerName) blocked.push("add the customer's name");
  if (quoteCheck.errors.jobDescription) blocked.push("describe the job");
  if (quoteCheck.errors.validityDays || quoteCheck.errors.quoteDate) blocked.push("check the quote date and validity");
  if (quoteCheck.errors.customerEmail) blocked.push("check the customer's email");

  const ready = blocked.length === 0;
  const msg = $("preview-blocked");
  msg.hidden = ready;
  msg.textContent = ready ? "" : `To preview your quote, ${blocked.join(", ")}.`;
  $("print-quote").disabled = !ready;
  $("quote-doc").hidden = !ready;
  document.body.classList.toggle("quote-ready", ready);
  if (!ready) return;

  const { quote, business } = state;
  fillOptional("q-businessName", business.businessName);
  fillOptional("q-contactName", business.contactName);
  fillOptional("q-businessAddress", business.businessAddress);
  fillOptional("q-businessPhone", business.businessPhone);
  fillOptional("q-businessEmail", business.businessEmail);

  setText("q-quoteNumber", quote.quoteNumber.trim() || "–");
  setText("q-quoteDate", formatDate(quote.quoteDate));
  setText("q-validUntil", formatDate(validUntil));

  fillOptional("q-customerName", quote.customerName);
  fillOptional("q-customerAddress", quote.customerAddress);
  fillOptional("q-customerPhone", quote.customerPhone);
  fillOptional("q-customerEmail", quote.customerEmail);

  setText("q-jobTitle", quote.jobTitle.trim() || "The job");
  setText("q-jobDescription", quote.jobDescription.trim());

  // Only customer-facing lines: overhead and profit are already spread across them.
  const tbody = $("q-lines");
  tbody.replaceChildren();
  for (const line of customerLines(result)) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = line.label;
    const td = document.createElement("td");
    td.className = "num";
    td.textContent = formatPence(line.amount);
    tr.append(th, td);
    tbody.append(tr);
  }
  setText("q-total", formatPence(result.price));

  for (const f of ["exclusions", "paymentTerms", "notes"]) {
    const text = quote[f].trim();
    $(`q-${f}`).textContent = text;
    $(`q-${f}-block`).hidden = !text;
  }
}

function update() {
  const state = readState();

  const costCheck = validateCostInputs(state.costs);
  for (const f of COST_FIELDS) setFieldError(f, costCheck.errors[f]);

  let result = null;
  if (costCheck.ok) result = calculateJob(costCheck.values);

  const quoteCheck = validateQuoteDetails(state.quote);
  for (const f of ["customerName", "jobDescription", "validityDays", "quoteDate", "customerEmail"]) {
    setFieldError(f, touched.has(f) ? quoteCheck.errors[f] : "");
  }

  const validUntil = renderValidUntil(state.quote);
  renderResults(costCheck, result);
  renderWarnings(costCheck, result);
  renderQuote(state, costCheck, result, quoteCheck, validUntil);
  return state;
}

// ---- saving ----------------------------------------------------------------

let saveTimer;
let saveFailedShown = false;
function scheduleSave() {
  if (!store.available) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

function saveNow() {
  clearTimeout(saveTimer);
  if (!store.available) return;
  const state = readState();
  const ok = store.saveDraft(state) && store.saveBusiness(state.business);
  if (ok) {
    showSaveStatus("Saved in this browser");
    if (saveFailedShown) showStorageBanner("");
    saveFailedShown = false;
  } else if (!saveFailedShown) {
    saveFailedShown = true;
    showStorageBanner("Your browser stopped us saving (storage may be full or blocked). The calculator still works, but this draft won't be kept if you close the page.");
  }
}

// ---- start-up --------------------------------------------------------------

function init() {
  const draft = store.loadDraft();
  const business = store.loadBusiness();

  if (!store.available) {
    showStorageBanner("Your browser is blocking storage (for example in a private window), so drafts won't be saved. The calculator still works normally.");
  } else if (draft.status === "corrupt" || business.status === "corrupt") {
    showStorageBanner("A saved draft couldn't be read, so it has been reset. Sorry about that.");
  }

  writeGroup(business.value, BUSINESS_FIELDS);
  if (draft.status === "ok") {
    writeGroup(draft.value.costs, COST_FIELDS);
    writeGroup(draft.value.quote, QUOTE_FIELDS);
    if (!draft.value.quote.quoteNumber) form.elements.quoteNumber.value = freshQuote().quoteNumber;
    if (!isIsoDate(draft.value.quote.quoteDate)) form.elements.quoteDate.value = todayIso();
  } else {
    writeGroup(freshQuote(), QUOTE_FIELDS);
  }

  form.addEventListener("input", () => {
    update();
    scheduleSave();
  });
  form.addEventListener("focusout", (e) => {
    if (e.target.name) {
      touched.add(e.target.name);
      update();
    }
  });
  form.addEventListener("submit", (e) => e.preventDefault());

  $("new-quote").addEventListener("click", () => {
    if (!window.confirm("Start a new quote? This clears the current costs and customer details. Your business details are kept.")) return;
    writeGroup({}, COST_FIELDS);
    writeGroup(freshQuote(), QUOTE_FIELDS);
    touched.clear();
    update();
    saveNow();
    $("hours").focus();
  });

  $("print-quote").addEventListener("click", () => {
    saveNow();
    window.print();
  });

  window.addEventListener("pagehide", saveNow);

  update();
}

init();
