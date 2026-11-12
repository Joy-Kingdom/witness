# WITNESS - Same invoice. Wrong account.

![WITNESS logo](app/assets/witness-logo.png)

**An AI agent may propose a payment. It can never expand the authorization its owner gave it.**

WITNESS is a payment-integrity system for the agent economy, built on NEAR. The owner signs a **Trusted Payment Mandate** - supplier, exact recipient account, amount cap, invoice fingerprint, one payment, expiry - *before* any invoice reaches the agent. Invoices are untrusted input: they can mislead the agent, but they cannot rewrite the mandate. The vault contract re-checks every proposal against the mandate at execution time and records the outcome - paid or denied, with the reason - as permanent on-chain evidence.

> The AI read the wrong instructions. The contract followed the right authorization.

## The recorded proof (NEAR Testnet - verify it yourself)

Under owner mandate **M4** on the live contract, two proposals were executed:

| Proposal | Agent asked to pay | Contract result |
|---|---|---|
| **P5** | `mujeebwajid-witness-agent.testnet` (the agent's own account) | **DENIED - RECIPIENT_MISMATCH**, recorded on-chain |
| **P6** | `mujeebwajid-witness-supplier.testnet` (the approved supplier) | **PAID - 0.005 NEAR**, settled only after the async payout callback |

- Contract: `mujeebwajid-witness-vault.testnet`
- P5 transaction: https://testnet.nearblocks.io/txns/2Ckv4xy9GkNjWef4zN2T3qB9zb6qhhkMo2c6BJbs1Q3k
- P6 transaction: https://testnet.nearblocks.io/txns/9GToMDg9Qw1QCSKeiq4vea9V7a6ZmtCKv69RtQBFXQUv
- Or open the app's **Payment Evidence** page (`/reviewer`): it re-reads finalized contract state and transaction receipts from public RPC and lets you download an **evidence receipt** - don't trust this README, check the chain.

## Why this is the need of the hour

Business email compromise - the family that invoice fraud belongs to - cost victims **$3.05 billion across 24,768 complaints in 2025** (FBI IC3 2025 report). In October 2026, Sublime Security documented the next evolution: an invoice-fraud campaign hiding prompt-injection instructions (invisible Unicode tag characters) inside fake invoices, aimed at AI agents that read email (attempted; no completed agent payment was reported). The step after that is an agent with a wallet.

Agent wallets, spend caps and policy wrappers are everywhere in this hackathon. WITNESS defends the layer they skip: **the business decision itself.** Caps limit *how much* an agent can lose; a mandate decides *who was ever allowed to be paid*, bound to the fingerprint of the invoice the owner actually approved - committed by the owner before the agent is ever exposed to untrusted content.

- **NEAR Business protects a treasury from outsiders. WITNESS protects it from its own software.**
- Simulated guard demos show a block happening. WITNESS shows a block that **already happened, on-chain, with a receipt**.

## No AI in the authorization path

Several strong entries put a second AI - a guardian model, an enclave signer - between the agent and the money. WITNESS deliberately does not. The guard is a deterministic contract doing exact comparisons: recipient, cap, fingerprint, version, expiry. No model is consulted, so no model can be persuaded, and no enclave liveness is required. NEAR AI's own November 2026 incident report made the same point from the other side: confidential computing does not protect against a flaw in the software running inside the enclave. The authorization path should contain as little software - and no intelligence - as possible.

## What is in this repo

- `contract/witness.ts` - NEAR contract (near-sdk-js). Owner-only `fund / create_mandate / revise_mandate / revoke_mandate`; agent-only `propose / execute`, roles enforced by predecessor account. `execute()` re-validates 9 conditions (revoked, consumed, expired, policy-version drift, recipient, cap, invoice fingerprint, mandate binding, vault balance). Denials **persist** with reasons (a reverting call would erase the evidence). Payout is async: a proposal is `PAID` only inside the private callback; a failed transfer restores funds and un-consumes the mandate.
- `app/` - zero-dependency Node server and UI:
  - **The Case** - the recorded M4 / P5 / P6 story, one recipient swapped, highlighted in seconds.
  - **Attack Lab** - 7 preset attacks plus *your own* injected instruction, run against a deterministic local reference model of the contract (clearly labelled simulation; moves no funds).
  - **Testnet Observer** - read-only, finalized RPC reads of the real contract with multi-provider fallback (FastNear → NEAR → dRPC; archival endpoint for transaction receipts). Wrong state is never invented: failures show UNVERIFIED.
  - **Payment Evidence (`/reviewer`)** - independent re-check of mandate, proposals, invoice fingerprint (SHA-256, computed locally in your browser; the file never leaves your device) and a downloadable evidence receipt.
- `core/` - the reference policy model, the deliberately gullible custom-input parser (a heuristic, **not** an LLM), and the allow-listed RPC reader.
- `tests/` - 23 deterministic tests (`npm test`), NEAR Sandbox suites for the real contract (`npm run test:near`), and a restricted function-call-key test (agent key scoped to `propose`/`execute` only) - **run and passed on NEAR Sandbox, 12 Nov 2026**: the restricted key settled exactly one approved payment and was rejected for direct transfers, mandate creation/revision, the private callback, calls to other accounts, and attached deposits.

## Quick start

```bash
npm test          # 23 deterministic tests, no network needed
npm start         # http://localhost:4173  (Attack Lab + observer)
```

To point the observer at the live contract:

```bash
WITNESS_TESTNET_ACCOUNT=mujeebwajid-witness-vault.testnet npm start
```

Then open `/reviewer`, choose P5 or P6, and press **Check against Testnet**.

## Honest limits

- Testnet demonstration only. Not audited. Do not use with real funds.
- The mandate is only as trustworthy as the owner's enrollment; WITNESS proves a payment matched the owner's authorization, not that the supplier is honest.
- The Attack Lab's "agent" is a deterministic heuristic parser, not a production LLM agent.
- The reviewer page is served from the same origin in this prototype; a production version would be independently hosted.
- The bounded claim is exact: **the contract cannot execute what was not exactly authorized, no matter what any screen says.** WITNESS does not claim to reproduce or prevent the Bybit hack; its permission-change framing is a NEAR-analogous class (key and code changes), and NEAR has no DELEGATECALL.

## Tracks

AI Security & Defense (primary) · Agent Economy · Autonomous Business · Real-World Money

The AI Security & Defense brief asks for exactly this shape: *"Give AI money without giving it the keys to everything."* The Agent Economy brief asks for *"a receipt for every task"* - WITNESS issues receipts for refusals too, and exports the audit trail as CSV an accountant can open.

## Prior art, stated plainly

WITNESS did not invent approvals, spend caps, policy contracts, on-chain refusals or document hashing - NEAR Business, Veto, Banbo, APort and others cover parts of that ground, some of them very well. The combination claimed here is narrower and, after reading the field's own READMEs, still unoccupied:

1. **The invoice fingerprint lives inside the owner's mandate** - pre-committed by the owner, not supplied by the agent at proposal time.
2. **The mandate is single-use and single-invoice**: one supplier, one recipient, one payment, then it dies - not a standing policy or a job budget.
3. **Authorization is deterministic** - no AI, guardian or attestation is consulted when money moves.
4. **Denials are permanent and productized** - unpruned on-chain refusal records, packaged as an evidence receipt and an accountant-ready CSV.

See `docs/POSITIONING.md` for the full comparison and `docs/MANDATE_PATTERN.md` if you want to reuse the pattern - it is a public good, built to be stolen.

MIT License. Hackathon prototype; no warranties.
