# Avyxyva CRM

Painel da agência Avyxyva (do Kaique): posts dos clientes, pendências, datas comemorativas e chat com o Claude.

- **Site:** https://avyxyva-crm.netlify.app (Netlify, site `avyxyva-crm`, equipe AVYXYVA)
- **Código:** https://github.com/kaaiquemorais/Avyxyva-CRM
- **Banco:** Supabase, projeto `xiznktfpwsikwfqmuavn` (conta do Kaique, não a organização da Casa Vita)

## Regras

- **Nunca publicar sozinho** (nem `netlify deploy`, nem push que dispare deploy) sem o Kaique pedir nesta conversa
- Segredos só no painel do Netlify ou do Supabase. Nunca no código, no chat ou no `.env` que vai para o Git
- Toda tabela nova: RLS ligado e forçado, política com `public.is_membro()`, grants explícitos (o padrão do esquema é fechado)
- Não mover esta pasta nem a pasta `MazyOS`

## Estrutura

- `index.html`, `src/main.js`, `src/style.css`: o painel (Vite, JavaScript puro). Visual: fundo branco, vidro, roxo Avyxyva, fontes Sora/Geist
- `src/supabase.js`: cliente Supabase (chave pública + login por link mágico com PKCE)
- `netlify/functions/claude.mjs`: chat (`/api/claude`). Confere o login e se a pessoa é membro, lê o contexto do banco e chama o `claude-opus-5-5` (effort low, fallbacks default)
- `netlify.toml`: build e cabeçalhos de segurança (CSP restrita ao Supabase do projeto)
- `supabase/migrations/`: esquema com RLS; `supabase/seed.sql`: dados iniciais (57 posts, 21 pendências, 139 datas)
- `supabase/config.toml`: login sem cadastro aberto, link de 15 min, senha forte, MFA (TOTP)

## Variáveis no Netlify

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (públicas), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (função), `ANTHROPIC_API_KEY` (secreta, o Kaique cola no painel)

## Acesso

Não existe cadastro pelo site. Para dar acesso: criar o usuário no Supabase (Authentication > Users > Add user) e rodar
`insert into public.membros (user_id, nome) select id, 'Nome' from auth.users where email = 'email@pessoa.com';`

## Comandos

- `npm run dev`: abre em http://localhost:5173 (precisa do `.env` com as duas variáveis `VITE_`)
- `npm run build`: gera `dist/`
- `supabase db push --include-seed`: aplica o esquema e os dados (depois de `supabase link --project-ref xiznktfpwsikwfqmuavn`)
- `supabase config push`: aplica as regras de login do `config.toml`
