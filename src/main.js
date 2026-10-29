import "./style.css";
import logo48 from "./logo-48.png";
import logo192 from "./logo-192.png";
import { supabase } from "./supabase.js";

const STATUS = ["a fazer", "copy", "arte", "pronto", "publicado"];
const STATUS_CLASSE = { "a fazer": "s-afazer", copy: "s-copy", arte: "s-arte", pronto: "s-pronto", publicado: "s-publicado" };
const STATUS_COR = { "a fazer": "#d9d4e3", copy: "#f2c66d", arte: "#9b6fcf", pronto: "#3fb27f", publicado: "#45197a" };
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

let clientes = {}, posts = [], pendencias = [], filtro = "todos", sessao = null;

const $ = (id) => document.getElementById(id);
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const hojeIso = iso(new Date());
const br = (s) => (s ? s.slice(8, 10) + "/" + s.slice(5, 7) : "");
const visivel = (x) => filtro === "todos" || x.cliente_id === filtro;
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lerGuardado = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "cor") n.style.setProperty("--cor", v);
    else if (k === "fundo") n.style.background = v;
    else n.setAttribute(k, v);
  }
  for (const f of filhos) if (f != null) n.append(f);
  return n;
}

$("logo-login").src = logo192;
$("logo-topo").src = logo48;
$("hoje").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

/* ---------- entrada ---------- */
$("form-login").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = $("email").value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("msg-login").textContent = "Confira o e-mail digitado."; return; }
  $("btn-login").disabled = true;
  $("msg-login").textContent = "Enviando...";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
  });
  // Mesma resposta para e-mail cadastrado ou não, para não revelar quem tem acesso.
  $("msg-login").textContent = error && error.status === 429
    ? "Muitas tentativas. Espere alguns minutos e tente de novo."
    : "Se este e-mail tiver acesso, o link chega em instantes. Confira também o spam.";
  setTimeout(() => { $("btn-login").disabled = false; }, 60000);
});
$("sair").onclick = async () => { await supabase.auth.signOut(); location.replace("/"); };

supabase.auth.onAuthStateChange((_evento, s) => {
  const entrou = !sessao && s;
  sessao = s;
  $("entrada").hidden = !!s;
  $("app").hidden = !s;
  if (entrou) iniciar();
});

/* ---------- dados ---------- */
let iniciado = false;
async function iniciar() {
  if (iniciado) return;
  iniciado = true;
  const { data: cli, error } = await supabase.from("clientes").select("id, nome, cor").eq("ativo", true).order("nome");
  if (error || !cli?.length) {
    $("tabela-vazia").hidden = false;
    $("tabela-vazia").textContent = "Sua conta entrou, mas ainda não tem acesso aos dados. Peça para liberar o acesso.";
    return;
  }
  clientes = Object.fromEntries(cli.map((c) => [c.id, c]));
  montarFiltros();
  await Promise.all([carregarPosts(), carregarPendencias()]);
  supabase.channel("crm")
    .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, carregarPosts)
    .on("postgres_changes", { event: "*", schema: "public", table: "pendencias" }, carregarPendencias)
    .subscribe();
  carregarDatas();
}
async function carregarPosts() {
  const { data } = await supabase.from("posts").select("id, cliente_id, data, formato, titulo, status, falta").order("data");
  posts = data || []; render();
}
async function carregarPendencias() {
  const { data } = await supabase.from("pendencias").select("id, cliente_id, texto, quem, feito").order("criado_em");
  pendencias = data || []; render();
}

function montarFiltros() {
  filtro = lerGuardado("avx-filtro") || "todos";
  if (filtro !== "todos" && !clientes[filtro]) filtro = "todos";
  const f = $("filtros"); f.replaceChildren();
  const botao = (id, rotulo, cor) => {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": String(filtro === id) }, cor ? el("i", { fundo: cor }) : null, rotulo);
    b.onclick = () => { filtro = id; guardar("avx-filtro", id); f.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render(); };
    return b;
  };
  f.append(botao("todos", "Todos"), ...Object.values(clientes).map((c) => botao(c.id, c.nome, c.cor)));
}

/* ---------- tela ---------- */
function render() {
  const ps = posts.filter(visivel);
  const pe = pendencias.filter(visivel);
  const prontos = ps.filter((p) => ["arte", "pronto", "publicado"].includes(p.status)).length;
  const fim = new Date(); fim.setDate(fim.getDate() + 6);
  const semana = ps.filter((p) => p.data >= hojeIso && p.data <= iso(fim));
  const abertas = pe.filter((p) => !p.feito);
  $("k-total").textContent = ps.length;
  $("k-prontos").textContent = prontos;
  $("k-barra").style.width = (ps.length ? Math.round((prontos / ps.length) * 100) : 0) + "%";
  $("k-semana").textContent = semana.length;
  $("k-semana-sub").textContent = semana.filter((p) => p.status === "a fazer").length + " ainda sem copy";
  $("k-pend").textContent = abertas.length;
  $("k-pend-sub").textContent = abertas.length ? "a mais antiga: " + (abertas[0].quem || "cliente") : "tudo em dia";

  const s = $("semana"); s.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i); const k = iso(d);
    const box = el("div", { class: "dia" + (i === 0 ? " hojeD" : "") }, el("header", {}, el("b", {}, DIAS[d.getDay()]), br(k)));
    ps.filter((p) => p.data === k).forEach((p) => box.append(el("div", { class: "mini", cor: clientes[p.cliente_id]?.cor }, p.titulo, el("em", {}, p.formato + " · " + p.status))));
    s.append(box);
  }
  $("semana-lbl").textContent = semana.length + " posts";

  desenharGrafico();
  $("legenda").replaceChildren(...STATUS.map((st) => el("span", {}, el("i", { fundo: STATUS_COR[st] }), st)));

  const tb = $("tabela"); tb.replaceChildren();
  ps.forEach((p) => {
    const atrasado = p.data < hojeIso && !["pronto", "publicado"].includes(p.status);
    const btn = el("button", { class: "status " + (STATUS_CLASSE[p.status] || "s-afazer"), type: "button", title: "Avançar status" }, p.status);
    btn.onclick = () => avancar(p, btn);
    const c = clientes[p.cliente_id];
    tb.append(el("tr", { class: atrasado ? "atrasado" : "" },
      el("td", { class: "data" }, br(p.data)),
      el("td", {}, el("span", { class: "cli", cor: c?.cor }, el("i"), c?.nome || p.cliente_id)),
      el("td", { class: "fmt" }, p.formato),
      el("td", { class: "tema" }, p.titulo),
      el("td", {}, btn),
      el("td", { class: "falta" }, p.falta || "")));
  });
  $("tabela-vazia").hidden = posts.length > 0;

  const pd = $("pend"); pd.replaceChildren();
  [...pe].sort((a, b) => Number(a.feito) - Number(b.feito)).forEach((p) => {
    const cb = el("input", { type: "checkbox", id: "pd-" + p.id }); cb.checked = p.feito;
    cb.onchange = () => marcar(p, cb);
    pd.append(el("label", { class: p.feito ? "feito" : "", for: "pd-" + p.id }, cb,
      el("div", {}, el("span", {}, p.texto), el("small", {}, (clientes[p.cliente_id]?.nome || "") + " · pedir para " + (p.quem || "cliente")))));
  });
  $("pend-lbl").textContent = abertas.length + " abertas de " + pe.length;
  $("pend-vazia").hidden = pendencias.length > 0;
}

function desenharGrafico() {
  const NS = "http://www.w3.org/2000/svg";
  const ids = filtro === "todos" ? Object.keys(clientes) : [filtro];
  const W = 420, linha = 34, H = ids.length * linha + 26, x0 = 98, larg = W - x0 - 34;
  const max = Math.max(1, ...ids.map((c) => posts.filter((p) => p.cliente_id === c).length));
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Posts por status de cada cliente");
  const add = (tag, attrs, texto) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (texto != null) n.textContent = texto; svg.append(n); return n; };
  for (let t = 0; t <= 4; t++) {
    const x = x0 + (larg * t) / 4;
    add("line", { x1: x, y1: 4, x2: x, y2: H - 20, stroke: "rgba(69,25,122,.08)" });
    add("text", { x, y: H - 6, "font-size": 9, fill: "#8a8597", "text-anchor": "middle", "font-family": "Geist Mono, monospace" }, Math.round((max * t) / 4));
  }
  ids.forEach((c, i) => {
    const y = 8 + i * linha; let x = x0; const doCli = posts.filter((p) => p.cliente_id === c);
    add("text", { x: x0 - 8, y: y + 14, "font-size": 10.5, fill: "#4b4757", "text-anchor": "end", "font-family": "Geist, sans-serif" }, clientes[c]?.nome || c);
    STATUS.forEach((st) => {
      const n = doCli.filter((p) => p.status === st).length; if (!n) return;
      const w = (larg * n) / max;
      add("rect", { x, y: y + 3, width: Math.max(w - 2, 1), height: 16, rx: 4, fill: STATUS_COR[st] }).append(Object.assign(document.createElementNS(NS, "title"), { textContent: `${st}: ${n}` }));
      x += w;
    });
    add("text", { x: x + 6, y: y + 15, "font-size": 10, fill: "#16151a", "font-family": "Geist Mono, monospace" }, doCli.length);
  });
  $("grafico").replaceChildren(svg);
}

async function avancar(p, btn) {
  const prox = STATUS[(STATUS.indexOf(p.status) + 1) % STATUS.length];
  btn.disabled = true;
  const { error } = await supabase.from("posts").update({ status: prox }).eq("id", p.id);
  if (error) btn.title = "Não foi possível salvar";
  else { p.status = prox; render(); }
  btn.disabled = false;
}
async function marcar(p, cb) {
  cb.disabled = true;
  const { error } = await supabase.from("pendencias").update({ feito: cb.checked }).eq("id", p.id);
  if (error) cb.checked = !cb.checked; else { p.feito = cb.checked; render(); }
  cb.disabled = false;
}

/* ---------- datas comemorativas ---------- */
let datasHoje = [], proximas = [], campanhas = [];
async function carregarDatas() {
  const agora = new Date(), daqui = new Date(); daqui.setDate(daqui.getDate() + 7);
  const meses = [...new Set([agora.getMonth() + 1, daqui.getMonth() + 1])];
  const [{ data: ds }, { data: cs }] = await Promise.all([
    supabase.from("datas_comemorativas").select("mes, dia, nome, clientes, ideia, ano").in("mes", meses),
    supabase.from("campanhas_mes").select("campanhas").eq("mes", agora.getMonth() + 1).maybeSingle(),
  ]);
  if (!ds) return;
  const vale = (x) => !x.ano || x.ano === agora.getFullYear();
  campanhas = cs?.campanhas || [];
  datasHoje = ds.filter((x) => x.mes === agora.getMonth() + 1 && x.dia === agora.getDate() && vale(x));
  for (let i = 1; i <= 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    ds.filter((x) => x.mes === d.getMonth() + 1 && x.dia === d.getDate() && vale(x) && x.clientes.length)
      .forEach((x) => proximas.push({ ...x, quando: br(iso(d)) }));
  }
  mostrarDatas();
}
const relevantes = () => datasHoje.filter((x) => x.clientes.length).sort((a, b) => b.clientes.length - a.clientes.length);
function mostrarDatas() {
  if (!datasHoje.length && !proximas.length) return;
  const pill = $("datas-pill"), principal = relevantes()[0] || datasHoje[0];
  $("datas-txt").textContent = principal ? "Hoje: " + principal.nome : "Datas da semana";
  $("datas-mais").textContent = datasHoje.length > 1 ? "+" + (datasHoje.length - 1) : "";
  pill.hidden = false;
  if (lerGuardado("avx-datas-visto") !== hojeIso) {
    pill.classList.add("novo");
    if (principal) {
      const t = el("div", { class: "toast vidro", role: "status" }, el("span", {}, "Hoje é " + principal.nome), el("button", { type: "button" }, "Ver datas"));
      t.querySelector("button").onclick = () => { abrirDatas(); t.remove(); };
      document.body.append(t);
      setTimeout(() => { t.classList.add("sai"); setTimeout(() => t.remove(), 500); }, 8000);
    }
  }
  pill.onclick = () => ($("pop").hidden ? abrirDatas() : fecharDatas());
}
function itemData(x, comQuando) {
  const li = el("li", { class: x.clientes.length ? "" : "outra" });
  if (x.clientes.length) li.append(el("span", { class: "pontos" }, ...x.clientes.map((c) => el("i", { fundo: clientes[c]?.cor || "#9b6fcf", title: clientes[c]?.nome || c }))));
  if (comQuando) li.append(el("span", { class: "quando" }, x.quando));
  li.append(x.nome);
  if (x.ideia) li.append(el("em", {}, x.ideia));
  return li;
}
function abrirDatas() {
  const p = $("pop"); p.replaceChildren();
  p.append(el("h3", {}, new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long" })));
  if (campanhas.length) p.append(el("div", { class: "mes" }, "Neste mês: " + campanhas.join(", ")));
  const rel = relevantes(), outras = datasHoje.filter((x) => !x.clientes.length);
  if (rel.length) p.append(el("h4", {}, "Combina com seus clientes"), el("ul", {}, ...rel.map((x) => itemData(x))));
  if (outras.length) p.append(el("h4", {}, "Outras datas de hoje"), el("ul", {}, ...outras.map((x) => itemData(x))));
  if (!datasHoje.length) p.append(el("div", { class: "mes" }, "Nenhuma data marcada para hoje."));
  if (proximas.length) p.append(el("h4", {}, "Próximos dias"), el("ul", {}, ...proximas.map((x) => itemData(x, true))));
  p.append(el("div", { class: "nota" }, "Confira a data antes de postar."));
  p.hidden = false; $("datas-pill").setAttribute("aria-expanded", "true"); $("datas-pill").classList.remove("novo");
  guardar("avx-datas-visto", hojeIso);
}
function fecharDatas() { $("pop").hidden = true; $("datas-pill").setAttribute("aria-expanded", "false"); }
document.addEventListener("click", (ev) => { if (!$("pop").hidden && !ev.target.closest("#pop, #datas-pill, .toast")) fecharDatas(); });
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") fecharDatas(); });

/* ---------- chat com o Claude (via função segura no Netlify) ---------- */
let turnos = [];
try { turnos = JSON.parse(sessionStorage.getItem("avx-chat") || "[]").slice(-12); } catch (e) { turnos = []; }
function formatar(t) {
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = "", lista = false;
  for (const l of esc.split("\n")) {
    const m = l.match(/^\s*(?:[•\-*]|\d+[.)])\s+(.*)/);
    if (m) { if (!lista) { html += "<ul>"; lista = true; } html += "<li>" + m[1] + "</li>"; continue; }
    if (lista) { html += "</ul>"; lista = false; }
    html += l.trim() ? l + "<br>" : "<br>";
  }
  if (lista) html += "</ul>";
  return html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
function bolha(papel, texto) {
  const b = el("div", { class: "msg " + papel });
  if (papel === "ia") b.innerHTML = formatar(texto); else b.textContent = texto;
  $("msgs").append(b); $("msgs").scrollTop = $("msgs").scrollHeight; return b;
}
async function perguntar(texto) {
  texto = texto.trim().slice(0, 4000);
  if (!texto || !sessao) return;
  bolha("eu", texto); turnos.push({ role: "user", content: texto });
  const b = bolha("ia", "Pensando..."); $("enviar").disabled = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/claude", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ mensagens: turnos.slice(-10) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "Não consegui responder agora.");
    b.innerHTML = formatar(j.texto);
    turnos.push({ role: "assistant", content: j.texto });
    try { sessionStorage.setItem("avx-chat", JSON.stringify(turnos.slice(-12))); } catch (e) {}
  } catch (e) {
    turnos.pop();
    b.textContent = e.message || "Não consegui responder agora. Tente de novo.";
  }
  $("enviar").disabled = false;
}
turnos.forEach((t) => bolha(t.role === "user" ? "eu" : "ia", t.content));
if (!turnos.length) bolha("ia", "Oi, Kaique. Eu vejo os posts, as pendências e as datas do CRM. Toque em **O que faço hoje?** ou me pergunte qualquer coisa.");
$("envio").addEventListener("submit", (ev) => { ev.preventDefault(); const t = $("pergunta").value; $("pergunta").value = ""; perguntar(t); });
$("pergunta").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("envio").requestSubmit(); } });
document.querySelectorAll(".atalhos button").forEach((b) => { b.onclick = () => perguntar(b.dataset.p); });

// estado inicial (sem sessão, mostra a entrada)
supabase.auth.getSession().then(({ data: { session } }) => { if (!session) { $("entrada").hidden = false; $("app").hidden = true; } });
