import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { supabase } from './supabase';
import { syncNow, SyncResult } from './sync';
import { getMeta } from './db';

type Timer = { endAt: number; total: number } | null;
type Ctx = {
  version: number; bump: () => void;
  timer: Timer; startTimer: (sec: number) => void; addTimer: (sec: number) => void; stopTimer: () => void;
  email: string | null; sync: SyncResult | null; syncing: boolean; lastSync: number | null; requestSync: () => void;
};
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  /* ----- cronómetro de descanso (basado en hora de fin, así sobrevive si cambias de app) ----- */
  const [timer, setTimer] = useState<Timer>(null);
  const startTimer = useCallback((sec: number) => setTimer({ endAt: Date.now() + sec * 1000, total: sec }), []);
  const addTimer = useCallback((sec: number) => setTimer((t) => (t ? { endAt: Math.max(Date.now(), t.endAt + sec * 1000), total: Math.max(1, t.total + sec) } : t)), []);
  const stopTimer = useCallback(() => setTimer(null), []);
  useEffect(() => {
    if (!timer) return;
    const ms = timer.endAt - Date.now();
    const id = setTimeout(() => { Vibration.vibrate([0, 400, 200, 400, 200, 400]); }, Math.max(0, ms));
    const close = setTimeout(() => setTimer((t) => (t === timer ? null : t)), Math.max(0, ms) + 6000);
    return () => { clearTimeout(id); clearTimeout(close); };
  }, [timer]);

  /* ----- sesión y sincronización ----- */
  const [email, setEmail] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(() => Number(getMeta('last_sync')) || null);
  const busy = useRef(false);

  const requestSync = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; setSyncing(true);
    const r = await syncNow();
    busy.current = false; setSyncing(false); setSync(r);
    if (r.ok) setLastSync(Date.now());
    if (r.changed) bump();
  }, [bump]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setEmail(data.session?.user.email ?? null); requestSync(); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user.email ?? null);
      if (event === 'SIGNED_IN') requestSync();
    });
    // Al volver a la app: refresca el token y sincroniza. En segundo plano: deja de refrescar.
    const st = AppState.addEventListener('change', (s) => {
      if (s === 'active') { supabase!.auth.startAutoRefresh(); requestSync(); } else supabase!.auth.stopAutoRefresh();
    });
    const iv = setInterval(() => { if (AppState.currentState === 'active') requestSync(); }, 60000);
    return () => { sub.subscription.unsubscribe(); st.remove(); clearInterval(iv); };
  }, [requestSync]);

  return (
    <C.Provider value={{ version, bump, timer, startTimer, addTimer, stopTimer, email, sync, syncing, lastSync, requestSync }}>
      {children}
    </C.Provider>
  );
}
