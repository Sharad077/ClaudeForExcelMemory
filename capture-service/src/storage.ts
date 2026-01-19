import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { CapturedSession, SessionSummary } from './types';

let db: Database | null = null;
let dbPath: string = '';

export function getDbPath(): string {
  if (!dbPath) {
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'sessions.db');
  }
  return dbPath;
}

function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(getDbPath(), buffer);
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();
  const dbFilePath = getDbPath();

  let database: Database;
  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    database = new SQL.Database(fileBuffer);
  } else {
    database = new SQL.Database();
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workbook_name TEXT,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      request_body TEXT,
      response_body TEXT,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      user_prompt TEXT,
      assistant_response TEXT
    )
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_workbook ON sessions(workbook_name)');
  database.run('CREATE INDEX IF NOT EXISTS idx_captured ON sessions(captured_at)');

  db = database;
  saveDatabase();
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

export function insertSession(session: CapturedSession): void {
  if (!db) throw new Error('Database not initialized');

  try {
    db.run(
      `INSERT INTO sessions (
        id, workbook_name, captured_at, request_body, response_body,
        model, input_tokens, output_tokens, user_prompt, assistant_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.workbook_name,
        session.captured_at,
        session.request_body,
        session.response_body,
        session.model,
        session.input_tokens,
        session.output_tokens,
        session.user_prompt,
        session.assistant_response,
      ]
    );

    saveDatabase();
    console.log('[Storage] Inserted session:', session.id, '- Count now:', getSessionCount());
  } catch (error) {
    console.error('[Storage] Insert failed:', error);
  }
}

// Get the active session for a workbook (most recent)
export function getActiveSessionByWorkbook(workbookName: string): CapturedSession | null {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    SELECT * FROM sessions
    WHERE workbook_name = ?
    ORDER BY captured_at DESC
    LIMIT 1
  `);
  stmt.bind([workbookName]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as CapturedSession;
    stmt.free();
    return row;
  }

  stmt.free();
  return null;
}

// Update an existing session (for thread updates)
export function updateSession(session: CapturedSession): void {
  if (!db) throw new Error('Database not initialized');

  try {
    db.run(
      `UPDATE sessions SET
        captured_at = ?,
        request_body = ?,
        response_body = ?,
        user_prompt = ?,
        assistant_response = ?
      WHERE id = ?`,
      [
        session.captured_at,
        session.request_body,
        session.response_body,
        session.user_prompt,
        session.assistant_response,
        session.id,
      ]
    );

    saveDatabase();
    console.log('[Storage] Updated session:', session.id);
  } catch (error) {
    console.error('[Storage] Update failed:', error);
  }
}

export function getAllSessions(): SessionSummary[] {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    SELECT
      id, workbook_name, captured_at, model, input_tokens, output_tokens,
      SUBSTR(user_prompt, 1, 200) as user_prompt_preview
    FROM sessions
    ORDER BY captured_at DESC
  `);

  const results: SessionSummary[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as SessionSummary;
    results.push(row);
  }
  stmt.free();

  return results;
}

export function getSessionById(id: string): CapturedSession | null {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  stmt.bind([id]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as CapturedSession;
    stmt.free();
    return row;
  }

  stmt.free();
  return null;
}

export function getSessionsByWorkbook(workbookName: string): SessionSummary[] {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    SELECT
      id, workbook_name, captured_at, model, input_tokens, output_tokens,
      SUBSTR(user_prompt, 1, 200) as user_prompt_preview
    FROM sessions
    WHERE workbook_name = ?
    ORDER BY captured_at DESC
  `);
  stmt.bind([workbookName]);

  const results: SessionSummary[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as SessionSummary;
    results.push(row);
  }
  stmt.free();

  return results;
}

export function deleteSession(id: string): boolean {
  if (!db) throw new Error('Database not initialized');

  const before = getSessionCount();
  db.run('DELETE FROM sessions WHERE id = ?', [id]);
  saveDatabase();
  const after = getSessionCount();

  return after < before;
}

export function getSessionCount(): number {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare('SELECT COUNT(*) as count FROM sessions');
  stmt.step();
  const result = stmt.getAsObject() as { count: number };
  stmt.free();

  return result.count;
}

export function searchSessions(query: string): SessionSummary[] {
  if (!db) throw new Error('Database not initialized');

  const searchTerm = `%${query}%`;
  const stmt = db.prepare(`
    SELECT
      id, workbook_name, captured_at, model, input_tokens, output_tokens,
      SUBSTR(user_prompt, 1, 200) as user_prompt_preview
    FROM sessions
    WHERE user_prompt LIKE ? OR assistant_response LIKE ?
    ORDER BY captured_at DESC
  `);
  stmt.bind([searchTerm, searchTerm]);

  const results: SessionSummary[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as SessionSummary;
    results.push(row);
  }
  stmt.free();

  return results;
}

export function clearAllSessions(): void {
  if (!db) throw new Error('Database not initialized');

  db.run('DELETE FROM sessions');
  saveDatabase();
}
