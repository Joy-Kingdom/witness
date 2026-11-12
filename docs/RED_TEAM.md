# Red-team findings, limitations and adversarial checklist

## Threats intentionally modeled
- invoice prompt injection and altered beneficiary
- forged executive approval in untrusted document text
- amount inflation above owner cap
- replay of already spent single-use mandate
- expired or revoked mandate
- change of owner policy after agent proposal
- wrong invoice reference
- failed downstream transfer should never be called PAID

## Threats NOT mitigated
- Owner or owner key compromised, or owner deliberately authorizes attacker as supplier
- Deliberately dishonest external supplier enrollment process
- Agent has a **separate**, unprotected wallet/account with funds outside guard custody
- Compromised NEAR client libraries, RPC endpoints, developer dependencies or deployment process
- Another full-access key to the WITNESS contract account
- Bugs in the as-yet uncompiled contract
- A reviewer app compromised on the same host or serving origin
- Third-party contract side effects beyond the native NEAR transfer

## Known problems requiring independent review
1. On-chain contract source and local pure JS model are separate implementations. All successful model tests DO NOT establish correctness of the actual contract.
2. The local HTTP server is deliberately unauthenticated. It MUST NEVER be exposed as a wallet backend or treated as secure payment approval.
3. The UI calls a deterministic simulator, not a NEAR RPC. No testnet transaction receipt exists yet.
4. The `custom input` feature uses intentionally gullible regex parsing to emulate an agent deceived by untrusted text. It is **not** real LLM prompt-injection resistance testing.
5. Native NEAR asynchronous transfer callbacks, storage charges, account rent/staking rules, balance accounting, gas reservation, and promise failure paths require integration tests before testnet deployment.
6. Contract owner authorization relies on NEAR predecessor signature; owner must not give the agent or a compromised service the owner's keys.
7. Owner-controlled invoice hash is a reference, not an authenticity guarantee: the agent can copy the hash. It does not verify who issued the invoice.
8. If a human authorizes an attacker-controlled recipient in the trusted mandate, WITNESS cannot decide the intent was fraudulent.
9. Contract state is readable to anyone. Do not store real invoice content or private banking information onchain.
10. Production code would need bounded, storage-paid audit logs, emergency procedures, formalized storage assumptions and security audit.

## Adversarial proof standard
The project should make a falsifiable narrow claim: "Within the deployed and verified WITNESS contract path, an untrusted agent account cannot cause a native NEAR transfer whose recipient and amount exceed its existing owner-authorized mandate." Do not claim to prevent all crypto exchange hacks.
