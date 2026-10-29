import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !chave) throw new Error("Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env ou no Netlify.");

// Chave pública (anon/publishable): a proteção dos dados fica no RLS do banco.
export const supabase = createClient(url, chave, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
