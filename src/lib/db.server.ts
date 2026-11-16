import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

let pool: Pool | null = null;
const columnCache = new Map<string, Set<string>>();
let tablesCache: { at: number; names: Set<string> } | null = null;
// Positive/negative schema answers are cached briefly: a migration applied while the app is
// running becomes visible within a minute without restarting Passenger.
const SCHEMA_CACHE_TTL_MS = 60_000;
const SAFE_IDENTIFIER = /^[a-z0-9_]{1,64}$/;

/**
 * Read an env var defensively.
 *
 * cPanel/Apache `SetEnv DB_USER  someone` (double space) or a stray newline in an `.env`
 * file ends up inside the value; MySQL then rejects the login with a message such as
 * `Access denied for user ' someone'@'localhost'`, which is very hard to spot. Trimming
 * (and unwrapping harmless surrounding quotes) makes the app tolerant of that.
 */
function readEnvVar(...names: string[]): string | undefined {
  for (const name of names) {
    const raw = process.env[name];
    if (raw === undefined) continue;
    // Strip whitespace (JS \s already covers NBSP and BOM) plus zero-width characters,
    // which survive copy/paste from chat and docs and are invisible in an editor.
    let value = raw.replace(/^[\s\u200b-\u200d]+|[\s\u200b-\u200d]+$/g, "");
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' || first === "'") && first === last) {
        value = value.slice(1, -1).trim();
      }
    }
    if (value) return value;
  }
  return undefined;
}

function resolveDbConfig() {
  const host = readEnvVar("DB_HOST", "MYSQL_HOST") ?? "127.0.0.1";
  const port = Number(readEnvVar("DB_PORT", "MYSQL_PORT") ?? "3306");
  const database = readEnvVar("DB_NAME", "MYSQL_DATABASE") ?? "eugtezmj_fitlytix";
  const user = readEnvVar("DB_USER", "MYSQL_USER") ?? "";
  const password = readEnvVar("DB_PASSWORD", "MYSQL_PASSWORD") ?? "";
  // Some cPanel hosts only expose the MySQL unix socket (TCP 3306 stays closed).
  // Setting DB_SOCKET=/var/lib/mysql/mysql.sock makes mysql2 connect over the socket.
  const socketPath = readEnvVar("DB_SOCKET", "MYSQL_SOCKET") ?? "";

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 3306,
    database,
    user,
    password,
    socketPath,
  };
}

export function isDatabaseConfigured(): boolean {
  const cfg = resolveDbConfig();
  return Boolean(cfg.database && cfg.user);
}

export function getDbPool(): Pool {
  if (pool) return pool;

  const cfg = resolveDbConfig();
  if (!cfg.user) {
    throw new Error("DB_NOT_CONFIGURED");
  }

  // Shared cPanel hosting allows only a handful of concurrent MySQL connections in total
  // (observed: 63 threads already in use, and "Too many connections" on registration).
  // Each Node process therefore keeps a very small pool and releases idle sockets quickly.
  const configuredLimit = Number(process.env["DB_POOL_SIZE"] ?? "");
  const connectionLimit =
    Number.isFinite(configuredLimit) && configuredLimit >= 1 ? Math.min(configuredLimit, 20) : 3;

  pool = mysql.createPool({
    ...(cfg.socketPath ? { socketPath: cfg.socketPath } : { host: cfg.host, port: cfg.port }),
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    waitForConnections: true,
    connectionLimit,
    maxIdle: 2,
    idleTimeout: 30_000,
    enableKeepAlive: true,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
  });

  return pool;
}

export async function dbQuery<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params: unknown[] = [],
  conn?: PoolConnection,
): Promise<T> {
  const executor = conn ?? getDbPool();
  const [rows] = await executor.execute<T>(sql, params as never);
  return rows;
}

export async function dbExecute(
  sql: string,
  params: unknown[] = [],
  conn?: PoolConnection,
): Promise<ResultSetHeader> {
  const executor = conn ?? getDbPool();
  const [result] = await executor.execute<ResultSetHeader>(sql, params as never);
  return result;
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getDbPool().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Table names in the current database.
 *
 * Uses `SHOW TABLES` on purpose. On cPanel/CloudLinux the MySQL account is frequently denied
 * `INFORMATION_SCHEMA` (`#1044 Access denied ... to database 'information_schema'`), which used
 * to make every `tableExists()` throw and turn ordinary pages into 500s. `SHOW TABLES` only
 * needs the table privileges the account already has; INFORMATION_SCHEMA stays as a fallback.
 */
async function listTables(conn?: PoolConnection): Promise<Set<string>> {
  if (tablesCache && Date.now() - tablesCache.at < SCHEMA_CACHE_TTL_MS) return tablesCache.names;

  let names: string[] = [];
  try {
    const rows = await dbQuery<RowDataPacket[]>("SHOW TABLES", [], conn);
    names = rows.map((row) => String(Object.values(row)[0] ?? "").toLowerCase());
  } catch {
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT LOWER(TABLE_NAME) AS table_name
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()`,
      [],
      conn,
    );
    names = rows.map((row) => String(row["table_name"] ?? "").toLowerCase());
  }

  tablesCache = { at: Date.now(), names: new Set(names.filter(Boolean)) };
  return tablesCache.names;
}

export async function tableExists(tableName: string, conn?: PoolConnection): Promise<boolean> {
  const normalized = tableName.toLowerCase();
  try {
    return (await listTables(conn)).has(normalized);
  } catch {
    return false;
  }
}

export async function getTableColumns(
  tableName: string,
  conn?: PoolConnection,
): Promise<Set<string>> {
  const normalized = tableName.toLowerCase();
  const cached = columnCache.get(normalized);
  if (cached) return cached;

  // Table names reach this function from fixed call sites, but it is interpolated into SQL,
  // so refuse anything that is not a plain identifier.
  if (!SAFE_IDENTIFIER.test(normalized)) return new Set();

  let rows: RowDataPacket[] = [];
  try {
    // SHOW COLUMNS avoids INFORMATION_SCHEMA, which cPanel may deny (see listTables).
    rows = await dbQuery<RowDataPacket[]>(`SHOW COLUMNS FROM \`${normalized}\``, [], conn);
  } catch {
    // Missing table (1146) or no privileges: the caller treats an empty set as "no columns".
    return new Set();
  }

  const cols = new Set(
    rows.map((r) => String(r["Field"] ?? "").toLowerCase()).filter((name) => name !== ""),
  );
  if (cols.size > 0) {
    columnCache.set(normalized, cols);
  }
  return cols;
}

export async function testDatabaseConnection(): Promise<{ db: string; table_count: number }> {
  const rows = await dbQuery<RowDataPacket[]>("SELECT DATABASE() AS db");
  const first: RowDataPacket | undefined = rows[0];
  let tableCount = 0;
  try {
    tableCount = (await listTables()).size;
  } catch {
    tableCount = 0;
  }
  return {
    db: String(first?.["db"] ?? resolveDbConfig().database),
    table_count: tableCount,
  };
}
