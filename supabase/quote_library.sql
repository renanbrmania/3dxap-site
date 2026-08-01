-- Cole e rode isto no SQL Editor do Supabase (só a biblioteca de orçamentos)

create table if not exists quote_library (
  id text primary key,
  cliente text not null default '',
  numero text not null default '',
  data_label text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quote_library enable row level security;

drop policy if exists "public read quote_library" on quote_library;
drop policy if exists "public write quote_library" on quote_library;

create policy "public read quote_library" on quote_library for select using (true);
create policy "public write quote_library" on quote_library for all using (true) with check (true);
