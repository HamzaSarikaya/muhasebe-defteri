begin;

-- Retain the original day through short months, and Feb 29 through non-leap years.
alter table public.subscriptions
  add column billing_anchor_day smallint check (billing_anchor_day between 1 and 31),
  add column billing_anchor_month smallint check (billing_anchor_month between 1 and 12);
update public.subscriptions set billing_anchor_day = extract(day from next_billing_date),
  billing_anchor_month = extract(month from next_billing_date);
alter table public.subscriptions alter column billing_anchor_day set not null,
  alter column billing_anchor_month set not null,
  add constraint subscriptions_date_range check (next_billing_date between date '1000-01-01' and date '9999-12-31') not valid,
  add constraint subscriptions_provider_length check (provider is null or char_length(provider) <= 120) not valid,
  add constraint subscriptions_notes_length check (notes is null or char_length(notes) <= 2000) not valid;

create function public.set_subscription_anchor() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.billing_anchor_day := extract(day from new.next_billing_date);
    new.billing_anchor_month := extract(month from new.next_billing_date);
  elsif new.billing_cycle <> old.billing_cycle or new.next_billing_date <> old.next_billing_date then
    -- Renewal RPC explicitly retains its anchor; manual date edits reset it.
    if current_setting('muhasebe.renewing_subscription', true) is distinct from old.id::text then
      new.billing_anchor_day := extract(day from new.next_billing_date);
      new.billing_anchor_month := extract(month from new.next_billing_date);
    end if;
  end if;
  return new;
end; $$;
create trigger set_subscription_anchor before insert or update on public.subscriptions
for each row execute function public.set_subscription_anchor();

-- Expected date makes retries and competing tabs conflict rather than advance twice.
create function public.advance_subscription(subscription_id uuid, expected_date date)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare row public.subscriptions%rowtype; target_month date; next_date date; last_day integer;
begin
  select * into row from public.subscriptions where id = subscription_id and user_id = auth.uid()
    and is_active and next_billing_date = expected_date for update;
  if not found then return false; end if;
  target_month := case when row.billing_cycle = 'monthly'
    then (date_trunc('month', row.next_billing_date) + interval '1 month')::date
    else make_date(extract(year from row.next_billing_date)::integer + 1, row.billing_anchor_month, 1) end;
  last_day := extract(day from target_month + interval '1 month' - interval '1 day');
  next_date := target_month + (least(row.billing_anchor_day::integer, last_day) - 1);
  -- Preserve the original anchor while the ordinary date-edit trigger runs.
  perform set_config('muhasebe.renewing_subscription', row.id::text, true);
  update public.subscriptions set next_billing_date = next_date where id = row.id;
  perform set_config('muhasebe.renewing_subscription', '', true);
  return true;
end; $$;

-- Complete, RLS-scoped backup rows. All monetary BIGINTs and rates cross JSON as text.
create or replace function public.ledger_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'defaults',p.defaults_installed, 'base',p.base_currency, 'profile',to_jsonb(p),
    'cards',coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('credit_limit',c.credit_limit::text) order by c.name,c.id)
      from public.credit_cards c where c.user_id=p.id),'[]'),
    'clients',coalesce((select jsonb_agg(to_jsonb(c) order by c.name,c.id) from public.clients c where c.user_id=p.id),'[]'),
    'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.name,a.id) from public.client_accounts a where a.user_id=p.id),'[]'),
    'transactions',coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('amount',t.amount::text,'amount_base',t.amount_base::text,
      'exchange_rate',t.exchange_rate::text,'fx_offset',t.fx_offset::text,'card_rate',t.card_rate::text)
      order by t.transaction_date desc,t.created_at desc,t.installment_current,t.id) from public.transactions t where t.user_id=p.id),'[]'),
    'payments',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('amount',r.amount::text)
      order by r.payment_date desc,r.created_at desc,r.id) from public.payments r where r.user_id=p.id),'[]'),
    'subscriptions',coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('amount',s.amount::text)
      order by s.next_billing_date,s.id) from public.subscriptions s where s.user_id=p.id),'[]')
  ) from public.profiles p where p.id=auth.uid();
$$;

revoke all on function public.set_subscription_anchor(), public.advance_subscription(uuid,date) from public,anon,authenticated;
grant execute on function public.advance_subscription(uuid,date) to authenticated;
commit;
