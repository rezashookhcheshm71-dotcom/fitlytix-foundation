import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;
const columnCache = new Map<string, Set<string>>();
let existingTablesCache: Set<string> | null = null;

function resolveDbConfig() {
  const host = process.env["DB_HOST"] ?? process.env["MYSQL_HOST"] ?? "127.0.0.1";
  const port = Number(process.env["DB_PORT"] ?? process.env["MYSQL_PORT"] ?? "3306");
  const database = process.env["DB_NAME"] ?? process.env["MYSQL_DATABASE"] ?? "eugtezmj_fitlytix";
  const user = process.env["DB_USER"] ?? process.env["MYSQL_USER"] ?? "";
  const password = process.env["DB_PASSWORD"] ?? process.env["MYSQL_PASSWORD"] ?? "";

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 3306,
    database,
    user,
    password,
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
    host: cfg.host,
    port: cfg.port,
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

export async function getTableColumns(tableName: string, conn?: PoolConnection): Promise<Set<string>> {
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
