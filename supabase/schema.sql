-- Rode no SQL Editor do Supabase (projeto gratuito)
-- Depois crie um bucket público chamado: uploads

create table if not exists products (
  id text primary key,
  nome text not null,
  preco text not null,
  categoria text not null default '',
  descricao text not null default '',
  material text not null default 'PLA',
  imagens jsonb not null default '[]'::jsonb,
  whatsapp text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists testimonials (
  id text primary key,
  nome text not null,
  texto text not null default '',
  imagem text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Biblioteca de orçamentos finalizados (PDF) — reutilizável em qualquer aparelho
create table if not exists quote_library (
  id text primary key,
  cliente text not null default '',
  numero text not null default '',
  data_label text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Arquivo / fila de etiquetas para impressão em lote
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

-- Políticas abertas para o painel simples (pode restringir depois com auth)
alter table products enable row level security;
alter table testimonials enable row level security;
alter table quote_library enable row level security;
alter table label_archive enable row level security;

create policy "public read products" on products for select using (true);
create policy "public write products" on products for all using (true) with check (true);

create policy "public read testimonials" on testimonials for select using (true);
create policy "public write testimonials" on testimonials for all using (true) with check (true);

create policy "public read quote_library" on quote_library for select using (true);
create policy "public write quote_library" on quote_library for all using (true) with check (true);

create policy "public read label_archive" on label_archive for select using (true);
create policy "public write label_archive" on label_archive for all using (true) with check (true);
