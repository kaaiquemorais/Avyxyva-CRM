-- Avyxyva CRM: esquema inicial.
-- Segurança: RLS forçado em todas as tabelas; só quem está em public.membros lê ou escreve.
-- O papel anon não tem acesso a nada; tabelas e funções futuras não ganham permissão automática.

-- tabelas e funções novas não ficam abertas por padrão
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;

-- equipe com acesso (só se entra por SQL, nunca pelo site)
create table public.membros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  criado_em timestamptz not null default now()
);

create or replace function public.is_membro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.membros m where m.user_id = (select auth.uid()));
$$;

create table public.clientes (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  nome text not null check (char_length(nome) between 1 and 80),
  cor text not null check (cor ~ '^#[0-9a-fA-F]{6}$'),
  servico text check (char_length(servico) <= 200),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null references public.clientes (id) on update cascade,
  data date not null,
  formato text not null check (formato in ('Carrossel', 'Reel', 'Post único', 'Imagem única', 'Enquete', 'Só texto', 'Vídeo', 'Stories')),
  titulo text not null check (char_length(titulo) between 1 and 300),
  status text not null default 'a fazer' check (status in ('a fazer', 'copy', 'arte', 'pronto', 'publicado')),
  falta text not null default '' check (char_length(falta) <= 300),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index posts_data_idx on public.posts (data);
create index posts_cliente_idx on public.posts (cliente_id);

create table public.pendencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null references public.clientes (id) on update cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  quem text not null default '' check (char_length(quem) <= 80),
  feito boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pendencias_cliente_idx on public.pendencias (cliente_id);

create table public.datas_comemorativas (
  id bigint generated always as identity primary key,
  mes smallint not null check (mes between 1 and 12),
  dia smallint not null check (dia between 1 and 31),
  nome text not null check (char_length(nome) between 1 and 200),
  clientes text[] not null default '{}',
  ideia text check (char_length(ideia) <= 300),
  ano smallint check (ano between 2020 and 2100)
);
create index datas_mes_dia_idx on public.datas_comemorativas (mes, dia);

create table public.campanhas_mes (
  mes smallint primary key check (mes between 1 and 12),
  campanhas text[] not null default '{}'
);

-- atualizado_em automático
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger posts_tocar before update on public.posts for each row execute function public.tocar_atualizado_em();
create trigger pendencias_tocar before update on public.pendencias for each row execute function public.tocar_atualizado_em();

-- RLS ligado e forçado (vale até para o dono das tabelas)
alter table public.membros enable row level security;
alter table public.clientes enable row level security;
alter table public.posts enable row level security;
alter table public.pendencias enable row level security;
alter table public.datas_comemorativas enable row level security;
alter table public.campanhas_mes enable row level security;
alter table public.membros force row level security;
alter table public.clientes force row level security;
alter table public.posts force row level security;
alter table public.pendencias force row level security;
alter table public.datas_comemorativas force row level security;
alter table public.campanhas_mes force row level security;

-- permissões mínimas: anon não toca em nada; authenticated só no que precisa
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant select on public.membros to authenticated;
grant select, insert, update, delete on public.clientes, public.posts, public.pendencias,
  public.datas_comemorativas, public.campanhas_mes to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_membro() to authenticated;

-- políticas
create policy "membro ve o proprio cadastro" on public.membros
  for select to authenticated using (user_id = (select auth.uid()));

create policy "membros gerenciam clientes" on public.clientes
  for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy "membros gerenciam posts" on public.posts
  for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy "membros gerenciam pendencias" on public.pendencias
  for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy "membros gerenciam datas" on public.datas_comemorativas
  for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy "membros gerenciam campanhas" on public.campanhas_mes
  for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));

-- atualização ao vivo no painel (o Realtime respeita o RLS)
alter publication supabase_realtime add table public.posts, public.pendencias;
