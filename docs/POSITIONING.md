# WITNESS - where it stands in the field (12 Nov 2026)

Researched against the live field, not assumed. Competitor claims are
self-reported from their public READMEs; treat them as claims, not audits.

## The problem, with numbers

- Business email compromise: **$3.05B losses / 24,768 complaints in 2025**
  (FBI IC3 2025 report) - the fraud family invoice scams belong to.
- Oct 2026: Sublime Security documented invoice fraud with **prompt
  injection hidden in invisible Unicode** inside fake invoices, targeting
  AI agents that read email. Attempted; no completed agent payment reported.
- The documented cases of agents actually moving money under manipulation
  are still rare and messy - which is exactly why the defense has to be
  structural (contract equality), not a smarter model.

## What NEAR is asking for (their words)

- AI Security & Defense: *"Give AI money without giving it the keys to
  everything."*
- Agent Economy starter prompt: *"A receipt for every task: what was
  bought, from whom, at what price."*
- Real-World Money starter prompt: trusted payment statuses with tx links
  and *"CSV export an accountant could open."*
- Autonomous Business: *"Humans only set the constraints."*

WITNESS answers all four literally: receipts for payments **and refusals**,
CSV audit export, human-set constraints, agent never holds the keys.

## The closest entries - and the honest gaps between us

| | Mechanism (self-reported) | Where WITNESS differs |
|---|---|---|
| **Veto** | Vault caps + payee list, plus an enclave AI second signer that screens evidence and can only veto; cross-chain routes | Every payment needs the guardian + AI Cloud alive. WITNESS consults no model at all - deterministic equality checks, nothing to persuade, nothing to be down. |
| **Banbo** | CaMeL origin labels on-chain; owner task mandate with multiple payees and a budget; DKIM sender authority; refusal log pruned to latest 50 | A job budget is not a single invoice. WITNESS binds one invoice fingerprint inside the owner's mandate, dies after one payment, and never prunes a refusal. |
| **Spend-guard clones** (≥5 entries) | Vault + allowlist + caps + function-call keys | Table stakes. None bind a specific invoice, none productize refusal evidence. |
| **NEAR Business** | Invite-only confidential multisig treasury for institutions | Protects the treasury from outsiders. WITNESS protects it from its own software - and is built for one small business paying one supplier. |

## The four edges (the whole claim - nothing more)

1. Invoice SHA-256 **pre-committed inside the owner-signed mandate**, not
   supplied by the agent when proposing.
2. **Single-use mandate**: one supplier, one recipient, one payment - then
   it is consumed forever.
3. **No AI in the authorization path.** NEAR AI's own Nov 2026 incident
   lesson: confidential computing does not protect against a flaw in the
   software inside the enclave. Our authorization path contains no
   intelligence to trick and no enclave to depend on.
4. **Refusals are the product**: permanent on-chain denial records +
   downloadable evidence receipt + accountant CSV. An auditor, a bank or
   an insurer can re-check every word from public RPC.

## Never claim

First/only mandate, first on-chain refusal, or first invoice hash on NEAR -
all false. Sublime losses (none reported). Any win probability from track
entry counts. That the reviewer page is an independent origin (it is not,
yet). That WITNESS prevents Bybit (NEAR has no DELEGATECALL; this is the
analogous permission class, honestly labelled).

## The 10-second judge script

"Your agent received a fake invoice and tried to pay itself. The contract
checked the owner's mandate, refused, and wrote the refusal on-chain
forever. Here is the refusal - check it yourself, download the receipt,
open the CSV. The legitimate payment under the same mandate went through.
No AI guards the money. Arithmetic does."

## Independent validation of the mechanism (Nov 2026)

Cequence Security and KPMG's *Agentic AI Runtime Security, Governance, and
Control* report (Nov 2026) measured agents acting outside their assigned
job in **44% of runs** when they held only logins and fixed permissions.
When each agent worked from a defined job and **every action was checked
against it**, out-of-job attempts fell to **1%** and task completion rose.
That is the WITNESS mechanism, measured by someone else: a pre-set mandate,
checked on every single action, inside the contract rather than in a prompt.
