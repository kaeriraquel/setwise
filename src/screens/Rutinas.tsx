import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../AppContext';
import * as repo from '../repo';
import { Btn, Card, Chip, DAYS, H1, H2, Input, Picker, Row, T, confirm, useTheme } from '../ui';

export default function Rutinas({ onEdit }: { onEdit: (id: string | null) => void }) {
  const { version, bump } = useApp();
  const t = useTheme();
  const routines = useMemo(() => repo.listRoutines(), [version]);
  const exercises = useMemo(() => repo.listExercises(), [version]);
  const [name, setName] = useState('');
  const [group, setGroup] = useState(repo.GROUPS[0]);

  return (
    <View>
      <H1>Rutinas</H1>
      <T mute>Asigna cada rutina a sus días y aparecerá en Hoy.</T>
      {routines.map((r) => (
        <Card key={r.id}>
          <T size={20} bold>{r.name}</T>
          <Row style={{ marginVertical: 6 }}>{[...r.days].sort().map((x) => <Chip key={x} label={DAYS[x]} />)}</Row>
          <T mute size={14}>{r.items.map((i) => `${i.exercise_name} ${i.sets}×${i.reps}`).join(' · ') || 'Sin ejercicios'}</T>
          <View style={{ marginTop: 10, alignItems: 'flex-start' }}><Btn small kind="ghost" title="Editar" onPress={() => onEdit(r.id)} /></View>
        </Card>
      ))}
      <View style={{ marginTop: 8 }}><Btn title="+ Nueva rutina" kind="pri" full onPress={() => onEdit(null)} /></View>

      <H2>Ejercicios</H2>
      <Card>
        <Input label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Press francés" />
        <Text style={{ color: t.mute, fontSize: 13, marginTop: 10, marginBottom: 6 }}>Grupo muscular</Text>
        <Row>{repo.GROUPS.map((g) => <Chip key={g} label={g} on={g === group} onPress={() => setGroup(g)} />)}</Row>
        <View style={{ marginTop: 12 }}>
          <Btn title="Agregar ejercicio" kind="blue" disabled={!name.trim()} onPress={() => { repo.addExercise(name, group); setName(''); bump(); }} />
        </View>
      </Card>
      {!exercises.length && (
        <Card><T mute style={{ marginBottom: 8 }}>Sin ejercicios todavía.</T><Btn title="Agregar ejercicios básicos" onPress={() => { repo.seedStarter(); bump(); }} /></Card>
      )}
      {repo.GROUPS.map((g) => {
        const xs = exercises.filter((x) => x.muscle_group === g);
        if (!xs.length) return null;
        return (
          <View key={g}>
            <T bold size={17} style={{ marginTop: 14 }}>{g}</T>
            {xs.map((x) => (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: t.line }}>
                <T style={{ flex: 1 }}>{x.name}</T>
                <Pressable hitSlop={10} onPress={async () => { if (await confirm(`¿Eliminar "${x.name}"? Tu historial se conserva.`)) { repo.deleteExercise(x.id); bump(); } }}>
                  <Text style={{ fontSize: 22, color: t.mute, paddingHorizontal: 8 }}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

type Item = { id?: string; exercise_id: string; sets: string; reps: string; rest_sec: string };

export function EditRoutine({ id, onDone }: { id: string | null; onDone: () => void }) {
  const { bump } = useApp();
  const t = useTheme();
  const exercises = useMemo(() => repo.listExercises(), []);
  const orig = useMemo(() => (id ? repo.getRoutine(id) : undefined), [id]);
  const [name, setName] = useState(orig?.name ?? '');
  const [days, setDays] = useState<number[]>(orig?.days ?? []);
  const [items, setItems] = useState<Item[]>(
    orig?.items.map((i) => ({ id: i.id, exercise_id: i.exercise_id, sets: String(i.sets), reps: i.reps, rest_sec: String(i.rest_sec) })) ?? []);
  const [picking, setPicking] = useState<number | 'new' | null>(null);
  const exName = (eid: string) => exercises.find((x) => x.id === eid)?.name ?? 'Ejercicio eliminado';
  const setItem = (i: number, p: Partial<Item>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => setItems((xs) => { const ys = [...xs]; const j = i + d; if (j < 0 || j >= ys.length) return xs; [ys[i], ys[j]] = [ys[j], ys[i]]; return ys; });

  const saveIt = () => {
    if (!name.trim()) return;
    repo.saveRoutine({
      id: id ?? undefined, name, days,
      items: items.map((x) => ({ id: x.id, exercise_id: x.exercise_id, sets: Math.max(1, parseInt(x.sets) || 3), reps: x.reps.trim() || '10', rest_sec: Math.max(0, parseInt(x.rest_sec) || 90) })),
    });
    bump(); onDone();
  };

  return (
    <View>
      <H1>{id ? 'Editar rutina' : 'Nueva rutina'}</H1>
      <Input label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Pierna y glúteo" />
      <Text style={{ color: t.mute, fontSize: 13, marginTop: 12, marginBottom: 6 }}>Días</Text>
      <Row>{[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <Chip key={d} label={DAYS[d]} on={days.includes(d)} onPress={() => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))} />
      ))}</Row>

      <H2>Ejercicios</H2>
      {items.map((it, i) => (
        <Card key={it.id ?? 'n' + i}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable style={{ flex: 1 }} onPress={() => setPicking(i)}><T bold size={17}>{exName(it.exercise_id)} ›</T></Pressable>
            <Btn small kind="ghost" title="↑" onPress={() => move(i, -1)} />
            <Btn small kind="ghost" title="↓" onPress={() => move(i, 1)} />
            <Btn small kind="danger" title="×" onPress={() => setItems((xs) => xs.filter((_, k) => k !== i))} />
          </View>
          {picking === i && <View style={{ marginTop: 8 }}><Picker options={exercises.map((x) => ({ id: x.id, label: x.name }))} value={it.exercise_id} onChange={(eid) => { setItem(i, { exercise_id: eid }); setPicking(null); }} /></View>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input label="Series" keyboardType="number-pad" value={it.sets} onChangeText={(v) => setItem(i, { sets: v })} />
            <Input label="Reps" value={it.reps} onChangeText={(v) => setItem(i, { reps: v })} placeholder="8-12" />
            <Input label="Descanso (s)" keyboardType="number-pad" value={it.rest_sec} onChangeText={(v) => setItem(i, { rest_sec: v })} />
          </View>
        </Card>
      ))}
      {picking === 'new' ? (
        <Card>
          <T bold style={{ marginBottom: 8 }}>Elige un ejercicio</T>
          <Picker options={exercises.map((x) => ({ id: x.id, label: x.name }))} onChange={(eid) => { setItems((xs) => [...xs, { exercise_id: eid, sets: '3', reps: '10', rest_sec: '90' }]); setPicking(null); }} />
          <View style={{ marginTop: 8 }}><Btn title="Cancelar" kind="ghost" onPress={() => setPicking(null)} /></View>
        </Card>
      ) : exercises.length ? (
        <Btn title="+ Agregar ejercicio" onPress={() => setPicking('new')} />
      ) : (
        <T mute>Primero crea ejercicios en la pestaña Rutinas.</T>
      )}

      <Row style={{ marginTop: 24 }}>
        <Btn title="Guardar" kind="pri" disabled={!name.trim()} onPress={saveIt} />
        <Btn title="Cancelar" kind="ghost" onPress={onDone} />
        {id && <Btn title="Eliminar rutina" kind="danger" onPress={async () => { if (await confirm(`¿Eliminar la rutina "${orig?.name}"?`)) { repo.deleteRoutine(id); bump(); onDone(); } }} />}
      </Row>
    </View>
  );
}
