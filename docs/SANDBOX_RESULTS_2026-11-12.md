# NEAR Sandbox results - 12 Nov 2026

Run on the developer's machine (WSL Ubuntu, Node 22) against a fresh
`build/witness.wasm` compiled the same day:

```
npm run contract:build   → build/witness.wasm generated successfully
npm run test:near        → tests 3 · pass 3 · fail 0   (run twice, same result)
```

## Suite 1 - basic (near.test.mjs)
Unauthorized payee DENIED (RECIPIENT_MISMATCH) · approved payment PAID ·
replay DENIED. ✔

## Suite 2 - extended adversarial (near-extended.test.mjs)
AMOUNT_EXCEEDS_CAP · INVOICE_REFERENCE_MISMATCH · POLICY_VERSION_DRIFT ·
MANDATE_REVOKED · private callback rejected when called directly ·
failed payout to a nonexistent recipient recorded PAYMENT_FAILED with the
ledger restored. ✔

## Suite 3 - restricted agent key (near-agent-key.test.mjs)
The agent account is left with exactly one key: a FunctionCall key scoped
to {receiver: vault, methods: propose/execute}; the full-access key is
deleted before the adversarial calls. Confirmed on-chain in Sandbox:

- only the agent key can propose/execute on the vault ✔
- manipulated payee proposed with the key, denied by the contract ✔
- exactly one approved payment settled ✔
- direct NEAR transfer: blocked at SDK preflight ✔
- create_mandate with the agent key: rejected ✔
- revise_mandate with the agent key: rejected ✔
- private payout callback invoked directly: rejected ✔
- calling another account: rejected ✔
- attached deposit: rejected, with no proposal, audit event, or
  balance change ✔

The "Failure" receipt lines in the raw logs are the expected rejections
of the adversarial calls (CONTRACT_ACCOUNT_MUST_INITIALIZE on the init
hijack attempt, OWNER_ONLY on role violations, "Function is private" on
the direct callback attempt).
