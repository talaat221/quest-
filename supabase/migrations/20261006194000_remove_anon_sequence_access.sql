-- Anonymous visitors do not insert rows directly, so they do not need sequence access.
revoke all privileges on all sequences in schema public from anon;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon;
