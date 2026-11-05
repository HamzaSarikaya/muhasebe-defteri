begin;

-- Prefix rounding conserves the converted total across installment rows.
alter table public.transactions add column fx_offset bigint not null default 0
  check (fx_offset >= 0 and (installment_current > 1 or fx_offset = 0)),
  add column card_rate numeric(18,6) check (card_rate > 0 and card_rate <> 'NaN'::numeric);

do $$
declare constraint_name name;
begin
  select conname into strict constraint_name from pg_constraint
    where conrelid = 'public.transactions'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%round(%exchange_rate%';
  execute format('alter table public.transactions drop constraint %I', constraint_name);
end;
$$;
alter table public.transactions add constraint transactions_converted_amount check (
  amount_base = round((fx_offset::numeric + amount) * exchange_rate) - round(fx_offset::numeric * exchange_rate)
);

-- A third currency has no recoverable historical rate. Keep such rows unknown.
update public.transactions t set card_rate = case when c.currency = t.currency then 1
  when c.currency = t.currency_base then t.exchange_rate end
from public.credit_cards c where c.id = t.credit_card_id;

create function public.guard_card_snapshot() returns trigger language plpgsql set search_path = '' as $$
declare unit text;
begin
  if tg_op = 'UPDATE' and (old.credit_card_id,old.card_rate,old.fx_offset) is distinct from
    (new.credit_card_id,new.card_rate,new.fx_offset) then
    raise exception 'Immutable card snapshot' using errcode='23514';
  end if;
  if new.credit_card_id is not null and tg_op = 'INSERT' then
    select currency into unit from public.credit_cards where id=new.credit_card_id for share;
    if not found then raise exception 'Unknown card' using errcode='23503'; end if;
    if unit = new.currency then new.card_rate := 1;
    elsif unit = new.currency_base then new.card_rate := new.exchange_rate;
    elsif new.card_rate is null then raise exception 'Card rate required' using errcode='23514';
    end if;
  end if;
  return new;
end; $$;
create trigger guard_card_snapshot before insert or update on public.transactions
for each row execute function public.guard_card_snapshot();

create function public.guard_card_currency() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.currency <> new.currency then raise exception 'Immutable card currency' using errcode='23514'; end if;
  return new;
end; $$;
create trigger guard_card_currency before update of currency on public.credit_cards
for each row execute function public.guard_card_currency();

alter table public.profiles add column defaults_installed boolean not null default false;

create function public.install_ledger_defaults() returns void language plpgsql set search_path = '' as $$
declare owner_id uuid := auth.uid(); person text; account_name text; client_key uuid;
begin
  perform 1 from public.profiles where id=owner_id and not defaults_installed for update;
  if not found then return; end if;
  insert into public.credit_cards(user_id,name,bank_name)
    select owner_id,label,label from (values ('Kart 01'),('Kart 02'),('Kart 03')) as cards(label)
    where not exists (select 1 from public.credit_cards c where c.user_id=owner_id and c.name=label);
  foreach person in array array['Hesap 01','Hesap 02'] loop
    select id into client_key from public.clients where user_id=owner_id and name=person order by created_at,id limit 1;
    if not found then
      insert into public.clients(user_id,name) values(owner_id,person) returning id into client_key;
    end if;
    foreach account_name in array array['Genel','Taksit'] loop
      insert into public.client_accounts(user_id,client_id,name)
        select owner_id,client_key,account_name where not exists
        (select 1 from public.client_accounts where client_id=client_key and name=account_name);
    end loop;
  end loop;
  update public.profiles set defaults_installed=true where id=owner_id;
end; $$;

-- One RLS-scoped snapshot avoids PostgREST page limits and torn cross-table reads.
create function public.ledger_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'defaults',p.defaults_installed, 'base',p.base_currency,
    'cards',coalesce((select jsonb_agg(to_jsonb(c) order by c.name,c.id) from
      (select id,name,primary_user,currency,credit_limit::text,statement_day,due_day,is_active from public.credit_cards where user_id=p.id) c),'[]'),
    'clients',coalesce((select jsonb_agg(to_jsonb(c) order by c.name,c.id) from
      (select id,name,email,phone,is_active from public.clients where user_id=p.id) c),'[]'),
    'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.name,a.id) from
      (select id,client_id,name,is_active from public.client_accounts where user_id=p.id) a),'[]'),
    'transactions',coalesce((select jsonb_agg(to_jsonb(t) order by t.transaction_date desc,t.created_at desc,t.installment_current,t.id) from
      (select id,client_id,client_account_id,credit_card_id,title,type,status,currency,amount::text,fx_offset::text,card_rate::text,
        transaction_date,due_date,created_at,installment_count,installment_current,installment_group_id from public.transactions where user_id=p.id) t),'[]'),
    'payments',coalesce((select jsonb_agg(to_jsonb(r) order by r.payment_date desc,r.created_at desc,r.id) from
      (select id,client_id,client_account_id,transaction_id,amount::text,currency,payment_date,payment_method,created_at from public.payments where user_id=p.id) r),'[]')
  ) from public.profiles p where p.id=auth.uid();
$$;

revoke all on function public.guard_card_snapshot(), public.guard_card_currency(), public.install_ledger_defaults(), public.ledger_snapshot() from public,anon;
grant execute on function public.install_ledger_defaults(), public.ledger_snapshot() to authenticated;
commit;

