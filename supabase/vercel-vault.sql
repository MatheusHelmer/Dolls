create table livre.server_credentials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 encrypted text not null check(length(encrypted)<5000)
);
alter table livre.server_credentials enable row level security;
revoke all on livre.server_credentials from public,anon,authenticated;
grant select,insert,update on livre.server_credentials to service_role;
