/**
 * WITNESS first on-chain integration test (NEAR Sandbox via near-workspaces v5).
 *
 * Run: npm run contract:build && npm run test:near
 *
 * This tests the real WASM contract in a disposable LOCAL blockchain.
 * It does NOT establish that the contract is production secure or that
 * the agent holds only a protocol-restricted function-call access key.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'near-workspaces';

const ONE_NEAR = 10n ** 24n;
const invoiceHash = 'sha256:' + 'a'.repeat(64);
const gas = '250000000000000'; // 250 Tgas, below NEAR's 300 Tgas transaction limit

// A sandbox instance, owner, agent, attacker, recipient, and vault are created
// from scratch. The chain can only execute the compiled build/witness.wasm.
test('WITNESS WASM: malicious destination denied; legitimate payout settles once',
  { timeout: 300_000 }, async (t) => {
    const worker = await Worker.init();
    t.after(async () => { await worker.tearDown(); });
    const root = worker.rootAccount;
    const owner = await root.createSubAccount('owner');
    const agent = await root.createSubAccount('agent');
    const supplier = await root.createSubAccount('supplier');
    const attacker = await root.createSubAccount('attacker');
    const vault = await root.devDeploy('build/witness.wasm');

    // Initialization hijack should fail even if attacker chooses themselves as owner.
    await assert.rejects(
      () => attacker.call(vault, 'init', {
        owner: attacker.accountId,
        agent: attacker.accountId,
      }),
      /CONTRACT_ACCOUNT_MUST_INITIALIZE/
    );

    // Only the vault account's own signer may establish initial roles.
    await vault.call(vault, 'init', {
      owner: owner.accountId,
      agent: agent.accountId,
    });
    const initial = await vault.view('get_vault');
    assert.equal(initial.owner, owner.accountId);
    assert.equal(initial.agent, agent.accountId);

    // Owner is the only account permitted to create payment authority.
    await assert.rejects(
      () => attacker.call(vault, 'create_mandate', {
        supplier: 'Forged Supplier',
        recipient: attacker.accountId,
        cap_yocto: ONE_NEAR.toString(),
        invoice_hash: invoiceHash,
        expires_at_ns: (BigInt(Date.now()) * 1_000_000n + 3_600_000_000_000n).toString(),
      }),
      /OWNER_ONLY/
    );

    await owner.call(vault, 'fund', {}, {
      gas,
      attachedDeposit: (3n * ONE_NEAR).toString(),
    });
    const funded = await vault.view('get_vault');
    assert.equal(funded.available_yocto, (3n * ONE_NEAR).toString());

    const mandate = await owner.call(vault, 'create_mandate', {
      supplier: 'ABC Supplies',
      recipient: supplier.accountId,
      cap_yocto: ONE_NEAR.toString(),
      invoice_hash: invoiceHash,
      expires_at_ns: (BigInt(Date.now()) * 1_000_000n + 3_600_000_000_000n).toString(),
    });
    assert.ok(mandate.id, 'create_mandate should return mandate id');

    // Agent submits a malicious payment to an unauthorized destination.
    const malicious = await agent.call(vault, 'propose', {
      mandate_id: mandate.id,
      recipient: attacker.accountId,
      amount_yocto: ONE_NEAR.toString(),
      invoice_hash: invoiceHash,
    });
    const denied = await agent.call(vault, 'execute', { id: malicious.id }, { gas });
    assert.equal(denied.status, 'DENIED');
    assert.ok(denied.reasons.includes('RECIPIENT_MISMATCH'));
    assert.equal((await vault.view('get_proposal', { id: malicious.id })).status, 'DENIED');
    assert.equal((await vault.view('get_mandate', { id: mandate.id })).consumed, false);

    // Exactly the payment the owner authorized should be permitted.
    const legitimate = await agent.call(vault, 'propose', {
      mandate_id: mandate.id,
      recipient: supplier.accountId,
      amount_yocto: ONE_NEAR.toString(),
      invoice_hash: invoiceHash,
    });
    await agent.call(vault, 'execute', { id: legitimate.id }, { gas });
    const completed = await vault.view('get_proposal', { id: legitimate.id });
    assert.equal(completed.status, 'PAID',
      'A payout is PAID only after the async callback confirms settlement');
    assert.equal((await vault.view('get_mandate', { id: mandate.id })).consumed, true);

    const settled = await vault.view('get_vault');
    assert.equal(settled.available_yocto, (2n * ONE_NEAR).toString());
    assert.equal(settled.inflight_yocto, '0');

    // Already completed proposal cannot pay a second time.
    const replay = await agent.call(vault, 'execute', { id: legitimate.id }, { gas });
    assert.equal(replay.status, 'DENIED');
    assert.equal((await vault.view('get_proposal', { id: legitimate.id })).status, 'PAID');

    console.log('Verified in Sandbox: unauthorized payee DENIED; approved payment PAID; replay DENIED.');
  }
);
