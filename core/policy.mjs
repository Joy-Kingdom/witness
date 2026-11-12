/**
 * WITNESS — deterministic local reference model.
 * Mirrors contract/witness.ts semantics for the offline Attack Lab.
 * THIS IS A SIMULATION. It is not blockchain enforcement and moves no funds.
 */
import { createHash } from 'node:crypto';

export const SUPPLIER = 'abc-supplier.testnet';
export const ATTACKER = 'attacker.testnet';
export const DEMO_INVOICE =
  'ABC Supplies — Invoice INV-2047 — Hardware supplies — Total due: 5 NEAR — Pay to: abc-supplier.testnet';

const YOCTO = 10n ** 24n;

export function hashInvoice(text) {
  return 'sha256:' + createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function toYocto(near) {
  if (typeof near !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,24})?$/.test(near)) throw new Error('BAD_AMOUNT_FORMAT');
  const [whole, frac = ''] = near.split('.');
  const n = BigInt(whole) * YOCTO + BigInt((frac + '0'.repeat(24)).slice(0, 24));
  return n.toString();
}

export function fromYocto(yocto) {
  const n = BigInt(yocto);
  const whole = n / YOCTO;
  const frac = (n % YOCTO).toString().padStart(24, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export class LocalVault {
  constructor(clock = () => Date.now()) {
    this.clock = clock;
    this.roles = { owner: 'owner.testnet', agent: 'agent.testnet' };
    this.mandates = {};
    this.proposals = {};
    this.events = [];
    this.available_yocto = '0';
    this.inflight_yocto = '0';
    this.next_id = 1;
  }
  log(type, payload = {}) {
    this.events.push({ seq: this.events.length + 1, at_ms: this.clock(), type, ...payload });
  }
  ownerOnly(who) { if (who !== this.roles.owner) throw new Error('UNAUTHORIZED_OWNER'); }
  agentOnly(who) { if (who !== this.roles.agent) throw new Error('UNAUTHORIZED_AGENT'); }
  fund({ who, amount_yocto }) {
    this.ownerOnly(who);
    this.available_yocto = (BigInt(this.available_yocto) + BigInt(amount_yocto)).toString();
    this.log('VAULT_FUNDED', { amount_yocto });
  }
  createMandate({ who, supplier, recipient, cap_yocto, invoice_hash, expires_at_ms }) {
    this.ownerOnly(who);
    const id = `M${this.next_id++}`;
    const m = { id, supplier, recipient, cap_yocto, invoice_hash, expires_at_ms, version: 1, revoked: false, consumed: false, status: 'ACTIVE' };
    this.mandates[id] = m;
    this.log('MANDATE_CREATED', { id, recipient, cap_yocto });
    return m;
  }
  reviseMandate({ who, id, recipient, cap_yocto, expires_at_ms }) {
    this.ownerOnly(who);
    const m = this.mandates[id]; if (!m) throw new Error('UNKNOWN_MANDATE');
    if (recipient !== undefined) m.recipient = recipient;
    if (cap_yocto !== undefined) m.cap_yocto = cap_yocto;
    if (expires_at_ms !== undefined) m.expires_at_ms = expires_at_ms;
    m.version++;
    this.log('MANDATE_REVISED', { id, version: m.version });
    return m;
  }
  revokeMandate({ who, id }) {
    this.ownerOnly(who);
    const m = this.mandates[id]; if (!m) throw new Error('UNKNOWN_MANDATE');
    m.revoked = true; m.version++;
    this.log('MANDATE_REVOKED', { id });
    return m;
  }
  propose({ who, mandate_id, recipient, amount_yocto, invoice_hash, note }) {
    this.agentOnly(who);
    const m = this.mandates[mandate_id]; if (!m) throw new Error('UNKNOWN_MANDATE');
    const id = `P${this.next_id++}`;
    const p = { id, mandate_id, recipient, amount_yocto, invoice_hash, mandate_version: m.version, status: 'PROPOSED', reasons: [], note: note || '' };
    this.proposals[id] = p;
    this.log('AGENT_PROPOSED', { id, mandate_id });
    return p;
  }
  checks(m, p) {
    const reasons = [];
    if (m.revoked) reasons.push('MANDATE_REVOKED');
    if (m.consumed) reasons.push('MANDATE_ALREADY_USED');
    if (this.clock() >= m.expires_at_ms) reasons.push('MANDATE_EXPIRED');
    if (m.version !== p.mandate_version) reasons.push('POLICY_VERSION_DRIFT');
    if (m.recipient !== p.recipient) reasons.push('RECIPIENT_MISMATCH');
    if (BigInt(p.amount_yocto) <= 0n) reasons.push('INVALID_AMOUNT');
    else if (BigInt(p.amount_yocto) > BigInt(m.cap_yocto)) reasons.push('AMOUNT_EXCEEDS_CAP');
    if (m.invoice_hash !== p.invoice_hash) reasons.push('INVOICE_REFERENCE_MISMATCH');
    if (m.id !== p.mandate_id) reasons.push('MANDATE_MISMATCH');
    if (BigInt(p.amount_yocto) > BigInt(this.available_yocto)) reasons.push('INSUFFICIENT_VAULT_BALANCE');
    return reasons;
  }
  assess(id) {
    const p = this.proposals[id]; if (!p) throw new Error('UNKNOWN_PROPOSAL');
    const m = this.mandates[p.mandate_id];
    const reasons = p.status === 'PROPOSED' ? this.checks(m, p) : ['PROPOSAL_NOT_OPEN'];
    return { allowed: reasons.length === 0, reasons };
  }
  execute({ who, id }) {
    this.agentOnly(who);
    const p = this.proposals[id]; if (!p) throw new Error('UNKNOWN_PROPOSAL');
    if (p.status !== 'PROPOSED') return { status: 'DENIED', reasons: ['PROPOSAL_NOT_OPEN'] };
    const m = this.mandates[p.mandate_id];
    const reasons = this.checks(m, p);
    if (reasons.length) {
      p.status = 'DENIED'; p.reasons = reasons;
      this.log('PAYMENT_DENIED', { id, reasons });
      return { status: 'DENIED', reasons };
    }
    m.consumed = true; m.status = 'EXECUTING'; p.status = 'EXECUTING';
    this.available_yocto = (BigInt(this.available_yocto) - BigInt(p.amount_yocto)).toString();
    this.inflight_yocto = (BigInt(this.inflight_yocto) + BigInt(p.amount_yocto)).toString();
    this.log('PAYMENT_EXECUTING', { id, to: p.recipient, amount_yocto: p.amount_yocto });
    return { status: 'EXECUTING' };
  }
  settle({ id, success }) {
    const p = this.proposals[id]; if (!p || p.status !== 'EXECUTING') throw new Error('INVALID_CALLBACK_STATE');
    const m = this.mandates[p.mandate_id];
    this.inflight_yocto = (BigInt(this.inflight_yocto) - BigInt(p.amount_yocto)).toString();
    if (success) {
      p.status = 'PAID'; m.status = 'PAID';
      this.log('PAYMENT_PAID', { id, to: p.recipient, amount_yocto: p.amount_yocto });
      return 'PAID';
    }
    p.status = 'FAILED'; m.status = 'ACTIVE'; m.consumed = false;
    this.available_yocto = (BigInt(this.available_yocto) + BigInt(p.amount_yocto)).toString();
    this.log('PAYMENT_FAILED', { id });
    return 'FAILED';
  }
  snapshot() {
    return {
      mandates: this.mandates, proposals: this.proposals, events: this.events,
      available_yocto: this.available_yocto, inflight_yocto: this.inflight_yocto,
      owner: this.roles.owner, agent: this.roles.agent,
    };
  }
}

export function seededVault(clock) {
  const vault = new LocalVault(clock);
  vault.fund({ who: vault.roles.owner, amount_yocto: toYocto('100') });
  const mandate = vault.createMandate({
    who: vault.roles.owner, supplier: 'ABC Supplies', recipient: SUPPLIER,
    cap_yocto: toYocto('5'), invoice_hash: hashInvoice(DEMO_INVOICE),
    expires_at_ms: vault.clock() + 86_400_000,
  });
  return { vault, mandate };
}
