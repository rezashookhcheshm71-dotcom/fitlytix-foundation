import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

let pool: Pool | null = null;
const columnCache = new Map<string, Set<string>>();
let existingTablesCache: Set<string> | null = null;

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

  pool = mysql.createPool({
    ...(cfg.socketPath ? { socketPath: cfg.socketPath } : { host: cfg.host, port: cfg.port }),
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    waitForConnections: true,
    connectionLimit: 10,
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

export async function tableExists(tableName: string, conn?: PoolConnection): Promise<boolean> {
  const normalized = tableName.toLowerCase();
  if (existingTablesCache?.has(normalized)) return true;

  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT TABLE_NAME AS table_name
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ?
     LIMIT 1`,
    [normalized],
    conn,
  );
  if (rows.length > 0) {
    if (!existingTablesCache) existingTablesCache = new Set();
    existingTablesCache.add(normalized);
    return true;
  }
  return false;
}

export async function getTableColumns(
  tableName: string,
  conn?: PoolConnection,
): Promise<Set<string>> {
  const normalized = tableName.toLowerCase();
  const cached = columnCache.get(normalized);
  if (cached) return cached;

  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS col
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ?`,
    [normalized],
    conn,
  );
  const cols = new Set(rows.map((r) => String(r["col"]).toLowerCase()));
  if (cols.size > 0) {
    columnCache.set(normalized, cols);
  }
  return cols;
}

export async function testDatabaseConnection(): Promise<{ db: string; table_count: number }> {
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT DATABASE() AS db,
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()) AS table_count`,
  );
  const first: RowDataPacket | undefined = rows[0];
  return {
    db: String(first?.["db"] ?? resolveDbConfig().database),
    table_count: Number(first?.["table_count"] ?? 0),
  };
}
