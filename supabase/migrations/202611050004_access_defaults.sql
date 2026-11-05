-- New API objects require explicit grants in their own migration.
-- This protects future tables/functions even if their author omits RLS or a revoke.
begin;

revoke create on schema public from public, anon, authenticated;
-- Schema-level revokes cannot remove a global default grant (notably EXECUTE).
alter default privileges for role postgres
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
