import { seededVault, toYocto, SUPPLIER, ATTACKER, hashInvoice, DEMO_INVOICE } from '../core/policy.mjs';

const {vault,mandate}=seededVault();
console.log('WITNESS — deterministic local demonstration (NO blockchain).');
console.log('Owner mandate:',JSON.stringify(mandate,null,2));
const malicious=vault.propose({who:vault.roles.agent,mandate_id:mandate.id,recipient:ATTACKER,amount_yocto:toYocto('5'),invoice_hash:mandate.invoice_hash,note:'invoice says updated beneficiary'});
console.log('\nAttack: AI proposes:',malicious.recipient);
console.log('Assessment:',vault.assess(malicious.id).reasons);
console.log('Execution:',vault.execute({who:vault.roles.agent,id:malicious.id}));
const legitimate=vault.propose({who:vault.roles.agent,mandate_id:mandate.id,recipient:SUPPLIER,amount_yocto:toYocto('5'),invoice_hash:hashInvoice(DEMO_INVOICE)});
console.log('\nLegitimate execution:',vault.execute({who:vault.roles.agent,id:legitimate.id}));
console.log('Local callback simulation:',vault.settle({id:legitimate.id,success:true}));
console.log('Final vault balance (yoctoNEAR):',vault.available_yocto);
console.log('Audit events:',vault.events.length);
