/**
 * Pre-deploy step (runs inside CF, in the Postgres deployer container) BEFORE
 * `cds-deploy`.
 *
 * The BP app shares the existing `zepcappg-postgres` instance with other CAP
 * apps. To guarantee ZERO impact on them, all BP objects live in a dedicated
 * schema (default "znus_bp") instead of the shared `public` schema — this
 * isolates even CAP's framework tables (DRAFT admin, outbox, sap.common.*).
 *
 * Scoping is done per-connection via `credentials.schema` (cds-deploy and the
 * srv app each issue `SET search_path TO znus_bp` on their own connections).
 * We do NOT touch role/database defaults — the binding user `dbo` is shared
 * across all apps on this instance, so role-level changes would affect them.
 *
 * Here we only (idempotently) create the schema and grant access to PUBLIC so
 * the separately-bound srv app's connections can read/write the tables.
 */
function loadPg() {
  try {
    return require('pg');
  } catch {
    return require(require.resolve('pg', { paths: [require.resolve('@cap-js/postgres')] }));
  }
}
const { Client } = loadPg();

const SCHEMA = (process.env.CDS_REQUIRES_DB_CREDENTIALS_SCHEMA || 'znus_bp').replace(/[^a-zA-Z0-9_]/g, '');

function creds() {
  const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
  const list = vcap['postgresql-db'] || [];
  if (!list.length) throw new Error('No postgresql-db binding found in VCAP_SERVICES');
  return list[0].credentials;
}

(async () => {
  const c = creds();
  const client = new Client({
    host: c.hostname,
    port: c.port,
    database: c.dbname,
    user: c.username,
    password: c.password,
    ssl: c.sslrootcert ? { ca: c.sslrootcert, rejectUnauthorized: false } : { rejectUnauthorized: false },
  });
  await client.connect();

  const s = `"${SCHEMA}"`;
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
  await client.query(`GRANT ALL ON SCHEMA ${s} TO PUBLIC`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} GRANT ALL ON TABLES TO PUBLIC`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} GRANT ALL ON SEQUENCES TO PUBLIC`);

  const present = (await client.query(
    `select 1 from pg_namespace where nspname = '${SCHEMA}'`
  )).rowCount === 1;
  console.log(`[setup-schema] schema "${SCHEMA}" ready: ${present} (isolated; no role/db defaults changed)`);

  await client.end();
})().catch((e) => {
  console.error('[setup-schema] FAILED:', e.message);
  process.exit(1);
});
