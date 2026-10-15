-- Roles are created by the image bootstrap superuser.
-- Backend uses ONLY the app role. The bootstrap account is not used by the app.

SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
  :'owner_user', :'owner_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'owner_user')
\gexec

SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
  :'app_user', :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

ALTER DATABASE :"db_name" OWNER TO :"owner_user";
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO :"owner_user";
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";

ALTER SCHEMA public OWNER TO :"owner_user";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_user";
GRANT CREATE ON SCHEMA public TO :"owner_user";

-- Existing tables/sequences (if migrations are added to this init set).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_user";

-- Future objects created by the migration/owner role get DML rights for the app.
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_user" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
