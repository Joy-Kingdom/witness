# WITNESS - Public NEAR Testnet runbook (read this before sending tokens)

## What this patch actually delivers

- `/api/testnet/config`: whether a **public** vault account ID is configured.
- `/api/testnet/state`: **read-only NEAR Testnet RPC** queries for contract `get_vault`, `get_audit`, optional `get_mandate`, `get_proposal`. Finalized views; requests are independent, not an atomic cross-method snapshot.
- `/api/testnet/tx`: fetches `tx` RPC status for a **supplied** transaction hash and signer; verifies the transaction recipient is the configured vault and derives WITNESS events from vault-executed receipts. A successful transaction is **not** automatically a successful payment.
- Dashboard **03 / INDEPENDENT CHAIN EVIDENCE**, visually separated from the 7 existing local simulation scenarios.

**This patch does not deploy, fund, sign, call owner methods or create a wallet. It does not change the WASM contract or the 3 passing Sandbox test suites. No Testnet contract has been deployed by this patch.**

## 1 - Preserve your Ubuntu working project

```bash
cd ~/projects/WITNESS_2_0
cp -a app app.before-testnet-observer
cp -a core core.before-testnet-observer
```

Extract `WITNESS_Testnet_Evidence_Bridge.zip` into this same folder (see instructions in chat). Never overwrite `node_modules`, `build/witness.wasm`, `package.json` or `package-lock.json` with this patch.

Run offline adapter tests first:

```bash
node --test tests/testnet-rpc.test.mjs
node --check app/server.mjs
node --check app/testnet.js
```

Then start the still-local app:

```bash
npm start
```

Open <http://localhost:4173>. The regular attacks are still simulations. The new Testnet pane says **NOT CONFIGURED** until you supply a real deployed vault account.

## 2 - Obtain distinct, disposable NEAR Testnet accounts

You need **separate** accounts/roles:

- `OWNER.testnet`: an owner wallet that approves business mandates and funds the vault.
- `VAULT.OWNER.testnet`: a distinct contract account controlled by the owner; the vault account signs its own deploy+init transaction using a full-access key that never goes to the AI.
- `AGENT.testnet`: the agent account, ultimately restricted using an on-chain function-call key to only `propose` and `execute` on the vault.
- `SUPPLIER.testnet`: a disposable recipient account you can actually observe receiving test tokens. A forged recipient can be another testnet account.

Create via supported NEAR Testnet wallet/CLI account creation, and use the Testnet faucet: <https://near-faucet.io/>. Testnet tokens have **no monetary value**. Fund storage/gas conservatively and avoid real keys or mainnet funds.

**Do not paste seed phrases/private keys into ChatGPT or put them in git.**

## 3 - Install the NEAR CLI separately (does not modify this project's npm packages)

Official NEAR CLI install guide: <https://github.com/near/near-cli-rs>. On Ubuntu WSL, the official installer is:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh
```

Open a new Ubuntu terminal or follow the installer's PATH instructions, then run `near --version` and `near` for its interactive account-import workflow. The CLI must be configured on **testnet** (not mainnet).

**Deployment safety:** the hardened contract's `init` method requires `predecessor_account_id` to equal the vault's own account. Use a **single atomic deploy-and-initialize** action signed by the **vault account**; initialize owner and agent with the separately controlled accounts. Confirm both account IDs before signing. Do not deploy first and initialize in a later transaction. Do not store an AI full-access key for the vault.

The CLI's documented atomic deployment pattern is:

```bash
near contract deploy VAULT.OWNER.testnet \
  use-file build/witness.wasm \
  with-init-call init \
  json-args '{"owner":"OWNER.testnet","agent":"AGENT.testnet"}' \
  prepaid-gas '100 Tgas' \
  attached-deposit '0 NEAR' \
  network-config testnet \
  sign-with-keychain send
```

*These are placeholders.* Before confirming, ensure the CLI is using the **VAULT account's own signer/key**, not the owner or agent's key. Follow the CLI prompts; abort if it cannot sign as the vault. New contract testnet account must exist and be funded for storage/gas before deployment.

**Role nuance:** the owner should be the *only* owner of `create_mandate`, `revise_mandate`, `revoke_mandate` and `fund`. The agent's key must be function-call restricted to receiver = vault and methods = `propose,execute`, with no attached deposit. Do not reuse full-access credentials for the AI process.

## 4 - Initialize one tiny, auditable payment

After deploying, use NEAR CLI `near contract call-function as-transaction` to call `fund` **signed as OWNER.testnet**, with a small testnet deposit (for example `0.05 NEAR`) and sufficient gas. Create a mandate **signed as OWNER.testnet** for SUPPLIER.testnet, cap e.g. `0.01 NEAR`, invoice hash `sha256:` + 64 lowercase hex characters, and an expiry timestamp in **nanoseconds**, not milliseconds.

Compute an example reproducible invoice hash and 1-hour expiry in Ubuntu (no wallet involved):

```bash
node -e "const c=require('node:crypto'); console.log('sha256:'+c.createHash('sha256').update('WITNESS DEMO INVOICE 001').digest('hex'))"
node -e "console.log((BigInt(Date.now()+3600000)*1000000n).toString())"
```

CLI call example, after replacing the placeholders and using the hash and expiry you generated:

```bash
near contract call-function as-transaction VAULT.OWNER.testnet create_mandate \
  json-args '{"supplier":"ABC Supplies","recipient":"SUPPLIER.testnet","cap_yocto":"10000000000000000000000","invoice_hash":"sha256:REPLACE_WITH_64_HEX","expires_at_ns":"REPLACE_WITH_NS"}' \
  prepaid-gas '50 Tgas' attached-deposit '0 NEAR' \
  sign-as OWNER.testnet network-config testnet sign-with-keychain send
```

`10000000000000000000000` yoctoNEAR is `0.01 NEAR`; never use the 5 NEAR from the simulator's fictional invoice as a deployment amount. Keep the demonstration tiny.

For the agent, use a **restricted key** as independently confirmed in your Sandbox test; if it is not yet set up on Testnet, do not use the agent's full-access key as a substitute. Submit an attacker proposal to `attacker.testnet`, call `execute`, capture receipt hash; submit an approved supplier proposal `<= 0.01 NEAR`, execute, and capture its receipt hash. Use the exact mandate's invoice hash in both requests.

View methods `get_mandate({id:'M1'})` and `get_proposal({id:'P2'})` can verify the stored status. Actual proposal IDs depend on previous calls and are not guaranteed to be `P2`/`P3` on Testnet.

For CLI syntax and guidance: <https://github.com/near/near-cli-rs/blob/main/docs/GUIDE.en.md>.

## 5 - Connect the read-only Testnet dashboard

After the contract is deployed (and **only then**):

```bash
cd ~/projects/WITNESS_2_0
WITNESS_TESTNET_ACCOUNT='VAULT.OWNER.testnet' npm start
```

Use the **actual lowercase account ID**, not the literal placeholders. Refresh <http://localhost:4173> and go to **03 / INDEPENDENT CHAIN EVIDENCE**. Enter real M/P IDs and click **Refresh chain state**. Paste the transaction hash and *signer account ID* to independently verify the event from NEAR Testnet. Explorer links point to <https://testnet.nearblocks.io/>.

Never infer payment success from a successful `execute` transaction: the contract can return `DENIED`; a transfer may be `EXECUTING` until its callback confirms PAID/FAILED. Compare the event *and* stored proposal status.

## Key risks before hackathon submission

1. This observer is read-only: attack buttons in Section 01 still **simulate**, and must never be marketed as submitting Testnet transactions.
2. `get_audit` stores at most 200 entries; this is a limited demo history, not permanent exhaustive evidence.
3. Testnet RPC can rate-limit/fail. The UI shows **UNVERIFIED** rather than inventing outcomes.
4. Owner and vault full-access credentials must be secured. Agent restricted key must be independently checked on Testnet.
5. The dependency audit previously reported advisories in dev dependencies; no independent contract audit has been performed.
6. The current contract's `get_audit` entries do not themselves include transaction hashes. Hashes must be obtained from CLI transaction output, then verified through the separate receipt verifier.
