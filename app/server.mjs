/** Zero-dependency WITNESS local simulation. NOT blockchain enforcement. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seededVault, ATTACKER, SUPPLIER, toYocto, hashInvoice } from '../core/policy.mjs';
import { parseCustomInvoice } from '../core/parse-custom.mjs';
import { makeTestnetReader, assertAccountId } from '../core/testnet-rpc.mjs';
const __dirname=dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||4173);
let instance=seededVault();
const testnetContract=process.env.WITNESS_TESTNET_ACCOUNT?.trim()||'';
// Only read-only RPC requests; no secrets or signing credentials are loaded.
const testnetReader=makeTestnetReader();
let last=null;
const attacks={
  hidden:{title:'Invisible invoice injection',recipient:ATTACKER,near:'5',invoice:'original',detail:'Invisible characters tell the AI to replace the supplier wallet.'},
  redirect:{title:'Supplier account substitution',recipient:'replacement.testnet',near:'5',invoice:'original',detail:'A spoofed vendor email claims a new receiving address.'},
  inflated:{title:'Amount inflation',recipient:SUPPLIER,near:'50',invoice:'original',detail:'The document asks for 50 NEAR instead of the 5 NEAR limit.'},
  fakeApproval:{title:'Forged executive authorization',recipient:ATTACKER,near:'5',invoice:'original',detail:'A forged message claims the CEO already approved a new beneficiary.'},
  mismatch:{title:'Invoice authority mismatch',recipient:SUPPLIER,near:'5',invoice:'fake',detail:'The document content does not match the owner-authorized reference.'},
  drift:{title:'Policy changes before execution',recipient:SUPPLIER,near:'5',invoice:'original',detail:'The owner changes mandate version after the agent creates its proposal.'},
  replay:{title:'Repeat an already paid invoice',recipient:SUPPLIER,near:'5',invoice:'original',detail:'A second attempt tries to reuse an already consumed mandate.'},
};
function send(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'http://localhost:4174'});res.end(JSON.stringify(obj));}
function state(){return {snapshot:instance.vault.snapshot(),mandate:instance.mandate,last,scenario_catalog:Object.entries(attacks).map(([id,v])=>({id,title:v.title,detail:v.detail})),simulation:true,contract_deployed:false};}
async function body(req){let input='';for await(const c of req){input+=c;if(input.length>8000)throw new Error('Payload too large');}return input?JSON.parse(input):{};}
function attack(id){
  if(!(id in attacks))throw new Error('Unknown attack');
  instance=seededVault();
  const {vault,mandate}=instance; const attack=attacks[id];
  const invoice_hash=attack.invoice==='fake'?hashInvoice('forged and unrelated business document'):mandate.invoice_hash;
  const proposal=vault.propose({who:vault.roles.agent,mandate_id:mandate.id,recipient:attack.recipient,amount_yocto:toYocto(attack.near),invoice_hash,note:attack.detail});
  if(id==='drift'){vault.reviseMandate({who:vault.roles.owner,id:mandate.id,cap_yocto:toYocto('4')});}
  if(id==='replay'){
    const original=vault.propose({who:vault.roles.agent,mandate_id:mandate.id,recipient:SUPPLIER,amount_yocto:toYocto('5'),invoice_hash:mandate.invoice_hash});
    const first=vault.execute({who:vault.roles.agent,id:original.id});if(first.status==='EXECUTING')vault.settle({id:original.id,success:true});
  }
  const evaluated=vault.assess(proposal.id);
  const before=vault.available_yocto;
  const execution=vault.execute({who:vault.roles.agent,id:proposal.id});
  last={kind:'attack',id,attack,proposal_id:proposal.id,evaluated:{allowed:evaluated.allowed,reasons:evaluated.reasons},execution,available_before:before,available_after:vault.available_yocto};
  return state();
}
function customAttack(raw) {
  if (typeof raw !== 'string' || raw.length > 1200) throw new Error('Provide a short instruction (max 1200 characters).');
  instance = seededVault();
  const {vault, mandate} = instance;
  const parsed = parseCustomInvoice(raw);
  if (!parsed.ok) {
    last = {
      kind: 'custom-unparsed', id: 'custom', proposal_id: null,
      attack: {title:'Unparseable custom input', detail:raw.slice(0,180)},
      evaluated: {allowed:false, reasons:['UNPARSEABLE_REQUEST']},
      execution: {status:'DENIED', reasons:['UNPARSEABLE_REQUEST']},
      parse_message: parsed.reason, simulation_agent:'heuristic',
    };
    return state();
  }
  const p = vault.propose({
    who:vault.roles.agent, mandate_id:mandate.id, recipient:parsed.recipient,
    amount_yocto:toYocto(parsed.nearAmount), invoice_hash:mandate.invoice_hash,
    note: parsed.note,
  });
  const evaluation = vault.assess(p.id);
  const execution = vault.execute({who:vault.roles.agent,id:p.id});
  if(execution.status==='EXECUTING')vault.settle({id:p.id,success:true});
  last={
    kind:execution.status==='EXECUTING'?'custom-valid':'attack',
    id:'custom', attack:{title:'Custom judge input',detail:raw.slice(0,180)},
    proposal_id:p.id,
    evaluated:{allowed:evaluation.allowed,reasons:evaluation.reasons},
    execution, parsed, simulation_agent:'heuristic'
  };
  return state();
}
function legitimate(){
  instance=seededVault();const {vault,mandate}=instance;
  const p=vault.propose({who:vault.roles.agent,mandate_id:mandate.id,recipient:SUPPLIER,amount_yocto:toYocto('5'),invoice_hash:mandate.invoice_hash});
  const execute=vault.execute({who:vault.roles.agent,id:p.id});
  // This is a SIMULATED successful asynchronous callback. No NEAR transfer occurred.
  const settlement=execute.status==='EXECUTING'?vault.settle({id:p.id,success:true}):null;
  last={kind:'legitimate',proposal_id:p.id,execution:execute,settlement};return state();
}
const resources={
  '/':'index.html',
  '/index.html':'index.html',
  '/main.js':'main.js',
  '/testnet.js':'testnet.js',
  '/witness-motion.js':'witness-motion.js',
  '/witness-motion.css':'witness-motion.css',
  '/witness-polish.css':'witness-polish.css',
  '/styles.css':'styles.css',
  '/reviewer':'reviewer.html',
  '/case':'case.html',
  '/case.html':'case.html',
  '/witness-case.js':'witness-case.js',
  '/witness-case.css':'witness-case.css',
  '/reviewer.html':'reviewer.html',
  '/reviewer.js':'reviewer.js',
};
const contentType={'html':'text/html; charset=utf-8','css':'text/css; charset=utf-8','js':'text/javascript; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const path=(req.url||'/').split('?')[0];
  try {
    if(path==='/api/testnet/config'&&req.method==='GET'){
      if(testnetContract) assertAccountId(testnetContract,'configured contract');
      send(res,200,{network:'testnet',configured:!!testnetContract,contract:testnetContract||null,readonly:true,simulation:false});return;
    }
    if((path==='/api/testnet/state'||path==='/api/testnet/tx') && req.method==='GET'){
      if(!testnetContract){send(res,503,{error:'Set WITNESS_TESTNET_ACCOUNT to a deployed vault account in Ubuntu first.'});return;}
      assertAccountId(testnetContract,'configured contract');
      const url=new URL(req.url,'http://localhost');
      if(path==='/api/testnet/state'){
        const result=await testnetReader.snapshot(testnetContract,{mandateId:url.searchParams.get('mandate'),proposalId:url.searchParams.get('proposal')});
        send(res,200,result);return;
      }
      const result=await testnetReader.txEvidence(testnetContract,url.searchParams.get('sender'),url.searchParams.get('hash'));
      send(res,200,result);return;
    }
    if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'http://localhost:4174','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});res.end();return;}
    if(path==='/api/state'&&req.method==='GET'){send(res,200,state());return;}
    if(path==='/api/reset'&&req.method==='POST'){instance=seededVault();last=null;send(res,200,state());return;}
    if(path==='/api/attack'&&req.method==='POST'){const x=await body(req);send(res,200,attack(x.id));return;}
    if(path==='/api/legitimate'&&req.method==='POST'){send(res,200,legitimate());return;}
    if(path==='/api/custom'&&req.method==='POST'){const x=await body(req);send(res,200,customAttack(x.text));return;}
    if(req.method==='GET' && path.startsWith('/assets/') && /^\/assets\/[a-z0-9-]+\.png$/.test(path)){const contents=await readFile(join(__dirname,path.slice(1)));res.writeHead(200,{'content-type':'image/png','cache-control':'public, max-age=86400'});res.end(contents);return;}
    if(req.method==='GET' && path in resources){const filename=resources[path];const contents=await readFile(join(__dirname,filename));const ext=filename.split('.').pop();res.writeHead(200,{'content-type':contentType[ext]||'application/octet-stream','cache-control':'no-store','content-security-policy':"default-src 'self'; connect-src 'self' http://localhost:4173; style-src 'self'; script-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"});res.end(contents);return;}
    send(res,404,{error:'Not found'});
  } catch(error){send(res,400,{error:error.message});}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`WITNESS: http://localhost:${PORT}\nSIMULATOR: local only. TESTNET OBSERVER: ${testnetContract||'not configured'}. Read-only; no signing.`));
