-- To do Ralph – databaseschema voor Supabase
-- Plak dit geheel in Supabase > SQL Editor > New query en klik Run.
-- Mag in een nieuw Supabase-project, of in het bestaande project van het CRM (de tabelnamen botsen niet).
-- Elke tabel is afgeschermd: alleen de ingelogde eigenaar ziet en wijzigt zijn eigen rijen.
-- Het script is veilig om nog een keer uit te voeren.

-- ---------- gedeelde toegang (voor de aparte Claude-gebruiker, zie todo-toegang-claude.sql) ----------
create table if not exists public.todo_toegang (
  gast      uuid primary key references auth.users(id) on delete cascade,
  eigenaar  uuid not null references auth.users(id) on delete cascade
);
alter table public.todo_toegang enable row level security;
revoke all on public.todo_toegang from anon, authenticated;

-- wiens gegevens zie ik: van mijn eigenaar als ik gast ben, anders van mezelf
create or replace function public.todo_eigenaar() returns uuid
  language sql stable security definer set search_path = public
as $$ select coalesce((select eigenaar from public.todo_toegang where gast = auth.uid()), auth.uid()) $$;
revoke all on function public.todo_eigenaar() from public, anon;
grant execute on function public.todo_eigenaar() to authenticated;

-- ---------- to do's ----------
-- lijsten: de kolommen op het bord
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.todo_eigenaar() references auth.users(id) on delete cascade,
  name        text not null,
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- labels: Prio, Wachten, ...
create table if not exists public.labels (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.todo_eigenaar() references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default 'groen' check (color in ('groen','geel','rood','blauw','paars','roze','teal','grijs')),
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.todo_eigenaar() references auth.users(id) on delete cascade,
  list_id     uuid not null references public.lists(id) on delete cascade,
  title       text not null,
  notes       text,
  label_ids   uuid[] not null default '{}',          -- id's uit de tabel labels
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz,
  sort        double precision not null default 0,   -- volgorde binnen de lijst, laag = bovenaan
  checklist   jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),  -- [{"id":"…","text":"…","done":false}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- notities ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.todo_eigenaar() references auth.users(id) on delete cascade,
  name        text not null,
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.todo_eigenaar() references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null default '',
  body        text not null default '',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- deadlines ----------
-- losse deadlines voor de kalender; staan los van de to do's (to do's met een einddatum komen ook in de kalender)
create table if not exists public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.todo_eigenaar() references auth.users(id) on delete cascade,
  title       text not null,
  due_date    date not null,
  due_time    time,                                   -- optioneel tijdstip
  notes       text,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists deadlines_date_idx on public.deadlines(due_date);

create index if not exists tasks_list_idx    on public.tasks(list_id, done, sort);
create index if not exists notes_project_idx on public.notes(project_id, updated_at desc);

-- ---------- beveiliging: Row Level Security, alleen eigen rijen ----------
do $$
declare t text;
begin
  foreach t in array array['lists','labels','tasks','projects','notes','deadlines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists eigen_rijen on public.%I', t);
    execute format('create policy eigen_rijen on public.%I for all to authenticated
                    using (owner_id = public.todo_eigenaar()) with check (owner_id = public.todo_eigenaar())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
