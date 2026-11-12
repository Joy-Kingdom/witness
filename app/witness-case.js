/* WITNESS - The Case File. Presentational storytelling over the same
   read-only APIs as the rest of the app. It never signs or sends anything. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  /* The Thread */
  const thread = $('wc-thread');
  addEventListener('scroll', () => {
    const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    thread.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }, { passive: true });

  /* Exhibit A - reveal what the agent actually read. */
  const revealBtn = $('wc-reveal'), invoice = $('wc-invoice');
  revealBtn.addEventListener('click', () => {
    const open = invoice.classList.toggle('revealed');
    $('wc-hidden').setAttribute('aria-hidden', String(!open));
    revealBtn.textContent = open ? 'Hide the hidden layer' : 'Read it the way the agent read it';
    if (open) $('wc-reveal-note').innerHTML = 'There it is - an instruction with <strong>no authority</strong>, hiding in white text and invisible characters. The agent cannot tell a hidden line from a real one. <strong>The contract can tell both from the owner\'s signature.</strong>';
  });

  /* Exhibit C - the check, run as a sequence. */
  const CHECKS = [
    ['Not revoked', true], ['Not consumed', true], ['Not expired', true],
    ['Policy version match', true], ['Recipient match', null],
    ['Amount within cap', true], ['Invoice fingerprint', true],
    ['Mandate binding', true], ['Vault balance', true],
  ];
  const CASES = {
    P5: { to: 'mujeebwajid-witness-<b class="wc-bad">agent</b>.testnet', recipientPass: false,
      stamp: 'DENIED', paid: false, head: 'Recipient mismatch',
      sub: 'The proposal named the agent\'s own account. The mandate names the supplier. Nothing moved; the refusal was written into the contract\'s permanent record.',
      tx: '2Ckv4xy9GkNjWef4zN2T3qB9zb6qhhkMo2c6BJbs1Q3k' },
    P6: { to: 'mujeebwajid-witness-<b>supplier</b>.testnet', recipientPass: true,
      stamp: 'PAID', paid: true, head: 'Every field matched the mandate',
      sub: 'Same mandate, honest proposal: the contract executed, and marked the payment PAID only after the transfer callback confirmed the money arrived.',
      tx: '9GToMDg9Qw1QCSKeiq4vea9V7a6ZmtCKv69RtQBFXQUv' },
  };
  let mode = 'P5';
  const list = $('wc-checks');
  function renderChecks() {
    list.replaceChildren();
    for (const [name] of CHECKS) {
      const li = document.createElement('li');
      li.textContent = name; li.dataset.name = name;
      list.append(li);
    }
  }
  renderChecks();
  function setMode(next) {
    mode = next;
    for (const k of ['P5', 'P6']) {
      const b = $('wc-mode-' + k.toLowerCase());
      b.classList.toggle('is-active', k === next);
      b.setAttribute('aria-pressed', String(k === next));
    }
    $('wc-prop-id').textContent = next;
    $('wc-prop-to').innerHTML = CASES[next].to;
    $('wc-live-pid').textContent = next;
    $('wc-explorer').href = 'https://testnet.nearblocks.io/txns/' + CASES[next].tx;
    $('wc-verdict').hidden = true;
    renderChecks();
  }
  $('wc-mode-p5').addEventListener('click', () => setMode('P5'));
  $('wc-mode-p6').addEventListener('click', () => setMode('P6'));

  $('wc-run').addEventListener('click', async () => {
    const btn = $('wc-run');
    btn.disabled = true; btn.textContent = 'Checking…';
    $('wc-verdict').hidden = true;
    renderChecks();
    const items = [...list.children];
    const c = CASES[mode];
    for (let i = 0; i < CHECKS.length; i++) {
      items[i].classList.add('on');
      await new Promise((r) => setTimeout(r, 170));
      items[i].classList.remove('on');
      const isRecipient = CHECKS[i][0] === 'Recipient match';
      items[i].classList.add(isRecipient ? (c.recipientPass ? 'pass' : 'fail') : 'pass');
      if (isRecipient && !c.recipientPass) break; /* the story stops where the money would have left */
    }
    const v = $('wc-verdict'), stamp = $('wc-stamp');
    stamp.textContent = c.stamp;
    stamp.classList.toggle('paid', c.paid);
    $('wc-verdict-head').textContent = c.head;
    $('wc-verdict-sub').textContent = c.sub;
    v.hidden = false;
    stamp.classList.remove('stamp-in'); void stamp.offsetWidth; stamp.classList.add('stamp-in');
    btn.disabled = false; btn.textContent = 'Run the check again';
  });

  /* Exhibit D - live verification from public RPC via the app's observer. */
  async function getJson(url) {
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }
  $('wc-verify').addEventListener('click', async () => {
    const btn = $('wc-verify');
    btn.disabled = true; btn.textContent = 'Reading finalized chain state…';
    try {
      const d = await getJson('/api/testnet/state?mandate=M4&proposal=' + mode);
      $('wc-live-mandate').textContent = d.mandate
        ? `${d.mandate.id} · pay ${d.mandate.recipient} · cap 0.005 NEAR · status ${d.mandate.status}` : 'not found';
      $('wc-live-proposal').textContent = d.proposal
        ? `${d.proposal.id} · pay ${d.proposal.recipient} · 0.005 NEAR` : 'not found';
      const verdict = $('wc-live-verdict');
      verdict.textContent = d.proposal
        ? (d.proposal.status + (d.proposal.reasons?.length ? ' · ' + d.proposal.reasons.join(', ') : '')) : '-';
      $('wc-live-note').textContent = `Fresh from NEAR Testnet via ${d.rpc || 'public RPC'} · finalized blocks: vault ${d.blocks?.vault ?? '-'} · read at ${new Date(d.observed_at).toLocaleTimeString()}.`;
    } catch (e) {
      $('wc-live-verdict').textContent = 'UNVERIFIED - ' + e.message;
      $('wc-live-note').textContent = 'The observer could not reach Testnet RPC just now, so it shows nothing rather than inventing a state. The explorer receipt link above is independent of this app.';
    } finally {
      btn.disabled = false; btn.textContent = 'Verify live from Testnet';
    }
  });
})();
