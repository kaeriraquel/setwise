// Sincronización offline-first:
// 1) PUSH: sube las filas locales marcadas dirty=1 (upsert por id).
// 2) PULL: baja lo que cambió en el servidor desde la última vez (columna synced_at, hora del servidor).
// Conflictos: gana el updated_at más reciente (last-writer-wins), en el servidor (trigger) y aquí.
import { db, TABLES, COLS, Table, getMeta, setMeta } from './db';
import { supabase } from './supabase';

const BOOL = new Set(['deleted', 'done', 'is_pr']);
const PAGE = 500;
let running: Promise<SyncResult> | null = null;

export type SyncResult = { ok: boolean; message: string; changed: boolean };

function toRemote(t: Table, r: any) {
  const o: any = {};
  for (const c of COLS[t]) {
    let v = r[c];
    if (BOOL.has(c)) v = !!v;
    if (t === 'routines' && c === 'days') { try { v = JSON.parse(v); } catch { v = []; } }
    o[c] = v;
  }
  return o;
}
function toLocal(t: Table, r: any) {
  const o: any = {};
  for (const c of COLS[t]) {
    let v = r[c];
    if (BOOL.has(c)) v = v ? 1 : 0;
    if (t === 'routines' && c === 'days') v = JSON.stringify(v ?? []);
    o[c] = v ?? null;
  }
  return o;
}

async function push(t: Table) {
  for (let guard = 0; guard < 50; guard++) {
    const rows = db.getAllSync<any>(`SELECT ${COLS[t].join(', ')} FROM ${t} WHERE dirty=1 LIMIT ${PAGE}`);
    if (!rows.length) return;
    const { error } = await supabase!.from(t).upsert(rows.map((r) => toRemote(t, r)), { onConflict: 'id' });
    if (error) throw error;
    // Solo limpia dirty si la fila no cambió mientras se subía.
    db.withTransactionSync(() => {
      for (const r of rows) db.runSync(`UPDATE ${t} SET dirty=0 WHERE id=? AND updated_at=?`, [r.id, r.updated_at]);
    });
    if (rows.length < PAGE) return;
  }
}

async function pull(t: Table): Promise<boolean> {
  const key = 'pull_' + t;
  const last = getMeta(key);
  // 5 s de traslape por si una transacción del servidor terminó tarde; aplicar dos veces es inofensivo.
  let since = last ? new Date(new Date(last).getTime() - 5000).toISOString() : '1970-01-01T00:00:00Z';
  let changed = false;
  for (let guard = 0; guard < 200; guard++) {
    const { data, error } = await supabase!.from(t).select(COLS[t].join(',') + ',synced_at')
      .gt('synced_at', since).order('synced_at', { ascending: true }).limit(1000);
    if (error) throw error;
    if (!data || !data.length) break;
    db.withTransactionSync(() => {
      for (const remote of data as any[]) {
        const local = db.getFirstSync<{ updated_at: number; dirty: number }>(`SELECT updated_at, dirty FROM ${t} WHERE id=?`, [remote.id]);
        if (local && local.updated_at >= remote.updated_at) continue; // lo local es igual o más nuevo
        const r = toLocal(t, remote);
        const cols = Object.keys(r);
        db.runSync(
          `INSERT INTO ${t} (${cols.join(', ')}, dirty) VALUES (${cols.map(() => '?').join(', ')}, 0)
           ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(', ')}, dirty=0`,
          cols.map((c) => r[c]),
        );
        changed = true;
      }
    });
    const newest = (data[data.length - 1] as any).synced_at as string;
    setMeta(key, newest);
    if (data.length < 1000) break;
    since = newest;
  }
  return changed;
}

async function run(): Promise<SyncResult> {
  if (!supabase) return { ok: false, message: 'Nube no configurada (falta .env)', changed: false };
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { ok: false, message: 'Inicia sesión para respaldar en la nube', changed: false };
  try {
    for (const t of TABLES) await push(t);
    let changed = false;
    for (const t of TABLES) changed = (await pull(t)) || changed;
    setMeta('last_sync', String(Date.now()));
    return { ok: true, message: 'Sincronizado', changed };
  } catch (e: any) {
    const offline = /network|fetch|timeout/i.test(String(e?.message ?? e));
    return { ok: false, message: offline ? 'Sin conexión: se sincroniza cuando vuelva el internet' : 'Error al sincronizar: ' + (e?.message ?? e), changed: false };
  }
}

// Evita dos sincronizaciones al mismo tiempo.
export function syncNow(): Promise<SyncResult> {
  if (!running) running = run().finally(() => { running = null; });
  return running;
}

export function pendingCount(): number {
  return TABLES.reduce((n, t) => n + (db.getFirstSync<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t} WHERE dirty=1`)?.c ?? 0), 0);
}
