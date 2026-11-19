// Consultas y operaciones de la app sobre SQLite (todas síncronas y locales).
import { db, save, remove, uuid, now, getMeta, setMeta } from './db';

export type Exercise = { id: string; name: string; muscle_group: string };
export type RoutineItem = { id: string; exercise_id: string; exercise_name: string; position: number; sets: number; reps: string; rest_sec: number };
export type Routine = { id: string; name: string; days: number[]; position: number; items: RoutineItem[] };
export type Workout = { id: string; routine_id: string | null; name: string; started_at: number; ended_at: number | null };
export type WSet = { id: string; workout_id: string; exercise_id: string; exercise_order: number; set_number: number; weight: number | null; reps: number | null; done: number; is_pr: number };
export type Entry = { exercise_id: string; name: string; order: number; target: string; rest: number; sets: WSet[] };

export const GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Glúteo', 'Hombro', 'Brazos', 'Core', 'Cardio', 'Otro'];
const STARTER: [string, string][] = [
  ['Press banca', 'Pecho'], ['Press inclinado con mancuernas', 'Pecho'], ['Aperturas en máquina', 'Pecho'],
  ['Sentadilla', 'Piernas'], ['Prensa', 'Piernas'], ['Peso muerto rumano', 'Piernas'], ['Zancadas', 'Piernas'],
  ['Hip thrust', 'Glúteo'], ['Peso muerto', 'Espalda'], ['Dominadas', 'Espalda'], ['Remo con barra', 'Espalda'],
  ['Jalón al pecho', 'Espalda'], ['Press militar', 'Hombro'], ['Elevaciones laterales', 'Hombro'],
  ['Curl de bíceps', 'Brazos'], ['Extensión de tríceps en polea', 'Brazos'], ['Plancha', 'Core'],
];

// 1RM estimado (Epley)
export const e1rm = (w: number | null, r: number | null) => (!w || !r ? 0 : r === 1 ? w : w * (1 + r / 30));

/* ---------- ajustes ---------- */
export const getUnit = () => getMeta('unit') || 'kg';
export const setUnit = (u: string) => setMeta('unit', u);

/* ---------- ejercicios ---------- */
export function listExercises(): Exercise[] {
  return db.getAllSync<Exercise>('SELECT id, name, muscle_group FROM exercises WHERE deleted=0 ORDER BY name COLLATE NOCASE');
}
export function exerciseName(id: string): string {
  return db.getFirstSync<{ name: string }>('SELECT name FROM exercises WHERE id=?', [id])?.name ?? 'Ejercicio eliminado';
}
export function addExercise(name: string, group: string) {
  save('exercises', { id: uuid(), name: name.trim(), muscle_group: group });
}
export function seedStarter() {
  const have = new Set(listExercises().map((e) => e.name.toLowerCase()));
  db.withTransactionSync(() => {
    for (const [n, g] of STARTER) if (!have.has(n.toLowerCase())) addExercise(n, g);
  });
}
export const deleteExercise = (id: string) => remove('exercises', id);

/* ---------- rutinas ---------- */
export function listRoutines(): Routine[] {
  const rs = db.getAllSync<any>('SELECT id, name, days, position FROM routines WHERE deleted=0 ORDER BY position, name');
  const items = db.getAllSync<any>(
    `SELECT i.id, i.routine_id, i.exercise_id, COALESCE(e.name,'Ejercicio eliminado') AS exercise_name, i.position, i.sets, i.reps, i.rest_sec
     FROM routine_items i LEFT JOIN exercises e ON e.id=i.exercise_id WHERE i.deleted=0 ORDER BY i.position`,
  );
  return rs.map((r) => ({ ...r, days: safeDays(r.days), items: items.filter((i) => i.routine_id === r.id) }));
}
function safeDays(s: string): number[] {
  try { const d = JSON.parse(s); return Array.isArray(d) ? d : []; } catch { return []; }
}
export function getRoutine(id: string): Routine | undefined {
  return listRoutines().find((r) => r.id === id);
}
export function saveRoutine(r: { id?: string; name: string; days: number[]; items: { id?: string; exercise_id: string; sets: number; reps: string; rest_sec: number }[] }) {
  const id = r.id ?? uuid();
  db.withTransactionSync(() => {
    const prev = getRoutine(id);
    const position = prev?.position ?? (db.getFirstSync<{ m: number }>('SELECT COALESCE(MAX(position),0)+1 AS m FROM routines')?.m ?? 0);
    save('routines', { id, name: r.name.trim(), days: [...r.days].sort(), position });
    const keep = new Set<string>();
    r.items.forEach((it, i) => {
      const iid = it.id ?? uuid();
      keep.add(iid);
      save('routine_items', { id: iid, routine_id: id, exercise_id: it.exercise_id, position: i, sets: it.sets, reps: it.reps, rest_sec: it.rest_sec });
    });
    prev?.items.forEach((it) => { if (!keep.has(it.id)) remove('routine_items', it.id); });
  });
  return id;
}
export function deleteRoutine(id: string) {
  db.withTransactionSync(() => {
    getRoutine(id)?.items.forEach((it) => remove('routine_items', it.id));
    remove('routines', id);
  });
}

/* ---------- entrenamientos ---------- */
export function activeWorkout(): Workout | null {
  return db.getFirstSync<Workout>('SELECT * FROM workouts WHERE deleted=0 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1') ?? null;
}
export function startWorkout(routine: Routine | null): string {
  const id = uuid();
  db.withTransactionSync(() => {
    save('workouts', { id, routine_id: routine?.id ?? null, name: routine?.name ?? 'Entrenamiento libre', started_at: now(), ended_at: null });
    routine?.items.forEach((it, order) => {
      for (let n = 1; n <= it.sets; n++) newSet(id, it.exercise_id, order, n);
    });
  });
  return id;
}
function newSet(workoutId: string, exId: string, order: number, n: number, weight: number | null = null, reps: number | null = null) {
  save('workout_sets', { id: uuid(), workout_id: workoutId, exercise_id: exId, exercise_order: order, set_number: n, weight, reps, done: 0, is_pr: 0 });
}
export function workoutEntries(w: Workout): Entry[] {
  const sets = db.getAllSync<WSet>(
    'SELECT * FROM workout_sets WHERE workout_id=? AND deleted=0 ORDER BY exercise_order, set_number', [w.id]);
  const items = w.routine_id ? getRoutine(w.routine_id)?.items ?? [] : [];
  const map = new Map<number, Entry>();
  for (const s of sets) {
    let e = map.get(s.exercise_order);
    if (!e) {
      const it = items.find((x) => x.exercise_id === s.exercise_id);
      e = { exercise_id: s.exercise_id, name: exerciseName(s.exercise_id), order: s.exercise_order, target: it ? `${it.sets}×${it.reps}` : '', rest: it?.rest_sec ?? 90, sets: [] };
      map.set(s.exercise_order, e);
    }
    e.sets.push(s);
  }
  return [...map.values()];
}
export function updateSet(id: string, patch: Partial<WSet>) {
  const cur = db.getFirstSync<WSet>('SELECT * FROM workout_sets WHERE id=?', [id]);
  if (cur) save('workout_sets', { ...cur, ...patch });
}
export function addSet(workoutId: string, e: Entry) {
  const last = e.sets[e.sets.length - 1];
  newSet(workoutId, e.exercise_id, e.order, (last?.set_number ?? 0) + 1, last?.weight ?? null, last?.reps ?? null);
}
export function removeLastSet(e: Entry) {
  const last = e.sets[e.sets.length - 1];
  if (last && e.sets.length > 1) remove('workout_sets', last.id);
}
export function removeEntry(e: Entry) {
  db.withTransactionSync(() => e.sets.forEach((s) => remove('workout_sets', s.id)));
}
export function addExerciseToWorkout(workoutId: string, exId: string) {
  const m = db.getFirstSync<{ m: number }>('SELECT COALESCE(MAX(exercise_order),-1)+1 AS m FROM workout_sets WHERE workout_id=?', [workoutId])?.m ?? 0;
  const prev = lastSets(exId, workoutId);
  db.withTransactionSync(() => {
    for (let n = 1; n <= Math.max(3, prev.length); n++) newSet(workoutId, exId, m, n);
  });
}
// Devuelve true si se guardó, false si se descartó por no tener series completadas.
export function finishWorkout(id: string): boolean {
  const done = db.getFirstSync<{ c: number }>('SELECT COUNT(*) AS c FROM workout_sets WHERE workout_id=? AND deleted=0 AND done=1', [id])?.c ?? 0;
  if (!done) { discardWorkout(id); return false; }
  db.withTransactionSync(() => {
    db.getAllSync<{ id: string }>('SELECT id FROM workout_sets WHERE workout_id=? AND deleted=0 AND done=0', [id]).forEach((s) => remove('workout_sets', s.id));
    const w = db.getFirstSync<Workout>('SELECT * FROM workouts WHERE id=?', [id]);
    if (w) save('workouts', { ...w, ended_at: now() });
  });
  return true;
}
export function discardWorkout(id: string) {
  db.withTransactionSync(() => {
    db.getAllSync<{ id: string }>('SELECT id FROM workout_sets WHERE workout_id=? AND deleted=0', [id]).forEach((s) => remove('workout_sets', s.id));
    remove('workouts', id);
  });
}
export const deleteWorkout = discardWorkout;

/* ---------- historial y PR ---------- */
const DONE_SETS = `SELECT s.*, w.started_at FROM workout_sets s JOIN workouts w ON w.id=s.workout_id
  WHERE s.done=1 AND s.deleted=0 AND w.deleted=0 AND w.ended_at IS NOT NULL`;

// Series completadas la última vez que hiciste el ejercicio (para la columna "Anterior").
export function lastSets(exId: string, excludeWorkoutId: string): WSet[] {
  const w = db.getFirstSync<{ workout_id: string }>(
    `${DONE_SETS} AND s.exercise_id=? AND w.id<>? ORDER BY w.started_at DESC LIMIT 1`, [exId, excludeWorkoutId]);
  if (!w) return [];
  return db.getAllSync<WSet>(
    'SELECT * FROM workout_sets WHERE workout_id=? AND exercise_id=? AND done=1 AND deleted=0 ORDER BY exercise_order, set_number', [w.workout_id, exId]);
}
export function bestE1rmBefore(exId: string, excludeWorkoutId: string): number {
  const rows = db.getAllSync<WSet>(`${DONE_SETS} AND s.exercise_id=? AND w.id<>?`, [exId, excludeWorkoutId]);
  return rows.reduce((m, s) => Math.max(m, e1rm(s.weight, s.reps)), 0);
}

export type HistoryRow = Workout & { sets: number; volume: number; prs: number };
export function history(): HistoryRow[] {
  return db.getAllSync<HistoryRow>(
    `SELECT w.*, COUNT(s.id) AS sets, COALESCE(SUM(COALESCE(s.weight,0)*COALESCE(s.reps,0)),0) AS volume, COALESCE(SUM(s.is_pr),0) AS prs
     FROM workouts w LEFT JOIN workout_sets s ON s.workout_id=w.id AND s.deleted=0 AND s.done=1
     WHERE w.deleted=0 AND w.ended_at IS NOT NULL GROUP BY w.id ORDER BY w.started_at DESC`);
}
export function weekCount(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return db.getFirstSync<{ c: number }>('SELECT COUNT(*) AS c FROM workouts WHERE deleted=0 AND ended_at IS NOT NULL AND started_at>=?', [d.getTime()])?.c ?? 0;
}
export function exercisesWithHistory(): Exercise[] {
  return db.getAllSync<Exercise>(
    `SELECT DISTINCT e.id, e.name, e.muscle_group FROM exercises e JOIN (${DONE_SETS}) d ON d.exercise_id=e.id ORDER BY e.name COLLATE NOCASE`);
}
export type ExSession = { date: number; best: WSet; e1: number; volume: number; maxW: number; maxR: number };
export function exerciseHistory(exId: string): ExSession[] {
  const rows = db.getAllSync<WSet & { started_at: number }>(`${DONE_SETS} AND s.exercise_id=? ORDER BY w.started_at`, [exId]);
  const by = new Map<string, (WSet & { started_at: number })[]>();
  rows.forEach((r) => { if (!by.has(r.workout_id)) by.set(r.workout_id, []); by.get(r.workout_id)!.push(r); });
  return [...by.values()].map((sets) => {
    const best = sets.reduce((a, s) => (e1rm(s.weight, s.reps) > e1rm(a.weight, a.reps) ? s : a), sets[0]);
    return {
      date: sets[0].started_at, best, e1: e1rm(best.weight, best.reps),
      volume: sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0),
      maxW: Math.max(...sets.map((s) => s.weight ?? 0)), maxR: Math.max(...sets.map((s) => s.reps ?? 0)),
    };
  });
}
export function workoutDetail(id: string) {
  return db.getAllSync<WSet & { name: string }>(
    `SELECT s.*, COALESCE(e.name,'Ejercicio eliminado') AS name FROM workout_sets s LEFT JOIN exercises e ON e.id=s.exercise_id
     WHERE s.workout_id=? AND s.deleted=0 AND s.done=1 ORDER BY s.exercise_order, s.set_number`, [id]);
}
