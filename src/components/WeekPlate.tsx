import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../ui';

// Disco olímpico que se "llena" por segmentos con los entrenamientos de la semana (sin librerías de gráficos).
export default function WeekPlate({ done, goal }: { done: number; goal: number }) {
  const t = useTheme();
  const size = 120;
  const segs = Math.max(goal, 1);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.rubber, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: segs }).map((_, i) => {
        const angle = (360 / segs) * i;
        return (
          <View key={i} style={{ position: 'absolute', width: size, height: size, alignItems: 'center', transform: [{ rotate: `${angle}deg` }] }}>
            <View style={{ marginTop: 6, width: Math.min(26, (Math.PI * (size - 20)) / segs - 6), height: 10, borderRadius: 5, backgroundColor: i < done ? t.red : '#ffffff22' }} />
          </View>
        );
      })}
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{done}/{goal}</Text>
      <Text style={{ color: '#ffffffaa', fontSize: 11 }}>esta semana</Text>
    </View>
  );
}
