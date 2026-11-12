# WITNESS Sandbox hardening patch (candidate, unverified)

This patch modifies **contract/witness.ts** and **tests/near.test.mjs**, and
adds **tests/near-extended.test.mjs**.

## Security reason

The earlier `init({owner, agent})` method checked that the caller equals the
**caller-supplied owner**, allowing an attacker to initialize an uninitialized
contract under their own identity. The revised method requires the vault
contract account to call its own `init` method. This assumes the deployer
securely controls the vault account's signing key. Do not give that key to the
AI agent. This change is **not a production audit** and does not itself make
future upgrades or full-access keys safe.

The first Sandbox test is updated to initialize from `vault.call(vault,...)`.

## Applying (in Ubuntu, after backing up or committing current files)

1. Extract the patch archive over your Linux project root.
2. `npm run contract:build`
3. `npm run test:near`
4. `node --test tests/near-extended.test.mjs`

The second test intentionally attempts a payout to a nonexistent account and
checks for the `FAILED` callback and balance restoration. If it fails, share the
complete test log. Do not assume the transfer was successful.

## Known remaining gaps

- No actual NEAR function-call-only access key has been created in the tests.
- Owner/vault full-access keys and upgrade controls remain outside this patch.
- All of this is local NEAR Sandbox, not a public Testnet deployment.
- No concurrency, gas exhaustion, full state size, or property-based testing.
- Dependencies reported npm advisories and should be reviewed before testnet.
- The test source has been syntax checked but its Sandbox assertions have NOT
  been executed in this environment.
