import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp } from '../AppContext';
import * as repo from '../repo';
import { Btn, Card, H1, T, confirm, fdate, fmtInt, useTheme } from '../ui';

export default function Historial() {
  const { version, bump } = useApp();
  const t = useTheme();
  const rows = useMemo(() => repo.history(), [version]);
  const [open, setOpen] = useState<string | null>(null);
  const unit = repo.getUnit();
  const now = new Date();
  const month = rows.filter((r) => { const d = new Date(r.started_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;

  if (!rows.length) return <View><H1>Historial</H1><Card><T mute>Aquí aparecerán tus entrenamientos terminados.</T></Card></View>;

  return (
    <View>
      <H1>Historial</H1>
      <T mute style={{ marginBottom: 6 }}>{rows.length} entrenamientos · {month} este mes</T>
      {rows.map((w) => {
        const isOpen = open === w.id;
        const detail = isOpen ? repo.workoutDetail(w.id) : [];
        const groups: { name: string; sets: typeof detail }[] = [];
        detail.forEach((s) => { const g = groups[groups.length - 1]; if (g && g.name === s.name) g.sets.push(s); else groups.push({ name: s.name, sets: [s] }); });
        const mins = Math.max(1, Math.round(((w.ended_at ?? w.started_at) - w.started_at) / 60000));
        return (
          <Card key={w.id}>
            <Pressable onPress={() => setOpen(isOpen ? null : w.id)}>
              <T bold size={19}>{w.name}</T>
              <T mute size={14}>
                {fdate(w.started_at)} · {mins} min · {w.sets} series · {fmtInt(w.volume)} {unit}{w.prs ? ` · ${w.prs} PR` : ''}
              </T>
            </Pressable>
            {isOpen && (
              <View style={{ marginTop: 8 }}>
                {groups.map((g, i) => (
                  <View key={i} style={{ marginTop: 6 }}>
                    <T bold>{g.name}</T>
                    <T mute size={14}>{g.sets.map((s) => `${s.weight ?? 0}${unit}×${s.reps}${s.is_pr ? ' (PR)' : ''}`).join(' · ')}</T>
                  </View>
                ))}
                <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
                  <Btn small kind="danger" title="Eliminar" onPress={async () => { if (await confirm('¿Eliminar este entrenamiento del historial?')) { repo.deleteWorkout(w.id); bump(); } }} />
                </View>
              </View>
            )}
          </Card>
        );
      })}
      <View style={{ height: 1, backgroundColor: t.line, marginTop: 8 }} />
    </View>
  );
}
