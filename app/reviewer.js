/* WITNESS evidence receipt - builds a portable, verifiable record of a
   recorded Testnet case from fresh finalized RPC reads. Read-only. */
(() => {
  'use strict';
  const btn = document.getElementById('wt-ev-receipt');
  if (!btn) return;
  const TX = {
    P5: { hash: '2Ckv4xy9GkNjWef4zN2T3qB9zb6qhhkMo2c6BJbs1Q3k', sender: 'mujeebwajid-witness-agent.testnet' },
    P6: { hash: '9GToMDg9Qw1QCSKeiq4vea9V7a6ZmtCKv69RtQBFXQUv', sender: 'mujeebwajid-witness-agent.testnet' },
  };
  let current = 'P5';
  for (const id of ['P5', 'P6']) {
    const el = document.getElementById('wt-ev-' + id.toLowerCase());
    if (el) el.addEventListener('click', () => { current = id; });
  }
  async function getJson(url) {
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }
  btn.addEventListener('click', async () => {
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Building receipt from Testnet…';
    try {
      const state = await getJson(`/api/testnet/state?mandate=M4&proposal=${current}`);
      const tx = await getJson(`/api/testnet/tx?hash=${TX[current].hash}&sender=${TX[current].sender}`);
      const receipt = {
        receipt: 'WITNESS EVIDENCE RECEIPT',
        generated_at: new Date().toISOString(),
        network: 'NEAR Testnet',
        contract: state.contract,
        owner_mandate: state.mandate,
        agent_proposal: state.proposal,
        vault: state.vault,
        finalized_blocks: state.blocks,
        transaction_evidence: tx,
        verify_yourself: {
          explorer: tx.explorer_url,
          contract: `https://testnet.nearblocks.io/address/${state.contract}`,
          note: 'Re-run the read-only checks on the WITNESS evidence page; a receipt is a snapshot, the chain is the source.',
        },
      };
      const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `witness-evidence-${current.toLowerCase()}-mandate-m4.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      btn.textContent = 'Receipt downloaded ✓';
    } catch (e) {
      btn.textContent = 'Receipt failed - run “Check against Testnet” first';
    } finally {
      setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 2600);
    }
  });
})();

/* Accountant-friendly CSV of the contract's full audit trail. */
(() => {
  'use strict';
  const btn = document.getElementById('wt-ev-csv');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Reading audit trail…';
    try {
      const r = await fetch('/api/testnet/state', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
      const rows = [['seq', 'event', 'proposal', 'detail'].join(',')];
      for (const e of d.audit || []) {
        const detail = Object.entries(e).filter(([k]) => !['seq', 'type'].includes(k)).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('+') : v}`).join('; ');
        rows.push([e.seq, e.type, e.id || '', detail].map(esc).join(','));
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'witness-audit-trail.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      btn.textContent = 'CSV downloaded ✓';
    } catch (e) { btn.textContent = 'CSV failed - check connection'; }
    finally { setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 2600); }
  });
})();
