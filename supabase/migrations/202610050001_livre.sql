-- Livre: initial PostgreSQL schema. Apply only after checking the selected project.
-- Uses Supabase Auth; existing ChatGPT identities must not be copied as auth user UUIDs.
begin;
create schema if not exists livre;
revoke all on schema livre from public, anon;
grant usage on schema livre to authenticated, service_role;
create table livre.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', created_at timestamptz not null default now()
);
create table livre.bank_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider='pluggy'), provider_item_id text not null,
 name text not null, status text not null default 'READY', last_synced_at timestamptz,
 created_at timestamptz not null default now(), unique(user_id,id), unique(user_id,provider,provider_item_id)
);
create table livre.categories (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, color text, created_at timestamptz not null default now(), unique(user_id,id),unique(user_id,name)
);
create table livre.accounts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid, name text not null,currency char(3) not null default 'BRL',
 initial_balance numeric(18,2) not null default 0, reported_balance numeric(18,2),
 source text not null default 'manual' check(source in ('manual','pluggy')),
 provider_account_id text, balance_updated_at timestamptz,created_at timestamptz not null default now(),
 unique(user_id,id),unique(user_id,source,provider_account_id),
 foreign key(user_id,connection_id) references livre.bank_connections(user_id,id),
 check((source='manual' and connection_id is null and provider_account_id is null) or (source='pluggy' and connection_id is not null and provider_account_id is not null))
);
create table livre.credit_cards (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid,name text not null,currency char(3) not null default 'BRL',
 credit_limit numeric(18,2) check(credit_limit>=0), available_limit numeric(18,2),reported_balance numeric(18,2),
 closing_day smallint check(closing_day between 1 and 31),due_day smallint check(due_day between 1 and 31),
 source text not null default 'manual' check(source in ('manual','pluggy')),provider_account_id text,
 balance_updated_at timestamptz,created_at timestamptz not null default now(),
 unique(user_id,id),unique(user_id,source,provider_account_id),
 foreign key(user_id,connection_id) references livre.bank_connections(user_id,id),
 check((source='manual' and connection_id is null and provider_account_id is null) or (source='pluggy' and connection_id is not null and provider_account_id is not null))
);
create table livre.transactions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid,account_id uuid,credit_card_id uuid,category_id uuid,
 description text not null,amount numeric(18,2) not null check(amount>0),currency char(3) not null default 'BRL',
 type text not null check(type in ('income','expense','transfer')),status text not null default 'pending' check(status in ('pending','posted')),
 transaction_date date not null,source text not null default 'manual' check(source in ('manual','pluggy')),
 provider_transaction_id text,transfer_group_id uuid,legacy_record_id text,created_at timestamptz not null default now(),
 unique(user_id,id),unique(user_id,source,provider_transaction_id),unique(user_id,legacy_record_id),
 foreign key(user_id,connection_id) references livre.bank_connections(user_id,id),
 foreign key(user_id,account_id) references livre.accounts(user_id,id),
 foreign key(user_id,credit_card_id) references livre.credit_cards(user_id,id),
 foreign key(user_id,category_id) references livre.categories(user_id,id),
 check(account_id is null or credit_card_id is null),
 check((source='manual' and connection_id is null and provider_transaction_id is null) or (source='pluggy' and connection_id is not null and provider_transaction_id is not null))
);
create index transactions_user_date on livre.transactions(user_id,transaction_date desc);
create index transactions_account on livre.transactions(user_id,account_id);
create index transactions_card on livre.transactions(user_id,credit_card_id);
create index transactions_connection on livre.transactions(user_id,connection_id);
create table livre.budgets (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 category_id uuid not null,name text not null,month date not null check(extract(day from month)=1),
 amount numeric(18,2) not null check(amount>0),created_at timestamptz not null default now(),
 foreign key(user_id,category_id) references livre.categories(user_id,id),unique(user_id,category_id,month)
);
create table livre.goals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,target_amount numeric(18,2) not null check(target_amount>0),
 saved_amount numeric(18,2) not null default 0 check(saved_amount>=0),target_date date,
 created_at timestamptz not null default now()
);
create table livre.sync_runs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null,started_at timestamptz not null default now(),finished_at timestamptz,
 status text not null default 'running' check(status in ('running','succeeded','partial','failed')),
 imported_accounts integer not null default 0 check(imported_accounts>=0),imported_transactions integer not null default 0 check(imported_transactions>=0),
 error_code text, foreign key(user_id,connection_id) references livre.bank_connections(user_id,id)
);
create index sync_runs_connection_time on livre.sync_runs(user_id,connection_id,started_at desc);
-- A custom schema avoids overwriting unrelated tables already in this project.
-- Explicitly expose `livre` in the Data API settings when the app integration is ready.
do $$
declare t text;
begin
 foreach t in array array['profiles','bank_connections','categories','accounts','credit_cards','transactions','budgets','goals','sync_runs'] loop
  execute format('alter table livre.%I enable row level security',t);
  execute format('revoke all on table livre.%I from anon,authenticated',t);
  execute format('grant all on table livre.%I to service_role',t);
  execute format('grant select on table livre.%I to authenticated',t);
  execute format('create policy owner_select on livre.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 end loop;
 foreach t in array array['profiles','categories','budgets','goals'] loop
  execute format('grant insert,update,delete on table livre.%I to authenticated',t);
  execute format('create policy owner_insert on livre.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
  execute format('create policy owner_update on livre.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
  execute format('create policy owner_delete on livre.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
 end loop;
 foreach t in array array['accounts','credit_cards','transactions'] loop
  execute format('grant insert,update,delete on table livre.%I to authenticated',t);
  execute format('create policy manual_insert on livre.%I for insert to authenticated with check ((select auth.uid())=user_id and source=''manual'')',t);
  execute format('create policy manual_update on livre.%I for update to authenticated using ((select auth.uid())=user_id and source=''manual'') with check ((select auth.uid())=user_id and source=''manual'')',t);
  execute format('create policy manual_delete on livre.%I for delete to authenticated using ((select auth.uid())=user_id and source=''manual'')',t);
 end loop;
end $$;
-- Imported entries and sync metadata are written only by the backend.
-- Credentials belong in server secrets/Vault, never in the readable tables above.
commit;
