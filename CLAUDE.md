# Avyxyva CRM

Painel da agência Avyxyva (do Kaique): posts dos clientes, pendências e datas comemorativas. Sem chat com IA: o Kaique conversa com o Claude pelo Claude Code (a API seria cobrada à parte, decisão de 29/10/2026).

- **Site:** https://avyxyva-crm.netlify.app (Netlify, site `avyxyva-crm`, equipe AVYXYVA)
- **Código:** https://github.com/kaaiquemorais/Avyxyva-CRM
- **Banco:** Supabase, projeto `xiznktfpwsikwfqmuavn` (conta do Kaique, não a organização da Casa Vita)

## Regras

- **Nunca publicar sozinho** (nem `netlify deploy`, nem push que dispare deploy) sem o Kaique pedir nesta conversa
- **Dados não precisam de deploy:** posts, pendências, status e datas ficam no Supabase. Para criar ou mudar, gravar direto no banco
- **Mudança de código (combinado em 29/10/2026):** fazer e testar local, juntar as mudanças pequenas num pacote, mostrar e esperar o "sobe". Com o GitHub ligado ao Netlify, cada push em `main` publica sozinho, então push só depois do "sobe"
- Segredos só no painel do Netlify ou do Supabase. Nunca no código, no chat ou no `.env` que vai para o Git
- Toda tabela nova: RLS ligado e forçado, política com `public.is_membro()`, grants explícitos (o padrão do esquema é fechado)
- Não mover esta pasta nem a pasta `MazyOS`

## Estrutura

- `index.html`, `src/main.js`, `src/style.css`: o painel (Vite, JavaScript puro). Visual: fundo branco, vidro, roxo Avyxyva, fontes Sora/Geist
- `src/supabase.js`: cliente Supabase (chave pública + login por link mágico com PKCE)
- `netlify.toml`: build e cabeçalhos de segurança (CSP restrita ao Supabase do projeto)
- `supabase/migrations/`: esquema com RLS; `supabase/seed.sql`: dados iniciais (57 posts, 21 pendências, 139 datas)
- `supabase/config.toml`: login sem cadastro aberto, link de 15 min, senha forte, MFA (TOTP)

## Variáveis no Netlify

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (públicas; a proteção é o RLS)

## Acesso

Não existe cadastro pelo site. Para dar acesso: criar o usuário no Supabase (Authentication > Users > Add user) e rodar
`insert into public.membros (user_id, nome) select id, 'Nome' from auth.users where email = 'email@pessoa.com';`

## Comandos

- `npm run dev`: abre em http://localhost:5173 (precisa do `.env` com as duas variáveis `VITE_`)
- `npm run build`: gera `dist/`
- `supabase db push --include-seed`: aplica o esquema e os dados (depois de `supabase link --project-ref xiznktfpwsikwfqmuavn`)
- `supabase config push`: aplica as regras de login do `config.toml`
