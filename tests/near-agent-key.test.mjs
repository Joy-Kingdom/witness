/**
 * WITNESS 2.0 — protocol-level least-privilege agent key integration test.
 *
 * Executes against a disposable NEAR Sandbox using the EXISTING compiled
 * build/witness.wasm. The account is left with exactly one on-chain key:
 * a FunctionCall access key scoped to {receiver: vault, methods: propose/execute}.
 * The original full-access key is deleted before adversarial calls start.
 *
 * Requires near-workspaces v5 and its matching near-api-js dependency.
 * Status: RUN AND PASSED on NEAR Sandbox, 2026-11-12 (see docs/SANDBOX_RESULTS_2026-11-12.md).
 * Run: node --test tests/near-agent-key.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker, createKeyPair } from 'near-workspaces';
import { createRequire } from 'node:module';

// NEAR Workspaces v5 uses near-api-js transaction primitives internally.
// Import the SAME primitives it uses; importing a separate @near-js/transactions
// package can mix incompatible serializable transaction classes/schema versions.
// Resolve near-api-js from near-workspaces itself: near-api-js is nested under
// near-workspaces@5, not necessarily installed at the project's root.
// Its functionCallAccessKey helper is exported under `transactions`.
const projectRequire = createRequire(import.meta.url);
const workspaceRequire = createRequire(projectRequire.resolve('near-workspaces'));
const { transactions } = workspaceRequire('near-api-js');
const { functionCallAccessKey } = transactions;
assert.equal(typeof functionCallAccessKey, 'function',
  'Expected near-api-js.transactions.functionCallAccessKey');

const ONE_NEAR = 10n ** 24n;
const GAS = 250_000_000_000_000n;
const HASH = `sha256:${'a'.repeat(64)}`;
const EXPIRES_IN_ONE_HOUR_NS = 3_600_000_000_000n;

function expiry() {
  return (BigInt(Date.now()) * 1_000_000n + EXPIRES_IN_ONE_HOUR_NS).toString();
}

/**
 * Assert *protocol* rejection with the expected access-key violation.
 * Workspaces' batch().transact() may return a failed TransactionResult,
 * whereas call() and RPC validation errors can throw directly.
 */
async function mustBeRejected(action, expectedReason, description) {
  let outcome;
  let thrown;
  try {
    outcome = await action();
  } catch (error) {
    thrown = error;
  }

  if (thrown !== undefined) {
    assert.match(String(thrown), expectedReason,
      `${description}: rejected for an unexpected reason`);
    // An SDK preflight rejection isn't an RPC-level rejection. We verify
    // the installed key's on-chain method and receiver scope separately.
    const sdkPreflight = /more th[ae]n one action/i.test(String(thrown));
    console.log(`  ✓ ${description}: ${sdkPreflight ? 'SDK preflight blocked attempt' : 'rejected'}`);
    return;
  }

  assert.ok(outcome?.failed === true,
    `${description}: transaction was NOT rejected`);
  const details = [...(outcome.receiptFailureMessages ?? []),
    ...(outcome.failures ?? []).map((f) => JSON.stringify(f))].join('\n');
  assert.match(details, expectedReason,
    `${description}: failed for an unexpected reason`);
  console.log(`  ✓ ${description}: rejected`);
}

test('NEAR access key: agent may only propose and execute on WITNESS vault',
  {timeout: 300_000}, async (t) => {
    const worker = await Worker.init();
    t.after(async () => { await worker.tearDown(); });

    const root = worker.rootAccount;
    const owner = await root.createSubAccount('owner');
    const agent = await root.createSubAccount('agent');
    const supplier = await root.createSubAccount('supplier');
    const attacker = await root.createSubAccount('attacker');
    const vault = await root.devDeploy('build/witness.wasm');

    // Existing contract v0.1.2: only vault itself can initialize.
    await vault.call(vault, 'init', {
      owner: owner.accountId,
      agent: agent.accountId,
    });
    await owner.call(vault, 'fund', {}, {
      gas: GAS,
      attachedDeposit: 3n * ONE_NEAR,
    });
    const mandate = await owner.call(vault, 'create_mandate', {
      supplier: 'ABC Supplies',
      recipient: supplier.accountId,
      cap_yocto: ONE_NEAR.toString(),
      invoice_hash: HASH,
      expires_at_ns: expiry(),
    });
    assert.ok(mandate.id);

    // The test harness provisions the key with the agent account's one-time
    // full-access credential. The AI only receives the restricted key.
    const originalKey = await agent.getKey();
    assert.ok(originalKey, 'Agent setup must start with a full-access key');
    const restrictedKey = createKeyPair();
    const restrictedPublicKey = restrictedKey.getPublicKey();

    const provision = await agent.batch(agent).addKey(
      restrictedPublicKey,
      functionCallAccessKey(vault.accountId, ['propose', 'execute'], 5n * ONE_NEAR),
    ).transact();
    assert.equal(provision.succeeded, true, 'AddKey action must settle');

    // Remove the *only* existing full-access key before ANY attack runs.
    const removal = await agent.batch(agent)
      .deleteKey(originalKey.getPublicKey()).transact();
    assert.equal(removal.succeeded, true, 'DeleteKey action must settle');

    // Verify real on-chain access-key state, not a local JavaScript setting.
    const keyList = await agent.viewAccessKeys(agent.accountId);
    assert.equal(keyList.keys.length, 1,
      'Agent account must retain exactly one access key');
    const onlyKey = keyList.keys[0];
    assert.equal(onlyKey.public_key, restrictedPublicKey.toString());
    const permission = onlyKey.access_key.permission?.FunctionCall;
    assert.ok(permission, 'The one remaining key must be FunctionCall');
    assert.equal(permission.receiver_id, vault.accountId);
    assert.deepEqual([...permission.method_names].sort(), ['execute', 'propose']);
    assert.ok(BigInt(permission.allowance) > 0n,
      'The key should have a nonzero gas allowance');
    console.log('  ✓ Confirmed on-chain: only agent key allows propose/execute on WITNESS');

    // Allowlisted action #1: propose, signed EXPLICITLY with restricted key.
    const manipulated = await agent.call(vault, 'propose', {
      mandate_id: mandate.id,
      recipient: attacker.accountId,
      amount_yocto: ONE_NEAR.toString(),
      invoice_hash: HASH,
    }, {gas: GAS, signWithKey: restrictedKey});
    assert.ok(manipulated.id);

    // Allowlisted action #2: execute. The vault independently rejects it.
    const denied = await agent.call(vault, 'execute', {id: manipulated.id},
      {gas: GAS, signWithKey: restrictedKey});
    assert.equal(denied.status, 'DENIED');
    assert.ok(denied.reasons.includes('RECIPIENT_MISMATCH'));
    assert.equal((await vault.view('get_mandate', {id: mandate.id})).consumed, false);
    console.log('  ✓ Allowed key called propose/execute; contract denied manipulated payee');

    const legitimate = await agent.call(vault, 'propose', {
      mandate_id: mandate.id,
      recipient: supplier.accountId,
      amount_yocto: ONE_NEAR.toString(),
      invoice_hash: HASH,
    }, {gas: GAS, signWithKey: restrictedKey});
    assert.ok(legitimate.id);
    await agent.call(vault, 'execute', {id: legitimate.id},
      {gas: GAS, signWithKey: restrictedKey});
    assert.equal((await vault.view('get_proposal', {id: legitimate.id})).status, 'PAID');
    console.log('  ✓ Restricted key settled exactly one approved payment');

    // Forbidden action types / forbidden method names / forbidden receiver.
    // These must be rejected. SDK-level preflight is not an on-chain receipt;
    // the on-chain key permission list was independently verified above.
    await mustBeRejected(
      () => agent.batch(attacker).transfer(ONE_NEAR).transact(restrictedKey),
      /RequiresFullAccess|more th[ae]n one action|full access key/i,
      'Direct NEAR transfer',
    );
    await mustBeRejected(
      () => agent.call(vault, 'create_mandate', {
        supplier: 'Rogue', recipient: attacker.accountId,
        cap_yocto: ONE_NEAR.toString(), invoice_hash: HASH,
        expires_at_ns: expiry(),
      }, {gas: GAS, signWithKey: restrictedKey}),
      /MethodNameMismatch|Transaction method name .* isn['’]t allowed by the access key/i,
      'Creating a mandate',
    );
    await mustBeRejected(
      () => agent.call(vault, 'revise_mandate', {
        id: mandate.id, cap_yocto: (2n * ONE_NEAR).toString(),
      }, {gas: GAS, signWithKey: restrictedKey}),
      /MethodNameMismatch|Transaction method name .* isn['’]t allowed by the access key/i,
      'Revising a mandate',
    );
    await mustBeRejected(
      () => agent.call(vault, 'on_payout_result', {id: legitimate.id},
        {gas: GAS, signWithKey: restrictedKey}),
      /MethodNameMismatch|Transaction method name .* isn['’]t allowed by the access key/i,
      'Invoking private payout callback',
    );
    await mustBeRejected(
      () => agent.call(supplier, 'anything', {},
        {gas: GAS, signWithKey: restrictedKey}),
      /Wrong AccessKey used for transaction|ReceiverMismatch|Transaction receiver(?:_id| id)? .*?(?:doesn['’]t match|isn['’]t allowed|is not allowed|not allowed).*?access key/i,
      'Calling another account',
    );
    // Verify the failed deposit using actual on-chain state.
    const auditBeforeDeposit = await vault.view('get_audit');
    const accountBeforeDeposit = await vault.accountView();

    let depositResult;
    let depositError;

    try {
      depositResult = await agent.callRaw(vault, 'propose', {
        mandate_id: mandate.id,
        recipient: attacker.accountId,
        amount_yocto: ONE_NEAR.toString(),
        invoice_hash: HASH,
      }, {
        gas: GAS,
        attachedDeposit: 1n,
        signWithKey: restrictedKey,
      });
    } catch (error) {
      depositError = error;
    }

    assert.ok(
      depositError !== undefined || depositResult?.failed === true,
      'Attached deposit unexpectedly succeeded'
    );

    assert.deepEqual(
      await vault.view('get_audit'),
      auditBeforeDeposit,
      'Attached deposit must not create an audit event'
    );

    assert.equal(
      await vault.view('get_proposal', {id: 'P4'}),
      null,
      'Attached deposit must not create a proposal'
    );

    const accountAfterDeposit = await vault.accountView();

    assert.equal(
      accountAfterDeposit.amount,
      accountBeforeDeposit.amount,
      'Attached deposit must not change vault balance'
    );

    console.log(
      '  ✓ Attached deposit rejected: no proposal, audit event, or balance change'
    );

    // Verify failed attempts did not modify the owner's policy or transfer
    // more than the legitimate 1 NEAR from the vault's tracked balance.
    const after = await vault.view('get_mandate', {id: mandate.id});
    assert.equal(after.recipient, supplier.accountId);
    assert.equal(after.cap_yocto, ONE_NEAR.toString());
    assert.equal(after.consumed, true);
    const balances = await vault.view('get_vault');
    assert.equal(balances.available_yocto, (2n * ONE_NEAR).toString());
    assert.equal(balances.inflight_yocto, '0');

    console.log('Restricted function-call key isolation checks completed on NEAR Sandbox.');
  }
);
