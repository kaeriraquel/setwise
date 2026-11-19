import React from 'react';
import { Pressable, Text, TextInput, View, StyleSheet, useColorScheme, TextInputProps, ViewStyle, Alert } from 'react-native';

const light = { bg: '#ffffff', panel: '#f1f2f4', line: '#dfe1e5', ink: '#111418', mute: '#5c636e', red: '#d3242c', blue: '#1d4ed8', ok: '#0f7a3d', rubber: '#22262c', onAccent: '#ffffff' };
const dark = { bg: '#121417', panel: '#1c1f24', line: '#2c3037', ink: '#f2f3f5', mute: '#9aa1ac', red: '#ff4f55', blue: '#7aa2ff', ok: '#3fd27e', rubber: '#2b3038', onAccent: '#ffffff' };
export type Theme = typeof light;
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const fdate = (t: number) => new Date(t).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
export const r1 = (n: number) => Math.round(n * 10) / 10;
export const fmtInt = (n: number) => Math.round(n).toLocaleString('es-MX');

export function H1({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 32, fontWeight: '800', color: t.ink, marginBottom: 6 }}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontSize: 21, fontWeight: '800', color: t.ink, marginTop: 24, marginBottom: 8 }}>{children}</Text>;
}
export function T({ children, mute, size = 16, bold, style }: { children: React.ReactNode; mute?: boolean; size?: number; bold?: boolean; style?: any }) {
  const t = useTheme();
  return <Text style={[{ color: mute ? t.mute : t.ink, fontSize: size, fontWeight: bold ? '700' : '400' }, style]}>{children}</Text>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.panel, borderRadius: 16, padding: 16, marginVertical: 6 }, style]}>{children}</View>;
}
export function Btn({ title, onPress, kind = 'plain', small, full, disabled }: { title: string; onPress: () => void; kind?: 'pri' | 'blue' | 'plain' | 'ghost' | 'danger'; small?: boolean; full?: boolean; disabled?: boolean }) {
  const t = useTheme();
  const bg = kind === 'pri' ? t.red : kind === 'blue' ? t.blue : kind === 'plain' ? t.bg : 'transparent';
  const fg = kind === 'pri' || kind === 'blue' ? t.onAccent : kind === 'danger' ? t.red : t.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: small ? 38 : 46, paddingHorizontal: small ? 12 : 18, borderRadius: 12, backgroundColor: bg,
        borderWidth: kind === 'ghost' || kind === 'danger' || kind === 'plain' ? 1 : 0, borderColor: t.line,
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1, alignSelf: full ? 'stretch' : 'auto',
      })}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}
export function Input(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ flexGrow: 1 }}>
      {label ? <Text style={{ color: t.mute, fontSize: 13, marginBottom: 4, marginTop: 8 }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.mute}
        {...rest}
        style={[{ minHeight: 46, borderWidth: 1, borderColor: t.line, borderRadius: 10, paddingHorizontal: 10, fontSize: 16, color: t.ink, backgroundColor: t.bg }, style]}
      />
    </View>
  );
}
export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ minHeight: 36, minWidth: 44, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: on ? t.bg : t.ink, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
// Lista de opciones simple (sin dependencias extra), se usa como selector.
export function Picker({ options, value, onChange }: { options: { id: string; label: string }[]; value?: string; onChange: (id: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, maxHeight: 260, overflow: 'hidden' }}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={{ padding: 12, backgroundColor: o.id === value ? t.panel : t.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
          <Text style={{ color: t.ink, fontWeight: o.id === value ? '700' : '400' }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export const Row = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, style]}>{children}</View>
);
export function confirm(msg: string, okLabel = 'Eliminar'): Promise<boolean> {
  return new Promise((res) =>
    Alert.alert(msg, undefined, [
      { text: 'Cancelar', style: 'cancel', onPress: () => res(false) },
      { text: okLabel, style: 'destructive', onPress: () => res(true) },
    ], { cancelable: true, onDismiss: () => res(false) }));
}
