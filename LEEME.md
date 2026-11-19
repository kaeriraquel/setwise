# Mi Rutina (Android, funciona sin internet)

App para registrar tu rutina de gimnasio: rutinas por día, series con peso y repeticiones, detección de PR, cronómetro de descanso, progreso por ejercicio e historial.

## Cómo funciona

- **Sin internet primero.** Todo se guarda en una base de datos SQLite dentro del celular. Puedes entrenar en un sótano sin señal sin problema.
- **Respaldo en la nube.** Si inicias sesión, la app sube tus cambios a Supabase (PostgreSQL) y baja lo que hiciste en otros dispositivos. Sincroniza al abrir la app, cada minuto mientras está abierta y al terminar un entrenamiento. Sin señal solo espera y lo intenta después.
- **Conflictos.** Cada registro tiene un ID creado en el celular y una marca de tiempo. Si editas lo mismo en dos dispositivos, gana el cambio más reciente, tanto en el servidor (trigger) como en el celular.
- **Borrados.** Son lógicos (`deleted = true`) para que también lleguen a tus otros dispositivos.

## Lo que necesitas

1. [Node.js LTS](https://nodejs.org) en tu computadora.
2. La app **Expo Go** en tu Android (Play Store).
3. Una cuenta gratis en [Supabase](https://supabase.com). Es opcional: sin ella la app funciona, solo que sin respaldo.

## Paso 1: crear el proyecto

```bash
npx create-expo-app@latest mi-rutina --template blank-typescript
cd mi-rutina
npx expo install expo-sqlite @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill react-native-safe-area-context
```

Copia los archivos de este zip dentro de `mi-rutina/`:

- `App.tsx` (reemplaza el que viene)
- la carpeta `src/`
- `eas.json`
- `.env.example` (renómbralo a `.env`)

## Paso 2: preparar Supabase

1. Crea un proyecto nuevo en Supabase.
2. Ve a **SQL Editor > New query**, pega todo `supabase/schema.sql` y dale **Run**. Crea las 5 tablas, los índices, el trigger de "gana el más reciente" y la seguridad por usuario (RLS).
3. Ve a **Project Settings > API** y copia la **Project URL** y la **anon / publishable key** a tu archivo `.env`.
4. Opcional: en **Authentication > Sign In / Providers > Email** puedes desactivar "Confirm email" para no tener que confirmar el correo al crear tu cuenta.

La key "anon/publishable" puede ir en la app sin problema: la seguridad la dan las políticas RLS. **Nunca** pongas la `service_role` key.

## Paso 3: probar en tu celular

```bash
npx expo start
```

Escanea el código QR con Expo Go. Ve a **Cuenta**, crea tu usuario y listo. La primera vez que inicias sesión necesitas internet; después la sesión se queda guardada.

## Paso 4: instalarla como app real (APK)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Al terminar te da un enlace para descargar el `.apk` e instalarlo en tu celular. Si la app instalada dice "Nube no configurada", agrega `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` como variables de entorno del proyecto en expo.dev y vuelve a compilar.

Cuando quieras subirla a Google Play usa `--profile production` (genera un `.aab`).

## Estructura

```
App.tsx                    navegación por pestañas y botón "atrás"
src/db.ts                  SQLite: tablas, save()/remove() que marcan cambios pendientes
src/repo.ts                consultas: rutinas, entrenamientos, PR, historial, progreso
src/sync.ts                sincronización push/pull con Supabase
src/supabase.ts            cliente de Supabase (sesión guardada en el celular)
src/AppContext.tsx         estado global: cronómetro, sesión, sincronización
src/screens/               Hoy, Entrenamiento, Rutinas (+ editor), Progreso, Historial, Cuenta
src/components/            cronómetro de descanso y disco de progreso semanal
supabase/schema.sql        esquema de PostgreSQL con trigger y RLS
```

## Pendientes conocidos

- El cronómetro vibra al terminar solo si la app está abierta. Para avisar con la app en segundo plano habría que agregar `expo-notifications`.
- El cambio kg/lb solo cambia la etiqueta, no convierte los pesos guardados.
- Al cerrar sesión se borran los datos del celular, para que otra cuenta no los herede. Antes intenta sincronizar y te avisa si quedaron cambios sin subir.
