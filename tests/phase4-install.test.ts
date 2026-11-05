import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import type {Ledger} from '../lib/finance/ledger';

test('clean install starts empty and new subscriptions retain exact amounts in the snapshot', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth to anon, authenticated, service_role;
    `);
    for (const name of ['202611050001_initial_schema.sql', '202611050002_ledger.sql', '202611050003_phase4.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    }
    assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
    const owner = '10000000-0000-0000-0000-000000000001';
    await db.query('insert into auth.users(id) values ($1)', [owner]);
    await db.exec('begin; set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [owner]);
    const snapshot = async () => (await db.query<{data: Ledger}>('select public.ledger_snapshot() as data')).rows[0].data;
    const empty = await snapshot();
    assert.equal(empty.defaults, false);
    for (const key of ['clients', 'accounts', 'cards', 'transactions', 'payments', 'subscriptions'] as const) {
      assert.deepEqual(empty[key], []);
    }
    await db.query(`insert into public.subscriptions(user_id,name,amount,billing_cycle,next_billing_date)
      values ($1,'Abonelik 01',9007199254740993,'monthly','2027-01-31')`, [owner]);
    const saved = (await snapshot()).subscriptions[0];
    assert.equal(saved.amount, '9007199254740993');
    assert.equal(saved.billing_anchor_day, 31);
    assert.equal(saved.billing_anchor_month, 1);
    await db.exec('rollback');
  } finally {await db.close();}
});
