-- Server-only bridge for the existing authenticated, owner-private Livre Site.
create table livre.backend_auth(key_hash text primary key, allowed_email text not null);
alter table livre.backend_auth enable row level security;
revoke all on livre.backend_auth from public,anon,authenticated;
grant select on livre.backend_auth to service_role;
create table livre.site_users(site_user_id text primary key,user_id uuid not null unique references auth.users(id),migrated boolean not null default false);
alter table livre.site_users enable row level security;
revoke all on livre.site_users from public,anon,authenticated;
grant select,insert,update on livre.site_users to service_role;
do $$ declare t text;begin
 foreach t in array array['accounts','credit_cards','transactions','budgets','goals'] loop
  execute format('alter table livre.%I add column app_record_id text, add column app_data jsonb',t);
  execute format('create unique index %I on livre.%I(user_id,app_record_id)',t||'_app_record',t);
 end loop;
end $$;
create function livre.record_uuid(u uuid, k text) returns uuid language sql immutable strict security invoker set search_path='' as $$select md5(u::text||'|'||k)::uuid$$;
create function livre.app_snapshot(u uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('records',coalesce((select jsonb_agg(r) from (
 select jsonb_build_object('id',app_record_id,'kind','account','data',app_data) r from livre.accounts where user_id=u and app_record_id is not null union all
 select jsonb_build_object('id',app_record_id,'kind','card','data',app_data) from livre.credit_cards where user_id=u and app_record_id is not null union all
 select jsonb_build_object('id',app_record_id,'kind','transaction','data',app_data) from livre.transactions where user_id=u and app_record_id is not null union all
 select jsonb_build_object('id',app_record_id,'kind','budget','data',app_data) from livre.budgets where user_id=u and app_record_id is not null union all
 select jsonb_build_object('id',app_record_id,'kind','goal','data',app_data) from livre.goals where user_id=u and app_record_id is not null) q),'[]'::jsonb),
 'connections',coalesce((select jsonb_agg(jsonb_build_object('id',provider_item_id,'name',name,'status',status,'syncedAt',last_synced_at)) from livre.bank_connections where user_id=u),'[]'::jsonb))
$$;
create function livre.replace_snapshot(u uuid,records jsonb,connections jsonb) returns void language plpgsql security invoker set search_path='' as $$
 declare r jsonb; d jsonb; k text; rid text; cid uuid; src text;
 begin
 if jsonb_array_length(records)>15000 or jsonb_array_length(connections)>5 then raise exception 'Snapshot too large';end if;
 delete from livre.transactions where user_id=u;
 delete from livre.budgets where user_id=u;
 delete from livre.goals where user_id=u;
 delete from livre.accounts where user_id=u;
 delete from livre.credit_cards where user_id=u;
 delete from livre.sync_runs where user_id=u and connection_id not in(select livre.record_uuid(u,'connection:'||(c->>'id')) from jsonb_array_elements(connections)c);
 delete from livre.bank_connections where user_id=u and provider_item_id not in(select c->>'id' from jsonb_array_elements(connections)c);
 for r in select value from jsonb_array_elements(connections) loop
 insert into livre.bank_connections(id,user_id,provider,provider_item_id,name,status,last_synced_at) values(livre.record_uuid(u,'connection:'||(r->>'id')),u,'pluggy',r->>'id',r->>'name',coalesce(r->>'status','READY'),nullif(r->>'syncedAt','')::timestamptz)
 on conflict(id) do update set name=excluded.name,status=excluded.status,last_synced_at=excluded.last_synced_at;
 end loop;
 for k in select distinct coalesce(value->'data'->>'category','Outros') from jsonb_array_elements(records) where value->>'kind' in('transaction','budget') loop
 insert into livre.categories(id,user_id,name) values(livre.record_uuid(u,'category:'||k),u,k) on conflict(user_id,name) do nothing;
 end loop;
 for r in select value from jsonb_array_elements(records) where value->>'kind' in('account','card') loop
 d:=r->'data';rid:=r->>'id';src:=coalesce(d->>'source','manual');cid:=case when src='pluggy' then livre.record_uuid(u,'connection:'||(d->>'sourceItem')) else null end;
 if r->>'kind'='account' then
 insert into livre.accounts(id,user_id,connection_id,name,initial_balance,reported_balance,source,provider_account_id,balance_updated_at,app_record_id,app_data) values(livre.record_uuid(u,rid),u,cid,d->>'name',case when src='manual' then (d->>'amount')::numeric else 0 end,case when src='pluggy' then (d->>'amount')::numeric else null end,src,d->>'providerAccount',(d->>'updatedAt')::timestamptz,rid,d);
 else
 insert into livre.credit_cards(id,user_id,connection_id,name,credit_limit,available_limit,reported_balance,closing_day,due_day,source,provider_account_id,balance_updated_at,app_record_id,app_data) values(livre.record_uuid(u,rid),u,cid,d->>'name',(d->>'amount')::numeric,(d->>'availableLimit')::numeric,(d->>'balance')::numeric,nullif(d->>'closing','')::smallint,nullif(d->>'due','')::smallint,src,d->>'providerAccount',(d->>'updatedAt')::timestamptz,rid,d);
 end if;end loop;
 for r in select value from jsonb_array_elements(records) where value->>'kind' not in('account','card') loop
 d:=r->'data';rid:=r->>'id';src:=coalesce(d->>'source','manual');
 select id into cid from livre.categories where user_id=u and name=coalesce(d->>'category','Outros');
 if r->>'kind'='transaction' then
 insert into livre.transactions(id,user_id,connection_id,account_id,credit_card_id,category_id,description,amount,type,status,transaction_date,source,provider_transaction_id,legacy_record_id,app_record_id,app_data) values(livre.record_uuid(u,rid),u,case when src='pluggy' then livre.record_uuid(u,'connection:'||(d->>'sourceItem')) else null end,livre.record_uuid(u,nullif(d->>'account','')),livre.record_uuid(u,nullif(d->>'card','')),cid,d->>'name',(d->>'amount')::numeric,d->>'type',case when (d->>'paid')::boolean then 'posted' else 'pending' end,(d->>'date')::date,src,d->>'providerTransaction',rid,rid,d);
 elsif r->>'kind'='budget' then
 insert into livre.budgets(id,user_id,category_id,name,month,amount,app_record_id,app_data) values(livre.record_uuid(u,rid),u,cid,d->>'name',date_trunc('month',coalesce(nullif(d->>'month','')::date,current_date))::date,(d->>'amount')::numeric,rid,d);
 elsif r->>'kind'='goal' then
 insert into livre.goals(id,user_id,name,target_amount,saved_amount,target_date,app_record_id,app_data) values(livre.record_uuid(u,rid),u,d->>'name',(d->>'amount')::numeric,coalesce((d->>'saved')::numeric,0),nullif(d->>'date','')::date,rid,d);
 else raise exception 'Invalid record kind';end if;
 end loop;
 end $$;
create function livre.app_api(u uuid, action text, payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
 declare s jsonb; rec jsonb; conn jsonb; old jsonb; rid text; item text; category text;
 begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if not exists(select 1 from livre.site_users where user_id=u) then raise exception 'Unknown Site user';end if;
 s:=livre.app_snapshot(u);rec:=s->'records';conn:=s->'connections';
 if action='read' then return s;end if;
 if action='migrate' then
 if (select migrated from livre.site_users where user_id=u) then return s;end if;
 if jsonb_array_length(rec)>0 or jsonb_array_length(conn)>0 then raise exception 'Destination already contains records';end if;
 rec:=coalesce(payload->'records','[]');conn:=coalesce(payload->'connections','[]');
 elsif action='save' then
 rid:=payload->>'id';select value into old from jsonb_array_elements(rec) where value->>'id'=rid;
 if old is not null and old->>'kind'<>payload->>'kind' then raise exception 'Record kind cannot change';end if;
 if old->'data'->>'source'='pluggy' then
 if old->>'kind'<>'transaction' then raise exception 'Imported record is read only';end if;
 category:=payload->'data'->>'category';if not category=any(array['Moradia','Alimentação','Transporte','Saúde','Lazer','Educação','Compras','Salário','Outros']) then raise exception 'Invalid category';end if;
 payload:=jsonb_set(old,'{data,category}',to_jsonb(category));
 elsif coalesce(payload->'data'->>'source','manual')<>'manual' then raise exception 'Invalid source';end if;
 select coalesce(jsonb_agg(value),'[]') into rec from jsonb_array_elements(rec) where value->>'id'<>rid;rec:=rec||jsonb_build_array(payload);
 elsif action='delete' then
 rid:=payload->>'id';if exists(select 1 from jsonb_array_elements(rec) where value->>'id'=rid and value->'data'->>'source'='pluggy') then raise exception 'Imported record is read only';end if;
 select coalesce(jsonb_agg(value),'[]') into rec from jsonb_array_elements(rec) where value->>'id'<>rid;
 elsif action='bank_add' then
 if jsonb_array_length(conn)>=5 or exists(select 1 from jsonb_array_elements(conn) where value->>'id'=payload->>'id') then raise exception 'Connection limit or duplicate';end if;conn:=conn||jsonb_build_array(payload);
 elsif action='bank_delete' then
 item:=payload->>'id';
 if exists(select 1 from jsonb_array_elements(rec)m join jsonb_array_elements(rec)a on a->'data'->>'sourceItem'=item and (m->'data'->>'account'=a->>'id' or m->'data'->>'card'=a->>'id') where coalesce(m->'data'->>'source','manual')='manual') then raise exception 'Connection has manual entries';end if;
 select coalesce(jsonb_agg(value),'[]') into rec from jsonb_array_elements(rec) where coalesce(value->'data'->>'sourceItem','')<>item;
 select coalesce(jsonb_agg(value),'[]') into conn from jsonb_array_elements(conn) where value->>'id'<>item;
 elsif action='bank_sync' then
 item:=payload->>'id';if not exists(select 1 from jsonb_array_elements(conn)where value->>'id'=item) then raise exception 'Connection not found';end if;
 select coalesce(jsonb_agg(value),'[]') into rec from jsonb_array_elements(rec) where value->>'kind'<>'transaction' or coalesce(value->'data'->>'sourceItem','')<>item;
 for old in select value from jsonb_array_elements(payload->'records') loop
 if old->'data'->>'sourceItem'<>item or old->'data'->>'source'<>'pluggy' then raise exception 'Invalid imported ownership';end if;
 select coalesce(jsonb_agg(value),'[]') into rec from jsonb_array_elements(rec) where value->>'id'<>old->>'id';rec:=rec||jsonb_build_array(old);
 end loop;
 select jsonb_agg(case when value->>'id'=item then value||jsonb_build_object('status',payload->>'status','syncedAt',payload->>'syncedAt') else value end) into conn from jsonb_array_elements(conn);
 else raise exception 'Invalid action';end if;
 perform livre.replace_snapshot(u,rec,conn);
 if action='migrate' then update livre.site_users set migrated=true where user_id=u;end if;
 if action='bank_sync' then insert into livre.sync_runs(user_id,connection_id,finished_at,status,imported_accounts,imported_transactions) values(u,livre.record_uuid(u,'connection:'||item),now(),case when payload->>'status'='PARTIAL_SUCCESS' then 'partial' else 'succeeded' end,(payload->>'accounts')::integer,(payload->>'transactions')::integer);end if;
 return livre.app_snapshot(u);
 end $$;
revoke all on function livre.record_uuid(uuid,text),livre.app_snapshot(uuid),livre.replace_snapshot(uuid,jsonb,jsonb),livre.app_api(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function livre.record_uuid(uuid,text),livre.app_snapshot(uuid),livre.replace_snapshot(uuid,jsonb,jsonb),livre.app_api(uuid,text,jsonb) to service_role;
