# WITNESS - AI coding handoff for solo vibe coders

This document is the recommended prompt/instructions to paste into **Cursor, Claude Code or Codex** after unzipping this repository. It deliberately prevents an AI tool from silently rewriting the security model.

## Current baseline - do not invent success
- Node.js zero-dependency `core/policy.mjs` is a **local** reference model with 13 passing tests and live local UI.
- `contract/witness.ts` is a **candidate** NEAR contract only. Its dependencies could not be downloaded, so it has NOT compiled, deployed or executed.
- No wallet was created, no blockchain transfer has been broadcast, no browser-independent security environment was established, and no real LLM is connected.

## Mandatory model instructions

```text
You are implementing a security-sensitive NEAR hackathon prototype called WITNESS.
Read README.md, docs/IMPLEMENTATION_SPEC.md and docs/RED_TEAM.md in full first.
You MUST NOT claim or simulate that onchain transfers completed without a real
NEAR transaction result verified against Sandbox/Testnet.

The single critical invariant:
  Every successful transfer comes from a pre-existing owner-signed supplier
  mandate and does not expand its recipient, maximum amount, invoice
  reference, validity window, or one-time usage permission.

The AI/agent is UNTRUSTED. Only the owner can create/revise/revoke a mandate.
The agent can only propose and trigger contract-controlled execution.
Funds must be held by the guard contract. No agent full-access key to vault.

Required initial work:
1. Install the project's packages and pin exact SDK versions in a lockfile.
2. Compile contract/witness.ts using official near-sdk-js version 2.0 docs.
3. Correct compatibility/build errors WITHOUT changing the security invariant.
4. Set up NEAR Workspaces Sandbox integration tests.
5. Run actual transfer to a supplier; assert exact balances and callback status.
6. Verify red-team scenarios, particularly recipient substitution, replay,
   owner/agent separation, policy drift, and failed async transfer callbacks.
7. Output exact test commands, logs and outcome receipts; update README to
   distinguish VERIFIED from SIMULATED and NOT IMPLEMENTED.
8. Stop and ask the human before any wallet creation with nontrivial funds,
   testnet deployment, upload/publication, or access to credentials.

Do not add 1Click swaps, Chain Signatures, arbitrary smart-contract decoding,
mobile wallet integration, dashboards, gamification, or a second AI agent yet.
If you find a bypass, report it prominently and fix it before UI features.
```

## Build sprint A - contract first
- Run `npm install` and `npm run contract:build`.
- Make the compiled WASM reproducible and record its SHA-256 hash in a test artifact.
- Ensure init owner identity and initial key roles cannot be overtaken in a deploy-to-init gap.
- Validate the `NearPromise` callback `near.promiseResult(0)` semantics in NEAR SDK 2.0 with a real Sandbox failure case.
- Replace any unbounded state or event logs if they exhaust storage or risk DOS; create a small testnet-ready storage budget.

**Gate A:** A real Workspaces Sandbox test demonstrates a correct payment to enrolled recipient and denies a different recipient without changing its balance. Without this gate, do not add integrations or call the project 'onchain'.

## Build sprint B - agent & reviewer
- Integrate a real agent model behind a server-only adapter (e.g., NEAR AI Cloud OpenAI-compatible API), using `.env` for all secrets.
- Create reproducible fixture documents for legit invoices and malicious invoice prompt injection. Don't send real private business data to a model.
- An agent must propose via a method-scoped key, not receive owner credentials.
- Reviewer should read real finalized contract state directly through a separately controlled origin (RPC credentials/CORS evaluated), not through the primary app's data object.
- Extend Truth Diff to show *recorded chain values*, distinguish request transaction and settled transfer transaction.

**Gate B:** Live untrusted AI output (or model-mocked deterministic test) cannot change trusted mandate authority; the reviewer reads independently stored values.

## Build sprint C - demo & publication
- Add 1–2 meaningful unforeseen mutation tests, not just address hardcoding.
- Show attack denied and a legitimate payment settled with genuine explorer receipts.
- Produce a public, no-secrets GitHub repo with `npm test`, `npm run contract:build` and working Sandbox tests.
- Record a <= 150-second demo focused on one payment discrepancy and one real chain outcome.
- State clearly that the project is a testnet proof, not independently audited custody software.

## Winning-edge cuts
**Must ship:** owner mandate → proposal → attack mismatch → contract deny → authorized settlement + evidence.
**If time permits:** proof receipt view, changing invoice text, stronger mutation test, independent reviewer origin.
**Do not ship:** unsupported claims, full NEAR Intents, Chain Signatures, hardware wallet, multi-chain wallets, new tokens, or autonomous access to production funds.
