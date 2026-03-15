import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { config } from "./config.js";

const dbDir = path.dirname(config.DATABASE_PATH);
fs.mkdirSync(dbDir, { recursive: true });

export const sqlite = new Database(config.DATABASE_PATH);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

function ensureColumn(table: string, column: string, definition: string): void {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const hasColumn = columns.some((item) => item.name === column);
  if (!hasColumn) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initDb(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'full',
      status TEXT NOT NULL,
      states_json TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      summary_json TEXT,
      report_json TEXT,
      usage_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_stage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      impact TEXT,
      suggested_next_step TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_offers_snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discovered_casinos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      state TEXT NOT NULL,
      casino_name TEXT NOT NULL,
      confidence REAL NOT NULL,
      is_missing INTEGER NOT NULL,
      citations_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discovered_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      state TEXT NOT NULL,
      casino_name TEXT NOT NULL,
      offer_name TEXT NOT NULL,
      offer_type TEXT,
      expected_deposit REAL NOT NULL,
      expected_bonus REAL NOT NULL,
      confidence REAL NOT NULL,
      citations_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comparisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      state TEXT NOT NULL,
      casino_name TEXT NOT NULL,
      verdict TEXT NOT NULL,
      bonus_delta REAL NOT NULL,
      deposit_delta REAL NOT NULL,
      confidence REAL NOT NULL,
      rationale TEXT NOT NULL,
      current_offer_json TEXT,
      discovered_offer_json TEXT,
      alternatives_json TEXT NOT NULL,
      citations_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      target TEXT NOT NULL,
      model TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      status TEXT NOT NULL,
      input_text TEXT NOT NULL,
      raw_response_json TEXT,
      extracted_text TEXT,
      error_message TEXT,
      latency_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_cancellations (
      run_id TEXT PRIMARY KEY,
      requested_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_llm_traces_run_id ON llm_traces(run_id);
    CREATE INDEX IF NOT EXISTS idx_llm_traces_stage_status ON llm_traces(stage, status);
  `);

  ensureColumn("runs", "mode", "TEXT NOT NULL DEFAULT 'full'");
}
