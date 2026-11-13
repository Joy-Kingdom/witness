/* WITNESS_REVIEWER_FINAL_V1 - registered before original homepage JS so this page works independently. */
;(() => {
  'use strict';
  if (!/^\/reviewer\/?$/.test(location.pathname)) return;
  function initReviewer() {
    const $ = id => document.getElementById(id);
    if (!$('wt-ev-check')) return;
    const SUPPLIER = 'mujeebwajid-witness-supplier.testnet';
    const AGENT = 'mujeebwajid-witness-agent.testnet';
    const CONTRACT = 'mujeebwajid-witness-vault.testnet';
    const YOCTO = '5000000000000000000000';
    const TX_BASE = 'https://explorer.testnet.near.org/transactions/';
    const cases = {
      P5: { status: 'DENIED', recipient: AGENT, reason: 'RECIPIENT_MISMATCH', tx: '2Ckv4xy9GkNjWef4zN2T3qB9zb6qhhkMo2c6BJbs1Q3k' },
      P6: { status: 'PAID', recipient: SUPPLIER, reason: null, tx: '9GToMDg9Qw1QCSKeiq4vea9V7a6ZmtCKv69RtQBFXQUv' }
    };
    let proposalId = 'P5', live = null, fetchGeneration = 0;
    function setStatus(message, kind='') {
      const node = $('wt-ev-live'); node.textContent = message;
      node.classList.toggle('is-ok', kind === 'ok'); node.classList.toggle('is-error', kind === 'error');
    }
    function setFingerprintStatus(message,kind='') {
      const node=$('wt-ev-hash-status'); node.textContent=message;
      node.classList.toggle('is-ok',kind==='ok'); node.classList.toggle('is-error',kind==='error');
    }
    function paintAccount(id, suffix, danger) {
      const el=$(id); el.replaceChildren(document.createTextNode('mujeebwajid-witness-'));
      const bold=document.createElement('b'); bold.textContent=suffix;
      if(danger) bold.className='wt-ev-flag';
      el.append(bold,document.createTextNode('.testnet'));
    }
    function select(id) {
      proposalId = id; live=null; fetchGeneration++;
      const c=cases[id], paid=id==='P6';
      $('wt-ev-p5').classList.toggle('is-active',!paid);
      $('wt-ev-p6').classList.toggle('is-active',paid);
      $('wt-ev-p5').setAttribute('aria-pressed',String(!paid));
      $('wt-ev-p6').setAttribute('aria-pressed',String(paid));
      $('wt-ev-supplier').textContent=paid?'Approved supplier':'Different account';
      paintAccount('wt-ev-requested',paid?'supplier':'agent',!paid);
      $('wt-ev-pid').textContent=id;
      $('wt-ev-versus').textContent=paid?'=':'≠';
      $('wt-ev-verdict').classList.toggle('is-paid',paid);
      $('wt-ev-stamp').textContent=paid?'PAID':'DENIED';
      $('wt-ev-verdict-head').textContent=paid?'Approved recipient':'Recipient mismatch';
      $('wt-ev-verdict-sub').textContent=paid?'P6 settled 0.005 NEAR to the supplier. Historical case; live verification pending.':'P5 was denied. Historical case; live verification pending.';
      $('wt-ev-explorer').href=TX_BASE+c.tx;
      $('wt-ev-explorer').textContent='View '+id+' receipt ↗';
      $('wt-ev-chain-hash').textContent='Not loaded';
      $('wt-ev-raw').textContent='No fresh read for '+id+'.';
      setStatus('Historical reference only. Click to verify this record against live Testnet.');
      setFingerprintStatus('Requires a successful live M4 check.');
    }
    function assess(d,id) {
      const m=d?.mandate,p=d?.proposal,c=cases[id];
      if(d?.network!=='testnet'||d?.contract!==CONTRACT||d?.simulation!==false) return 'Not a verified NEAR Testnet response';
      if(!m||m.id!=='M4'||m.recipient!==SUPPLIER||String(m.cap_yocto)!==YOCTO) return 'Owner mandate mismatch';
      if(typeof m.invoice_hash!=='string'||!/^sha256:[0-9a-f]{64}$/.test(m.invoice_hash)) return 'Missing or invalid source fingerprint';
      if(!p||p.id!==id||p.mandate_id!=='M4'||p.recipient!==c.recipient||String(p.amount_yocto)!==YOCTO||p.status!==c.status||p.invoice_hash!==m.invoice_hash) return 'Proposal does not match owner mandate and recorded case';
      if(id==='P5'&&(!Array.isArray(p.reasons)||!p.reasons.includes(c.reason))) return 'Denied reason missing';
      if(id==='P6'&&Array.isArray(p.reasons)&&p.reasons.length) return 'Paid proposal includes denial reasons';
      if(!Array.isArray(d.audit)||!d.audit.some(x=>x.type===(id==='P5'?'PAYMENT_DENIED':'PAYMENT_PAID')&&x.id===id)) return 'Expected on-chain decision event missing';
      if(!Number.isSafeInteger(d.blocks?.proposal)||d.blocks.proposal<=0) return 'Finalized block evidence missing';
      return '';
    }
    async function check() {
      const current=proposalId, generation=++fetchGeneration;
      live=null; setStatus('Reading finalized NEAR Testnet state…');
      setFingerprintStatus('Waiting for a verified M4 response.');
      $('wt-ev-check').disabled=true;
      let timeout;
      try {
        const controller=new AbortController();
        timeout=setTimeout(()=>controller.abort(),18000);
        const res=await fetch('/api/testnet/state?mandate=M4&proposal='+current,{cache:'no-store',signal:controller.signal});
        let d;try{d=await res.json()}catch{throw new Error('Invalid JSON response')}
        if(generation!==fetchGeneration)return;
        if(!res.ok)throw new Error(d?.error||'HTTP '+res.status);
        const error=assess(d,current);
        $('wt-ev-raw').textContent=JSON.stringify(d,null,2);
        if(error)throw new Error('Contract data mismatch: '+error);
        live=d;
        $('wt-ev-chain-hash').textContent=d.mandate.invoice_hash;
        setStatus('CONFIRMED · '+current+' '+d.proposal.status+' · finalized block '+d.blocks.proposal+' · public contract record','ok');
        setFingerprintStatus('Live M4 loaded. Choose the original invoice file or paste exact text.');
      } catch(e) {
        if(generation!==fetchGeneration)return;
        live=null;
        setStatus('Not verified · '+(e?.name==='AbortError'?'RPC request timed out':e?.message||'RPC unavailable')+'. Retry this read.','error');
        setFingerprintStatus('A fresh verified mandate is required.','error');
      } finally {
        clearTimeout(timeout);
        if(generation===fetchGeneration)$('wt-ev-check').disabled=false;
      }
    }
    $('wt-ev-p5').addEventListener('click',()=>select('P5'));
    $('wt-ev-p6').addEventListener('click',()=>select('P6'));
    $('wt-ev-check').addEventListener('click',check);
    $('wt-ev-file').addEventListener('change',()=>{if($('wt-ev-file').files?.length)$('wt-ev-text').value='';setFingerprintStatus('Compare file bytes with fresh on-chain M4.');});
    $('wt-ev-text').addEventListener('input',()=>{if($('wt-ev-file').value)$('wt-ev-file').value='';setFingerprintStatus('Compare exact UTF-8 text with fresh on-chain M4.');});
    $('wt-ev-hash').addEventListener('click',async()=>{
      const d=live,generation=fetchGeneration;
      if(!d){setFingerprintStatus('First verify M4 against Testnet.','error');return}
      if(!globalThis.crypto?.subtle){setFingerprintStatus('SHA-256 requires localhost or HTTPS.','error');return}
      let bytes;
      const file=$('wt-ev-file').files?.[0];
      try {
        if(file){if(file.size>1048576){setFingerprintStatus('Choose a source file no larger than 1 MiB.','error');return}bytes=await file.arrayBuffer()}
        else {const value=$('wt-ev-text').value;if(value.length===0){setFingerprintStatus('Choose the exact source file or paste invoice text.','error');return}bytes=new TextEncoder().encode(value)}
        const hash=await crypto.subtle.digest('SHA-256',bytes);
        if(generation!==fetchGeneration||d!==live){setFingerprintStatus('Case changed. Verify the new record first.','error');return}
        const hex=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
        const expected=d.mandate.invoice_hash;
        const match=('sha256:'+hex)===expected;
        setFingerprintStatus(match?'MATCH · Exact invoice bytes equal the hash committed in M4.':'MISMATCH · Source SHA-256 '+hex.slice(0,16)+'… differs from the on-chain fingerprint.',match?'ok':'error');
      }catch(e){setFingerprintStatus('Unable to hash source: '+e.message,'error')}
    });
    select('P5');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initReviewer,{once:true});else initReviewer();
})();

/* The lab section below belongs to the homepage only. Guard it so this
   file also parses and runs on the evidence page, which loads it as a
   classic script (a top-level await there killed every evidence-page
   button bound earlier in this file). */
if(document.getElementById('attack-options')){
let selected='hidden';
const $=id=>document.getElementById(id);
const labels={MANDATE_REVOKED:'Mandate was revoked by its owner',MANDATE_ALREADY_USED:'Mandate already consumed',MANDATE_EXPIRED:'Authorized payment window expired',POLICY_VERSION_DRIFT:'Authorization changed after proposal',RECIPIENT_MISMATCH:'Recipient differs from owner mandate',AMOUNT_EXCEEDS_CAP:'Amount exceeds owner-approved cap',INVALID_AMOUNT:'Amount must be positive',INVOICE_REFERENCE_MISMATCH:'Invoice reference differs from the authorized one',MANDATE_MISMATCH:'Wrong mandate',INSUFFICIENT_VAULT_BALANCE:'Vault has insufficient funded balance',UNPARSEABLE_REQUEST:'Input was not recognized; no payment was proposed or executed'};
const near=yocto=>{if(!yocto)return '-';let n=BigInt(yocto);let a=(n/10n**24n).toString(),b=(n%10n**24n).toString().padStart(24,'0').replace(/0+$/,'');return a+(b?'.'+b:'')+' NEAR';};
function text(id,s){$(id).textContent=String(s??'-');}
async function call(path,data){const r=await fetch('/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data||{})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d;}
async function state(){const r=await fetch('/api/state');return r.json();}
function catalog(list){$('attack-options').replaceChildren();list.forEach((x,i)=>{const b=document.createElement('button');b.className='attack-option'+(x.id===selected?' active':'');b.innerHTML=`<span class="order">0${i+1} / ATTACK</span><strong></strong><small></small>`;b.querySelector('strong').textContent=x.title;b.querySelector('small').textContent=x.detail;b.addEventListener('click',()=>{selected=x.id;catalog(list);text('run-status','Selected: '+x.title);});$('attack-options').appendChild(b);});}
function render(d){const m=d.snapshot.mandates[d.mandate.id];text('mandate-supplier',m.supplier);text('mandate-recipient',m.recipient);text('mandate-amount',near(m.cap_yocto));text('mandate-version',m.version);text('mandate-ref',m.invoice_hash.slice(0,16)+'…');
const p=d.last?d.snapshot.proposals[d.last.proposal_id]:null;
text('proposal-recipient',p?.recipient||'-');text('proposal-amount',p?near(p.amount_yocto):'-');text('proposal-version',p?.mandate_version||'-');text('proposal-ref',p?p.invoice_hash.slice(0,16)+'…':'-');text('proposal-note',p?.note|| (p ? 'Payment proposal created from the demonstration workflow.' : d.last?.kind==='custom-unparsed' ? 'The custom instruction was not parsed. No payment was attempted.' : 'No proposal submitted yet.'));text('proposal-tag',p?p.status:(d.last?.kind==='custom-unparsed'?'UNPARSED':'AWAITING PROPOSAL'));
$('proposal-tag').className='mini-tag '+(p?.status==='DENIED'?'danger':p?.status==='PAID'?'approved':'pending');$('proposal-recipient').className=p?(p.recipient!==m.recipient?'bad':'good'):'';$('proposal-amount').className=p?(BigInt(p.amount_yocto)>BigInt(m.cap_yocto)?'bad':'good'):'';
const v=$('verdict');if(!d.last){v.className='verdict blank';text('verdict-icon','◎');text('verdict-title','WITNESS is ready');text('verdict-details','Choose an attack. We will show what the deterministic policy decides and why.');text('verdict-status','WAITING');}
else if(d.last.kind==='legitimate'||d.last.kind==='custom-valid'){v.className='verdict paid';text('verdict-icon','✓');text('verdict-title','Permitted payment settled - LOCAL SIMULATION');text('verdict-details','The agent stayed within the mandate. A simulated callback marked the payment PAID; no blockchain transaction took place.');text('verdict-status','SIMULATED PAID');}
else{v.className='verdict denied';text('verdict-icon','×');text('verdict-title','Unauthorized payment refused - LOCAL SIMULATION');const reasons=d.last.execution?.reasons||d.last.evaluated.reasons;text('verdict-details',d.last.parse_message || reasons.map(x=>labels[x]||x).join(' · '));text('verdict-status','SIMULATED BLOCK');}
$('events').replaceChildren();if(!d.snapshot.events.length){$('events').textContent='Run a scenario to generate an audit trail.';}else d.snapshot.events.slice().reverse().forEach(e=>{const r=document.createElement('div');r.className='event';const n=document.createElement('span');n.className='event-num';n.textContent=String(e.seq).padStart(2,'0');const a=document.createElement('div');a.className='event-main';const b=document.createElement('strong');b.textContent=e.type.replaceAll('_',' ');const c=document.createElement('small');c.textContent=JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k])=>!['seq','at_ms','type'].includes(k))));a.append(b,c);r.append(n,a);$('events').appendChild(r);});
text('invoice-note',d.last?.attack?`Fictional adversarial input: ${d.last.attack.detail} This text can mislead an agent; it cannot authorize new money movements.`:'Attack text appears here after a scenario is selected. The agent input is not trusted authorization.');
}
async function run(kind){$('run').disabled=true;$('valid').disabled=true;try{const d=kind==='legitimate'?await call('legitimate'):await call('attack',{id:selected});render(d);text('run-status','Scenario completed • local deterministic model');}catch(e){text('run-status',e.message);}finally{$('run').disabled=false;$('valid').disabled=false;}}
$('custom-run').addEventListener('click',async()=>{try{const d=await call('custom',{text:$('custom-text').value});render(d);text('run-status',d.last?.kind==='custom-unparsed' ? 'Unrecognized text: no payment was attempted.' : 'Custom instruction parsed by deterministic heuristic (not an LLM).');}catch(e){text('run-status',e.message);}});$('run').addEventListener('click',()=>run('attack'));$('valid').addEventListener('click',()=>run('legitimate'));$('reset').addEventListener('click',async()=>{const d=await call('reset');render(d);text('run-status','Lab reset.');});
(async()=>{try{const initial=await state();catalog(initial.scenario_catalog);render(initial);}catch(e){}})();
}


// WB_DIRECT_4 - historical Testnet cases; no signing.
(()=>{
const $=id=>document.getElementById(id);
if(!$('wb-p5')||!$('wb-p6'))return;

const data={
  p5:{
    id:'P5',
    account:'mujeebwajid-witness-agent.testnet',
    head:'Different recipient',
    bad:true
  },
  p6:{
    id:'P6',
    account:'mujeebwajid-witness-supplier.testnet',
    head:'Approved supplier',
    bad:false
  }
};

const box=document.querySelector('.w-split article:nth-child(2)');

function show(k){
  const x=data[k];
  for(const name of ['p5','p6']){
    $('wb-'+name).classList.toggle('active',name===k);
  }

  box.querySelector('small').textContent='THE AGENT REQUESTED / '+x.id;
  box.querySelector('h3').textContent=x.head;

  const account=box.querySelector('strong');
  account.textContent=x.account;
  account.classList.toggle('w-wrong',x.bad);

  document.querySelector('.w-result').style.display=x.bad?'flex':'none';
  document.querySelector('.w-success').style.display=x.bad?'none':'flex';

  const m=$('tn-mandate-id'),p=$('tn-proposal-id');
  if(m)m.value='M4';
  if(p)p.value=x.id;
}

$('wb-p5').addEventListener('click',()=>show('p5'));
$('wb-p6').addEventListener('click',()=>show('p6'));
show('p5');
})();

/* WITNESS_VISUAL_REPAIR_EXTERNAL_JS_V1 BEGIN */
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
/* WITNESS_VISUAL_REPAIR_EXTERNAL_JS_V1 END */

/* WITNESS_FINAL_POLISH_V1: presentation only, no contract calls and no payment methods. */
(() => {
  'use strict';
  const whenReady = () => {
    if (!document.getElementById('wt-case')) return;
    // Keep the footer to a single truthful, original disclosure.
    document.querySelectorAll('.wt-footer-note').forEach(n => n.remove());
    const observer = document.querySelector('details.wt-bound-chain') || document.querySelector('#testnet-proof');
    // The mock default IDs M1/P2 distract from the recorded public demonstration M4/P5.
    const mandate = document.getElementById('tn-mandate-id');
    const proposal = document.getElementById('tn-proposal-id');
    if (mandate && (!mandate.value.trim() || /^M1$/i.test(mandate.value.trim()))) mandate.value = 'M4';
    if (proposal && (!proposal.value.trim() || /^P2$/i.test(proposal.value.trim()))) proposal.value = 'P5';
    for (const key of ['p5','p6']) {
      const select = document.getElementById('wt-select-' + key);
      if (!select) continue;
      select.addEventListener('click', () => {
        if (mandate) mandate.value = 'M4';
        if (proposal) proposal.value = key.toUpperCase();
      });
    }
    // Explicitly distinguish configured RPC access from independently confirmed current state.
    const evidence = document.getElementById('wt-verification-state');
    let chainPill = null;
    if (observer) {
      chainPill = [...observer.querySelectorAll('span,small,div,strong')].find(e =>
        e.children.length === 0 && /^(TESTNET\s*[·-]\s*CONNECTED|TESTNET CONNECTED)$/i.test((e.textContent||'').trim()));
    }
    const updateChainPill = () => {
      if (!chainPill || !evidence) return;
      const s = evidence.dataset.state;
      chainPill.classList.add('wt-chain-state');
      if (s === 'ok') {
        chainPill.textContent = 'LIVE READ VERIFIED';
        chainPill.dataset.proofState = 'ok';
      } else if (s === 'warning') {
        chainPill.textContent = 'LIVE READ UNAVAILABLE';
        chainPill.dataset.proofState = 'error';
      } else {
        chainPill.textContent = 'TESTNET · READ ONLY';
        chainPill.dataset.proofState = 'idle';
      }
    };
    updateChainPill();
    if (evidence && chainPill && typeof MutationObserver !== 'undefined') {
      new MutationObserver(updateChainPill).observe(evidence,{attributes:true,attributeFilter:['data-state'],childList:true,subtree:true});
    }
    // Shorten redundant local-simulation prose without changing the input, labels, or handlers.
    const replaceExact = (from,to) => {
      for(const el of document.querySelectorAll('label,small,span,strong,h3,h4,p,div')) {
        if (el.children.length) continue;
        if ((el.textContent||'').trim().toLowerCase() === from.toLowerCase()) el.textContent = to;
      }
    };
    replaceExact('OR TRY YOUR OWN INVOICE INSTRUCTION','CUSTOM ATTACK TEXT');
    replaceExact('Local gullible-agent simulation - not an LLM','Rule-based local test · no LLM');
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',whenReady,{once:true});
  else whenReady();
})();

