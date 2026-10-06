-- Fail closed for future objects created by Quest migrations.
-- Client-callable functions must receive an explicit GRANT in the migration that creates them.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Anonymous visitors should not receive direct table privileges by default.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;

-- Signed-in users never need schema-management style table privileges from the browser.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;
