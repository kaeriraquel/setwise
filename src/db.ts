// Base de datos local (SQLite). Es la fuente de verdad del celular:
// todo se escribe aquí primero y funciona sin internet.
// Cada fila lleva updated_at (ms), deleted (borrado lógico) y dirty (pendiente de subir).
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('mirutina.db');

export const TABLES = ['exercises', 'routines', 'routine_items', 'workouts', 'workout_sets'] as const;
export type Table = (typeof TABLES)[number];

// Columnas que se sincronizan con Supabase (dirty es solo local).
export const COLS: Record<Table, string[]> = {
  exercises: ['id', 'name', 'muscle_group', 'updated_at', 'deleted'],
  routines: ['id', 'name', 'days', 'position', 'updated_at', 'deleted'],
  routine_items: ['id', 'routine_id', 'exercise_id', 'position', 'sets', 'reps', 'rest_sec', 'updated_at', 'deleted'],
  workouts: ['id', 'routine_id', 'name', 'started_at', 'ended_at', 'updated_at', 'deleted'],
  workout_sets: ['id', 'workout_id', 'exercise_id', 'exercise_order', 'set_number', 'weight', 'reps', 'done', 'is_pr', 'updated_at', 'deleted'],
};

export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, muscle_group TEXT,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, days TEXT NOT NULL DEFAULT '[]', position INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS routine_items (
      id TEXT PRIMARY KEY NOT NULL, routine_id TEXT NOT NULL, exercise_id TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
      sets INTEGER NOT NULL DEFAULT 3, reps TEXT NOT NULL DEFAULT '10', rest_sec INTEGER NOT NULL DEFAULT 90,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY NOT NULL, routine_id TEXT, name TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS workout_sets (
      id TEXT PRIMARY KEY NOT NULL, workout_id TEXT NOT NULL, exercise_id TEXT NOT NULL, exercise_order INTEGER NOT NULL,
      set_number INTEGER NOT NULL, weight REAL, reps INTEGER, done INTEGER NOT NULL DEFAULT 0, is_pr INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX IF NOT EXISTS ix_sets_workout ON workout_sets(workout_id);
    CREATE INDEX IF NOT EXISTS ix_sets_exercise ON workout_sets(exercise_id);
    CREATE INDEX IF NOT EXISTS ix_items_routine ON routine_items(routine_id);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
  `);
}

export const now = () => Date.now();

// UUID v4 generado en el celular: permite crear registros sin conexión sin chocar entre dispositivos.
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type Val = string | number | null;

// Inserta o actualiza una fila y la marca como pendiente de sincronizar.
export function save(table: Table, row: Record<string, any>) {
  const r: Record<string, Val> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    r[k] = typeof v === 'boolean' ? (v ? 1 : 0) : Array.isArray(v) ? JSON.stringify(v) : v;
  }
  r.updated_at = now();
  r.dirty = 1;
  if (r.deleted == null) r.deleted = 0;
  const cols = Object.keys(r);
  const set = cols.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(', ');
  db.runSync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${set}`,
    cols.map((c) => r[c]),
  );
}

// Borrado lógico: así el borrado también viaja a los otros dispositivos.
export function remove(table: Table, id: string) {
  db.runSync(`UPDATE ${table} SET deleted=1, dirty=1, updated_at=? WHERE id=?`, [now(), id]);
}

export function getMeta(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key=?', [key]);
  return row ? row.value : null;
}
export function setMeta(key: string, value: string) {
  db.runSync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]);
}

// Al cerrar sesión se borran los datos locales para que otra cuenta no los herede.
export function wipeLocal() {
  db.execSync(TABLES.map((t) => `DELETE FROM ${t};`).join('\n') + "\nDELETE FROM meta WHERE key LIKE 'pull_%' OR key='last_sync';");
}
