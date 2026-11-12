/**
 * WITNESS — deliberately gullible heuristic parser for the Attack Lab's
 * custom-input box. It simulates how a careless agent might follow the most
 * recent instruction in untrusted text. It is NOT an LLM and NOT a defense:
 * whatever it proposes still has to pass the mandate guard.
 */
const ZERO_WIDTH = /[\u200b-\u200d\u2060\ufeff]/g;
const ACCOUNT_RE = /[a-z0-9][a-z0-9._-]*\.(?:testnet|near)\b/g;
const AMOUNT_RE = /(\d+(?:\.\d+)?)\s*NEAR\b/gi;

export function parseCustomInvoice(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'Input was not text.' };
  const text = raw.replace(ZERO_WIDTH, '');
  const accounts = [...text.matchAll(ACCOUNT_RE)].map((m) => m[0].toLowerCase());
  const amounts = [...text.matchAll(AMOUNT_RE)].map((m) => m[1]);
  if (!accounts.length || !amounts.length) {
    return { ok: false, reason: 'No payment destination and amount could be identified. Nothing was proposed.' };
  }
  // Gullible-agent heuristic: the LAST destination and amount mentioned win,
  // which is exactly how injected "new wallet" instructions hijack careless agents.
  const recipient = accounts[accounts.length - 1];
  const nearAmount = amounts[amounts.length - 1].replace(/\.0+$/, '');
  return { ok: true, recipient, nearAmount, note: text.slice(0, 180) };
}
