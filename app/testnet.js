const $=id=>document.getElementById(id);
const formatYocto=value=>{
  if(value===undefined || value===null)return '-';
  try {
    const n=BigInt(value), base=10n**24n;
    const fraction=(n%base).toString().padStart(24,'0').replace(/0+$/,'').slice(0,6);
    return `${n/base}${fraction?'.'+fraction:''} NEAR`;
  } catch { return '-'; }
};
const set=(id,value)=>{ const el=$(id);if(el)el.textContent=String(value??'-');};
const link=(container,text,url)=>{
  const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener noreferrer';
  container.append(a);
};
async function getJson(url){const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),30000);try{const r=await fetch(url,{cache:'no-store',signal:ctl.signal});const data=await r.json();if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data;}catch(e){if(e.name==='AbortError')throw new Error('Testnet read timed out');throw e;}finally{clearTimeout(timer);}}
let config;
async function refresh(){
  set('tn-feedback','Reading finalized NEAR Testnet state…');
  try {
    const params=new URLSearchParams();
    for(const [key,id] of [['mandate','tn-mandate-id'],['proposal','tn-proposal-id']]){
      const val=$(id).value.trim();if(val)params.set(key,val);
    }
    const data=await getJson('/api/testnet/state?'+params);
    set('tn-status','TESTNET · CONNECTED');
    $('tn-status').className='mini-tag approved';
    set('tn-contract',data.contract);
    set('tn-available',formatYocto(data.vault.available_yocto));
    set('tn-inflight',formatYocto(data.vault.inflight_yocto));
    set('tn-mandate',data.mandate?`${data.mandate.id} · ${data.mandate.recipient} · cap ${formatYocto(data.mandate.cap_yocto)} · v${data.mandate.version}`:'Not selected or not found');
    set('tn-proposal',data.proposal?`${data.proposal.id} · ${data.proposal.status} · ${data.proposal.recipient} · ${formatYocto(data.proposal.amount_yocto)}`:'Not selected or not found');
    const p=data.proposal;
    const verdict=$('tn-verdict');
    const status=p?.status||'NOT SELECTED';
    const states={PAID:'Chain storage confirms PAID',FAILED:'Chain storage confirms FAILED',DENIED:'Chain storage confirms DENIED',EXECUTING:'Payment remains EXECUTING - do not claim PAID',PROPOSED:'Payment is PROPOSED - not yet evaluated'};
    verdict.textContent=states[status]||'Select a real proposal ID to display its contract status.';
    if(p?.reasons?.length)verdict.textContent+=' · '+p.reasons.join(', ');
    verdict.className='chain-verdict '+(status==='PAID'?'success':status==='DENIED'||status==='FAILED'?'danger':'pending');
    if(p && data.mandate && p.mandate_id===data.mandate.id){
      const m=data.mandate;
      verdict.textContent+=' · '+(p.recipient===m.recipient?'recipient matches owner mandate':'recipient differs from owner mandate');
      verdict.textContent+=' · proposal version '+p.mandate_version+' / mandate version '+m.version;
    }
    set('tn-block',`Finalized query blocks: vault ${data.blocks.vault??'-'} · audit ${data.blocks.audit??'-'} (not atomic)`);
    const events=$('tn-events');events.replaceChildren();
    if(!data.audit?.length) events.textContent='No contract audit entries yet.';
    else for(const e of [...data.audit].reverse()){
      const item=document.createElement('div');item.className='chain-event';
      const name=document.createElement('strong');name.textContent=e.type||'EVENT';
      const desc=document.createElement('small');desc.textContent=JSON.stringify(e);
      item.append(name,desc);events.append(item);
    }
    set('tn-feedback',`Actual contract storage queried from NEAR Testnet · ${new Date(data.observed_at).toLocaleString()}`);
  return true;
  } catch(error){set('tn-feedback',`No verified state: ${error.message}`);set('tn-status','TESTNET · UNVERIFIED');$('tn-status').className='mini-tag danger';return false;}
}
async function verify(){
  set('tn-tx-feedback','Verifying transaction through NEAR Testnet RPC…');
  $('tn-tx-evidence').replaceChildren();
  try {
    const hash=$('tn-hash').value.trim(),sender=$('tn-sender').value.trim();
    const p=new URLSearchParams({hash,sender});
    const result=await getJson('/api/testnet/tx?'+p);
    const summary=`${result.payment_outcome} · ${result.final_execution_status} · ${result.contract_events.length} WITNESS event(s)`;
    set('tn-tx-feedback',summary);
    const wrapper=$('tn-tx-evidence');
    for(const e of result.contract_events){const div=document.createElement('div');div.className='chain-event';
      const strong=document.createElement('strong');strong.textContent=e.event;
      const small=document.createElement('small');small.textContent=JSON.stringify(e.data||[]);
      div.append(strong,small);wrapper.append(div);
    }
    link(wrapper,'Open independent Testnet explorer receipt',result.explorer_url);
    const foot=document.createElement('p');foot.className='evidence-warning';foot.textContent=result.caution;wrapper.append(foot);
  }catch(error){set('tn-tx-feedback',`Unable to verify: ${error.message}`);}
}
async function init(){
  try {config=await getJson('/api/testnet/config');
    if(!config.configured){set('tn-status','TESTNET · NOT CONFIGURED');set('tn-feedback','Set WITNESS_TESTNET_ACCOUNT in Ubuntu and restart the app. The simulation above remains separate.');return;}
    set('tn-status','TESTNET · CHECKING');set('tn-contract',config.contract);for(let attempt=0;attempt<3;attempt++){if(await refresh())break;if(attempt<2)await new Promise(r=>setTimeout(r,3000*(attempt+1)));}
  }catch(error){set('tn-feedback',error.message);}
}
$('tn-refresh').addEventListener('click',refresh);
$('tn-verify').addEventListener('click',verify);
await init();
