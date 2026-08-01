-- Cole e rode no SQL Editor do Supabase (arquivo de etiquetas / fila de impressão)

create table if not exists label_archive (
  id text primary key,
  quote_numero text not null default '',
  cliente text not null default '',
  carrier text not null default '',
  service text not null default '',
  dest_name text not null default '',
  dest_cep text not null default '',
  zpl text not null default '',
  status text not null default 'pronta',
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table label_archive enable row level security;

drop policy if exists "public read label_archive" on label_archive;
drop policy if exists "public write label_archive" on label_archive;

create policy "public read label_archive" on label_archive for select using (true);
create policy "public write label_archive" on label_archive for all using (true) with check (true);
