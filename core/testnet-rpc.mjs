/**
 * WITNESS — read-only NEAR Testnet observer.
 * Queries finalized contract state via public JSON-RPC with provider
 * fallback (FastNear -> legacy NEAR -> dRPC). No keys, no signing, no writes.
 * Arbitrary endpoints are refused: only the allow-listed Testnet RPCs.
 */
export const TESTNET_RPCS = [
  'https://test.rpc.fastnear.com',
  'https://rpc.testnet.near.org',
  'https://testnet.drpc.org',
];
/** Transaction lookups need an endpoint that still holds the receipt;
 *  FastNear's fast endpoint answers view calls but returns 404 for `tx`. */
export const TESTNET_TX_RPCS = [
  'https://archival-rpc.testnet.near.org',
  'https://rpc.testnet.near.org',
  'https://testnet.drpc.org',
];

export function assertAccountId(id, label = 'account') {
  if (typeof id !== 'string' || id.length < 2 || id.length > 64 || !/^[a-z0-9._-]+\.testnet$/.test(id) || id.includes('://')) {
    throw new Error(`Invalid ${label}: only NEAR testnet accounts (*.testnet) are supported`);
  }
  return id;
}
function assertLocalId(id, kind) {
  const re = kind === 'mandate' ? /^M[0-9]+$/ : /^P[0-9]+$/;
  if (typeof id !== 'string' || !re.test(id)) throw new Error(`Invalid ${kind} ID`);
  return id;
}

export function derivePaymentOutcome(events) {
  const names = (events || []).map((e) => e.event || e.type);
  if (names.includes('PAYMENT_PAID')) return 'PAID';
  if (names.includes('PAYMENT_DENIED')) return 'DENIED';
  if (names.includes('PAYMENT_FAILED')) return 'FAILED';
  if (names.includes('PAYMENT_EXECUTING')) return 'EXECUTING';
  return 'NOT_A_PAYMENT_RESULT';
}

export function makeTestnetReader({ fetchImpl, endpoint, endpoints } = {}) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  let providers = endpoints || TESTNET_RPCS;
  if (endpoint) {
    if (!TESTNET_RPCS.includes(endpoint)) throw new Error('Only the official NEAR Testnet RPC endpoints are allowed');
    providers = [endpoint];
  }
  async function rpc(body, providerList = providers) {
    let lastError;
    for (const url of providerList) {
      try {
        const res = await doFetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error.message || JSON.stringify(json.error).slice(0, 160));
        return { result: json.result, rpc: url };
      } catch (e) { lastError = e; }
    }
    throw new Error(`NEAR Testnet RPC unreachable: ${lastError?.message || 'all providers failed'}`);
  }
  async function view(contract, methodName, args) {
    const { result, rpc: used } = await rpc({
      jsonrpc: '2.0', id: 'witness', method: 'query',
      params: {
        request_type: 'call_function', account_id: contract, method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'), finality: 'final',
      },
    });
    const value = result && Array.isArray(result.result) ? JSON.parse(Buffer.from(result.result).toString('utf8')) : null;
    return { value, block_height: result?.block_height ?? null, rpc: used };
  }
  async function snapshot(contract, { mandateId, proposalId } = {}) {
    assertAccountId(contract, 'configured contract');
    if (mandateId) assertLocalId(mandateId, 'mandate');
    if (proposalId) assertLocalId(proposalId, 'proposal');
    const vault = await view(contract, 'get_vault', {});
    const audit = await view(contract, 'get_audit', {});
    const mandate = mandateId ? (await view(contract, 'get_mandate', { id: mandateId })).value : null;
    const proposal = proposalId ? (await view(contract, 'get_proposal', { id: proposalId })).value : null;
    return {
      simulation: false, network: 'testnet', contract, readonly: true,
      vault: vault.value, audit: audit.value, mandate, proposal,
      blocks: { vault: vault.block_height, audit: audit.block_height },
      rpc: vault.rpc, observed_at: new Date().toISOString(),
    };
  }
  async function txEvidence(contract, senderId, hash) {
    assertAccountId(contract, 'configured contract');
    assertAccountId(senderId, 'sender');
    if (typeof hash !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hash)) throw new Error('Invalid transaction hash');
    const { result } = await rpc({ jsonrpc: '2.0', id: 'witness', method: 'tx', params: [hash, senderId] }, endpoint ? providers : TESTNET_TX_RPCS);
    const tx = result?.transaction || {};
    if (tx.signer_id !== senderId) throw new Error('Transaction signer does not match the expected sender');
    if (tx.receiver_id !== contract) throw new Error('Transaction was not addressed to the WITNESS contract');
    const events = [];
    const outcomes = [result?.transaction_outcome, ...(result?.receipts_outcome || [])];
    for (const o of outcomes) {
      for (const line of o?.outcome?.logs || []) {
        if (typeof line === 'string' && line.startsWith('EVENT_JSON:')) {
          try {
            const parsed = JSON.parse(line.slice('EVENT_JSON:'.length));
            if (parsed.standard === 'witness') events.push({ event: parsed.event, data: parsed.data || [] });
          } catch { /* ignore malformed log lines */ }
        }
      }
    }
    return {
      simulation: false, network: 'testnet', contract, finalized: Boolean(result?.final_execution_status || result?.status),
      final_execution_status: result?.final_execution_status || null,
      payment_outcome: derivePaymentOutcome(events),
      contract_events: events,
      explorer_url: `https://testnet.nearblocks.io/txns/${hash}`,
      caution: 'A successful transaction status alone does not prove a payment. The outcome above is derived only from WITNESS contract events.',
    };
  }
  return { snapshot, txEvidence };
}
