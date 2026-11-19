import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../AppContext';
import * as repo from '../repo';
import { Card, Chip, H1, H2, T, fdate, fmtInt, r1, useTheme } from '../ui';

export default function Progreso() {
  const { version } = useApp();
  const t = useTheme();
  const used = useMemo(() => repo.exercisesWithHistory(), [version]);
  const [sel, setSel] = useState<string | null>(null);
  const exId = used.find((x) => x.id === sel)?.id ?? used[0]?.id;
  const H = useMemo(() => (exId ? repo.exerciseHistory(exId) : []), [exId, version]);
  const unit = repo.getUnit();

  if (!used.length || !H.length) return (
    <View><H1>Progreso</H1><Card><T bold size={18}>Todavía no hay datos</T><T mute style={{ marginTop: 6 }}>Termina tu primer entrenamiento y aquí verás tus PR, tu 1RM estimado y la gráfica de cada ejercicio.</T></Card></View>
  );

  const maxW = H.reduce((a, x) => (x.maxW > a.maxW ? x : a), H[0]);
  const best = H.reduce((a, x) => (x.e1 > a.e1 ? x : a), H[0]);
  const maxR = Math.max(...H.map((x) => x.maxR));
  const maxV = Math.max(...H.map((x) => x.volume));
  const last = H.slice(-12);
  const hi = Math.max(...last.map((x) => x.e1)), lo = Math.min(...last.map((x) => x.e1)) * 0.9;

  const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <View style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: t.panel, borderRadius: 14, padding: 12 }}>
      <T mute size={13}>{label}</T>
      <Text style={{ fontSize: 30, fontWeight: '800', color: t.ink }}>{value}</Text>
      {sub ? <T mute size={13}>{sub}</T> : null}
    </View>
  );

  return (
    <View>
      <H1>Progreso</H1>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {used.map((x) => <Chip key={x.id} label={x.name} on={x.id === exId} onPress={() => setSel(x.id)} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat label="PR de peso" value={`${r1(maxW.maxW)} ${unit}`} sub={fdate(maxW.date)} />
        <Stat label="1RM estimado" value={`${r1(best.e1)} ${unit}`} sub={`${best.best.weight ?? 0}×${best.best.reps} · ${fdate(best.date)}`} />
        <Stat label="Más reps en una serie" value={String(maxR)} />
        <Stat label="Mejor volumen en un día" value={`${fmtInt(maxV)} ${unit}`} />
      </View>

      <H2>1RM estimado (últimas {last.length} sesiones)</H2>
      <Card>
        <View style={{ height: 160, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          {last.map((x, i) => {
            const h = hi === lo ? 1 : (x.e1 - lo) / (hi - lo);
            const top = x === best;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: t.mute }} numberOfLines={1}>{Math.round(x.e1)}</Text>
                <View style={{ width: '80%', height: 20 + h * 110, borderRadius: 6, backgroundColor: top ? t.red : t.blue, opacity: top ? 1 : 0.75 }} />
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <T mute size={12}>{fdate(last[0].date)}</T><T mute size={12}>{fdate(last[last.length - 1].date)}</T>
        </View>
      </Card>
      <T mute size={13}>1RM estimado con la fórmula de Epley: peso × (1 + reps/30). En rojo, tu mejor sesión.</T>

      <H2>Historial del ejercicio</H2>
      {H.slice().reverse().map((x, i) => (
        <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: t.line }}>
          <T style={{ flex: 1.3 }}>{fdate(x.date)}</T>
          <T style={{ flex: 1 }}>{x.best.weight ?? 0}×{x.best.reps}</T>
          <T style={{ flex: 1, textAlign: 'right' }}>{r1(x.e1)}</T>
          <T mute style={{ flex: 1.2, textAlign: 'right' }}>{fmtInt(x.volume)}</T>
        </View>
      ))}
      <T mute size={12} style={{ marginTop: 4 }}>Fecha · mejor serie · 1RM est. · volumen</T>
    </View>
  );
}
