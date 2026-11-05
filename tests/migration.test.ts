import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {after, before, test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {balances, schedule, type Ledger} from '../lib/finance/ledger';

const db = new PGlite();
const owner = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const client = '20000000-0000-0000-0000-000000000001';
const otherClient = '20000000-0000-0000-0000-000000000002';
const account = '30000000-0000-0000-0000-000000000001';
const otherAccount = '30000000-0000-0000-0000-000000000002';
const card = '40000000-0000-0000-0000-000000000001';
const otherCard = '40000000-0000-0000-0000-000000000002';
const debt = '50000000-0000-0000-0000-000000000001';

async function asUser<T>(id: string, run: () => Promise<T>): Promise<T> {
  await db.exec('begin; set local role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
  try { return await run(); } finally { await db.exec('rollback'); }
}

async function rejects(sql: string, code: string, id = owner) {
  await asUser(id, async () => {
    await assert.rejects(db.exec(sql), (error: unknown) => (error as {code: string}).code === code);
  });
}

before(async () => {
  // Only Supabase-managed Auth objects are stubbed. The migration executes in real PostgreSQL.
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
    insert into auth.users(id, raw_user_meta_data) values ('${owner}', '{"full_name":"Test"}');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202611050001_initial_schema.sql', import.meta.url), 'utf8'));
  await db.exec(`
    insert into auth.users(id) values ('${other}');
    insert into public.clients(id,user_id,name) values ('${client}','${owner}','Hesap 01'),('${otherClient}','${other}','Hesap 02');
    insert into public.client_accounts(id,user_id,client_id,name) values ('${account}','${owner}','${client}','Site'),('${otherAccount}','${other}','${otherClient}','Site');
    insert into public.credit_cards(id,user_id,name,bank_name) values ('${card}','${owner}','Kart 01','Kart 01'),('${otherCard}','${other}','Kart 03','Kart 03');
    insert into public.transactions(id,user_id,client_id,client_account_id,credit_card_id,title,amount,amount_base,type,transaction_date)
      values ('${debt}','${owner}','${client}','${account}','${card}','Site',2200000,2200000,'debt','2026-11-05'),
      ('50000000-0000-0000-0000-000000000002','${other}','${otherClient}','${otherAccount}','${otherCard}','Site',10000,10000,'debt','2026-11-05');
    insert into public.subscriptions(user_id,credit_card_id,name,amount,billing_cycle,next_billing_date)
      values ('${owner}','${card}','Service',10000,'monthly','2026-12-05'),('${other}','${otherCard}','Cloud',20000,'yearly','2027-11-05');
    insert into public.payments(user_id,client_id,client_account_id,amount,payment_method,payment_date)
      values ('${owner}','${client}','${account}',100,'cash','2026-11-05'),('${other}','${otherClient}','${otherAccount}',100,'cash','2026-11-05');
    insert into public.exchange_rates(base_currency,target_currency,rate,effective_at) values ('USD','TRY',40,'2026-11-05T00:00:00Z');
  `);
  // Upgrade a populated Phase 1 ledger, including pre-existing cards and advances.
  await db.exec(await readFile(new URL('../supabase/migrations/202611050002_ledger.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611050003_phase4.sql', import.meta.url), 'utf8'));
});

after(async () => { await db.close(); });

test('migration creates eight tables, all with RLS and no persisted balance columns', async () => {
  const {rows} = await db.query<{relname: string; relrowsecurity: boolean}>("select relname,relrowsecurity from pg_class join pg_namespace on relnamespace=pg_namespace.oid where nspname='public' and relkind='r'");
  assert.equal(rows.length, 8);
  assert.ok(rows.every(row => row.relrowsecurity));
  const balances = await db.query("select column_name from information_schema.columns where table_schema='public' and column_name like '%balance%'");
  assert.equal(balances.rows.length, 0);
});

test('existing and new Auth users both receive profiles', async () => {
  const {rows} = await db.query<{full_name: string}>('select full_name from public.profiles order by id');
  assert.deepEqual(rows.map(row => row.full_name), ['Test', '']);
});

test('each owner can read only their rows in every private table', async () => {
  for (const id of [owner, other]) {
    await asUser(id, async () => {
      for (const table of ['profiles', 'clients', 'client_accounts', 'credit_cards', 'transactions', 'payments', 'subscriptions']) {
        const {rows} = await db.query<Record<string, string>>(`select * from public.${table}`);
        assert.equal(rows.length, 1, table);
        assert.equal(table === 'profiles' ? rows[0].id : rows[0].user_id, id, table);
      }
    });
  }
});

test('anonymous users cannot read financial data or profiles', async () => {
  for (const table of ['profiles','clients','client_accounts','credit_cards','transactions','payments','subscriptions','exchange_rates']) {
    await db.exec('begin; set local role anon;');
    try { await assert.rejects(db.exec(`select * from public.${table}`), (error: unknown) => (error as {code: string}).code === '42501'); }
    finally { await db.exec('rollback'); }
  }
});

test('other-owner updates and deletes cannot affect rows', async () => {
  await asUser(other, async () => {
    const updated = await db.query('update public.clients set name=$1 where id=$2 returning id', ['Changed', client]);
    const removed = await db.query('delete from public.transactions where id=$1 returning id', [debt]);
    assert.equal(updated.rows.length, 0);
    assert.equal(removed.rows.length, 0);
  });
});

test('ownership cannot be forged on insert or transferred on update', async () => {
  await rejects(`insert into public.clients(user_id,name) values ('${other}','Forged')`, '42501');
  await rejects(`update public.clients set user_id='${other}' where id='${client}'`, '42501');
});

test('cross-owner account, card and subscription references are rejected', async () => {
  await rejects(`insert into public.client_accounts(user_id,client_id,name) values ('${owner}','${otherClient}','Invalid')`, '23503');
  await rejects(`insert into public.transactions(user_id,credit_card_id,title,amount,amount_base,type,transaction_date) values ('${owner}','${otherCard}','Invalid',100,100,'expense','2026-11-05')`, '23503');
  await rejects(`insert into public.subscriptions(user_id,credit_card_id,name,amount,billing_cycle,next_billing_date) values ('${owner}','${otherCard}','Invalid',100,'monthly','2026-11-05')`, '23503');
});

test('an account cannot be attached to the wrong client, even under the same owner', async () => {
  await asUser(owner, async () => {
    await db.exec(`insert into public.clients(id,user_id,name) values ('20000000-0000-0000-0000-000000000003','${owner}','Another client')`);
    await assert.rejects(db.exec(`insert into public.transactions(user_id,client_id,client_account_id,title,amount,amount_base,type,transaction_date) values ('${owner}','20000000-0000-0000-0000-000000000003','${account}','Invalid',100,100,'debt','2026-11-05')`), (error: unknown) => (error as {code: string}).code === '23503');
  });
});

test('invalid financial amounts, currencies and FX snapshots are rejected', async () => {
  for (const values of ["0,0,'TRY','TRY',1", "-1,-1,'TRY','TRY',1", "100,100,'GBP','TRY',1", "100,101,'TRY','TRY',1", "100,100,'USD','TRY',0", "100,100,'USD','TRY','NaN'"]) {
    await rejects(`insert into public.transactions(user_id,title,amount,amount_base,currency,currency_base,exchange_rate,type,transaction_date) values ('${owner}','Invalid',${values},'debt','2026-11-05')`, '23514');
  }
});

test('BIGINT amounts survive beyond JavaScript safe integers without precision loss', async () => {
  await asUser(owner, async () => {
    const {rows} = await db.query<{amount: string}>(`insert into public.transactions(user_id,title,amount,amount_base,type,transaction_date) values ('${owner}','Large','9007199254740993','9007199254740993','debt','2026-11-05') returning amount::text`);
    assert.equal(rows[0].amount, '9007199254740993');
  });
});

test('recorded exchange rate and currencies cannot be rewritten', async () => {
  await rejects(`update public.transactions set currency='USD',exchange_rate=40,amount_base=88000000 where id='${debt}'`, '23514');
});

test('valid partial and final allocations are accepted', async () => {
  await asUser(owner, async () => {
    await db.exec(`insert into public.payments(user_id,client_id,client_account_id,transaction_id,amount,payment_method,payment_date) values ('${owner}','${client}','${account}','${debt}',1000000,'bank_transfer','2026-11-05'),('${owner}','${client}','${account}','${debt}',1200000,'cash','2026-11-05')`);
    const {rows} = await db.query<{total: string}>(`select sum(amount)::text as total from public.payments where transaction_id='${debt}'`);
    assert.equal(rows[0].total, '2200000');
  });
});

test('over-allocation, account mismatch and currency mismatch are rejected', async () => {
  const prefix = 'insert into public.payments(user_id,client_id,client_account_id,transaction_id,amount,currency,payment_method,payment_date) values';
  await rejects(`${prefix} ('${owner}','${client}','${account}','${debt}',2200001,'TRY','cash','2026-11-05')`, '23514');
  await rejects(`${prefix} ('${owner}','${client}',null,'${debt}',100,'TRY','cash','2026-11-05')`, '23514');
  await rejects(`${prefix} ('${owner}','${client}','${account}','${debt}',100,'USD','cash','2026-11-05')`, '23503');
});

test('a debt with allocations cannot be reduced or cancelled', async () => {
  for (const change of ["amount=1,amount_base=1", "status='cancelled'", 'client_account_id=null', "type='refund'"]) {
    await asUser(owner, async () => {
      await db.exec(`insert into public.payments(user_id,client_id,client_account_id,transaction_id,amount,payment_method,payment_date) values ('${owner}','${client}','${account}','${debt}',100,'cash','2026-11-05')`);
      await assert.rejects(db.exec(`update public.transactions set ${change} where id='${debt}'`), (error: unknown) => (error as {code: string}).code === '23514');
    });
  }
});

test('installments require valid sequence numbers and a group', async () => {
  for (const [count, current, group] of [[12, 13, "'70000000-0000-0000-0000-000000000001'"], [12, 1, 'null'], [0, 1, 'null']]) {
    await rejects(`insert into public.transactions(user_id,title,amount,amount_base,type,transaction_date,installment_count,installment_current,installment_group_id) values ('${owner}','Invalid',100,100,'debt','2026-11-05',${count},${current},${group})`, '23514');
  }
});

test('rates are readable after login but not writable by account owners', async () => {
  await asUser(owner, async () => { assert.equal((await db.query('select * from public.exchange_rates')).rows.length, 1); });
  await rejects("insert into public.exchange_rates(base_currency,target_currency,rate,effective_at) values ('EUR','TRY',42,now())", '42501');
});

test('profile creation and deletion are reserved for the Auth lifecycle', async () => {
  await rejects(`delete from public.profiles where id='${owner}'`, '42501');
  await rejects(`insert into public.profiles(id) values ('${other}')`, '42501');
});

test('updated_at is controlled by the database', async () => {
  await asUser(owner, async () => {
    const {rows} = await db.query<{valid: boolean}>(`update public.clients set name='Updated',updated_at='2000-01-01' where id='${client}' returning updated_at > '2026-01-01'::timestamptz as valid`);
    assert.equal(rows[0].valid, true);
  });
});

test('starter records reuse existing cards and clients and install only once', async () => {
  await asUser(owner, async () => {
    await db.exec('select public.install_ledger_defaults(); select public.install_ledger_defaults();');
    const {rows} = await db.query<{ledger: Ledger}>('select public.ledger_snapshot() as ledger');
    const ledger = rows[0].ledger;
    assert.equal(ledger.defaults,true);
    assert.deepEqual(ledger.cards.map(c => c.name).sort(),['Kart 01','Kart 02','Kart 03']);
    assert.deepEqual(ledger.clients.map(c => c.name).sort(),['Hesap 01','Hesap 02']);
    assert.equal(ledger.accounts.length,5);
    assert.equal(ledger.transactions.length,1);
    assert.equal(ledger.payments.length,1);
    assert.equal(typeof ledger.cards[0].credit_limit,'string');
    assert.equal(ledger.transactions[0].card_rate,'1.000000');
  });
});

test('the ledger snapshot preserves exact FX and reconciles installment allocations', async () => {
  await asUser(owner, async () => {
    const group='70000000-0000-0000-0000-000000000004';
    const parts=schedule(101n,3,'1.5','2027-01-31');
    for (const part of parts) {
      await db.query(`insert into public.transactions(user_id,client_id,client_account_id,credit_card_id,title,type,amount,amount_base,
        currency,exchange_rate,fx_offset,installment_group_id,installment_count,installment_current,transaction_date,due_date)
        values($1,$2,$3,$4,'FX','debt',$5,$6,'USD',1.5,$7,$8,3,$9,'2027-01-01',$10)`,
        [owner,client,account,card,part.amount,part.amount_base,part.fx_offset,group,part.installment_current,part.due_date]);
    }
    await db.exec(`insert into public.payments(user_id,client_id,client_account_id,transaction_id,currency,amount,payment_method,payment_date)
      select user_id,client_id,client_account_id,id,currency,amount,'cash',due_date from public.transactions where installment_group_id='${group}' and installment_current=1`);
    const {rows} = await db.query<{data: Ledger}>('select public.ledger_snapshot() as data');
    const totals=balances(rows[0].data);
    assert.equal(totals.accounts.get(account+'/USD'),66n);
    assert.equal(totals.cards.get(card),2200000n + 152n - 53n);
    await db.exec('savepoint before_cancel');
    await assert.rejects(db.query("update public.transactions set status='cancelled' where installment_group_id=$1",[group]), {code:'23514'});
    await db.exec('rollback to before_cancel');
    const cancelled=await db.query("select id from public.transactions where status='cancelled'");
    assert.equal(cancelled.rows.length,0);
  });
});

test('card currency is frozen and third-currency purchases require an explicit snapshot', async () => {
  await rejects(`update public.credit_cards set currency='USD' where id='${card}'`,'23514');
  await rejects(`insert into public.transactions(user_id,credit_card_id,title,type,currency,currency_base,amount,amount_base,exchange_rate,transaction_date)
    values('${owner}','${card}','FX','expense','USD','EUR',100,90,0.9,'2026-11-05')`,'23514');
  await db.exec('begin; set local role anon');
  try { await assert.rejects(db.exec('select public.ledger_snapshot()'), {code:'42501'}); }
  finally { await db.exec('rollback'); }
});

test('phase 4 snapshot includes complete backup fields, exact amounts and only owned subscriptions', async () => {
  await asUser(owner, async () => {
    const {rows} = await db.query<{data: Ledger & {profile: {id: string}}}>('select public.ledger_snapshot() as data');
    const data = rows[0].data;
    assert.equal(data.subscriptions.length, 1);
    assert.equal(data.subscriptions[0].name, 'Service');
    assert.equal(data.subscriptions[0].amount, '10000');
    assert.equal(data.subscriptions[0].billing_anchor_day, 5);
    assert.equal(data.transactions[0].category, 'personal');
    assert.equal(data.profile.id, owner);
    assert.equal(typeof (data.transactions[0] as unknown as {amount_base: string}).amount_base, 'string');
    assert.equal(typeof (data.transactions[0] as unknown as {exchange_rate: string}).exchange_rate, 'string');
  });
});

test('monthly renewals preserve day 31 through February and stale retries do not advance twice', async () => {
  await asUser(owner, async () => {
    const {rows} = await db.query<{id: string}>(`insert into public.subscriptions(user_id,name,amount,billing_cycle,next_billing_date) values ('${owner}','Month end',100,'monthly','2027-01-31') returning id`);
    const id = rows[0].id;
    const advance = async (expected: string) => (await db.query<{ok: boolean}>('select public.advance_subscription($1,$2) as ok', [id, expected])).rows[0].ok;
    assert.equal(await advance('2027-01-31'), true);
    assert.equal(await advance('2027-01-31'), false);
    assert.equal(await advance('2027-02-28'), true);
    const result = await db.query<{date: string; day: number}>('select next_billing_date::text as date,billing_anchor_day as day from public.subscriptions where id=$1', [id]);
    assert.deepEqual(result.rows[0], {date: '2027-03-31', day: 31});
    await db.query("update public.subscriptions set next_billing_date='2027-04-15' where id=$1", [id]);
    assert.equal(await advance('2027-04-15'), true);
    assert.equal((await db.query<{date: string}>('select next_billing_date::text as date from public.subscriptions where id=$1', [id])).rows[0].date, '2027-05-15');
  });
});

test('yearly renewals retain leap-day anchor, cannot renew paused or foreign subscriptions', async () => {
  await asUser(owner, async () => {
    const {rows} = await db.query<{id: string}>(`insert into public.subscriptions(user_id,name,amount,billing_cycle,next_billing_date) values ('${owner}','Leap year',100,'yearly','2024-02-29') returning id`);
    const id = rows[0].id;
    for (const date of ['2024-02-29','2025-02-28','2026-02-28','2027-02-28']) {
      assert.equal((await db.query<{ok: boolean}>('select public.advance_subscription($1,$2) as ok', [id,date])).rows[0].ok, true);
    }
    assert.equal((await db.query<{date: string}>('select next_billing_date::text as date from public.subscriptions where id=$1', [id])).rows[0].date, '2028-02-29');
    await db.query('update public.subscriptions set is_active=false where id=$1', [id]);
    assert.equal((await db.query<{ok: boolean}>("select public.advance_subscription($1,'2028-02-29') as ok", [id])).rows[0].ok, false);
  });
  const foreign = (await db.query<{id: string}>('select id from public.subscriptions where user_id=$1', [other])).rows[0].id;
  await asUser(owner, async () => {
    assert.equal((await db.query<{ok: boolean}>("select public.advance_subscription($1,'2027-11-05') as ok", [foreign])).rows[0].ok, false);
  });
  await db.exec('begin; set local role anon');
  try {await assert.rejects(db.exec(`select public.advance_subscription('${foreign}','2027-11-05')`), {code: '42501'});}
  finally {await db.exec('rollback');}
});

test('subscription date overflow and oversized new metadata fail without changing records', async () => {
  await asUser(owner, async () => {
    const {rows} = await db.query<{id: string}>(`insert into public.subscriptions(user_id,name,amount,billing_cycle,next_billing_date) values ('${owner}','Last supported year',100,'yearly','9999-12-31') returning id`);
    await db.exec('savepoint before_renewal');
    await assert.rejects(db.query("select public.advance_subscription($1,'9999-12-31')", [rows[0].id]), {code: '23514'});
    await db.exec('rollback to before_renewal');
    assert.equal((await db.query<{date: string}>('select next_billing_date::text as date from public.subscriptions where id=$1', [rows[0].id])).rows[0].date, '9999-12-31');
  });
  await rejects(`insert into public.subscriptions(user_id,name,provider,amount,billing_cycle,next_billing_date) values ('${owner}','Too long',repeat('x',121),100,'monthly','2027-01-01')`, '23514');
});
