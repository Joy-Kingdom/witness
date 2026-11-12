# WITNESS 2.0 - Implementation specification

## One-line problem
A payment agent must never enlarge the authority granted by a human-controlled supplier mandate, even if an untrusted invoice or interface deceives it.

## Scope lock
One trusted supplier mandate, one payment, one NEAR-native token, one agent proposer, one owner, ten+ adversarial regression cases. The owner enrolls authority **before** the invoice enters the workflow. The agent cannot enroll a supplier or change the approved address.

## Business authority
A mandate includes `id`, `supplier`, `recipient` (NEAR account), `cap_yocto`, `invoice_hash`, `expires_at_ns`, `version`, `revoked`, `consumed`, `status`. `invoice_hash` is an owner-supplied reference, not verified supply-chain provenance. Authenticity of an invoice and of supplier enrollment remains outside the MVP.

## Agent proposed transaction
`id`, `mandate_id`, `mandate_version`, `recipient`, `amount_yocto`, `invoice_hash`, `status`.

## Trust boundaries
1. Owner authorization: owner NEAR signature to `create_mandate`, `revise_mandate`, `revoke_mandate`, `fund`.
2. Agent: dedicated NEAR account restricted to `propose` and `execute` on the WITNESS contract; the contract independently checks the account ID as well. The agent never receives a full-access key to the vault account.
3. Independent reviewer: reads state from a trusted NEAR RPC with `finality: final`; should be served from a distinct origin and codebase in a production iteration. The current local reviewer **is only a second page on the same local server**.
4. Execution: contract invokes a native NEAR transfer to the mandate-enrolled beneficiary only after independent mandate validation. The agent cannot call arbitrary contracts through the WITNESS contract.
5. Audit: record the request, denial reason or asynchronous settlement result. A denied attempt must use a successful state-changing method to persist evidence. A rejected transaction reverted at runtime does not produce persistent application state.

## Onchain contract methods
| Method | Caller | Description |
|---|---|---|
| `init(owner,agent)` | owner at atomic deployment | Initializes authorization roles; call atomically with deployment |
| `fund()` | owner with attached native NEAR | Adds to tracked available reserve |
| `create_mandate(...)` | owner | Defines immutable initial authority |
| `revise_mandate(...)` | owner | Changes authorization and increments version |
| `revoke_mandate(id)` | owner | Revokes all pending requests |
| `propose(...)` | agent | Creates request; cannot move funds |
| `execute(id)` | agent | Persistently denies mismatches or schedules payment promise |
| `on_payout_result(id)` | self callback | Settles to PAID only after transfer succeeds; FAILED otherwise |
| `get_mandate/get_proposal/get_audit/get_vault` | anyone | Read-only visibility for fictional testnet data |

**No new approval is required for a payment satisfying a pre-approved mandate.** That is bounded autonomy, not an unlimited agent wallet. **Mandate trust begins with the owner.** It is not created from whatever an invoice happens to claim.

## Core invariant
Every successfully settled transfer must refer to an owner-issued, currently valid and unused mandate. The actual `recipient` must equal the mandate recipient, the `amount_yocto` must be positive and no more than the cap, and the `invoice_hash` and `mandate_version` must match. A proposal cannot revise its own mandate. A successfully executed mandate is consumed.

## Async lifecycle
`PROPOSED -> (DENIED)` OR `PROPOSED -> EXECUTING -> PAID/FAILED`.
The contract reserves the amount before issuing the transfer promise; only its private callback marks the payment `PAID`. On a failed transfer it restores tracked funds and unlocks the mandate so a fresh request can retry. It does *not* turn the old failed request back into an executable request.

## Status of deliverables (updated 2026-11-12)
- **Verified:** Node.js zero-dependency local simulation, local HTTP interface and 23 automated reference-model tests.
- **Verified:** `contract/witness.ts` compiles (witness.wasm) and passed NEAR Sandbox basic + extended suites on the developer machine.
- **Verified:** deployed to NEAR Testnet at `mujeebwajid-witness-vault.testnet`; mandate M4 recorded, proposal P5 DENIED (RECIPIENT_MISMATCH), proposal P6 PAID - re-checkable via the read-only observer (`docs/evidence/testnet-proof-2026-11-12.json`).
- **Verified (2026-11-12):** the restricted function-call agent-key test passed on NEAR Sandbox - see `docs/SANDBOX_RESULTS_2026-11-12.md`.
- **Not implemented:** production agent with real LLM inference; authenticated independent reviewer on a separate origin; secure contract upgrades; token swaps; Chain Signatures; external security audit.
- **Deliberately excluded:** custody of production user funds; wallet-connect; generalized untrusted third-party call inspection; hardware-wallet security claims.

## Demo narrative
1. Owner enrolls `ABC Supplies -> abc-supplier.testnet`, amount <=5 NEAR, one transaction, invoice fingerprint.
2. Incoming fictional invoice includes instructions to pay a different address.
3. A deliberately gullible agent simulation proposes the attacker's destination.
4. Truth Diff highlights it, deterministic guard denies it, read-only evidence records the specific reason.
5. A fresh authorized scenario succeeds, with a simulated callback. The real chain version must show an actual testnet explorer transaction.

## Gate required before claiming NEAR integration
- `near-sdk-js` contract builds and deploys successfully using a pinned toolchain.
- Run Workspaces Sandbox integration tests, specifically altered beneficiary, replay, callback failure, owner/agent separation and balance integrity.
- Deploy to NEAR Testnet; verify the receipt status and actual beneficiary balance from RPC/explorer.
- Ensure reviewer obtains `get_mandate` and `get_proposal` directly from contract state, not the requesting app's body.
- Obtain a qualified code review before touching real money. This is a hackathon proof, not a security-audited financial product.
