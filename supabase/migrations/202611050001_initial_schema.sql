-- Phase 1 foundation. Amounts are integer minor units, never floating point.
-- Apply with the Supabase CLI or SQL Editor as the database administrator.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  preferred_locale text not null default 'tr' check (preferred_locale in ('tr', 'en')),
  base_currency text not null default 'TRY' check (base_currency in ('TRY', 'USD', 'EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.client_accounts (
  id uuid primary key default gen_random_uuid(),
  -- Denormalized ownership enables simple, non-recursive RLS and composite FKs.
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, user_id) references public.clients(id, user_id),
  unique (id, client_id, user_id)
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  bank_name text not null check (char_length(btrim(bank_name)) between 1 and 120),
  card_type text not null default 'credit' check (card_type in ('credit', 'debit')),
  last_four text check (last_four ~ '^[0-9]{4}$'),
  credit_limit bigint not null default 0 check (credit_limit >= 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  statement_day smallint check (statement_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  color text not null default '#3B82F6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  primary_user text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid,
  client_account_id uuid,
  -- Optional for off-card debts (for example a website invoice).
  credit_card_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  category text not null default 'personal' check (char_length(btrim(category)) between 1 and 80),
  amount bigint not null check (amount > 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  amount_base bigint not null check (amount_base > 0),
  currency_base text not null default 'TRY' check (currency_base in ('TRY', 'USD', 'EUR')),
  exchange_rate numeric(18,6) not null default 1 check (exchange_rate > 0 and exchange_rate <> 'NaN'::numeric),
  type text not null check (type in ('debt', 'payment', 'expense', 'refund')),
  installment_count smallint not null default 1 check (installment_count between 1 and 120),
  installment_current smallint not null default 1,
  installment_group_id uuid,
  transaction_date date not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, user_id) references public.clients(id, user_id),
  foreign key (client_account_id, client_id, user_id) references public.client_accounts(id, client_id, user_id),
  foreign key (credit_card_id, user_id) references public.credit_cards(id, user_id),
  check (client_account_id is null or client_id is not null),
  check (installment_current between 1 and installment_count),
  check ((installment_count = 1 and installment_group_id is null) or (installment_count > 1 and installment_group_id is not null)),
  check (currency <> currency_base or exchange_rate = 1),
  check (amount_base::numeric = round(amount::numeric * exchange_rate)),
  unique (id, client_id, user_id, currency),
  unique (user_id, installment_group_id, installment_current)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  client_account_id uuid,
  transaction_id uuid,
  amount bigint not null check (amount > 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'card')),
  payment_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (client_id, user_id) references public.clients(id, user_id),
  foreign key (client_account_id, client_id, user_id) references public.client_accounts(id, client_id, user_id),
  -- Also prevents applying a payment to another client or currency.
  foreign key (transaction_id, client_id, user_id, currency) references public.transactions(id, client_id, user_id, currency)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credit_card_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  provider text,
  amount bigint not null check (amount > 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  next_billing_date date not null,
  is_active boolean not null default true,
  category text not null default 'productivity' check (category in ('entertainment', 'productivity', 'cloud', 'other')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (credit_card_id, user_id) references public.credit_cards(id, user_id)
);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null check (base_currency in ('TRY', 'USD', 'EUR')),
  target_currency text not null check (target_currency in ('TRY', 'USD', 'EUR')),
  rate numeric(18,6) not null check (rate > 0 and rate <> 'NaN'::numeric),
  effective_at timestamptz not null,
  check (base_currency <> target_currency),
  unique (base_currency, target_currency, effective_at)
);

create index clients_owner_active_idx on public.clients(user_id, is_active);
create index client_accounts_owner_client_idx on public.client_accounts(user_id, client_id);
create index credit_cards_owner_active_idx on public.credit_cards(user_id, is_active);
create index transactions_owner_date_idx on public.transactions(user_id, transaction_date desc);
create index transactions_client_account_idx on public.transactions(user_id, client_id, client_account_id);
create index transactions_card_idx on public.transactions(user_id, credit_card_id);
create index transactions_due_idx on public.transactions(user_id, due_date) where status in ('pending', 'overdue');
create index payments_client_date_idx on public.payments(user_id, client_id, payment_date desc);
create index payments_account_idx on public.payments(user_id, client_account_id);
create index payments_transaction_idx on public.payments(transaction_id);
create index subscriptions_owner_billing_idx on public.subscriptions(user_id, next_billing_date) where is_active;
create index subscriptions_card_idx on public.subscriptions(user_id, credit_card_id);
create index exchange_rates_latest_idx on public.exchange_rates(base_currency, target_currency, effective_at desc);

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Also support a project where the administrator's Auth account already exists.
insert into public.profiles(id, full_name)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 120) from auth.users
on conflict (id) do nothing;

create function public.protect_transaction_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.currency is distinct from old.currency
    or new.currency_base is distinct from old.currency_base
    or new.exchange_rate is distinct from old.exchange_rate then
    raise exception 'Currency snapshots are immutable; create a corrected entry.' using errcode = '23514';
  end if;
  if exists (select 1 from public.payments where transaction_id = old.id)
    and (new.amount is distinct from old.amount
      or new.client_account_id is distinct from old.client_account_id
      or new.type is distinct from old.type
      or new.status = 'cancelled') then
    raise exception 'An allocated transaction cannot be changed or cancelled.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger protect_transaction_snapshot before update on public.transactions
for each row execute function public.protect_transaction_snapshot();

create function public.check_payment_allocation()
returns trigger language plpgsql set search_path = '' as $$
declare
  target public.transactions%rowtype;
  allocated numeric;
begin
  if new.transaction_id is null then return new; end if;
  -- Serialize allocations to the same transaction, including concurrent inserts.
  select * into target from public.transactions
    where id = new.transaction_id and user_id = new.user_id for update;
  if not found then
    raise exception 'Payment target is unavailable.' using errcode = '23503';
  end if;
  if target.type not in ('debt', 'expense') or target.status = 'cancelled'
    or target.client_account_id is distinct from new.client_account_id then
    raise exception 'Payment must match an active debt and its account.' using errcode = '23514';
  end if;
  select coalesce(sum(amount), 0) into allocated from public.payments
    where transaction_id = new.transaction_id and id <> new.id;
  if allocated + new.amount::numeric > target.amount::numeric then
    raise exception 'Allocated payments exceed the transaction amount.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_payment_allocation before insert or update on public.payments
for each row execute function public.check_payment_allocation();

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'clients', 'client_accounts', 'credit_cards', 'transactions', 'subscriptions'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_accounts enable row level security;
alter table public.credit_cards enable row level security;
alter table public.transactions enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.exchange_rates enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array['clients', 'client_accounts', 'credit_cards', 'transactions', 'payments', 'subscriptions'] loop
    execute format('create policy owner_access on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name);
  end loop;
end;
$$;

-- Shared rate history is readable after login, writable only by trusted server jobs.
create policy rates_read on public.exchange_rates for select to authenticated using (true);

revoke all on table public.profiles, public.clients, public.client_accounts, public.credit_cards,
  public.transactions, public.payments, public.subscriptions, public.exchange_rates from public, anon, authenticated;
grant usage on schema public to authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.clients, public.client_accounts, public.credit_cards,
  public.transactions, public.payments, public.subscriptions to authenticated;
grant select on public.exchange_rates to authenticated;
grant all on public.profiles, public.clients, public.client_accounts, public.credit_cards,
  public.transactions, public.payments, public.subscriptions, public.exchange_rates to service_role;

revoke all on function public.set_updated_at(), public.handle_new_user(),
  public.protect_transaction_snapshot(), public.check_payment_allocation() from public, anon, authenticated;

commit;
