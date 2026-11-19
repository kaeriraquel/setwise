import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, ToastAndroid, View } from 'react-native';
import { useApp } from '../AppContext';
import * as repo from '../repo';
import { Btn, Card, Picker, Row, T, confirm, useTheme } from '../ui';

const toast = (m: string) => ToastAndroid.show(m, ToastAndroid.SHORT);
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return isNaN(n) ? null : n; };

export default function Workout({ workout }: { workout: repo.Workout }) {
  const { version, bump, startTimer, stopTimer, requestSync } = useApp();
  const t = useTheme();
  const entries = useMemo(() => repo.workoutEntries(workout), [workout.id, version]);
  const unit = repo.getUnit();
  const [adding, setAdding] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  const secs = Math.floor((Date.now() - workout.started_at) / 1000);
  const elapsed = `${secs >= 3600 ? Math.floor(secs / 3600) + ':' : ''}${String(Math.floor(secs / 60) % 60).padStart(secs >= 3600 ? 2 : 1, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const finish = async () => {
    if (!(await confirm('¿Terminar el entrenamiento?', 'Terminar'))) return;
    const saved = repo.finishWorkout(workout.id);
    stopTimer(); bump(); requestSync();
    toast(saved ? '¡Entrenamiento guardado!' : 'No había series completadas: se descartó');
  };
  const discard = async () => {
    if (!(await confirm('¿Descartar este entrenamiento? No se guardará.', 'Descartar'))) return;
    repo.discardWorkout(workout.id); stopTimer(); bump();
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <T mute>{workout.name}</T>
          <Text style={{ fontSize: 40, fontWeight: '800', color: t.ink, fontVariant: ['tabular-nums'] }}>{elapsed}</Text>
        </View>
        <Btn title="Terminar" kind="pri" onPress={finish} />
      </View>

      {entries.map((e) => (
        <ExerciseCard key={e.order} entry={e} workoutId={workout.id} unit={unit}
          onChanged={bump} onRest={() => startTimer(e.rest)} />
      ))}

      <Card>
        {adding ? (
          <>
            <T bold style={{ marginBottom: 8 }}>Elige un ejercicio</T>
            <Picker options={repo.listExercises().map((x) => ({ id: x.id, label: x.name }))}
              onChange={(id) => { repo.addExerciseToWorkout(workout.id, id); setAdding(false); bump(); }} />
            <View style={{ marginTop: 8 }}><Btn title="Cancelar" kind="ghost" onPress={() => setAdding(false)} /></View>
          </>
        ) : (
          <Btn title="+ Agregar ejercicio" kind="blue" full onPress={() => setAdding(true)} />
        )}
      </Card>
      <View style={{ marginTop: 8 }}><Btn title="Descartar entrenamiento" kind="danger" full onPress={discard} /></View>
    </View>
  );
}

function ExerciseCard({ entry, workoutId, unit, onChanged, onRest }: { entry: repo.Entry; workoutId: string; unit: string; onChanged: () => void; onRest: () => void }) {
  const t = useTheme();
  const prev = useMemo(() => repo.lastSets(entry.exercise_id, workoutId), [entry.exercise_id, workoutId]);
  const H = ({ children, w, flex }: { children: string; w?: number; flex?: number }) => (
    <Text style={{ width: w, flex, color: t.mute, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{children}</Text>
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: t.ink }}>{entry.name}</Text>
        <Text style={{ color: t.mute, fontSize: 13, marginTop: 4 }}>{entry.target ? entry.target + ' · ' : ''}{entry.rest}s</Text>
        <Pressable hitSlop={10} onPress={async () => { if (await confirm(`¿Quitar ${entry.name} de este entrenamiento?`, 'Quitar')) { repo.removeEntry(entry); onChanged(); } }}>
          <Text style={{ fontSize: 22, color: t.mute, paddingHorizontal: 6 }}>×</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
        <H w={34}>Serie</H><H flex={1}>Anterior</H><H w={72}>{unit}</H><H w={62}>Reps</H><H w={48}>{''}</H>
      </View>
      {entry.sets.map((s, j) => (
        <SetRow key={s.id} set={s} index={j} prev={prev[j]} entry={entry} workoutId={workoutId} unit={unit} onChanged={onChanged} onRest={onRest} />
      ))}
      <Row style={{ marginTop: 10 }}>
        <Btn small title="+ Serie" onPress={() => { repo.addSet(workoutId, entry); onChanged(); }} />
        {entry.sets.length > 1 && <Btn small kind="ghost" title="− Serie" onPress={() => { repo.removeLastSet(entry); onChanged(); }} />}
      </Row>
    </Card>
  );
}

function SetRow({ set, index, prev, entry, workoutId, unit, onChanged, onRest }: { set: repo.WSet; index: number; prev?: repo.WSet; entry: repo.Entry; workoutId: string; unit: string; onChanged: () => void; onRest: () => void }) {
  const t = useTheme();
  const [w, setW] = useState(set.weight == null ? '' : String(set.weight));
  const [r, setR] = useState(set.reps == null ? '' : String(set.reps));
  const done = !!set.done;

  const toggle = () => {
    if (done) { repo.updateSet(set.id, { done: 0, is_pr: 0 }); onChanged(); return; }
    // Si dejaste vacío, usa lo de la vez pasada (lo que se ve en gris).
    const weight = num(w) ?? prev?.weight ?? null;
    const reps = num(r) ?? prev?.reps ?? null;
    if (!reps || reps <= 0) { toast('Escribe las repeticiones'); return; }
    const mine = repo.e1rm(weight, reps);
    const before = repo.bestE1rmBefore(entry.exercise_id, workoutId);
    const today = Math.max(0, ...entry.sets.filter((x) => x.id !== set.id && x.done).map((x) => repo.e1rm(x.weight, x.reps)));
    const isPr = before > 0 && mine > before && mine > today;
    repo.updateSet(set.id, { weight, reps: Math.round(reps), done: 1, is_pr: isPr ? 1 : 0 });
    setW(weight == null ? '' : String(weight)); setR(String(Math.round(reps)));
    if (isPr) ToastAndroid.show(`¡Nuevo PR en ${entry.name}! ${weight ?? 0} ${unit} × ${reps}`, ToastAndroid.LONG);
    onRest(); onChanged();
  };

  const inputStyle = { height: 44, borderWidth: done ? 0 : 1, borderColor: t.line, borderRadius: 10, textAlign: 'center' as const, fontSize: 16, color: t.ink, backgroundColor: done ? 'transparent' : t.bg, fontWeight: done ? ('700' as const) : ('400' as const) };
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}>
      <View style={{ width: 34, alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: t.ink }}>{index + 1}</Text>
        {!!set.is_pr && <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: t.red, borderRadius: 4, paddingHorizontal: 3 }}>PR</Text>}
      </View>
      <Text numberOfLines={1} style={{ flex: 1, color: t.mute, textAlign: 'center' }}>{prev ? `${prev.weight ?? 0}×${prev.reps}` : '—'}</Text>
      <TextInput style={[inputStyle, { width: 72 }]} keyboardType="decimal-pad" value={w} editable={!done}
        placeholder={prev?.weight != null ? String(prev.weight) : ''} placeholderTextColor={t.mute}
        onChangeText={(v) => { setW(v); repo.updateSet(set.id, { weight: num(v) }); }} />
      <TextInput style={[inputStyle, { width: 62 }]} keyboardType="number-pad" value={r} editable={!done}
        placeholder={prev?.reps != null ? String(prev.reps) : ''} placeholderTextColor={t.mute}
        onChangeText={(v) => { setR(v); const n = num(v); repo.updateSet(set.id, { reps: n == null ? null : Math.round(n) }); }} />
      <Pressable onPress={toggle} accessibilityLabel={`Completar serie ${index + 1}`}
        style={{ width: 48, height: 44, borderRadius: 10, borderWidth: 2, borderColor: done ? t.ok : t.line, backgroundColor: done ? t.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: done ? '#fff' : t.mute }}>✓</Text>
      </Pressable>
    </View>
  );
}
