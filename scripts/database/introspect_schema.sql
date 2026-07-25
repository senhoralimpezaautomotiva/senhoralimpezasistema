\set ON_ERROR_STOP on
\pset pager off
\pset footer off

-- DB-001: inventário somente leitura. Este arquivo não contém DDL/DML e não
-- lê linhas das tabelas de negócio. Grave a saída apenas em backups/, que é
-- ignorado pelo controle de versão e deve possuir acesso restrito.

\echo '=== DB001_DATABASE ==='
SELECT
  current_database() AS database_name,
  current_setting('server_version') AS postgres_version,
  current_user AS inspected_by;

\echo '=== DB001_EXTENSIONS ==='
SELECT
  e.extname AS extension_name,
  e.extversion AS extension_version,
  n.nspname AS schema_name
FROM pg_extension AS e
JOIN pg_namespace AS n ON n.oid = e.extnamespace
ORDER BY e.extname;

\echo '=== DB001_CUSTOM_TYPES_AND_ENUMS ==='
SELECT
  n.nspname AS schema_name,
  t.typname AS type_name,
  t.typtype AS type_kind,
  e.enumlabel AS enum_value,
  e.enumsortorder AS enum_order
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
LEFT JOIN pg_enum AS e ON e.enumtypid = t.oid
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND t.typtype IN ('c', 'd', 'e', 'r', 'm')
ORDER BY n.nspname, t.typname, e.enumsortorder NULLS FIRST;

\echo '=== DB001_TABLES_AND_RLS ==='
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned_table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    WHEN 'S' THEN 'sequence'
    ELSE c.relkind::text
  END AS object_kind,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'auth', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
ORDER BY n.nspname, c.relkind, c.relname;

\echo '=== DB001_COLUMNS ==='
SELECT
  cols.table_schema,
  cols.table_name,
  cols.ordinal_position,
  cols.column_name,
  cols.data_type,
  cols.udt_schema,
  cols.udt_name,
  cols.is_nullable,
  cols.column_default,
  cols.is_identity,
  cols.identity_generation,
  cols.is_generated,
  cols.generation_expression
FROM information_schema.columns AS cols
WHERE cols.table_schema IN ('public', 'auth', 'storage')
ORDER BY cols.table_schema, cols.table_name, cols.ordinal_position;

\echo '=== DB001_CONSTRAINTS ==='
SELECT
  n.nspname AS schema_name,
  rel.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'x' THEN 'EXCLUSION'
    ELSE con.contype::text
  END AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS definition,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
    ELSE NULL
  END AS on_delete,
  CASE con.confupdtype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
    ELSE NULL
  END AS on_update,
  con.convalidated AS validated
FROM pg_constraint AS con
JOIN pg_class AS rel ON rel.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = rel.relnamespace
WHERE n.nspname IN ('public', 'auth', 'storage')
ORDER BY n.nspname, rel.relname, con.contype, con.conname;

\echo '=== DB001_INDEXES ==='
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  indexname AS index_name,
  indexdef AS definition
FROM pg_indexes
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, tablename, indexname;

\echo '=== DB001_TRIGGERS ==='
SELECT
  event_object_schema AS schema_name,
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'auth', 'storage')
ORDER BY event_object_schema, event_object_table, trigger_name, event_manipulation;

\echo '=== DB001_FUNCTIONS ==='
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_function_result(p.oid) AS result_type,
  l.lanname AS language,
  p.prosecdef AS security_definer,
  p.provolatile AS volatility,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
JOIN pg_language AS l ON l.oid = p.prolang
WHERE n.nspname IN ('public', 'auth', 'storage')
ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);

\echo '=== DB001_POLICIES ==='
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  policyname AS policy_name,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS check_expression
FROM pg_policies
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, tablename, policyname;

\echo '=== DB001_VIEWS ==='
SELECT
  schemaname AS schema_name,
  viewname AS view_name,
  definition
FROM pg_views
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, viewname;

\echo '=== DB001_MATERIALIZED_VIEWS ==='
SELECT
  schemaname AS schema_name,
  matviewname AS view_name,
  definition
FROM pg_matviews
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, matviewname;

\echo '=== DB001_SEQUENCES ==='
SELECT
  sequence_schema AS schema_name,
  sequence_name,
  data_type,
  start_value,
  minimum_value,
  maximum_value,
  increment,
  cycle_option
FROM information_schema.sequences
WHERE sequence_schema IN ('public', 'auth', 'storage')
ORDER BY sequence_schema, sequence_name;

\echo '=== DB001_TABLE_PRIVILEGES ==='
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema IN ('public', 'auth', 'storage')
ORDER BY table_schema, table_name, grantee, privilege_type;

\echo '=== DB001_ROUTINE_PRIVILEGES ==='
SELECT
  routine_schema,
  routine_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_routine_grants
WHERE routine_schema IN ('public', 'auth', 'storage')
ORDER BY routine_schema, routine_name, grantee, privilege_type;

\echo '=== DB001_PUBLICATIONS ==='
SELECT
  p.pubname AS publication_name,
  n.nspname AS schema_name,
  c.relname AS table_name
FROM pg_publication AS p
LEFT JOIN pg_publication_rel AS pr ON pr.prpubid = p.oid
LEFT JOIN pg_class AS c ON c.oid = pr.prrelid
LEFT JOIN pg_namespace AS n ON n.oid = c.relnamespace
ORDER BY p.pubname, n.nspname NULLS FIRST, c.relname NULLS FIRST;

\echo '=== DB001_MIGRATION_HISTORY ==='
SELECT
  to_regclass('supabase_migrations.schema_migrations') AS migration_history_table;

SELECT
  'SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;'
WHERE to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
\gexec
