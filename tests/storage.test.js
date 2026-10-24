import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, KEYS } from "../js/storage.js";

function memoryBackend(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test("round-trips a draft and drops unknown fields", () => {
  const store = createStore(memoryBackend());
  assert.equal(store.loadDraft().status, "empty");
  assert.equal(store.saveDraft({ costs: { hours: "8", evil: "x" }, quote: { customerName: "Ann" } }), true);
  const r = store.loadDraft();
  assert.equal(r.status, "ok");
  assert.equal(r.value.costs.hours, "8");
  assert.equal(r.value.costs.evil, undefined);
  assert.equal(r.value.costs.rate, "");
  assert.equal(r.value.quote.customerName, "Ann");
});

test("corrupt JSON is reported and removed", () => {
  const backend = memoryBackend({ [KEYS.draft]: "{not json" });
  const store = createStore(backend);
  assert.equal(store.loadDraft().status, "corrupt");
  assert.equal(KEYS.draft in backend.data, false);
  assert.equal(createStore(memoryBackend({ [KEYS.draft]: "[1,2]" })).loadDraft().status, "corrupt");
  assert.equal(createStore(memoryBackend({ [KEYS.business]: "42" })).loadBusiness().status, "corrupt");
});

test("unavailable storage never throws", () => {
  const store = createStore(null);
  assert.equal(store.available, false);
  assert.equal(store.loadDraft().status, "unavailable");
  assert.equal(store.saveDraft({ costs: {}, quote: {} }), false);
  assert.equal(store.clearDraft(), false);
  assert.equal(store.nextSequence("2026-10-24"), 1);
});

test("storage that throws on every call is handled", () => {
  const boom = () => { throw new Error("SecurityError"); };
  const store = createStore({ getItem: boom, setItem: boom, removeItem: boom });
  assert.equal(store.loadDraft().status, "unavailable");
  assert.equal(store.saveBusiness({ businessName: "X" }), false);
  assert.equal(store.clearDraft(), false);
});

test("quota errors on save return false", () => {
  const backend = memoryBackend();
  backend.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(createStore(backend).saveDraft({ costs: {}, quote: {} }), false);
});

test("business details round-trip", () => {
  const store = createStore(memoryBackend());
  store.saveBusiness({ businessName: "Smith Building", businessPhone: "07700 900000" });
  const r = store.loadBusiness();
  assert.equal(r.value.businessName, "Smith Building");
  assert.equal(r.value.businessEmail, "");
});

test("sequence increments per day and restarts on a new day", () => {
  const store = createStore(memoryBackend());
  assert.equal(store.nextSequence("2026-10-24"), 1);
  assert.equal(store.nextSequence("2026-10-24"), 2);
  assert.equal(store.nextSequence("2026-10-25"), 1);
});
