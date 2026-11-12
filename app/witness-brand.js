/* WITNESS final brand/recorded proof interactions.
   This script does not call payment methods, use private keys, or mutate the contract. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const root = $('wt-case');
  if (!root) return;

  const contractAccount = 'mujeebwajid-witness-vault.testnet';
  const supplier = 'mujeebwajid-witness-supplier.testnet';
  const agent = 'mujeebwajid-witness-agent.testnet';
  const cases = Object.freeze({
    p5: { id: 'P5', status: 'DENIED', recipient: agent, suffix: 'agent',
      message: 'P5 named the agent\'s account. The contract rejected the proposal with RECIPIENT_MISMATCH; no payment was sent.',
      title: 'The destination changed',
      tx: '2Ckv4xy9GkNjWef4zN2T3qB9zb6qhhkMo2c6BJbs1Q3k', reason: 'RECIPIENT_MISMATCH', paid: false },
    p6: { id: 'P6', status: 'PAID', recipient: supplier, suffix: 'supplier',
      message: 'P6 matched the approved supplier and amount. The contract recorded the completed 0.005 NEAR Testnet payment.',
      title: 'The original approval held',
      tx: '9GToMDg9Qw1QCSKeiq4vea9V7a6ZmtCKv69RtQBFXQUv', reason: null, paid: true }
  });
  let active = 'p5';
  let requestSeq = 0;

  function status(message, state = 'neutral') {
    const node = $('wt-verification-state');
    node.textContent = message;
    node.dataset.state = state;
  }

  function render(key) {
    if (!Object.prototype.hasOwnProperty.call(cases, key)) return;
    active = key;
    requestSeq++;
    const c = cases[key];
    for (const k of ['p5', 'p6']) {
      const b = $('wt-select-' + k);
      b.classList.toggle('is-selected', k === key);
      b.setAttribute('aria-pressed', String(k === key));
    }
    $('wt-page-id').textContent = 'FORM / ' + c.id;
    $('wt-request-heading').textContent = c.paid ? 'Approved supplier' : 'Receiving account changed';
    $('wt-request-proposal').textContent = c.id + ' / ' + (c.paid ? 'PAYMENT_PAID' : c.reason);
    $('wt-request-caption').textContent = c.paid ? 'RECEIVER = APPROVED SUPPLIER' : 'RECEIVER ≠ APPROVED SUPPLIER';
    const field = $('wt-request-account');
    field.replaceChildren(document.createTextNode('mujeebwajid-witness-'));
    const highlight = document.createElement('strong');
    highlight.className = 'wt-highlight ' + (c.paid ? 'wt-highlight-green' : 'wt-highlight-red');
    highlight.textContent = c.suffix;
    field.append(highlight, document.createTextNode('.testnet'));
    $('wt-compare-sign').textContent = c.paid ? '=' : '≠';
    $('wt-compare-sign').setAttribute('aria-label', c.paid ? 'equal' : 'not equal');
    $('wt-pen-symbol').textContent = c.paid ? '✓' : '✕';
    $('wt-pen-symbol').className = 'wt-pen ' + (c.paid ? 'wt-ok' : 'wt-danger');
    const decision = $('wt-decision');
    decision.classList.toggle('wt-paid', c.paid);
    $('wt-stamp').textContent = c.status;
    $('wt-stamp').setAttribute('aria-label', 'Payment ' + c.status.toLowerCase());
    $('wt-decision-title').textContent = c.title;
    $('wt-decision-description').textContent = c.message;
    $('wt-explorer').setAttribute('href', 'https://explorer.testnet.near.org/transactions/' + c.tx);
    $('wt-explorer').firstChild.textContent = 'View ' + c.id + ' receipt ';
    status('Live check not yet requested.');
  }

  async function verify() {
    const c = cases[active];
    const current = ++requestSeq;
    const b = $('wt-verify');
    b.disabled = true;
    status('Reading finalized NEAR Testnet state for M4 / ' + c.id + '…');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch('/api/testnet/state?mandate=M4&proposal=' + encodeURIComponent(c.id), {
          method: 'GET', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' }
        });
      } finally { clearTimeout(timeout); }
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Read-only Testnet endpoint returned ' + response.status);
      if (current !== requestSeq) return; // Ignore stale result after tab switch.
      const m = data.mandate, p = data.proposal;
      const mRecipient = m?.recipient;
      const pRecipient = p?.recipient;
      const amount = String(p?.amount_yocto ?? '');
      const matches = p?.id === c.id && p?.mandate_id === 'M4' && p?.status === c.status &&
        pRecipient === c.recipient && mRecipient === supplier && amount === '5000000000000000000000';
      if (matches) {
        const block = data.blocks?.vault ? ' · block ' + String(data.blocks.vault) : '';
        status('Verified against ' + contractAccount + ': ' + c.id + ' = ' + c.status + block + '.', 'ok');
      } else {
        status('Current contract data differs from the case record. Inspect the full Payment Evidence view before treating it as verified.', 'warning');
      }
      // Keep the existing deep-chain inspector synchronized if its inputs are present.
      const mandateInput = $('tn-mandate-id'), proposalInput = $('tn-proposal-id');
      if (mandateInput) mandateInput.value = 'M4';
      if (proposalInput) proposalInput.value = c.id;
    } catch (error) {
      if (current !== requestSeq) return;
      const msg = error?.name === 'AbortError' ? 'request timed out' : String(error?.message || error);
      status('Live verification unavailable (' + msg + '). The receipt link remains available, but this page has not independently confirmed the current state.', 'warning');
    } finally {
      b.disabled = false;
    }
  }

  $('wt-select-p5').addEventListener('click', () => render('p5'));
  $('wt-select-p6').addEventListener('click', () => render('p6'));
  $('wt-verify').addEventListener('click', verify);

  // Bind the original simulator and Testnet observer. Do not replace their event handlers.
  const details = [...document.querySelectorAll('details.w-extra')];
  let lab = details.find(e => /attack|simulat|offline|lab/i.test(e.querySelector('summary')?.textContent || ''));
  let observer = details.find(e => /chain|testnet|proof|record|evidence/i.test(e.querySelector('summary')?.textContent || '') && e !== lab);
  if (!lab && details.length) lab = details[0];
  if (!observer && details.length > 1) observer = details.find(e => e !== lab);
  if (lab && !lab.id) lab.id = 'witness-attack-lab';
  if (lab && lab.id !== 'witness-attack-lab') $('wt-lab-link').href = '#' + lab.id;
  if (lab) {
    lab.classList.add('wt-bound-lab');
    const summary = lab.querySelector('summary');
    if (summary) summary.textContent = 'Try an attack - local simulator';
  }
  if (observer) {
    observer.classList.add('wt-bound-chain');
    const summary = observer.querySelector('summary');
    if (summary) summary.textContent = 'Check the on-chain records - read only';
    if (!document.getElementById('testnet-proof')) observer.id = 'testnet-proof';
  }
  for (const [id, el] of [['wt-lab-link', lab], ['wt-proof-link', observer || $('testnet-proof')]]) {
    const link = $(id);
    if (!el) { link.setAttribute('aria-disabled','true'); link.title = 'This tool is not available in the current build'; continue; }
    link.addEventListener('click', () => {
      const d = el.tagName === 'DETAILS' ? el : el.closest('details');
      if (d) d.open = true;
    });
  }
  // Keep the small trust disclosure; remove old promotional duplication only if safe.
  for (const a of document.querySelectorAll('a[href="/reviewer"]')) {
    if (/open reviewer/i.test(a.textContent)) a.textContent = 'Payment Evidence ↗';
  }
  const oldDisclaimer = [...document.querySelectorAll('p,small')].find(e =>
    /for research and hackathon demonstration only/i.test(e.textContent || '') &&
    !e.closest('.wt-footer-note'));
  if (oldDisclaimer) oldDisclaimer.classList.add('wt-old-disclaimer');
  const footer = document.querySelector('footer') || document.body;
  if (!document.querySelector('.wt-footer-note')) {
    const note = document.createElement('p');
    note.className = 'wt-footer-note';
    note.textContent = 'NEAR Testnet prototype · The simulator moves no funds · On-chain lookups are read-only · Not audited';
    footer.append(note);
  }
  render('p5');
})();
