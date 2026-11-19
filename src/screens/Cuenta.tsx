import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useApp } from '../AppContext';
import { supabase } from '../supabase';
import { pendingCount, syncNow } from '../sync';
import { wipeLocal } from '../db';
import * as repo from '../repo';
import { Btn, Card, Chip, H1, H2, Input, Row, T, confirm } from '../ui';

export default function Cuenta() {
  const { version, bump, email, sync, syncing, lastSync, requestSync } = useApp();
  const [mail, setMail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useMemo(() => pendingCount(), [version, syncing]);
  const unit = repo.getUnit();

  const auth = async (mode: 'in' | 'up') => {
    if (!supabase) return;
    setBusy(true); setMsg('');
    const { error, data } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: mail.trim(), password: pass })
      : await supabase.auth.signUp({ email: mail.trim(), password: pass });
    setBusy(false);
    if (error) setMsg(error.message.includes('Invalid login') ? 'Correo o contraseña incorrectos' : error.message);
    else if (mode === 'up' && !data.session) setMsg('Te enviamos un correo para confirmar tu cuenta. Confírmala y luego entra.');
  };

  const signOut = async () => {
    if (!supabase) return;
    if (!(await confirm('Al cerrar sesión se borran los datos de este celular (tu respaldo en la nube se queda). ¿Continuar?', 'Cerrar sesión'))) return;
    setBusy(true);
    const r = await syncNow();
    if (!r.ok && pendingCount() > 0 && !(await confirm('Hay cambios sin subir y no se pudo sincronizar. Si sigues, esos cambios se pierden.', 'Cerrar de todos modos'))) { setBusy(false); return; }
    await supabase.auth.signOut();
    wipeLocal(); setBusy(false); bump();
  };

  return (
    <View>
      <H1>Cuenta</H1>
      {!supabase ? (
        <Card><T bold>Nube no configurada</T><T mute style={{ marginTop: 6 }}>La app funciona y guarda todo en este celular. Para respaldar y usarla en otros dispositivos, agrega tus claves de Supabase en el archivo .env (ver LEEME.md).</T></Card>
      ) : !email ? (
        <Card>
          <T mute>Tus datos ya se guardan en este celular. Inicia sesión para respaldarlos en la nube y verlos en otros dispositivos.</T>
          <Input label="Correo" value={mail} onChangeText={setMail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Input label="Contraseña" value={pass} onChangeText={setPass} secureTextEntry autoComplete="password" />
          {msg ? <T size={14} style={{ marginTop: 8 }}>{msg}</T> : null}
          <Row style={{ marginTop: 12 }}>
            <Btn title="Entrar" kind="pri" disabled={busy || !mail || pass.length < 6} onPress={() => auth('in')} />
            <Btn title="Crear cuenta" kind="ghost" disabled={busy || !mail || pass.length < 6} onPress={() => auth('up')} />
            {busy && <ActivityIndicator />}
          </Row>
        </Card>
      ) : (
        <Card>
          <T mute size={14}>Sesión iniciada como</T>
          <T bold>{email}</T>
          <T mute size={14} style={{ marginTop: 10 }}>
            {syncing ? 'Sincronizando…' : sync?.message ?? 'Listo'}
            {lastSync ? ` · última vez ${new Date(lastSync).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
          </T>
          <T mute size={14}>{pending ? `${pending} cambios pendientes de subir` : 'Todo respaldado'}</T>
          <Row style={{ marginTop: 12 }}>
            <Btn title="Sincronizar ahora" kind="blue" disabled={syncing} onPress={requestSync} />
            <Btn title="Cerrar sesión" kind="ghost" disabled={busy} onPress={signOut} />
          </Row>
        </Card>
      )}

      <H2>Unidad de peso</H2>
      <Row>{['kg', 'lb'].map((u) => <Chip key={u} label={u} on={u === unit} onPress={() => { repo.setUnit(u); bump(); }} />)}</Row>
      <T mute size={13} style={{ marginTop: 6 }}>Solo cambia la etiqueta; no convierte lo que ya registraste.</T>
    </View>
  );
}
