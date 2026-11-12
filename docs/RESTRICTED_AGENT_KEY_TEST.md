# WITNESS 2.0 - Restricted agent key | Sandbox integration test

**Status:** test candidate, syntax-checked; real NEAR Sandbox run required. This patch adds a *test only*. It does not alter `contract/witness.ts`, the frontend, or any existing tests.

## What it verifies

1. Creates a fresh local Sandbox vault, owner, agent, approved supplier, attacker.
2. The owner funds a mandate for an approved invoice.
3. Uses an agent account's temporary full-access key *only during setup* to add a **FunctionCall** key with:
   - Receiver: the deployed vault account ID;
   - Allowed method names: `propose`, `execute` (not empty!);
   - Gas allowance: 5 NEAR, usable for transaction fees only.
4. Deletes the setup full-access key from the agent account and queries **on-chain** access keys to prove the agent has only one remaining restricted key.
5. Uses `signWithKey: restrictedKey` on every agent call, ensuring the test does not fall back to the default full-access signer.
6. Successfully invokes `propose` and `execute`; the vault denies malicious recipient substitution and settles a legitimate 1 NEAR transfer.
7. Verifies protocol rejection of a direct NEAR transfer (`RequiresFullAccess`), unauthorized methods (`MethodNameMismatch`), another receiver (`ReceiverMismatch`), and nonzero attached deposit (`DepositWithFunctionCall`).
8. Confirms the trusted recipient, cap, and tracked vault balance were not changed by these rejected attempts.

## Setup in Ubuntu (not PowerShell)

From `~/projects/WITNESS_2_0`:

```bash
# Extract patch into the project root (preserving tests/ and docs/ directories)
python3 -m zipfile -e "/mnt/c/Users/DE/Downloads/WITNESS_Agent_Restricted_Key_Sandbox_Test.zip" .

# Make the near-workspaces-compatible key helper a declared dev dependency.
# near-workspaces v5 docs use @near-js/transactions 1.3.2.
npm install --save-dev --save-exact @near-js/transactions@1.3.2

# Reuse your successfully compiled v0.1.2 WASM; rebuilding is safe too:
npm run contract:build

# Run ONLY the new test first:
node --test tests/near-agent-key.test.mjs

# Then, if it succeeds, rerun the two earlier test suites:
npm run test:near
node --test tests/near-extended.test.mjs
```

## Expected outcome

The test should report `pass 1`, `fail 0` and lines beginning with `✓` for the on-chain permission check, permitted methods, direct transfer denial, owner-method denial, callback denial, receiver restriction, and deposit restriction.

**Do not count this test as passed until it actually executes in your Ubuntu Sandbox.** A dependency/API mismatch is a test-harness issue and requires checking its exact error. A forbidden transaction unexpectedly succeeding is a serious security failure: preserve the log and do **not** deploy.

## Scope and caveats

- This is a disposable local blockchain test; no mainnet or Testnet account is created.
- On-chain permissions are tied to an **access key** on an **agent account**, not to the AI service itself. In production the agent process must never receive the old full-access key. The test removes the setup key on-chain but the test harness still holds it in local memory for the duration of the run; that key is invalid after removal.
- The owner and vault full-access credentials must remain separate and secured.
- A FunctionCall key is not a guarantee that permitted `propose`/`execute` calls are safe: the smart contract's mandate checks are still essential.
- This is not an independent audit, and does not yet wire the interface to Sandbox/Testnet.
- The dependencies still require a full development-dependency audit before public deployment.

References:
- https://near.github.io/near-workspaces-js/interfaces/account_near_account.NearAccount.html
- https://near.github.io/near-workspaces-js/classes/transaction.Transaction.html
- https://near.github.io/nearcore/DataStructures/AccessKey.html
- https://github.com/near/nearcore/blob/master/docs/RuntimeSpec/Transactions.md
