# The WITNESS Mandate Pattern - steal this

A reusable pattern for any NEAR agent that moves money on a human's behalf.
Public good: if your agent pays, rent, hire or buy things, copy this shape.

## The rule

**Authorization is created by the owner, before the agent touches untrusted
content, and it names exactly one outcome.** Anything the agent proposes is
compared, field by field, against that pre-commitment at execution time -
inside the contract, never inside the agent.

## The mandate (owner-signed, single-use)

```
{ id, supplier, recipient, cap_yocto, invoice_hash (SHA-256 of the real
  invoice, committed by the owner), expires_at, version,
  revoked: false, consumed: false }
```

One supplier · one recipient · one amount ceiling · one document · one
payment · one deadline. After a successful payment the mandate is consumed
forever; a changed decision means a new mandate, not an edit an agent can
ride on (revisions bump `version`, which kills every outstanding proposal).

## The checks at execution (all must pass, in the contract)

not revoked · not consumed · not expired · proposal version == mandate
version · recipient == mandate recipient · 0 < amount <= cap ·
invoice hash == mandate hash · mandate binding · vault balance sufficient.

## The evidence rules

- **Denials persist.** A denied execution must write state (status DENIED +
  reason codes) - a reverting call erases the very evidence you need.
- **PAID is a callback, not a hope.** Mark paid only in the private payout
  callback; on failure, restore funds and un-consume the mandate.
- **Receipts for refusals too.** Export the audit trail (JSON/CSV) so a
  human - accountant, bank, insurer - can verify without trusting your UI.

## Conformance proof

This exact pattern is live on NEAR Testnet at
`mujeebwajid-witness-vault.testnet`: mandate M4, proposal P5 refused
(RECIPIENT_MISMATCH), proposal P6 paid. Re-check it from the project's
evidence page or any public NEAR RPC - the pattern is the proof.
