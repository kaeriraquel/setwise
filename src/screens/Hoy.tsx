import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useApp } from '../AppContext';
import * as repo from '../repo';
import { Btn, Card, Chip, DAYS, DAYS_LONG, H1, H2, Row, T, confirm } from '../ui';
import WeekPlate from '../components/WeekPlate';
import Workout from './Workout';

export default function Hoy({ onEditRoutine, onNewRoutine }: { onEditRoutine: (id: string) => void; onNewRoutine: () => void }) {
  const { version, bump, startTimer } = useApp();
  const active = useMemo(() => repo.activeWorkout(), [version]);
  const routines = useMemo(() => repo.listRoutines(), [version]);
  const exCount = useMemo(() => repo.listExercises().length, [version]);
  const week = useMemo(() => repo.weekCount(), [version]);

  if (active) return <Workout workout={active} />;

  const d = new Date().getDay();
  const today = routines.filter((r) => r.days.includes(d));
  const others = routines.filter((r) => !r.days.includes(d));
  const goal = new Set(routines.flatMap((r) => r.days)).size || 3;

  const start = (r: repo.Routine | null) => { repo.startWorkout(r); bump(); };

  const RoutineCard = ({ r, main }: { r: repo.Routine; main?: boolean }) => (
    <Card>
      <T size={20} bold>{r.name}</T>
      <Row style={{ marginVertical: 6 }}>{[...r.days].sort().map((x) => <Chip key={x} label={DAYS[x]} />)}</Row>
      <T mute size={14}>{r.items.map((i) => `${i.exercise_name} ${i.sets}×${i.reps}`).join(' · ') || 'Sin ejercicios'}</T>
      <Row style={{ marginTop: 12 }}>
        <Btn title="Empezar" kind={main ? 'pri' : 'blue'} onPress={() => start(r)} />
        <Btn title="Editar" kind="ghost" onPress={() => onEditRoutine(r.id)} />
      </Row>
    </Card>
  );

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <T mute>Hoy es {DAYS_LONG[d]}</T>
          <H1>{today.length ? today.map((r) => r.name).join(' + ') : 'Día libre'}</H1>
          <T mute size={14}>{week} de {goal} entrenamientos esta semana</T>
        </View>
        <WeekPlate done={week} goal={goal} />
      </View>

      {!exCount && (
        <Card>
          <T size={18} bold>Empieza armando tu lista de ejercicios</T>
          <T mute style={{ marginVertical: 8 }}>Carga 17 ejercicios básicos o crea los tuyos en Rutinas.</T>
          <Btn title="Agregar ejercicios básicos" kind="pri" onPress={() => { repo.seedStarter(); bump(); }} />
        </Card>
      )}
      {today.map((r) => <RoutineCard key={r.id} r={r} main />)}
      {!routines.length && exCount > 0 && (
        <Card>
          <T size={18} bold>Aún no tienes rutinas</T>
          <T mute style={{ marginVertical: 8 }}>Crea una y asígnale los días de la semana.</T>
          <Btn title="Crear rutina" kind="pri" onPress={onNewRoutine} />
        </Card>
      )}
      {others.length > 0 && <H2>Otras rutinas</H2>}
      {others.map((r) => <RoutineCard key={r.id} r={r} />)}
      <View style={{ marginTop: 12 }}>
        <Btn title="Entrenamiento libre" kind="ghost" full onPress={async () => { if (!exCount && !(await confirm('No tienes ejercicios todavía. ¿Empezar de todos modos?', 'Empezar'))) return; start(null); }} />
      </View>
      <H2>Cronómetro de descanso</H2>
      <Row>{[60, 90, 120, 180, 240].map((s) => <Btn key={s} title={s < 120 ? `${s} s` : `${s / 60} min`} onPress={() => startTimer(s)} />)}</Row>
    </View>
  );
}
