# NEAR Hackathon - submission pack (deadline 14 Nov 2026, 23:59 UTC)

## Project name
WITNESS

## Tracks
AI Security & Defense (primary) · Agent Economy · Autonomous Business · Real-World Money

## Description for the form (copy-paste)

WITNESS stops AI agents from paying the wrong account. The owner signs a Trusted Payment Mandate on NEAR - supplier, exact recipient, amount cap, invoice fingerprint, one payment, expiry - before any invoice reaches the agent. Invoices are untrusted: hidden prompt-injection can mislead the agent, but the vault contract re-checks every proposal against the mandate at execution and permanently records the outcome. On Testnet, under mandate M4, proposal P5 (agent tried to pay its own account) was DENIED for RECIPIENT_MISMATCH, and P6 (the approved supplier) was PAID - both verifiable from public RPC on the project's evidence page, which also checks the invoice fingerprint locally and issues a downloadable evidence receipt. Includes an Attack Lab where judges can fire preset attacks or type their own injection. The AI read the wrong instructions; the contract followed the right authorization.

## Demo post for X (copy-paste, add the live link + a screenshot of The Case)

Same invoice. Wrong account.

A rigged invoice made our AI agent try to pay itself. The NEAR contract refused, on-chain forever.

WITNESS: owner approves first, agent proposes second. P5 DENIED, P6 PAID
Built at NEAR Hackathon [ live demo link ] #NEARHackathon @NEARProtocol

## Before you press submit - 5-minute checklist

1. Repo public on GitHub, README renders, logo shows.
2. Live demo URL opens; `/reviewer` → P5 → "Check against Testnet" shows DENIED from chain.
3. `npm test` passes 23/23 from a fresh clone.
4. X demo post published with @NEARProtocol and #NEARHackathon, and it says the project was built for the NEAR Hackathon.
5. Form: name, description above, tracks, team lead email, NEAR mainnet account for payout. This must be a mainnet (.near) account - the Testnet accounts do not qualify for payout.
6. Keep the live demo up through judging (18 Nov, ideally 25 Nov). Screenshots alone are not enough if judges cannot open the demo.
