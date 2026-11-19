import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../AppContext';
import { useTheme } from '../ui';

// Barra flotante del descanso. Se muestra cuando hay un cronómetro activo.
export default function RestTimer() {
  const { timer, addTimer, stopTimer } = useApp();
  const t = useTheme();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [timer]);
  if (!timer) return null;
  const left = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
  const ended = left === 0;
  const frac = Math.min(1, left / timer.total);
  const bg = ended ? t.red : t.ink;
  const fg = ended ? '#fff' : t.bg;
  const B = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ minHeight: 42, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#ffffff22', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: 8, backgroundColor: bg, borderRadius: 18, padding: 10, elevation: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: fg, fontSize: 32, fontWeight: '800', minWidth: 86, fontVariant: ['tabular-nums'] }}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </Text>
        <Text style={{ color: fg, opacity: 0.8, flex: 1 }}>{ended ? '¡A darle!' : 'Descanso'}</Text>
        <B label="−15" onPress={() => addTimer(-15)} />
        <B label="+15" onPress={() => addTimer(15)} />
        <B label="Saltar" onPress={stopTimer} />
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: '#ffffff33', marginTop: 8, overflow: 'hidden' }}>
        <View style={{ height: 4, width: `${frac * 100}%`, backgroundColor: fg }} />
      </View>
    </View>
  );
}
