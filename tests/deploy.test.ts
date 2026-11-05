import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {verifyDeployment} from '../lib/deployment';

function preflight(values: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-deploy.ts'], {
    encoding: 'utf8', env: {...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '', LEDGER_DASHBOARD_TEST: '', ...values}
  });
}

test('deployment refuses missing credentials, test mode and a local backend', () => {
  const cases: Record<string, string>[] = [{}, {LEDGER_DASHBOARD_TEST: '1'}, {NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_fixture'}];
  for (const env of cases) {
    const result = preflight(env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Deployment stopped/);
  }
});

test('deployment rejects privileged credentials without printing their values', () => {
  const secret = 'sb_secret_do_not_print';
  const invalid = preflight({NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret});
  assert.equal(invalid.status, 1);
  assert.ok(!invalid.stderr.includes(secret));
});

test('deployment fails closed when signup or anonymous access is enabled or unverifiable', async () => {
  const env = {NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_preflight_example'};
  for (const settings of [{disable_signup: false, external: {anonymous_users: false}}, {disable_signup: true, external: {anonymous_users: true}}, {}]) {
    await assert.rejects(verifyDeployment(env, async () => Response.json(settings)));
  }
  await assert.rejects(verifyDeployment(env, async () => new Response('', {status: 401})));
  await assert.rejects(verifyDeployment(env, async () => { throw new Error('network'); }));
  let requested = false;
  await verifyDeployment(env, async (url, options) => {
    assert.equal(url, env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/settings');
    assert.equal((options.headers as Record<string, string>).apikey, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    requested = true;
    return Response.json({disable_signup: true, external: {anonymous_users: false}});
  });
  assert.equal(requested, true);
});
