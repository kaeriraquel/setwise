-- Mi Rutina: esquema de Supabase (PostgreSQL)
-- Pégalo completo en Supabase > SQL Editor > New query > Run.
--
-- Diseño:
--  * Los IDs (uuid) los genera el celular, así se pueden crear registros sin conexión.
--  * updated_at = milisegundos del celular; gana la versión más reciente (trigger lww_guard).
--  * synced_at  = hora del servidor; el celular baja "lo que cambió desde synced_at".
--  * deleted    = borrado lógico, para que los borrados lleguen a los otros dispositivos.
--  * user_id se llena solo con auth.uid() y RLS hace que cada quien vea solo lo suyo.
--  * Sin llaves foráneas entre tablas a propósito: las filas pueden llegar en cualquier orden.

create or replace function public.lww_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;               -- nadie cambia el dueño de una fila
    if new.updated_at < old.updated_at then   -- llegó una versión más vieja: se ignora
      return old;
    end if;
  end if;
  new.synced_at := now();
  return new;
end $$;

create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text,
  updated_at bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create table if not exists public.routines (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  days smallint[] not null default '{}',
  position integer not null default 0,
  updated_at bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create table if not exists public.routine_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid not null,
  exercise_id uuid not null,
  position integer not null default 0,
  sets integer not null default 3,
  reps text not null default '10',
  rest_sec integer not null default 90,
  updated_at bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid,
  name text not null,
  started_at bigint not null,
  ended_at bigint,
  updated_at bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null,
  exercise_order integer not null,
  set_number integer not null,
  weight real,
  reps integer,
  done boolean not null default false,
  is_pr boolean not null default false,
  updated_at bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['exercises','routines','routine_items','workouts','workout_sets'] loop
    execute format('create index if not exists %1$s_user_synced on public.%1$s (user_id, synced_at)', t);
    execute format('drop trigger if exists %1$s_lww on public.%1$s', t);
    execute format('create trigger %1$s_lww before insert or update on public.%1$s for each row execute function public.lww_guard()', t);
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%1$s', t);
    execute format('create policy "own rows" on public.%1$s for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
