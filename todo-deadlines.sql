-- To do Ralph – uitbreiding: tabel voor losse deadlines (kalenderpagina).
-- Staat ook in todo-schema.sql; dit losse script is voor een database waar het schema al eerder is uitgevoerd.
-- Veilig om nog een keer uit te voeren.
create table if not exists public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.todo_eigenaar() references auth.users(id) on delete cascade,
  title       text not null,
  due_date    date not null,
  due_time    time,
  notes       text,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists deadlines_date_idx on public.deadlines(due_date);
alter table public.deadlines enable row level security;
drop policy if exists eigen_rijen on public.deadlines;
create policy eigen_rijen on public.deadlines for all to authenticated
  using (owner_id = public.todo_eigenaar()) with check (owner_id = public.todo_eigenaar());
revoke all on public.deadlines from anon;
grant select, insert, update, delete on public.deadlines to authenticated;
