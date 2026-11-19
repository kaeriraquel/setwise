import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { initDb } from './src/db';
import { AppProvider, useApp } from './src/AppContext';
import { useTheme } from './src/ui';
import RestTimer from './src/components/RestTimer';
import Hoy from './src/screens/Hoy';
import Rutinas, { EditRoutine } from './src/screens/Rutinas';
import Progreso from './src/screens/Progreso';
import Historial from './src/screens/Historial';
import Cuenta from './src/screens/Cuenta';

initDb();

type Tab = 'hoy' | 'rutinas' | 'progreso' | 'historial' | 'cuenta';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'hoy', label: 'Hoy', icon: '●' },
  { id: 'rutinas', label: 'Rutinas', icon: '☰' },
  { id: 'progreso', label: 'Progreso', icon: '↗' },
  { id: 'historial', label: 'Historial', icon: '◷' },
  { id: 'cuenta', label: 'Cuenta', icon: '☁' },
];

function Shell() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { timer } = useApp();
  const [tab, setTab] = useState<Tab>('hoy');
  // undefined = no editando; null = rutina nueva; string = editando esa rutina
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const scroll = useRef<any>(null);

  const go = (x: Tab) => { setTab(x); setEditing(undefined); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const edit = (id: string | null) => { setTab('rutinas'); setEditing(id); scroll.current?.scrollTo({ y: 0, animated: false }); };

  // Botón "atrás" de Android: sale del editor o regresa a Hoy antes de cerrar la app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editing !== undefined) { setEditing(undefined); return true; }
      if (tab !== 'hoy') { go('hoy'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [editing, tab]);

  let screen: React.ReactNode;
  if (tab === 'hoy') screen = <Hoy onEditRoutine={edit} onNewRoutine={() => edit(null)} />;
  else if (tab === 'rutinas') screen = editing !== undefined ? <EditRoutine key={editing ?? 'new'} id={editing} onDone={() => setEditing(undefined)} /> : <Rutinas onEdit={edit} />;
  else if (tab === 'progreso') screen = <Progreso />;
  else if (tab === 'historial') screen = <Historial />;
  else screen = <Cuenta />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: timer ? 130 : 40 }}>
          {screen}
        </ScrollView>
        <RestTimer />
      </KeyboardAvoidingView>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: t.line, backgroundColor: t.bg, paddingBottom: insets.bottom }}>
        {TABS.map((x) => {
          const on = x.id === tab;
          return (
            <Pressable key={x.id} onPress={() => go(x.id)} style={{ flex: 1, height: 62, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={{ fontSize: 18, color: on ? t.red : t.mute }}>{x.icon}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: on ? t.red : t.mute }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
