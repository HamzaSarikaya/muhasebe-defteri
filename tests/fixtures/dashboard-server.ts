import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {sampleLedger} from './dashboard-data';

// Local read-only protocol fixture. No production authentication or database is used.
const backend = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3101');
  response.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info');
  if (request.method === 'OPTIONS') {response.end('{}'); return;}
  let id: string | undefined;
  try {id = JSON.parse(Buffer.from((request.headers.authorization ?? '').split('.')[1], 'base64url').toString()).sub;} catch { /* No session. */ }
  if (!id) {response.statusCode = 401; response.end(JSON.stringify({message: 'No session'})); return;}
  if (request.url === '/auth/v1/user') {
    response.end(JSON.stringify({id, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z'}));
  } else if (request.url === '/rest/v1/rpc/ledger_snapshot') {
    if (id.endsWith('003')) {response.statusCode = 503; response.end(JSON.stringify({message: 'Fixture unavailable'})); return;}
    const ledger = id.endsWith('002') ? {...sampleLedger, clients: [], accounts: [], cards: [], transactions: [], payments: []}
      : id.endsWith('004') ? {...sampleLedger, transactions: sampleLedger.transactions.map((row, index) => index === 0 ? {...row, amount: '9223372036854775807'} : row)} : sampleLedger;
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
