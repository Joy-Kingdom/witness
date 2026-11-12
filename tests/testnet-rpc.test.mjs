import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTestnetReader, assertAccountId, derivePaymentOutcome} from '../core/testnet-rpc.mjs';

const CONTRACT='vault.demo.testnet';
const AGENT='agent.demo.testnet';
const TX='4qRsF7eAH5fJBrUAgCis8xN4MLaY1TCqQePTMskWr2jx';
function response(value){return {ok:true,async json(){return {result:value}}};}
const bytes=(data,h=100)=>({result:[...Buffer.from(JSON.stringify(data))],block_height:h,block_hash:'abc'});
function fixture(){
  const methods=[];
  const mocked=async(_url,init)=>{
    const body=JSON.parse(init.body);methods.push(body);
    if(body.method==='query'){
      const name=body.params.method_name;
      const map={get_vault:{owner:'owner.demo.testnet',agent:AGENT,available_yocto:'2000000000000000000000000',inflight_yocto:'0'},get_audit:[{seq:1,type:'MANDATE_CREATED'},{seq:2,type:'PAYMENT_PAID'}],get_mandate:{id:'M1',recipient:'supplier.demo.testnet',version:1},get_proposal:{id:'P2',status:'PAID'}};
      return response(bytes(map[name]));
    }
    if(body.method==='tx')return response({
      final_execution_status:'FINAL',status:{SuccessValue:''},
      transaction:{signer_id:AGENT,receiver_id:CONTRACT,hash:TX},
      transaction_outcome:{outcome:{executor_id:AGENT,logs:[]}},
      receipts_outcome:[{outcome:{executor_id:CONTRACT,logs:['EVENT_JSON:'+JSON.stringify({standard:'witness',event:'PAYMENT_DENIED',data:[{id:'P3',reasons:['RECIPIENT_MISMATCH']}]})]}}]
    });
    throw new Error('Unknown method');
  };
  return {reader:makeTestnetReader({fetchImpl:mocked}),methods};
}
test('validates Testnet-only account names and proposal IDs', async()=>{
  assert.equal(assertAccountId(CONTRACT),CONTRACT);
  assert.throws(()=>assertAccountId('attacker.near'),/testnet/);
  assert.throws(()=>assertAccountId('http://127.0.0.1'),/testnet/);
  const {reader}=fixture();
  await assert.rejects(reader.snapshot(CONTRACT,{mandateId:'../../../etc/passwd'}),/Invalid mandate/);
});
test('loads real-view response shapes via finalized RPC queries',async()=>{
  const {reader,methods}=fixture();
  const s=await reader.snapshot(CONTRACT,{mandateId:'M1',proposalId:'P2'});
  assert.equal(s.simulation,false);
  assert.equal(s.vault.available_yocto,'2000000000000000000000000');
  assert.equal(s.proposal.status,'PAID');
  assert.equal(s.blocks.vault,100);
  assert.equal(methods.length,4);
  for(const m of methods) {assert.equal(m.method,'query');assert.equal(m.params.finality,'final');}
});
test('verifies tx signer, receiver, and contract logs; no false PAID',async()=>{
  const {reader}=fixture();
  const res=await reader.txEvidence(CONTRACT,AGENT,TX);
  assert.equal(res.finalized,true);
  assert.equal(res.payment_outcome,'DENIED');
  assert.equal(res.contract_events.length,1);
  assert.match(res.explorer_url,/testnet.nearblocks.io\/txns\//);
});
test('does not mistake transaction success for successful payment',()=>{
  assert.equal(derivePaymentOutcome([{event:'AGENT_PROPOSED'}]),'NOT_A_PAYMENT_RESULT');
  assert.equal(derivePaymentOutcome([{event:'PAYMENT_EXECUTING'}]),'EXECUTING');
  assert.equal(derivePaymentOutcome([{event:'PAYMENT_EXECUTING'},{event:'PAYMENT_PAID'}]),'PAID');
  assert.equal(derivePaymentOutcome([{event:'PAYMENT_DENIED'}]),'DENIED');
});
test('rejects wrong signer/receiver and disallows arbitrary endpoints',async()=>{
  const {reader}=fixture();
  await assert.rejects(reader.txEvidence(CONTRACT,'fake.demo.testnet',TX),/signer does not match/);
  await assert.rejects(reader.txEvidence('other.testnet',AGENT,TX),/not addressed/);
  assert.throws(()=>makeTestnetReader({endpoint:'https://rpc.mainnet.near.org'}),/Only the official/);
});
