/**
 * WITNESS 2.0 — NEAR testnet candidate contract.
 * Status: SOURCE ONLY; not compiled/deployed/audited in this environment.
 * Requires near-sdk-js compilation and independent NEAR Workspaces validation.
 * Native NEAR only. The app's local simulation is NOT blockchain evidence.
 *
 * Role rule: owner enrolls/revises trusted suppliers & mandates; agent only
 * proposes and attempts execution. Every successful transfer is limited to
 * the owner-issued mandate in contract storage. No universal call forwarding.
 *
 * IMPORTANT: this contract's account must hold the protected funds. Do NOT
 * give an AI agent full-access credentials to the contract's NEAR account.
 */
import { NearBindgen, near, call, view, initialize, NearPromise } from 'near-sdk-js';

const T_GAS = 1_000_000_000_000n;
const MAX_AMOUNT = 10n ** 30n;
type Mandate = {id:string; supplier:string; recipient:string; cap_yocto:string; invoice_hash:string;
  expires_at_ns:string; version:number; revoked:boolean; consumed:boolean; status:string};
type Proposal = {id:string; mandate_id:string; recipient:string; amount_yocto:string;
  invoice_hash:string; mandate_version:number; status:string; reasons:string[]};
function assertion(ok:boolean, msg:string){if(!ok) throw new Error(msg)}
function amount(s:string):bigint {
  assertion(typeof s==='string' && /^(0|[1-9]\d*)$/.test(s),'BAD_AMOUNT_FORMAT');
  const n=BigInt(s); assertion(n>0n && n<MAX_AMOUNT,'BAD_AMOUNT'); return n;
}
function validAccount(s:string){assertion(typeof s==='string' && s.length>=2 && s.length<=64 && /^[a-z0-9._-]+$/.test(s),'BAD_ACCOUNT');}
function hashRef(s:string){assertion(typeof s==='string' && /^sha256:[a-f0-9]{64}$/.test(s),'BAD_INVOICE_HASH');}

@NearBindgen({ requireInit: true })
class WitnessVault {
  owner: string='';
  agent: string='';
  mandates: Record<string,Mandate>={};
  proposals: Record<string,Proposal>={};
  audit: any[]=[];
  available_yocto: string='0';
  inflight_yocto: string='0';
  next_id=1;

  private who(){return near.predecessorAccountId()}
  private ownerOnly(){assertion(this.who()===this.owner,'OWNER_ONLY')}
  private agentOnly(){assertion(this.who()===this.agent,'AGENT_ONLY')}
  private log(type:string,payload:any){
    const entry={seq:this.audit.length+1,type,...payload};
    // Demo bounds state cost; a production build needs event indexing/storage accounting.
    if(this.audit.length<200)this.audit.push(entry);
    near.log(`EVENT_JSON:${JSON.stringify({standard:'witness',version:'0.1.0',event:type,data:[payload]})}`);
  }
  private checks(m:Mandate,p:Proposal):string[]{
    const reasons:string[]=[];
    if(m.revoked) reasons.push('MANDATE_REVOKED');
    if(m.consumed) reasons.push('MANDATE_ALREADY_USED');
    if(BigInt(near.blockTimestamp())>=BigInt(m.expires_at_ns)) reasons.push('MANDATE_EXPIRED');
    if(m.version!==p.mandate_version)reasons.push('POLICY_VERSION_DRIFT');
    if(m.recipient!==p.recipient)reasons.push('RECIPIENT_MISMATCH');
    if(amount(p.amount_yocto)>amount(m.cap_yocto))reasons.push('AMOUNT_EXCEEDS_CAP');
    if(m.invoice_hash!==p.invoice_hash)reasons.push('INVOICE_REFERENCE_MISMATCH');
    if(m.id!==p.mandate_id)reasons.push('MANDATE_MISMATCH');
    if(amount(p.amount_yocto)>BigInt(this.available_yocto))reasons.push('INSUFFICIENT_VAULT_BALANCE');
    return reasons;
  }

  @initialize({})
  init({owner,agent}:{owner:string;agent:string}){
    validAccount(owner);validAccount(agent);
    // The account that holds/deploys this contract must initialize it itself.
    // A stranger cannot claim ownership by supplying their own account as `owner`.
    // The deployer must control the vault account's full-access key securely.
    assertion(near.predecessorAccountId()===near.currentAccountId(),'CONTRACT_ACCOUNT_MUST_INITIALIZE');
    this.owner=owner;this.agent=agent;
  }

  @call({payableFunction:true})
  fund(){
    this.ownerOnly();
    const dep=near.attachedDeposit();assertion(dep>0n,'NO_DEPOSIT');
    this.available_yocto=(BigInt(this.available_yocto)+dep).toString();
    this.log('VAULT_FUNDED',{amount_yocto:dep.toString()});
    return {available_yocto:this.available_yocto};
  }

  @call({})
  create_mandate({supplier,recipient,cap_yocto,invoice_hash,expires_at_ns}:{supplier:string;recipient:string;cap_yocto:string;invoice_hash:string;expires_at_ns:string}){
    this.ownerOnly();validAccount(recipient);amount(cap_yocto);hashRef(invoice_hash);
    assertion(typeof supplier==='string'&&supplier.length>0&&supplier.length<=120,'BAD_SUPPLIER');
    assertion(typeof expires_at_ns==='string' && /^\d+$/.test(expires_at_ns) && BigInt(expires_at_ns)>BigInt(near.blockTimestamp()),'BAD_EXPIRY');
    const id=`M${this.next_id++}`;
    const m:Mandate={id,supplier,recipient,cap_yocto,invoice_hash,expires_at_ns,version:1,revoked:false,consumed:false,status:'ACTIVE'};
    this.mandates[id]=m;this.log('MANDATE_CREATED',{id,recipient,cap_yocto});return m;
  }

  @call({})
  revise_mandate({id,recipient,cap_yocto,expires_at_ns}:{id:string;recipient?:string;cap_yocto?:string;expires_at_ns?:string}){
    this.ownerOnly();const m=this.mandates[id];assertion(!!m,'UNKNOWN_MANDATE');
    assertion(!m.consumed && m.status!=='EXECUTING','MANDATE_LOCKED');
    if(recipient!==undefined){validAccount(recipient);m.recipient=recipient;}
    if(cap_yocto!==undefined){amount(cap_yocto);m.cap_yocto=cap_yocto;}
    if(expires_at_ns!==undefined){assertion(/^\d+$/.test(expires_at_ns) && BigInt(expires_at_ns)>BigInt(near.blockTimestamp()),'BAD_EXPIRY');m.expires_at_ns=expires_at_ns;}
    m.version++;this.log('MANDATE_REVISED',{id,version:m.version});return m;
  }

  @call({})
  revoke_mandate({id}:{id:string}){
    this.ownerOnly();const m=this.mandates[id];assertion(!!m,'UNKNOWN_MANDATE');
    assertion(!m.consumed && m.status!=='EXECUTING','MANDATE_LOCKED');
    m.revoked=true;m.version++;this.log('MANDATE_REVOKED',{id});return m;
  }

  @call({})
  propose({mandate_id,recipient,amount_yocto,invoice_hash}:{mandate_id:string;recipient:string;amount_yocto:string;invoice_hash:string}){
    this.agentOnly();validAccount(recipient);amount(amount_yocto);hashRef(invoice_hash);
    const m=this.mandates[mandate_id];assertion(!!m,'UNKNOWN_MANDATE');
    const id=`P${this.next_id++}`;
    const p:Proposal={id,mandate_id,recipient,amount_yocto,invoice_hash,mandate_version:m.version,status:'PROPOSED',reasons:[]};
    this.proposals[id]=p;this.log('AGENT_PROPOSED',{id,mandate_id});return p;
  }

  @call({})
  execute({id}:{id:string}){
    this.agentOnly();const p=this.proposals[id];assertion(!!p,'UNKNOWN_PROPOSAL');
    if(p.status!=='PROPOSED')return {status:'DENIED',reasons:['PROPOSAL_NOT_OPEN']};
    const m=this.mandates[p.mandate_id];assertion(!!m,'UNKNOWN_MANDATE');
    const reasons=this.checks(m,p);
    if(reasons.length){p.status='DENIED';p.reasons=reasons;this.log('PAYMENT_DENIED',{id,reasons});return {status:'DENIED',reasons};}
    m.consumed=true;m.status='EXECUTING';p.status='EXECUTING';
    this.available_yocto=(BigInt(this.available_yocto)-BigInt(p.amount_yocto)).toString();
    this.inflight_yocto=(BigInt(this.inflight_yocto)+BigInt(p.amount_yocto)).toString();
    this.log('PAYMENT_EXECUTING',{id,to:p.recipient,amount_yocto:p.amount_yocto});
    // Never claim PAID here. The promise executes asynchronously.
    return NearPromise.new(p.recipient).transfer(BigInt(p.amount_yocto))
      .then(NearPromise.new(near.currentAccountId()).functionCall('on_payout_result',JSON.stringify({id}),0n,30n*T_GAS));
  }

  @call({privateFunction:true})
  on_payout_result({id}:{id:string}){
    assertion(this.who()===near.currentAccountId(),'CONTRACT_ONLY');
    const p=this.proposals[id];assertion(!!p && p.status==='EXECUTING','INVALID_CALLBACK_STATE');
    const m=this.mandates[p.mandate_id];assertion(!!m,'MISSING_MANDATE');
    let success=false;
    try { near.promiseResult(0);success=true; } catch (_error) { success=false; }
    this.inflight_yocto=(BigInt(this.inflight_yocto)-BigInt(p.amount_yocto)).toString();
    if(success){p.status='PAID';m.status='PAID';this.log('PAYMENT_PAID',{id,to:p.recipient,amount_yocto:p.amount_yocto});}
    else{p.status='FAILED';m.status='ACTIVE';m.consumed=false;
      this.available_yocto=(BigInt(this.available_yocto)+BigInt(p.amount_yocto)).toString();
      this.log('PAYMENT_FAILED',{id});}
    return {status:p.status};
  }

  @view({})
  get_mandate({id}:{id:string}){return this.mandates[id]??null}
  @view({})
  get_proposal({id}:{id:string}){return this.proposals[id]??null}
  @view({})
  get_audit(){return this.audit}
  @view({})
  get_vault(){return {available_yocto:this.available_yocto,inflight_yocto:this.inflight_yocto,owner:this.owner,agent:this.agent}}
}
