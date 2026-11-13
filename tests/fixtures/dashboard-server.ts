import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {sampleLedger} from './dashboard-data';
import {largeLedger} from './large-ledger';
import type {Ledger, Subscription} from '../../lib/finance/ledger';
import {dueMonth} from '../../lib/finance/ledger';

// Local protocol fixture. All writes stay in memory; no real account is used.
const ledgers = new Map<string, Ledger>();
const backend = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3101');
  response.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info');
  if (request.method === 'OPTIONS') {response.end('{}'); return;}
  let id: string | undefined;
  try {id = JSON.parse(Buffer.from((request.headers.authorization ?? '').split('.')[1], 'base64url').toString()).sub;} catch { /* No session. */ }
  if (!id) {response.statusCode = 401; response.end(JSON.stringify({message: 'No session'})); return;}
  const ledgerForUser = () => {
    if (!ledgers.has(id!)) ledgers.set(id!, structuredClone(sampleLedger));
    return ledgers.get(id!)!;
  };
  const url = new URL(request.url!, 'http://127.0.0.1:54329');
  if (url.pathname === '/rest/v1/subscriptions') {
    const data = ledgerForUser();
    let body = '';
    for await (const chunk of request) body += chunk;
    const values = body ? JSON.parse(body) : {};
    const target = url.searchParams.get('id')?.replace(/^eq\./, '');
    let row = data.subscriptions.find(s => s.id === target);
    if (request.method === 'POST') {
      row = {...values, billing_anchor_day: Number(values.next_billing_date.slice(8)), billing_anchor_month: Number(values.next_billing_date.slice(5, 7))} as Subscription;
      data.subscriptions.push(row);
    } else if (request.method === 'PATCH' && row) {
      if (row.next_billing_date !== values.next_billing_date || row.billing_cycle !== values.billing_cycle) {
        values.billing_anchor_day = Number(values.next_billing_date.slice(8));
        values.billing_anchor_month = Number(values.next_billing_date.slice(5, 7));
      }
      Object.assign(row, values);
    } else if (request.method === 'DELETE' && row) data.subscriptions = data.subscriptions.filter(s => s.id !== target);
    else {response.statusCode = 406; response.end(JSON.stringify({code: 'PGRST116'})); return;}
    response.end(JSON.stringify(row)); return;
  }
  if (url.pathname === '/rest/v1/rpc/advance_subscription') {
    let body = ''; for await (const chunk of request) body += chunk;
    const values = JSON.parse(body);
    const row = ledgerForUser().subscriptions.find(s => s.id === values.subscription_id && s.next_billing_date === values.expected_date && s.is_active);
    if (row) row.next_billing_date = dueMonth(row.next_billing_date, row.billing_cycle === 'monthly' ? 1 : 12, row.billing_anchor_day);
    response.end(JSON.stringify(!!row)); return;
  }
  if (url.pathname === '/rest/v1/credit_cards') {
    const card = ledgerForUser().cards.find(c => c.id === url.searchParams.get('id')?.replace(/^eq\./, ''));
    response.end(JSON.stringify(card ?? null)); return;
  }
  if (request.url === '/auth/v1/user') {
    response.end(JSON.stringify({id, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z'}));
  } else if (request.url === '/rest/v1/rpc/ledger_snapshot') {
    if (id.endsWith('005')) await new Promise(resolve => setTimeout(resolve, 1500));
    if (id.endsWith('003')) {response.statusCode = 503; response.end(JSON.stringify({message: 'Fixture unavailable'})); return;}
    const ledger = id.endsWith('002') ? {...sampleLedger, clients: [], accounts: [], cards: [], transactions: [], payments: [], subscriptions: []}
      : id.endsWith('099') ? largeLedger(1200)
      : id.endsWith('004') ? {...sampleLedger, transactions: sampleLedger.transactions.map((row, index) => index === 0 ? {...row, amount: '9223372036854775807'} : row)} : ledgerForUser();
    response.end(JSON.stringify(ledger));
  } else {response.statusCode = 404; response.end('{}');}
});
backend.listen(54329, '127.0.0.1');
const env = {...process.env, LEDGER_DASHBOARD_TEST: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_fixture', NEXT_PUBLIC_SUPABASE_ANON_KEY: ''};
const next = 'node_modules/next/dist/bin/next';
const build = spawn(process.execPath, [next, 'build'], {env, stdio: 'inherit'});
let app: ReturnType<typeof spawn> | undefined;
build.on('exit', code => {
  if (code !== 0) {backend.close(); process.exit(code ?? 1);}
  app = spawn(process.execPath, [next, 'start', '--port', '3101'], {env, stdio: 'inherit'});
  app.on('exit', code => {backend.close(); process.exit(code ?? 0);});
});
function stop() {build.kill(); app?.kill(); backend.close();}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
