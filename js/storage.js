// Browser storage for ContractorQuote. Everything stays in this browser's
// localStorage; nothing is sent anywhere. Every access is wrapped so the app
// keeps working when storage is blocked (private browsing, disabled cookies,
// full quota) or holds corrupt data.

export const KEYS = {
  draft: "contractorquote:draft:v1",
  business: "contractorquote:business:v1",
  sequence: "contractorquote:sequence:v1",
};

export const COST_FIELDS = ["hours", "rate", "burdenPct", "materials", "subcontractors", "extras", "overheadPct", "marginPct"];
export const QUOTE_FIELDS = [
  "quoteNumber", "quoteDate", "validityDays", "customerName", "customerAddress", "customerEmail",
  "customerPhone", "jobTitle", "jobDescription", "exclusions", "paymentTerms", "notes",
];
export const BUSINESS_FIELDS = ["businessName", "contactName", "businessPhone", "businessEmail", "businessAddress"];

/** Returns window.localStorage if it can actually be written to, otherwise null. */
export function detectLocalStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = "contractorquote:probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Keep only known fields, as strings. Anything else is dropped. */
export function pickStrings(source, fields) {
  const out = {};
  for (const f of fields) {
    const v = source?.[f];
    out[f] = typeof v === "string" || typeof v === "number" ? String(v) : "";
  }
  return out;
}

/**
 * createStore(backend) — backend is any object with getItem/setItem/removeItem,
 * or null when storage is unavailable.
 * load() returns { status, value } where status is "ok", "empty", "corrupt" or "unavailable".
 */
export function createStore(backend = detectLocalStorage()) {
  const available = backend !== null;

  function loadJson(key) {
    if (!available) return { status: "unavailable", value: null };
    let text;
    try {
      text = backend.getItem(key);
    } catch {
      return { status: "unavailable", value: null };
    }
    if (text === null || text === undefined) return { status: "empty", value: null };
    try {
      const value = JSON.parse(text);
      if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("bad shape");
      return { status: "ok", value };
    } catch {
      try { backend.removeItem(key); } catch { /* ignore */ }
      return { status: "corrupt", value: null };
    }
  }

  function saveJson(key, value) {
    if (!available) return false;
    try {
      backend.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false; // e.g. QuotaExceededError
    }
  }

  return {
    available,

    loadDraft() {
      const r = loadJson(KEYS.draft);
      if (r.status !== "ok") return r;
      return {
        status: "ok",
        value: { costs: pickStrings(r.value.costs, COST_FIELDS), quote: pickStrings(r.value.quote, QUOTE_FIELDS) },
      };
    },

    saveDraft(draft) {
      return saveJson(KEYS.draft, {
        version: 1,
        savedAt: new Date().toISOString(),
        costs: pickStrings(draft.costs, COST_FIELDS),
        quote: pickStrings(draft.quote, QUOTE_FIELDS),
      });
    },

    clearDraft() {
      if (!available) return false;
      try { backend.removeItem(KEYS.draft); return true; } catch { return false; }
    },

    loadBusiness() {
      const r = loadJson(KEYS.business);
      if (r.status !== "ok") return r;
      return { status: "ok", value: pickStrings(r.value, BUSINESS_FIELDS) };
    },

    saveBusiness(details) {
      return saveJson(KEYS.business, pickStrings(details, BUSINESS_FIELDS));
    },

    /** Next quote sequence number for the given date (restarts at 1 each day). */
    nextSequence(isoDate) {
      const r = loadJson(KEYS.sequence);
      const last = r.status === "ok" && r.value.date === isoDate && Number.isInteger(r.value.n) ? r.value.n : 0;
      const n = last + 1;
      saveJson(KEYS.sequence, { date: isoDate, n });
      return n;
    },
  };
}
