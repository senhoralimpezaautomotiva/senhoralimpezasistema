\set ON_ERROR_STOP on
\pset pager off
\pset footer off

-- DB-001: validação somente leitura para executar tanto na origem quanto no
-- alvo isolado restaurado. A saída contém somente nomes técnicos e contagens.

\echo '=== DB001_OBJECT_COUNTS ==='
SELECT
  n.nspname AS schema_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned_table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    WHEN 'S' THEN 'sequence'
    ELSE c.relkind::text
  END AS object_kind,
  count(*) AS object_count
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'auth', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
GROUP BY n.nspname, c.relkind
ORDER BY n.nspname, object_kind;

\echo '=== DB001_ROUTINE_COUNTS ==='
SELECT
  n.nspname AS schema_name,
  count(*) AS routine_count
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'auth', 'storage')
GROUP BY n.nspname
ORDER BY n.nspname;

\echo '=== DB001_POLICY_COUNTS ==='
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  count(*) AS policy_count
FROM pg_policies
WHERE schemaname IN ('public', 'auth', 'storage')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

\echo '=== DB001_ROW_COUNTS ==='
SELECT format(
  'SELECT %L AS table_name, count(*)::bigint AS row_count FROM %I.%I;',
  schemaname || '.' || tablename,
  schemaname,
  tablename
)
FROM pg_tables
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, tablename
\gexec
