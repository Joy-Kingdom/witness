# NEAR chain integration test plan — pending

Do not count local `npm test` as blockchain contract tests.

Use NEAR Workspaces Sandbox to deploy the compiled `contract/witness.ts` WASM to an account initialized atomically. Use three identities: owner (creates/funds mandates), agent (proposes/executes with a restricted function-call key), supplier (receives native NEAR), and attacker (unauthorized receiver).

1. Owner initializes and funds vault; attempted init by someone else fails.
2. Agent cannot `create_mandate`, `revise_mandate`, `revoke_mandate`, `fund`.
3. Owner creates a 5 NEAR mandate for supplier, with invoice hash and future expiry.
4. Agent submits attacker address; the contract persists `DENIED/RECIPIENT_MISMATCH`, supplier & attacker balance unchanged.
5. Agent submits 50 NEAR to the proper address; contract denies with `AMOUNT_EXCEEDS_CAP`.
6. Agent submits a legitimate 5 NEAR payment; execute schedules native transfer; callback marks PAID and supplier's actual chain balance increases.
7. A replay with a fresh proposal is denied; no second transfer.
8. Revision/revocation/expiry after proposal are rejected.
9. Induce transfer failure (e.g. destination that cannot receive); verify callback `FAILED`, not `PAID`, reserve restored; validate under real VM rules.
10. A non-self account calling `on_payout_result` fails.
11. Storage and NEAR balance changes: available/inflight tracked balances must reconcile with actual contract account NEAR funds and storage costs.
12. Verify all read-only reviewer fields are retrieved directly from chain state with finality, not a dApp-controlled description.

Record commands and expected outcomes in README after these are *actually* run. Pin compiler & SDK versions in lockfile; attach explorer receipts for main demonstration.
