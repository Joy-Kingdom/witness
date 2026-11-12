/* WITNESS creative system - wires "The Check" into every interaction.
   Purely presentational: it never changes data, verdicts or requests. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const CHECKS = ['Not revoked', 'Not consumed', 'Not expired', 'Version match',
    'Recipient match', 'Within cap', 'Invoice fingerprint', 'Mandate binding', 'Vault balance'];

  /* The Thread - evidence line across the top, fills as the case is read. */
  const thread = document.createElement('div');
  thread.id = 'wm-thread';
  document.body.prepend(thread);
  addEventListener('scroll', () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    thread.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }, { passive: true });

  /* The Stamp - restamp whenever a verdict element changes.
     Guarded: observing class changes on a subtree that contains the stamp
     itself would retrigger forever, so we watch text only and ignore our
     own animation class writes. */
  function watchStamp(el, target) {
    if (!el) return;
    let busy = false, last = '';
    new MutationObserver(() => {
      if (busy) return;
      const t = target();
      if (!t) return;
      const now = t.textContent;
      if (now === last) return;
      last = now;
      busy = true;
      t.classList.remove('wm-stamp-in');
      void t.offsetWidth; /* restart the animation */
      t.classList.add('wm-stamp-in');
      setTimeout(() => { busy = false; }, 450);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  watchStamp($('wt-ev-verdict'), () => $('wt-ev-stamp'));
  watchStamp($('verdict'), () => $('verdict-icon'));

  /* The Swap - flip the changed word when the judge switches P5 / P6. */
  for (const pair of [['wt-select-p5', 'wt-case'], ['wt-select-p6', 'wt-case'],
                      ['wt-ev-p5', 'wt-ev-case'], ['wt-ev-p6', 'wt-ev-case']]) {
    const btn = $(pair[0]), box = document.querySelector('.' + pair[1]) || $(pair[1]);
    if (btn && box) btn.addEventListener('click', () => {
      box.classList.remove('wm-swap'); void box.offsetWidth; box.classList.add('wm-swap');
      setTimeout(() => box.classList.remove('wm-swap'), 750);
    });
  }

  /* The Nine Checks - the only loading state: checking IS the product. */
  function runChecks(anchorBtn, watchEl) {
    if (!anchorBtn || anchorBtn.dataset.wmBusy) return;
    anchorBtn.dataset.wmBusy = '1';
    const list = document.createElement('ol');
    list.className = 'wm-checks';
    list.innerHTML = '<li class="wm-checks-head">The contract is checking</li>' +
      CHECKS.map((c) => `<li>${c}</li>`).join('');
    anchorBtn.closest('div')?.after(list);
    const items = [...list.querySelectorAll('li:not(.wm-checks-head)')];
    let i = 0;
    const timer = setInterval(() => {
      if (i > 0) items[i - 1].classList.add('done');
      if (i < items.length) items[i].classList.add('on');
      i++;
      if (i > items.length) clearInterval(timer);
    }, 120);
    const finish = () => {
      items.forEach((li) => li.classList.add('done'));
      setTimeout(() => { list.remove(); delete anchorBtn.dataset.wmBusy; }, 450);
    };
    if (watchEl) {
      const before = watchEl.textContent;
      const obs = new MutationObserver(() => {
        if (watchEl.textContent !== before) { obs.disconnect(); finish(); }
      });
      obs.observe(watchEl, { childList: true, characterData: true, subtree: true });
      setTimeout(() => { obs.disconnect(); finish(); }, 15000); /* never trap the UI */
    } else setTimeout(finish, 1400);
  }
  const evCheck = $('wt-ev-check');
  if (evCheck) evCheck.addEventListener('click', () => runChecks(evCheck, $('wt-ev-live')));
  const tnRefresh = $('tn-refresh');
  if (tnRefresh) tnRefresh.addEventListener('click', () => {
    runChecks(tnRefresh, $('tn-feedback'));
    const ev = $('tn-events');
    if (ev) { ev.classList.add('wm-skeleton'); setTimeout(() => ev.classList.remove('wm-skeleton'), 2500); }
  });
})();
