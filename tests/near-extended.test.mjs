/**
 * Additional defensive scenarios against the ACTUAL WITNESS WASM.
 * This file has been syntax-checked but NOT executed in a NEAR Sandbox here.
 * Run only after: npm run contract:build
 * Command: node --test tests/near-extended.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'near-workspaces';

const ONE_NEAR = 10n ** 24n;
const invoiceHash = 'sha256:' + 'a'.repeat(64);
const otherInvoiceHash = 'sha256:' + 'b'.repeat(64);
const GAS = '250000000000000';
const expiry = () => (BigInt(Date.now()) * 1_000_000n + 3_600_000_000_000n).toString();

test('WITNESS WASM adversarial cases: cap, invoice, drift, revocation, callback failure',
  { timeout: 300_000 }, async (t) => {
    const worker = await Worker.init();
    t.after(async () => { await worker.tearDown(); });
    const root = worker.rootAccount;
    const owner = await root.createSubAccount('owner');
    const agent = await root.createSubAccount('agent');
    const supplier = await root.createSubAccount('supplier');
    const attacker = await root.createSubAccount('attacker');
    const vault = await root.devDeploy('build/witness.wasm');

    // Test the revised initialization rule: untrusted callers cannot choose the owner.
    await assert.rejects(
      () => attacker.call(vault, 'init', {owner: attacker.accountId, agent: attacker.accountId}),
      /CONTRACT_ACCOUNT_MUST_INITIALIZE/
    );
    await vault.call(vault, 'init', {owner: owner.accountId, agent: agent.accountId});
    await owner.call(vault, 'fund', {}, {gas: GAS, attachedDeposit: (3n * ONE_NEAR).toString()});

    const mandate = await owner.call(vault, 'create_mandate', {
      supplier: 'ABC Supplies', recipient: supplier.accountId,
      cap_yocto: ONE_NEAR.toString(), invoice_hash: invoiceHash,
      expires_at_ns: expiry(),
    });

    // Owner-only authority is enforced at the contract, not in the interface.
    await assert.rejects(
      () => agent.call(vault, 'revise_mandate', { id: mandate.id, cap_yocto: (2n * ONE_NEAR).toString() }),
      /OWNER_ONLY/
    );

    // Reject amount inflation.
    const inflated = await agent.call(vault, 'propose', {
      mandate_id: mandate.id, recipient: supplier.accountId,
      amount_yocto: (2n * ONE_NEAR).toString(), invoice_hash: invoiceHash,
    });
    const inflatedResult = await agent.call(vault, 'execute', {id: inflated.id}, {gas: GAS});
    assert.equal(inflatedResult.status, 'DENIED');
    assert.ok(inflatedResult.reasons.includes('AMOUNT_EXCEEDS_CAP'));
    assert.equal((await vault.view('get_mandate', {id: mandate.id})).consumed, false);

    // Reject invoice substitution.
    const alteredInvoice = await agent.call(vault, 'propose', {
      mandate_id: mandate.id, recipient: supplier.accountId,
      amount_yocto: ONE_NEAR.toString(), invoice_hash: otherInvoiceHash,
    });
    const invoiceResult = await agent.call(vault, 'execute', {id: alteredInvoice.id}, {gas: GAS});
    assert.equal(invoiceResult.status, 'DENIED');
    assert.ok(invoiceResult.reasons.includes('INVOICE_REFERENCE_MISMATCH'));

    // The owner revises the policy after proposal; old proposal loses authority.
    const oldPolicyProposal = await agent.call(vault, 'propose', {
      mandate_id: mandate.id, recipient: supplier.accountId,
      amount_yocto: ONE_NEAR.toString(), invoice_hash: invoiceHash,
    });
    await owner.call(vault, 'revise_mandate', {
      id: mandate.id, cap_yocto: (2n * ONE_NEAR).toString(),
    });
    const staleResult = await agent.call(vault, 'execute', {id: oldPolicyProposal.id}, {gas: GAS});
    assert.equal(staleResult.status, 'DENIED');
    assert.ok(staleResult.reasons.includes('POLICY_VERSION_DRIFT'));

    // Revoked authority cannot be used by newly created proposals.
    await owner.call(vault, 'revoke_mandate', {id: mandate.id});
    const revoked = await agent.call(vault, 'propose', {
      mandate_id: mandate.id, recipient: supplier.accountId,
      amount_yocto: ONE_NEAR.toString(), invoice_hash: invoiceHash,
    });
    const revokedResult = await agent.call(vault, 'execute', {id: revoked.id}, {gas: GAS});
    assert.equal(revokedResult.status, 'DENIED');
    assert.ok(revokedResult.reasons.includes('MANDATE_REVOKED'));

    // No external account may invoke the private settlement callback.
    await assert.rejects(
      () => attacker.call(vault, 'on_payout_result', {id: revoked.id}, {gas: GAS}),
      /private|CONTRACT_ONLY|Private|FunctionCallError/
    );

    // A syntactically valid but nonexistent named NEAR destination causes a
    // failed transfer. The callback MUST release the in-flight reserve and
    // return the mandate to a usable, not-consumed state.
    const nonexistent = 'missing-supplier.test.near';
    const failMandate = await owner.call(vault, 'create_mandate', {
      supplier: 'Unavailable recipient', recipient: nonexistent,
      cap_yocto: ONE_NEAR.toString(), invoice_hash: invoiceHash,
      expires_at_ns: expiry(),
    });
    const failedProposal = await agent.call(vault, 'propose', {
      mandate_id: failMandate.id, recipient: nonexistent,
      amount_yocto: ONE_NEAR.toString(), invoice_hash: invoiceHash,
    });
    await agent.call(vault, 'execute', {id: failedProposal.id}, {gas: GAS});
    const failedState = await vault.view('get_proposal', {id: failedProposal.id});
    assert.equal(failedState.status, 'FAILED',
      'Failed transfer must never be reported as PAID');
    const restored = await vault.view('get_vault');
    assert.equal(restored.available_yocto, (3n * ONE_NEAR).toString());
    assert.equal(restored.inflight_yocto, '0');
    assert.equal((await vault.view('get_mandate', {id: failMandate.id})).consumed, false);

    console.log('Sandbox advanced defense checks completed: cap, invoice, drift, revocation, callback, failed payout.');
  }
);
