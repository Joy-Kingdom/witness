# WITNESS: Same invoice, wrong account

![WITNESS logo](app/assets/witness-logo.png)

**Pitch deck (PDF):** [WITNESS-Deck.pdf](docs/WITNESS-Deck.pdf) - the 10-slide story, with the problem numbers and the Testnet proof.

WITNESS is a small NEAR contract with one job: stop an AI agent from paying the wrong account.

Here is the problem. People are starting to let AI agents handle payments. The agent reads an invoice and pays it. But an invoice can be rigged. A fake one can hide instructions inside it, in invisible text or strange characters, that push the agent to send the money somewhere else. If the agent holds the keys, that trick can work.

So WITNESS takes the agent out of the final decision. Before any invoice shows up, the owner writes down exactly what may be paid: which supplier, which account, the highest amount, and a fingerprint of the one approved invoice. That written order is a mandate, and it lives inside the contract. Later the agent can propose a payment, but the contract compares the proposal against the mandate, point by point. If anything is different, the payment is refused, and the refusal is stored on-chain with the reason why. You do not have to trust the agent, the invoice, or even this README. The record is public, and you can check it yourself.

## See it on Testnet

This already happened on the live contract, under the owner's mandate M4. The agent made two proposals:

| Proposal | The agent tried to pay | What the contract did |
|---|---|---|
| **P5** | `mujeebwajid-witness-agent.testnet` (its own account) | **Refused it: RECIPIENT_MISMATCH**, and wrote the refusal on-chain |
| **P6** | `mujeebwajid-witness-supplier.testnet` (the approved supplier) | **Paid it: 0.005 NEAR**, settled after the payout callback confirmed |

- Contract: `mujeebwajid-witness-vault.testnet`
- P5 transaction: https://testnet.nearblocks.io/txns/2Ckv4xy9GkNjWef4zN2T3qB9zb6qhhkMo2c6BJbs1Q3k
- P6 transaction: https://testnet.nearblocks.io/txns/9GToMDg9Qw1QCSKeiq4vea9V7a6ZmtCKv69RtQBFXQUv
- Or open the app's evidence page (`/reviewer`). It reads the contract state and the transaction receipts fresh from public RPC, checks the invoice fingerprint in your browser, and lets you download an evidence receipt.

## Why this matters now

Invoice fraud is not a small problem. The FBI's IC3 report counted $3.05 billion in losses from business email compromise in 2025, across 24,768 complaints. In October 2026, Sublime Security wrote about the next step: fake invoices with hidden prompt-injection text inside them, aimed at AI agents that read email. That campaign was an attempt, and no completed agent payment was reported. But it shows where this is going. First the fake invoice fooled people. Now it is written to fool the agent that pays for them.

Plenty of tools in this hackathon give agent wallets spending caps and allowlists. Caps are useful, but a cap only limits how much an agent can lose. It does not decide who was ever allowed to be paid. WITNESS works on that earlier question, and ties it to the fingerprint of the exact invoice the owner approved, written down before the agent ever saw any invoice.

A simple way to say it: NEAR Business protects a treasury from outsiders. WITNESS protects it from its own software.

## Why there is no AI guard

Some strong projects put a second AI between the agent and the money: a guardian model that reviews each payment. WITNESS does not do that, on purpose. The check here is a plain contract comparing exact values: the account, the amount cap, the invoice fingerprint, the version, the expiry date. No model is asked, so no model can be talked into saying yes. NEAR AI's own incident report from November 2026 is a good reminder of why: their confidential setup was undermined by a flaw in the software running inside it. The fewer smart parts sit between an order and its execution, the fewer ways there are to fool them.

## What is in this repo

- `contract/witness.ts` - the NEAR contract, written with near-sdk-js. Only the owner can fund the vault and create, change, or cancel a mandate. Only the agent can propose and execute, and the contract knows who is calling. When the agent executes, the contract checks 9 things (cancelled, already used, expired, policy changed, right account, under the cap, invoice fingerprint, mandate match, enough balance). A refusal is saved as a record, not thrown away as an error, because the refusal is the evidence. Money only counts as paid after the payout callback confirms the transfer went through. If a transfer fails, the funds and the mandate are restored.
- `app/` - a small Node server with no dependencies, and three pages:
  - **The Case** - the M4 story above, told step by step: the rigged invoice, the owner's order, the agent's proposal, the refusal.
  - **Attack Lab** - 7 ready-made attacks, plus a box where you can type your own hidden instruction and watch what happens. This runs on a local copy of the contract's rules. It is a simulation and moves no funds, and the page says so.
  - **Payment Evidence (`/reviewer`)** - the checking page described above, with downloads for an evidence receipt (JSON) and the audit trail (CSV, the kind of file an accountant can open).
- `core/` - the local copy of the checking rules, the simple parser that plays the part of the agent (it is a basic heuristic, not a real AI model), and the RPC reader that only talks to approved NEAR endpoints.
- `tests/` - 23 quick tests that run anywhere (`npm test`), plus NEAR Sandbox suites that run the real compiled contract (`npm run test:near`).

One test is worth calling out. The agent in WITNESS does not use a full-access key. It uses a NEAR function-call key that can only call two methods, `propose` and `execute`, on this one contract. The Sandbox test for that key passed on 12 Nov 2026: with only that key, one approved payment went through, and everything else was rejected: a direct transfer, creating or changing a mandate, calling the private payout callback, calling other accounts, and sending a payment with a deposit attached. Giving an agent a key that can only do its job is a NEAR feature, and this project leans on it hard.

## Run it yourself

```bash
npm test          # 23 tests, no network needed
npm start         # http://localhost:4173
```

To watch the real Testnet contract instead of the local demo:

```bash
WITNESS_TESTNET_ACCOUNT=mujeebwajid-witness-vault.testnet npm start
```

Then open `/reviewer`, pick P5 or P6, and press **Check against Testnet**.

## What WITNESS cannot do

Being straight about the limits, because judges should hear them from me:

- This is a Testnet demo. It is not audited. Do not use it with real money.
- A mandate proves a payment matched what the owner approved. It does not prove the supplier is honest, only that the payment went where the owner said.
- The agent in the Attack Lab is a simple parser standing in for a real AI agent, so I could test the contract's side of the story properly.
- The evidence page is served by the same small server in this prototype. In real use it should live somewhere independent.
- The claim is narrow and exact: **the contract cannot execute what was not exactly authorized, no matter what any screen says.** WITNESS does not claim to reproduce or prevent the Bybit hack. NEAR has no DELEGATECALL; the similar risk here is permission changes like adding a full-access key or replacing contract code, and that is the class this design speaks to.

## Tracks

AI Security & Defense (primary) · Agent Economy · Autonomous Business · Real-World Money

The AI Security & Defense brief says: "Give AI money without giving it the keys to everything." That is the whole design. The Agent Economy brief asks for "a receipt for every task." WITNESS writes receipts for refusals too.

## Other projects, fairly stated

WITNESS did not invent approvals, spend caps, policy contracts, on-chain refusals, or document hashing. NEAR Business, Veto, Banbo, and others each cover part of this ground, and some do it very well. What I could not find anywhere, after reading their own READMEs, is this exact combination:

1. The invoice fingerprint is written inside the owner's mandate from the start, not handed over by the agent later.
2. One mandate pays one invoice, once, and then it is finished. It is not a standing policy or a monthly budget.
3. No AI, guardian, or attestation service is consulted when money moves. The check is exact comparison, nothing more.
4. Refusals are kept forever and packaged as evidence you can download, not trimmed to the latest few.

The full comparison is in `docs/POSITIONING.md`. If the mandate pattern is useful to you, `docs/MANDATE_PATTERN.md` explains it as a reusable pattern. Take it, that is what it is there for.

MIT License. Hackathon prototype, no warranties.
