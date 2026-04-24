// ============================================================
// TALENTOS+ | APP.JS COMPLETO CORRIGIDO V2
// Mantém visual atual. Corrige funcionalidades e dados ausentes.
// NÃO altera CSS, MapeIA, Parecer ou Retorno ao Cliente.
// ============================================================

const SUPABASE_URL = "https://xidodhapgrtkranvzdpx.supabase.co";
const SUPABASE_KEY = "COLE_SUA_CHAVE_AQUI";

const supabaseClient =
  window.supabase && SUPABASE_KEY !== "COLE_SUA_CHAVE_AQUI"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

const STORAGE_KEYS = {
  vagas: "talentos_plus_vagas",
  candidatos: "talentos_plus_candidatos",
  mapeamentos: "talentos_plus_mapeamentos"
};

const BANCO_TALENTOS_ID = "banco_talentos";

const App = {
  State: {
    user: null,
    profile: null,
    vagas: [],
    candidatos: [],
    mapeamentos: [],
    useSupabase: !!supabaseClient
  },

  Utils: {
    value(id) {
      const el = document.getElementById(id);
      return el ? el.value : "";
    },

    setValue(id, value) {
      const el = document.getElementById(id);
      if (el) el.value = value || "";
    },

    text(id, value) {
      const el = document.getElementById(id);
      if (el) el.innerText = value ?? "";
    },

    html(id, value) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = value || "";
    },

    safe(text) {
      return (text || "").toString().replace(/[<>&]/g, m => ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;"
      }[m]));
    },

    option(value, label) {
      return `<option value="${App.Utils.safe(value)}">${App.Utils.safe(label || value)}</option>`;
    },

    unique(items) {
      return [...new Set(items.filter(Boolean))];
    },

    money(value) {
      if (!value) return "Não informado";
      return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    },

    uuid(prefix = "id") {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
      return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    },

    normalizeText(text) {
      return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    },

    download(filename, content, type = "application/json") {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },

    storageGet(key) {
      try {
        return JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        return [];
      }
    },

    storageSet(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },

    idade(dataNascimento) {
      if (!dataNascimento) return null;
      const nascimento = new Date(dataNascimento + "T00:00:00");
      if (isNaN(nascimento.getTime())) return null;
      const hoje = new Date();
      let idade = hoje.getFullYear() - nascimento.getFullYear();
      const mes = hoje.getMonth() - nascimento.getMonth();
      if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
      return idade;
    },

    faixaEtaria(dataNascimento) {
      const idade = App.Utils.idade(dataNascimento);
      if (idade === null || idade < 0) return "Não informado";
      if (idade <= 24) return "Até 24 anos";
      if (idade <= 34) return "25 a 34 anos";
      if (idade <= 44) return "35 a 44 anos";
      if (idade <= 54) return "45 a 54 anos";
      return "55 anos ou mais";
    },

    percent(part, total) {
      if (!total) return "0%";
      return `${Math.round((part / total) * 100)}%`;
    },

    getVagaNome(vaga) {
      if (!vaga) return "";
      return vaga.nome || vaga.vaga || vaga.cargo || vaga.titulo || "";
    },

    getVagaCliente(vaga) {
      if (!vaga) return "";
      return vaga.cliente || vaga.cliente_nome || vaga.empresa || vaga.empresa_nome || vaga.nome_cliente || "";
    },

    getCandidatoCliente(candidato) {
      if (!candidato) return "";
      return candidato.cliente || candidato.cliente_nome || candidato.empresa || candidato.empresa_nome || App.Utils.getVagaCliente(candidato.vagas) || "";
    },

    getCandidatoVagaNome(candidato) {
      if (!candidato) return "";
      return candidato.vaga_interesse || App.Utils.getVagaNome(candidato.vagas) || "Não vinculada";
    },

    isUnknownColumnError(error) {
      const message = (error?.message || "").toLowerCase();
      return message.includes("column") && (message.includes("does not exist") || message.includes("could not find"));
    },

    formatDateBR(date) {
      if (!date) return "—";
      const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("pt-BR");
    },

    calcularSLA14DiasUteis(dataAbertura) {
      if (!dataAbertura) return "";
      const data = new Date(dataAbertura + "T00:00:00");
      if (isNaN(data.getTime())) return "";
      let diasUteis = 0;
      const atual = new Date(data);
      while (diasUteis < 14) {
        atual.setDate(atual.getDate() + 1);
        const diaSemana = atual.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) diasUteis++;
      }
      return atual.toISOString().slice(0, 10);
    },

    atualizarSLAVisual() {
      const data = App.Utils.value("v_data");
      const prazo = App.Utils.calcularSLA14DiasUteis(data);
      const texto = prazo ? `Prazo SLA: ${App.Utils.formatDateBR(prazo)}` : "Prazo SLA: —";
      App.Utils.text("v_sla_view", texto);
    },

    countBy(items, callback) {
      const map = {};
      items.forEach(item => {
        const key = callback(item) || "Não informado";
        map[key] = (map[key] || 0) + 1;
      });
      return map;
    },

    renderCountList(id, items, callback) {
      const el = document.getElementById(id);
      if (!el) return;
      const map = App.Utils.countBy(items, callback);
      const total = items.length;
      el.innerHTML = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .map(([nome, qtd]) => `<div class="chart-line"><strong>${App.Utils.safe(nome)}</strong>: ${qtd} <span>(${App.Utils.percent(qtd, total)})</span></div>`)
        .join("") || `<div class="chart-empty">Sem dados disponíveis.</div>`;
    }
  },

  Data: {
    async refreshAll() {
      await Promise.all([
        App.Data.loadVagas(),
        App.Data.loadCandidatos(),
        App.Data.loadMapeamentos()
      ]);

      App.Controllers.Vagas.populateSelects();
      App.Controllers.Vagas.renderGestao();
      App.Controllers.Candidatos.populateSelects();
      App.Controllers.Candidatos.renderGestao();
      App.Controllers.MapeIA.renderHistorico();
      App.Controllers.Upload.renderResumoInicial();
      App.Controllers.Portal.prepararPortal();
      App.Controllers.Parecer.populateSelects();
      App.Controllers.Feedback.populateSelects();
      App.Controllers.Retorno.populateSelects();
      App.Controllers.Diversidade.render();
      App.Controllers.Dashboard.render();
      App.Utils.atualizarSLAVisual();
    },

    async loadVagas() {
      if (App.State.useSupabase) {
        const { data, error } = await supabaseClient
          .from("vagas")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao carregar vagas:", error);
          App.State.vagas = [];
          return;
        }

        App.State.vagas = data || [];
        return;
      }

      App.State.vagas = App.Utils.storageGet(STORAGE_KEYS.vagas);
    },

    async loadCandidatos() {
      if (App.State.useSupabase) {
        let result = await supabaseClient
          .from("candidatos")
          .select("*, vagas(id, nome, status, localizacao, modalidade)")
          .order("created_at", { ascending: false });

        if (result.error) {
          console.warn("Consulta com relacionamento de vagas falhou. Tentando sem relacionamento:", result.error);
          result = await supabaseClient
            .from("candidatos")
            .select("*")
            .order("created_at", { ascending: false });
        }

        if (result.error) {
          console.error("Erro ao carregar candidatos:", result.error);
          App.State.candidatos = [];
          return;
        }

        const candidatos = result.data || [];
        App.State.candidatos = candidatos.map(candidato => {
          const vagaLocal = App.State.vagas.find(v => v.id === candidato.vaga_id) || null;
          return { ...candidato, vagas: candidato.vagas || vagaLocal };
        });
        return;
      }

      const candidatos = App.Utils.storageGet(STORAGE_KEYS.candidatos);
      App.State.candidatos = candidatos.map(candidato => ({
        ...candidato,
        vagas: App.State.vagas.find(vaga => vaga.id === candidato.vaga_id) || null
      }));
    },

    async loadMapeamentos() {
      if (App.State.useSupabase) {
        const { data, error } = await supabaseClient
          .from("mapeamentos")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao carregar mapeamentos:", error);
          App.State.mapeamentos = [];
          return;
        }

        App.State.mapeamentos = data || [];
        return;
      }

      App.State.mapeamentos = App.Utils.storageGet(STORAGE_KEYS.mapeamentos);
    },

    async insert(table, record) {
      if (App.State.useSupabase) {
        const { data, error } = await supabaseClient.from(table).insert([record]).select().single();
        if (error) throw error;
        return data;
      }
      const key = STORAGE_KEYS[table];
      const items = App.Utils.storageGet(key);
      const newRecord = { ...record, id: record.id || App.Utils.uuid(table), created_at: new Date().toISOString() };
      items.unshift(newRecord);
      App.Utils.storageSet(key, items);
      return newRecord;
    },

    async update(table, id, record) {
      if (App.State.useSupabase) {
        const { data, error } = await supabaseClient.from(table).update(record).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }
      const key = STORAGE_KEYS[table];
      const items = App.Utils.storageGet(key);
      const updated = items.map(item => item.id === id ? { ...item, ...record, updated_at: new Date().toISOString() } : item);
      App.Utils.storageSet(key, updated);
      return updated.find(item => item.id === id);
    },

    async delete(table, id) {
      if (App.State.useSupabase) {
        const { error } = await supabaseClient.from(table).delete().eq("id", id);
        if (error) throw error;
        return;
      }
      const key = STORAGE_KEYS[table];
      const items = App.Utils.storageGet(key).filter(item => item.id !== id);
      App.Utils.storageSet(key, items);
    }
  },

  Controllers: {}
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  const loginBtn = document.getElementById("authLoginBtn");
  if (loginBtn) loginBtn.addEventListener("click", login);

  const portalBtn = document.getElementById("pc_enviar");
  if (portalBtn) portalBtn.addEventListener("click", () => App.Controllers.Portal.enviar());

  const dataVaga = document.getElementById("v_data");
  if (dataVaga) dataVaga.addEventListener("change", App.Utils.atualizarSLAVisual);

  const cVaga = document.getElementById("c_vaga");
  if (cVaga) {
    cVaga.addEventListener("change", () => {
      const vagaId = App.Utils.value("c_vaga");
      if (vagaId === BANCO_TALENTOS_ID) {
        App.Utils.setValue("c_cliente", "Banco de Talentos");
        return;
      }
      const vaga = App.State.vagas.find(v => v.id === vagaId);
      if (vaga && !App.Utils.value("c_cliente")) App.Utils.setValue("c_cliente", App.Utils.getVagaCliente(vaga));
    });
  }

  const pcVaga = document.getElementById("pc_vaga");
  if (pcVaga) {
    pcVaga.addEventListener("change", () => {
      const vagaId = App.Utils.value("pc_vaga");
      if (vagaId === BANCO_TALENTOS_ID) {
        App.Utils.setValue("pc_empresa", "Banco de Talentos");
        return;
      }
      const vaga = App.State.vagas.find(v => v.id === vagaId);
      if (vaga) App.Utils.setValue("pc_empresa", App.Utils.getVagaCliente(vaga));
    });
  }

  if (App.State.useSupabase) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) await bootUser();
    else showAuth();
  } else {
    App.State.user = { id: "local-admin", email: "modo-local@talentos.plus" };
    App.State.profile = { id: "local-admin", email: "modo-local@talentos.plus", tipo: "admin" };
    showApp();
    applyAccess("admin");
    await App.Data.refreshAll();
    showPage("mapeia", document.querySelector('[data-page="mapeia"]'));
  }
});

async function login() {
  const email = App.Utils.value("authEmail").trim();
  const password = App.Utils.value("authPassword").trim();
  const errorBox = document.getElementById("authError");
  if (errorBox) errorBox.innerText = "";
  if (!email || !password) {
    if (errorBox) errorBox.innerText = "Preencha email e senha.";
    return;
  }
  if (!App.State.useSupabase) {
    App.State.user = { id: "local-admin", email };
    App.State.profile = { id: "local-admin", email, tipo: "admin" };
    showApp();
    applyAccess("admin");
    await App.Data.refreshAll();
    showPage("mapeia", document.querySelector('[data-page="mapeia"]'));
    return;
  }
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    if (errorBox) errorBox.innerText = "Erro no login: " + error.message;
    return;
  }
  await bootUser();
}

async function logout() {
  if (App.State.useSupabase) await supabaseClient.auth.signOut();
  location.reload();
}

async function bootUser() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) {
    showAuth();
    return;
  }
  App.State.user = userData.user;
  let { data: profile, error: profileError } = await supabaseClient.from("profiles").select("*").eq("id", App.State.user.id).maybeSingle();
  if (profileError) {
    console.error("Erro ao carregar perfil:", profileError);
    showAuth();
    return;
  }
  if (!profile) {
    const { error: insertProfileError } = await supabaseClient.from("profiles").insert([{ id: App.State.user.id, email: App.State.user.email, tipo: "candidato" }]);
    if (insertProfileError) {
      console.error("Erro ao criar perfil:", insertProfileError);
      showAuth();
      return;
    }
    profile = { id: App.State.user.id, email: App.State.user.email, tipo: "candidato" };
  }
  App.State.profile = profile;
  showApp();
  applyAccess(profile.tipo);
  await App.Data.refreshAll();
  if (profile.tipo === "candidato") {
    showPage("portalCandidato", document.querySelector('[data-page="portalCandidato"]'));
    await App.Controllers.Portal.carregarMeuCadastro();
  } else {
    showPage("mapeia", document.querySelector('[data-page="mapeia"]'));
  }
}

function showAuth() {
  document.getElementById("authScreen")?.classList.remove("hidden");
  document.getElementById("appShell")?.classList.add("hidden");
}

function showApp() {
  document.getElementById("authScreen")?.classList.add("hidden");
  document.getElementById("appShell")?.classList.remove("hidden");
  const badge = document.getElementById("authUserBadge");
  if (badge && App.State.user) badge.innerText = `${App.State.profile?.tipo || ""} | ${App.State.user.email}`;
}

function applyAccess(tipo) {
  const isAdmin = tipo === "admin";
  document.querySelectorAll(".admin-only").forEach(btn => { btn.style.display = isAdmin ? "block" : "none"; });
  document.body.classList.toggle("auth-candidato", !isAdmin);
}

function showPage(id, btn) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  const selectedPage = document.getElementById(id);
  if (selectedPage) selectedPage.classList.add("active");
  document.querySelectorAll(".menu-btn").forEach(button => button.classList.remove("active"));
  if (btn) btn.classList.add("active");
  if (id === "gestaoVagas") App.Controllers.Vagas.renderGestao();
  if (id === "gestaoCandidatos") App.Controllers.Candidatos.renderGestao();
  if (id === "portalCandidato") App.Controllers.Portal.carregarMeuCadastro();
  if (id === "parecer") App.Controllers.Parecer.populateSelects();
  if (id === "feedback") App.Controllers.Feedback.populateSelects();
  if (id === "retornoCliente") App.Controllers.Retorno.populateSelects();
  if (id === "diversidade") App.Controllers.Diversidade.render();
  if (id === "dashboard") App.Controllers.Dashboard.render();
}

// ============================================================
// MAPEIA - MANTIDO
// ============================================================

App.Controllers.MapeIA = {
  estimarSalario(vaga, senioridade, localizacao) {
    const texto = App.Utils.normalizeText(`${vaga} ${senioridade} ${localizacao}`);
    let min = 2500;
    let max = 4000;
    if (texto.includes("assistente") || texto.includes("auxiliar")) { min = 1800; max = 3200; }
    if (texto.includes("analista") && texto.includes("junior")) { min = 3000; max = 4500; }
    if (texto.includes("analista") && texto.includes("pleno")) { min = 4500; max = 7000; }
    if (texto.includes("analista") && texto.includes("senior")) { min = 6500; max = 9500; }
    if (texto.includes("especialista")) { min = 8000; max = 13000; }
    if (texto.includes("coord")) { min = 9000; max = 15000; }
    if (texto.includes("ger")) { min = 14000; max = 25000; }
    if (texto.includes("sao paulo") || texto.includes("sp") || texto.includes("vila olimpia")) { min = Math.round(min * 1.15); max = Math.round(max * 1.2); }
    return `R$ ${min.toLocaleString("pt-BR")} a R$ ${max.toLocaleString("pt-BR")}`;
  },

  calcularDificuldade(salario, idioma, requisito, pcd, descricao) {
    let pontos = 0;
    const texto = App.Utils.normalizeText(`${idioma} ${requisito} ${pcd} ${descricao}`);
    if (texto.includes("ingles")) pontos++;
    if (texto.includes("excel avancado") || texto.includes("power bi") || texto.includes("sap")) pontos++;
    if (texto.includes("obrigatorio") || texto.includes("imprescindivel")) pontos++;
    if (texto.includes("presencial")) pontos++;
    if (pcd === "Sim") pontos++;
    if (Number(salario) && Number(salario) < 4000) pontos++;
    if (pontos >= 4) return "Alta";
    if (pontos >= 2) return "Média";
    return "Baixa";
  },

  gerar() {
    const cliente = App.Utils.value("m_cliente");
    const vaga = App.Utils.value("m_vaga");
    const senioridade = App.Utils.value("m_senioridade");
    const salario = App.Utils.value("m_salario");
    const localizacao = App.Utils.value("m_localizacao");
    const idioma = App.Utils.value("m_idioma");
    const requisito = App.Utils.value("m_requisito");
    const pcd = App.Utils.value("m_pcd");
    const descricao = App.Utils.value("m_descricao");
    const salarioMercado = this.estimarSalario(vaga, senioridade, localizacao);
    const dificuldade = this.calcularDificuldade(salario, idioma, requisito, pcd, descricao);
    const analise = `Resumo executivo:\nA vaga ${vaga || "não informada"} para o cliente ${cliente || "não informado"} apresenta senioridade ${senioridade || "não informada"} e localização ${localizacao || "não informada"}.\n\nInteligência salarial:\nSalário informado: ${salario ? App.Utils.money(salario) : "não informado"}.\nReferência estimada de mercado: ${salarioMercado}.\n\nDificuldade de contratação:\n${dificuldade}.\n\nAnálise consultiva:\nA posição deve ser avaliada considerando o alinhamento entre escopo, salário, senioridade, requisitos técnicos e contexto de vaga PcD. Caso a remuneração esteja abaixo da faixa de mercado ou os requisitos estejam muito elevados, há risco de baixa conversão, alongamento de SLA e perda de candidatos aderentes.\n\nPontos de atenção:\n- Aderência entre salário e senioridade;\n- Exigência técnica versus mercado disponível;\n- Localização, modelo de trabalho e impacto na conversão;\n- Possíveis barreiras para profissionais com deficiência;\n- Flexibilizações que podem ampliar a base qualificada.\n\nRecomendação:\nValidar requisitos obrigatórios, flexibilizações possíveis e atratividade da proposta antes de intensificar a busca.`;
    App.Utils.setValue("m_resultado", analise);
  },

  async salvar() {
    const vaga = App.Utils.value("m_vaga");
    if (!vaga) return alert("Informe o nome da vaga para salvar o mapeamento.");
    if (!App.Utils.value("m_resultado")) this.gerar();
    const salarioMercado = this.estimarSalario(vaga, App.Utils.value("m_senioridade"), App.Utils.value("m_localizacao"));
    const dificuldade = this.calcularDificuldade(App.Utils.value("m_salario"), App.Utils.value("m_idioma"), App.Utils.value("m_requisito"), App.Utils.value("m_pcd"), App.Utils.value("m_descricao"));
    const dados = {
      cliente: App.Utils.value("m_cliente"), vaga, cargo: vaga, senioridade: App.Utils.value("m_senioridade"),
      salario_oferecido: App.Utils.value("m_salario") ? Number(App.Utils.value("m_salario")) : null,
      localizacao: App.Utils.value("m_localizacao"), idioma: App.Utils.value("m_idioma"), requisito: App.Utils.value("m_requisito"),
      pcd: App.Utils.value("m_pcd"), descricao: App.Utils.value("m_descricao"), salario_mercado: salarioMercado, dificuldade,
      analise: App.Utils.value("m_resultado")
    };
    try { await App.Data.insert("mapeamentos", dados); alert("Mapeamento salvo!"); await App.Data.refreshAll(); }
    catch (error) { alert("Erro ao salvar mapeamento: " + error.message); }
  },

  limpar() {
    ["m_cliente", "m_vaga", "m_senioridade", "m_salario", "m_localizacao", "m_idioma", "m_requisito", "m_pcd", "m_descricao", "m_resultado"].forEach(id => App.Utils.setValue(id, ""));
  },

  renderHistorico() {
    const cliente = App.Utils.normalizeText(App.Utils.value("mh_busca_cliente"));
    const vaga = App.Utils.normalizeText(App.Utils.value("mh_busca_vaga"));
    const list = document.getElementById("listaMapeamentos");
    if (!list) return;
    const items = App.State.mapeamentos.filter(m => {
      const c = App.Utils.normalizeText(m.cliente || "");
      const v = App.Utils.normalizeText(m.vaga || m.cargo || "");
      return (!cliente || c.includes(cliente)) && (!vaga || v.includes(vaga));
    });
    if (!items.length) {
      list.innerHTML = `<div class="card-item"><div class="card-text">Nenhum mapeamento salvo ainda.</div></div>`;
      return;
    }
    list.innerHTML = items.map(m => `<div class="card-item"><div class="card-title">${App.Utils.safe(m.vaga || m.cargo)}</div><div class="card-text">Cliente: ${App.Utils.safe(m.cliente || "Não informado")}<br>Senioridade: ${App.Utils.safe(m.senioridade || "Não informado")}<br>Mercado: ${App.Utils.safe(m.salario_mercado || "-")}<br>Dificuldade: ${App.Utils.safe(m.dificuldade || "-")}</div><div class="card-actions"><button class="action-mini" type="button" onclick="App.Controllers.MapeIA.carregar('${m.id}')">Carregar</button><button class="action-mini" type="button" onclick="App.Controllers.MapeIA.excluir('${m.id}')">Excluir</button></div></div>`).join("");
  },

  carregar(id) {
    const m = App.State.mapeamentos.find(item => item.id === id);
    if (!m) return;
    App.Utils.setValue("m_cliente", m.cliente); App.Utils.setValue("m_vaga", m.vaga || m.cargo); App.Utils.setValue("m_senioridade", m.senioridade);
    App.Utils.setValue("m_salario", m.salario_oferecido || m.salario); App.Utils.setValue("m_localizacao", m.localizacao); App.Utils.setValue("m_idioma", m.idioma);
    App.Utils.setValue("m_requisito", m.requisito); App.Utils.setValue("m_pcd", m.pcd); App.Utils.setValue("m_descricao", m.descricao); App.Utils.setValue("m_resultado", m.analise);
  },

  async excluir(id) {
    if (!confirm("Excluir este mapeamento?")) return;
    try { await App.Data.delete("mapeamentos", id); await App.Data.refreshAll(); }
    catch (error) { alert("Erro ao excluir mapeamento: " + error.message); }
  }
};

// ============================================================
// VAGAS
// ============================================================

App.Controllers.Vagas = {
  montarDadosVaga(clienteFieldName = "cliente") {
    const prazoSla = App.Utils.calcularSLA14DiasUteis(App.Utils.value("v_data"));
    const dados = {
      nome: App.Utils.value("v_nome").trim(), data_abertura: App.Utils.value("v_data") || null,
      senioridade: App.Utils.value("v_senioridade"), salario: App.Utils.value("v_salario") ? Number(App.Utils.value("v_salario")) : null,
      localizacao: App.Utils.value("v_localizacao"), modalidade: App.Utils.value("v_modalidade") || App.Utils.value("v_modelo") || App.Utils.value("v_tipo_trabalho"),
      tipo: App.Utils.value("v_tipo"), classificacao: App.Utils.value("v_classificacao"), status: App.Utils.value("v_status") || "Aberta",
      gestor: App.Utils.value("v_gestor"), idioma: App.Utils.value("v_idioma"), requisito: App.Utils.value("v_requisito"), descricao: App.Utils.value("v_descricao"), prazo_sla: prazoSla || null
    };
    dados[clienteFieldName] = App.Utils.value("v_cliente").trim();
    return dados;
  },

  async salvar() {
    const id = App.Utils.value("v_id");
    const nome = App.Utils.value("v_nome").trim();
    const cliente = App.Utils.value("v_cliente").trim();
    if (!cliente) return alert("Informe a empresa/cliente.");
    if (!nome) return alert("Informe o cargo/vaga.");
    const tentativasCliente = ["cliente", "empresa", "cliente_nome", "empresa_nome", "nome_cliente"];
    let ultimoErro = null;
    for (const campoCliente of tentativasCliente) {
      const dados = this.montarDadosVaga(campoCliente);
      try {
        if (id) await App.Data.update("vagas", id, dados);
        else await App.Data.insert("vagas", dados);
        alert("Vaga salva com sucesso!");
        this.limparFormulario();
        await App.Data.refreshAll();
        showPage("gestaoVagas", document.querySelector('[data-page="gestaoVagas"]'));
        return;
      } catch (error) {
        ultimoErro = error;
        if (!App.Utils.isUnknownColumnError(error)) break;
      }
    }
    alert("Erro ao salvar vaga: " + (ultimoErro?.message || "erro desconhecido"));
  },

  limparFormulario() {
    ["v_id", "v_cliente", "v_nome", "v_data", "v_senioridade", "v_salario", "v_localizacao", "v_modalidade", "v_modelo", "v_tipo_trabalho", "v_tipo", "v_classificacao", "v_status", "v_gestor", "v_idioma", "v_requisito", "v_pcd", "v_descricao"].forEach(id => App.Utils.setValue(id, ""));
    App.Utils.text("v_sla_view", "Prazo SLA: —");
  },

  editar(id) {
    const vaga = App.State.vagas.find(item => item.id === id);
    if (!vaga) return;
    App.Utils.setValue("v_id", vaga.id); App.Utils.setValue("v_cliente", App.Utils.getVagaCliente(vaga)); App.Utils.setValue("v_nome", App.Utils.getVagaNome(vaga));
    App.Utils.setValue("v_data", vaga.data_abertura); App.Utils.setValue("v_senioridade", vaga.senioridade); App.Utils.setValue("v_salario", vaga.salario);
    App.Utils.setValue("v_localizacao", vaga.localizacao); App.Utils.setValue("v_modalidade", vaga.modalidade); App.Utils.setValue("v_tipo", vaga.tipo);
    App.Utils.setValue("v_classificacao", vaga.classificacao); App.Utils.setValue("v_status", vaga.status); App.Utils.setValue("v_gestor", vaga.gestor);
    App.Utils.setValue("v_idioma", vaga.idioma); App.Utils.setValue("v_requisito", vaga.requisito); App.Utils.setValue("v_pcd", vaga.pcd); App.Utils.setValue("v_descricao", vaga.descricao);
    App.Utils.atualizarSLAVisual();
    showPage("cadastroVagas", document.querySelector('[data-page="cadastroVagas"]'));
  },

  async excluir(id) {
    if (!confirm("Tem certeza que deseja excluir esta vaga?")) return;
    try { await App.Data.delete("vagas", id); await App.Data.refreshAll(); }
    catch (error) { alert("Erro ao excluir vaga: " + error.message); }
  },

  populateSelects() {
    const vagaSelects = ["c_vaga", "gc_vaga", "f_vaga", "p_vaga", "r_vaga", "pc_vaga", "gv_filtro_nome"];
    vagaSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const atual = el.value;
      const labelInicial = id === "gv_filtro_nome" || id === "gc_vaga" ? "Todas" : "Selecione";
      let options = `<option value="">${labelInicial}</option>`;
      if (["c_vaga", "pc_vaga"].includes(id)) options += App.Utils.option(BANCO_TALENTOS_ID, "Banco de Talentos");
      options += App.State.vagas.map(vaga => {
        const nome = App.Utils.getVagaNome(vaga) || "Vaga sem nome";
        const cliente = App.Utils.getVagaCliente(vaga);
        const local = vaga.localizacao ? ` | ${vaga.localizacao}` : "";
        const modalidade = vaga.modalidade ? ` | ${vaga.modalidade}` : "";
        const status = vaga.status ? ` - ${vaga.status}` : "";
        return App.Utils.option(vaga.id, `${nome}${cliente ? " | " + cliente : ""}${local}${modalidade}${status}`);
      }).join("");
      el.innerHTML = options;
      el.value = atual;
    });
    const clienteSelects = ["gv_filtro_cliente", "gc_cliente", "r_cliente"];
    clienteSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const atual = el.value;
      const clientes = App.Utils.unique(App.State.vagas.map(vaga => App.Utils.getVagaCliente(vaga)).concat(App.State.candidatos.map(candidato => App.Utils.getCandidatoCliente(candidato))));
      el.innerHTML = `<option value="">Todos</option>` + clientes.map(cliente => App.Utils.option(cliente, cliente)).join("");
      el.value = atual;
    });
  },

  renderGestao() {
    const list = document.getElementById("listaGestaoVagas");
    if (!list) return;
    const cliente = App.Utils.value("gv_filtro_cliente");
    const status = App.Utils.value("gv_filtro_status");
    const vagaId = App.Utils.value("gv_filtro_nome");
    const vagas = App.State.vagas.filter(vaga => (!cliente || App.Utils.getVagaCliente(vaga) === cliente) && (!status || vaga.status === status) && (!vagaId || vaga.id === vagaId));
    App.Utils.text("gv_kpi_ativas", App.State.vagas.filter(v => ["Aberta", "Em andamento", "Reaberta"].includes(v.status)).length);
    App.Utils.text("gv_kpi_fechadas", App.State.vagas.filter(v => v.status === "Fechada").length);
    App.Utils.text("gv_kpi_canceladas", App.State.vagas.filter(v => v.status === "Cancelada").length);
    if (!vagas.length) { list.innerHTML = `<div class="card-item"><div class="card-text">Nenhuma vaga encontrada.</div></div>`; return; }
    list.innerHTML = vagas.map(vaga => {
      const prazoSla = vaga.prazo_sla || App.Utils.calcularSLA14DiasUteis(vaga.data_abertura);
      return `<div class="card-item"><div class="card-title">${App.Utils.safe(App.Utils.getVagaNome(vaga))}</div><div class="card-text">Cliente: ${App.Utils.safe(App.Utils.getVagaCliente(vaga) || "-")}<br>Status: ${App.Utils.safe(vaga.status || "-")}<br>Senioridade: ${App.Utils.safe(vaga.senioridade || "-")}<br>Localização: ${App.Utils.safe(vaga.localizacao || "-")}<br>Modalidade: ${App.Utils.safe(vaga.modalidade || "-")}<br>Salário: ${vaga.salario ? App.Utils.money(vaga.salario) : "-"}<br>Classificação: ${App.Utils.safe(vaga.classificacao || "-")}<br>SLA: ${App.Utils.safe(App.Utils.formatDateBR(prazoSla))}</div><div class="card-actions"><button class="action-mini" type="button" onclick="App.Controllers.Vagas.editar('${vaga.id}')">Editar</button><button class="action-mini" type="button" onclick="App.Controllers.Vagas.excluir('${vaga.id}')">Excluir</button></div></div>`;
    }).join("");
  }
};

// ============================================================
// CANDIDATOS
// ============================================================

App.Controllers.Candidatos = {
  gerarAderencia(texto) {
    const t = App.Utils.normalizeText(texto || "");
    let score = 0;
    if (t.includes("experiencia")) score++;
    if (t.includes("comunicacao")) score++;
    if (t.includes("excel")) score++;
    if (t.includes("indicador")) score++;
    if (t.includes("hospital")) score++;
    if (t.includes("cliente")) score++;
    if (t.includes("atendimento")) score++;
    if (score >= 4) return "Alta";
    if (score >= 2) return "Média";
    return "Baixa";
  },

  gerarAnaliseIA(nome, vaga, texto) {
    const aderencia = this.gerarAderencia(texto);
    return `O candidato ${nome} apresenta aderência ${aderencia} para a vaga de ${vaga || "vaga não informada"}. A análise considera experiência profissional, competências técnicas, competências comportamentais, contexto profissional e informações de acessibilidade. Recomenda-se validar com o gestor a profundidade técnica, exemplos práticos e alinhamento com o contexto da posição.`;
  },

  async uploadArquivo(inputId, tipoArquivo) {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];
    if (!file) return null;
    if (!App.State.useSupabase) return { path: `local/${Date.now()}-${tipoArquivo}-${file.name}`, nome: file.name };
    const extensao = file.name.split(".").pop();
    const userId = App.State.user?.id || "admin-upload";
    const fileName = `${userId}/${Date.now()}-${tipoArquivo}.${extensao}`;
    const { error } = await supabaseClient.storage.from("laudos").upload(fileName, file, { upsert: true });
    if (error) throw error;
    return { path: fileName, nome: file.name };
  },

  getFormData(extra = {}) {
    const vagaId = App.Utils.value("c_vaga");
    const vaga = App.State.vagas.find(v => v.id === vagaId);
    const isBanco = vagaId === BANCO_TALENTOS_ID;
    const nome = App.Utils.value("c_nome").trim();
    const textoBase = [App.Utils.value("c_experiencia"), App.Utils.value("c_descricao_experiencia"), App.Utils.value("c_competencias_tecnicas"), App.Utils.value("c_competencias_comportamentais"), App.Utils.value("c_contexto"), App.Utils.value("c_objetivo"), App.Utils.value("c_deficiencia_acessibilidade"), App.Utils.value("c_recursos_adaptacoes")].join(" ");
    return {
      nome,
      data_nascimento: App.Utils.value("c_data_nascimento") || null,
      vaga_id: isBanco ? null : (vagaId || null),
      vaga_interesse: isBanco ? "Banco de Talentos" : App.Utils.getVagaNome(vaga),
      cliente: isBanco ? "Banco de Talentos" : (App.Utils.value("c_cliente") || App.Utils.getVagaCliente(vaga)),
      status: App.Utils.value("c_status") || "Triagem",
      etapa: App.Utils.value("c_status") || "Triagem",
      telefone: App.Utils.value("c_telefone"), email: App.Utils.value("c_email"), estado: App.Utils.value("c_estado"), cidade: App.Utils.value("c_cidade"),
      deficiencia: App.Utils.value("c_deficiencia"), cid: App.Utils.value("c_cid"), genero: App.Utils.value("c_genero"), raca: App.Utils.value("c_raca"), escolaridade: App.Utils.value("c_escolaridade"),
      formacao: App.Utils.value("c_formacao"), area: App.Utils.value("c_area"), reprovacao_interna: App.Utils.value("c_reprovacao_interna"), reprovacao_cliente: App.Utils.value("c_reprovacao_cliente"),
      motivo_reprovacao: App.Utils.value("c_motivo_reprovacao"), tipo_reprovacao: App.Utils.value("c_tipo_reprovacao"), experiencia: App.Utils.value("c_experiencia"),
      descricao_experiencia: App.Utils.value("c_descricao_experiencia") || App.Utils.value("c_experiencia"), competencias_tecnicas: App.Utils.value("c_competencias_tecnicas"),
      competencias_comportamentais: App.Utils.value("c_competencias_comportamentais"), contexto: App.Utils.value("c_contexto"), momento_profissional: App.Utils.value("c_contexto"),
      objetivo_profissional: App.Utils.value("c_objetivo"), deficiencia_acessibilidade: App.Utils.value("c_deficiencia_acessibilidade"), necessidade_acessibilidade: App.Utils.value("c_deficiencia_acessibilidade"),
      recursos_adaptacoes: App.Utils.value("c_recursos_adaptacoes"), origem: "Cadastro interno", aderencia: this.gerarAderencia(textoBase),
      analise_ia: this.gerarAnaliseIA(nome, isBanco ? "Banco de Talentos" : App.Utils.getVagaNome(vaga), textoBase), ...extra
    };
  },

  async salvar() {
    const id = App.Utils.value("c_id");
    let extra = {};
    try {
      const curriculo = await this.uploadArquivo("c_curriculo", "curriculo");
      const laudo = await this.uploadArquivo("c_laudo", "laudo");
      if (curriculo) { extra.curriculo_url = curriculo.path; extra.curriculo_nome = curriculo.nome; }
      if (laudo) { extra.laudo_url = laudo.path; extra.laudo_nome = laudo.nome; }
    } catch (error) { alert("Erro ao enviar documento: " + error.message); return; }
    const dados = this.getFormData(extra);
    if (!dados.nome) return alert("Informe o nome do candidato.");
    try {
      if (id) await App.Data.update("candidatos", id, dados);
      else await App.Data.insert("candidatos", dados);
      alert("Candidato salvo com sucesso!");
      this.limparFormulario();
      await App.Data.refreshAll();
      showPage("gestaoCandidatos", document.querySelector('[data-page="gestaoCandidatos"]'));
    } catch (error) { alert("Erro ao salvar candidato: " + error.message); }
  },

  limparFormulario() {
    ["c_id", "c_nome", "c_data_nascimento", "c_vaga", "c_cliente", "c_status", "c_telefone", "c_email", "c_estado", "c_cidade", "c_deficiencia", "c_cid", "c_genero", "c_raca", "c_escolaridade", "c_formacao", "c_area", "c_reprovacao_interna", "c_reprovacao_cliente", "c_tipo_reprovacao", "c_motivo_reprovacao", "c_experiencia", "c_descricao_experiencia", "c_competencias_tecnicas", "c_competencias_comportamentais", "c_contexto", "c_objetivo", "c_deficiencia_acessibilidade", "c_recursos_adaptacoes"].forEach(id => App.Utils.setValue(id, ""));
  },

  populateSelects() {
    const candidatoSelects = ["f_candidato", "p_candidato"];
    candidatoSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const atual = el.value;
      el.innerHTML = `<option value="">Selecione</option>` + App.State.candidatos.map(c => App.Utils.option(c.id, c.nome)).join("");
      el.value = atual;
    });
  },

  editar(id) {
    const c = App.State.candidatos.find(item => item.id === id);
    if (!c) return;
    App.Utils.setValue("c_id", c.id); App.Utils.setValue("c_nome", c.nome); App.Utils.setValue("c_data_nascimento", c.data_nascimento);
    App.Utils.setValue("c_vaga", c.vaga_id || (c.vaga_interesse === "Banco de Talentos" ? BANCO_TALENTOS_ID : "")); App.Utils.setValue("c_cliente", App.Utils.getCandidatoCliente(c));
    App.Utils.setValue("c_status", c.status); App.Utils.setValue("c_telefone", c.telefone); App.Utils.setValue("c_email", c.email); App.Utils.setValue("c_estado", c.estado); App.Utils.setValue("c_cidade", c.cidade);
    App.Utils.setValue("c_deficiencia", c.deficiencia); App.Utils.setValue("c_cid", c.cid); App.Utils.setValue("c_genero", c.genero); App.Utils.setValue("c_raca", c.raca); App.Utils.setValue("c_escolaridade", c.escolaridade);
    App.Utils.setValue("c_formacao", c.formacao); App.Utils.setValue("c_area", c.area); App.Utils.setValue("c_reprovacao_interna", c.reprovacao_interna); App.Utils.setValue("c_reprovacao_cliente", c.reprovacao_cliente);
    App.Utils.setValue("c_tipo_reprovacao", c.tipo_reprovacao); App.Utils.setValue("c_motivo_reprovacao", c.motivo_reprovacao); App.Utils.setValue("c_experiencia", c.experiencia);
    App.Utils.setValue("c_descricao_experiencia", c.descricao_experiencia || c.experiencia); App.Utils.setValue("c_competencias_tecnicas", c.competencias_tecnicas); App.Utils.setValue("c_competencias_comportamentais", c.competencias_comportamentais);
    App.Utils.setValue("c_contexto", c.contexto || c.momento_profissional); App.Utils.setValue("c_objetivo", c.objetivo_profissional); App.Utils.setValue("c_deficiencia_acessibilidade", c.deficiencia_acessibilidade || c.necessidade_acessibilidade);
    App.Utils.setValue("c_recursos_adaptacoes", c.recursos_adaptacoes);
    showPage("cadastroCandidatos", document.querySelector('[data-page="cadastroCandidatos"]'));
  },

  async excluir(id) {
    if (!confirm("Tem certeza que deseja excluir este candidato?")) return;
    try { await App.Data.delete("candidatos", id); await App.Data.refreshAll(); }
    catch (error) { alert("Erro ao excluir candidato: " + error.message); }
  },

  filtrarCandidatos() {
    const cliente = App.Utils.value("gc_cliente"); const vagaId = App.Utils.value("gc_vaga"); const status = App.Utils.value("gc_status"); const busca = App.Utils.normalizeText(App.Utils.value("gc_busca"));
    return App.State.candidatos.filter(c => {
      const nome = App.Utils.normalizeText(c.nome || "");
      return (!cliente || App.Utils.getCandidatoCliente(c) === cliente) && (!vagaId || c.vaga_id === vagaId) && (!status || c.status === status) && (!busca || nome.includes(busca));
    });
  },

  renderGestao() {
    const list = document.getElementById("listaGestaoCandidatos");
    if (!list) return;
    const candidatos = this.filtrarCandidatos();
    if (!candidatos.length) { list.innerHTML = `<div class="card-item"><div class="card-text">Nenhum candidato encontrado.</div></div>`; return; }
    list.innerHTML = candidatos.map(c => {
      const idade = App.Utils.idade(c.data_nascimento); const faixa = App.Utils.faixaEtaria(c.data_nascimento); const vagaNome = App.Utils.getCandidatoVagaNome(c);
      return `<div class="card-item"><div class="card-title">${App.Utils.safe(c.nome)}</div><div class="card-text">Vaga: ${App.Utils.safe(vagaNome)}<br>Cliente: ${App.Utils.safe(App.Utils.getCandidatoCliente(c) || "-")}<br>Status: ${App.Utils.safe(c.status || "-")}<br>Idade: ${idade !== null ? idade + " anos" : "Não informado"}<br>Faixa etária: ${App.Utils.safe(faixa)}<br>Escolaridade: ${App.Utils.safe(c.escolaridade || "-")}<br>Gênero: ${App.Utils.safe(c.genero || "-")}<br>Raça/cor: ${App.Utils.safe(c.raca || "-")}<br>Aderência: <strong>${App.Utils.safe(c.aderencia || "-")}</strong><br>Telefone: ${App.Utils.safe(c.telefone || "-")}<br>Email: ${App.Utils.safe(c.email || "-")}<br>Deficiência: ${App.Utils.safe(c.deficiencia || "-")}<br>Reprovação interna: ${App.Utils.safe(c.reprovacao_interna || "-")}<br>Reprovação cliente: ${App.Utils.safe(c.reprovacao_cliente || "-")}<br>Motivo reprovação/perda: ${App.Utils.safe(c.motivo_reprovacao || "-")}<br>Currículo: ${App.Utils.safe(c.curriculo_nome || (c.curriculo_url ? "Enviado" : "Não enviado"))}<br>Laudo: ${App.Utils.safe(c.laudo_nome || (c.laudo_url ? "Enviado" : "Não enviado"))}<br><br><strong>Análise IA:</strong><br>${App.Utils.safe(c.analise_ia || "-")}</div><div class="card-actions"><button class="action-mini" type="button" onclick="App.Controllers.Candidatos.editar('${c.id}')">Editar</button><button class="action-mini" type="button" onclick="App.Controllers.Candidatos.excluir('${c.id}')">Excluir</button></div></div>`;
    }).join("");
  }
};

// ============================================================
// UPLOAD CSV
// ============================================================

App.Controllers.Upload = {
  renderResumoInicial() {
    const box = document.getElementById("uploadResumo");
    if (box && !box.innerText) box.innerText = "Nenhuma importação realizada ainda.";
  },

  baixarModeloCSV() {
    const csv = ["nome", "data_nascimento", "email", "telefone", "estado", "cidade", "deficiencia", "genero", "raca", "escolaridade", "formacao", "area", "status", "reprovacao_interna", "reprovacao_cliente", "motivo_reprovacao"].join(",") + "\n";
    App.Utils.download("modelo_candidatos.csv", csv, "text/csv;charset=utf-8");
  },

  importarCSV() {
    const file = document.getElementById("csvFile")?.files?.[0]; const box = document.getElementById("uploadResumo");
    if (!file) { if (box) box.innerText = "Selecione um arquivo CSV."; return; }
    const reader = new FileReader();
    reader.onload = async event => {
      const linhas = event.target.result.split(/\r?\n/).filter(Boolean);
      if (!linhas.length) { if (box) box.innerText = "Arquivo vazio."; return; }
      const headers = linhas.shift().split(",").map(h => h.trim());
      const registros = linhas.map(linha => {
        const colunas = linha.split(","); const obj = {}; headers.forEach((h, i) => obj[h] = colunas[i] || ""); const textoBase = Object.values(obj).join(" ");
        return { nome: obj.nome, data_nascimento: obj.data_nascimento || null, email: obj.email, telefone: obj.telefone, estado: obj.estado, cidade: obj.cidade, deficiencia: obj.deficiencia, genero: obj.genero, raca: obj.raca, escolaridade: obj.escolaridade, formacao: obj.formacao, area: obj.area, status: obj.status || "Triagem", etapa: obj.status || "Triagem", reprovacao_interna: obj.reprovacao_interna, reprovacao_cliente: obj.reprovacao_cliente, motivo_reprovacao: obj.motivo_reprovacao, origem: "Upload CSV", aderencia: App.Controllers.Candidatos.gerarAderencia(textoBase), analise_ia: App.Controllers.Candidatos.gerarAnaliseIA(obj.nome, "", textoBase) };
      });
      try { for (const registro of registros) await App.Data.insert("candidatos", registro); if (box) box.innerText = `${registros.length} candidatos importados com sucesso.`; await App.Data.refreshAll(); }
      catch (error) { if (box) box.innerText = "Erro ao importar: " + error.message; }
    };
    reader.readAsText(file, "UTF-8");
  }
};

// ============================================================
// PORTAL DO CANDIDATO
// ============================================================

App.Controllers.Portal = {
  prepararPortal() {
    App.Controllers.Vagas.populateSelects();
    if (App.State.user?.email) App.Utils.setValue("pc_email", App.State.user.email);
    this.renderVagasDisponiveis();
  },

  renderVagasDisponiveis() {
    const container = document.getElementById("pc_vagas_disponiveis");
    if (!container) return;
    const vagas = App.State.vagas.filter(v => !v.status || ["Aberta", "Em andamento", "Reaberta"].includes(v.status));
    let html = `<div class="card-item"><div class="card-title">Banco de Talentos</div><div class="card-text">Cadastre-se para futuras oportunidades aderentes ao seu perfil.</div><div class="card-actions"><button class="action-mini" type="button" onclick="App.Utils.setValue('pc_vaga','${BANCO_TALENTOS_ID}')">Selecionar</button></div></div>`;
    html += vagas.map(v => `<div class="card-item"><div class="card-title">${App.Utils.safe(App.Utils.getVagaNome(v))}</div><div class="card-text">Localidade: ${App.Utils.safe(v.localizacao || "Não informada")}<br>Modalidade: ${App.Utils.safe(v.modalidade || "Não informada")}<br>Status: ${App.Utils.safe(v.status || "Não informado")}</div><div class="card-actions"><button class="action-mini" type="button" onclick="App.Utils.setValue('pc_vaga','${v.id}')">Candidatar-se</button></div></div>`).join("");
    container.innerHTML = html;
  },

  async carregarMeuCadastro() {
    if (!App.State.user) return;
    App.Controllers.Vagas.populateSelects();
    this.renderVagasDisponiveis();
    if (App.State.user.email) App.Utils.setValue("pc_email", App.State.user.email);
    let data = null;
    if (App.State.useSupabase) {
      let result = await supabaseClient.from("candidatos").select("*, vagas(id, nome, status, localizacao, modalidade)").eq("user_id", App.State.user.id).maybeSingle();
      if (result.error) result = await supabaseClient.from("candidatos").select("*").eq("user_id", App.State.user.id).maybeSingle();
      if (result.error) { console.error("Erro ao carregar cadastro:", result.error); App.Utils.html("pc_resultado", `<span class="resultado-error">Não foi possível carregar seu cadastro agora.</span>`); return; }
      data = result.data;
    } else data = App.State.candidatos.find(c => c.user_id === App.State.user.id) || null;
    if (data) {
      App.Utils.setValue("pc_nome", data.nome); App.Utils.setValue("pc_email", data.email || App.State.user.email); App.Utils.setValue("pc_telefone", data.telefone); App.Utils.setValue("pc_data_nascimento", data.data_nascimento);
      App.Utils.setValue("pc_estado", data.estado); App.Utils.setValue("pc_cidade", data.cidade); App.Utils.setValue("pc_escolaridade", data.escolaridade); App.Utils.setValue("pc_genero", data.genero); App.Utils.setValue("pc_raca", data.raca);
      App.Utils.setValue("pc_vaga", data.vaga_id || (data.vaga_interesse === "Banco de Talentos" ? BANCO_TALENTOS_ID : "")); App.Utils.setValue("pc_empresa", App.Utils.getCandidatoCliente(data));
      App.Utils.setValue("pc_experiencia", data.experiencia); App.Utils.setValue("pc_descricao_experiencia", data.descricao_experiencia || data.experiencia); App.Utils.setValue("pc_competencias_tecnicas", data.competencias_tecnicas);
      App.Utils.setValue("pc_competencias_comportamentais", data.competencias_comportamentais); App.Utils.setValue("pc_contexto", data.contexto || data.momento_profissional); App.Utils.setValue("pc_objetivo", data.objetivo_profissional);
      App.Utils.setValue("pc_deficiencia", data.deficiencia); App.Utils.setValue("pc_deficiencia_acessibilidade", data.deficiencia_acessibilidade || data.necessidade_acessibilidade); App.Utils.setValue("pc_recursos_adaptacoes", data.recursos_adaptacoes);
      const vagaNome = data.vaga_interesse || App.Utils.getVagaNome(data.vagas) || "Não selecionada"; const vagaStatus = data.vagas?.status || data.status || "Novo";
      App.Utils.html("pc_resultado", `<span class="resultado-success">Cadastro carregado.</span><br>Vaga: ${App.Utils.safe(vagaNome)}<br>Status: ${App.Utils.safe(vagaStatus)}<br>Currículo: ${data.curriculo_url || data.curriculo_nome ? "Enviado" : "Não enviado"}<br>Laudo: ${data.laudo_url || data.laudo_nome ? "Enviado" : "Não enviado"}`);
    }
  },

  async uploadArquivo(inputId, tipoArquivo) {
    const input = document.getElementById(inputId); const file = input?.files?.[0]; if (!file) return null;
    if (!App.State.useSupabase) return { path: `local/${Date.now()}-${tipoArquivo}-${file.name}`, nome: file.name };
    const extensao = file.name.split(".").pop(); const fileName = `${App.State.user.id}/${Date.now()}-${tipoArquivo}.${extensao}`;
    const { error } = await supabaseClient.storage.from("laudos").upload(fileName, file, { upsert: true }); if (error) throw error;
    return { path: fileName, nome: file.name };
  },

  async enviar() {
    if (!App.State.user) return alert("Faça login novamente.");
    const nome = App.Utils.value("pc_nome").trim(); const email = App.Utils.value("pc_email").trim(); const telefone = App.Utils.value("pc_telefone").trim(); const vagaId = App.Utils.value("pc_vaga");
    if (!nome || !email || !telefone || !vagaId) { App.Utils.html("pc_resultado", `<span class="resultado-error">Preencha nome, email, telefone e vaga.</span>`); return; }
    const isBanco = vagaId === BANCO_TALENTOS_ID; const vaga = App.State.vagas.find(v => v.id === vagaId);
    let curriculo = null; let laudo = null;
    try { curriculo = await this.uploadArquivo("pc_curriculo", "curriculo"); laudo = await this.uploadArquivo("pc_laudo", "laudo"); }
    catch (error) { App.Utils.html("pc_resultado", `<span class="resultado-error">Erro ao enviar documento: ${error.message}</span>`); return; }
    const experiencia = App.Utils.value("pc_experiencia"); const descricaoExperiencia = App.Utils.value("pc_descricao_experiencia") || experiencia; const competenciasTecnicas = App.Utils.value("pc_competencias_tecnicas"); const competenciasComportamentais = App.Utils.value("pc_competencias_comportamentais"); const contexto = App.Utils.value("pc_contexto"); const objetivo = App.Utils.value("pc_objetivo"); const acessibilidade = App.Utils.value("pc_deficiencia_acessibilidade"); const recursos = App.Utils.value("pc_recursos_adaptacoes");
    const textoBase = [experiencia, descricaoExperiencia, competenciasTecnicas, competenciasComportamentais, contexto, objetivo, acessibilidade, recursos].join(" ");
    const dados = {
      user_id: App.State.user.id, nome, email, telefone, data_nascimento: App.Utils.value("pc_data_nascimento") || null, estado: App.Utils.value("pc_estado"), cidade: App.Utils.value("pc_cidade"), escolaridade: App.Utils.value("pc_escolaridade"), genero: App.Utils.value("pc_genero"), raca: App.Utils.value("pc_raca"),
      vaga_id: isBanco ? null : vagaId, vaga_interesse: isBanco ? "Banco de Talentos" : App.Utils.getVagaNome(vaga), cliente: isBanco ? "Banco de Talentos" : App.Utils.getVagaCliente(vaga), status: "Triagem", etapa: "Triagem", origem: "Portal do candidato", experiencia, descricao_experiencia: descricaoExperiencia, competencias_tecnicas: competenciasTecnicas, competencias_comportamentais: competenciasComportamentais, contexto, momento_profissional: contexto, objetivo_profissional: objetivo, deficiencia: App.Utils.value("pc_deficiencia"), deficiencia_acessibilidade: acessibilidade, necessidade_acessibilidade: acessibilidade, recursos_adaptacoes: recursos, aderencia: App.Controllers.Candidatos.gerarAderencia(textoBase), analise_ia: App.Controllers.Candidatos.gerarAnaliseIA(nome, isBanco ? "Banco de Talentos" : App.Utils.getVagaNome(vaga), textoBase)
    };
    if (curriculo) { dados.curriculo_url = curriculo.path; dados.curriculo_nome = curriculo.nome; }
    if (laudo) { dados.laudo_url = laudo.path; dados.laudo_nome = laudo.nome; }
    try {
      let existente = null;
      if (App.State.useSupabase) { const result = await supabaseClient.from("candidatos").select("id").eq("user_id", App.State.user.id).maybeSingle(); if (result.error) throw result.error; existente = result.data; }
      else existente = App.State.candidatos.find(c => c.user_id === App.State.user.id);
      if (existente) await App.Data.update("candidatos", existente.id, dados); else await App.Data.insert("candidatos", dados);
      App.Utils.html("pc_resultado", `<span class="resultado-success">Cadastro enviado com sucesso!</span>`); await App.Data.refreshAll(); await this.carregarMeuCadastro();
    } catch (error) { App.Utils.html("pc_resultado", `<span class="resultado-error">Erro ao salvar cadastro: ${error.message}</span>`); }
  },

  limparFormulario() {
    ["pc_nome", "pc_email", "pc_telefone", "pc_data_nascimento", "pc_estado", "pc_cidade", "pc_escolaridade", "pc_genero", "pc_raca", "pc_vaga", "pc_empresa", "pc_experiencia", "pc_descricao_experiencia", "pc_competencias_tecnicas", "pc_competencias_comportamentais", "pc_contexto", "pc_objetivo", "pc_deficiencia", "pc_deficiencia_acessibilidade", "pc_recursos_adaptacoes"].forEach(id => App.Utils.setValue(id, ""));
    App.Utils.html("pc_resultado", "");
  }
};

// ============================================================
// PARECER - MANTIDO
// ============================================================

App.Controllers.Parecer = {
  populateSelects() {
    const vagaSelect = document.getElementById("p_vaga"); const candidatoSelect = document.getElementById("p_candidato");
    if (vagaSelect) { const atual = vagaSelect.value; vagaSelect.innerHTML = `<option value="">Selecione</option>` + App.State.vagas.map(v => App.Utils.option(v.id, App.Utils.getVagaNome(v))).join(""); vagaSelect.value = atual; vagaSelect.onchange = () => { const vagaId = App.Utils.value("p_vaga"); const candidatos = App.State.candidatos.filter(c => !vagaId || c.vaga_id === vagaId); if (candidatoSelect) candidatoSelect.innerHTML = `<option value="">Selecione</option>` + candidatos.map(c => App.Utils.option(c.id, c.nome)).join(""); }; }
    if (candidatoSelect) { const atual = candidatoSelect.value; candidatoSelect.innerHTML = `<option value="">Selecione</option>` + App.State.candidatos.map(c => App.Utils.option(c.id, c.nome)).join(""); candidatoSelect.value = atual; }
  },
  async gerar() {
    const c = App.State.candidatos.find(item => item.id === App.Utils.value("p_candidato")); const transcricao = App.Utils.value("p_transcricao"); if (!c) return alert("Selecione um candidato."); const vaga = c.vaga_interesse || App.Utils.getVagaNome(c.vagas) || "vaga não informada";
    const texto = `${c.nome} participa do processo seletivo para a vaga de ${vaga}. ${c.contexto || "A pessoa candidata demonstra interesse na oportunidade e disponibilidade para avaliação."}\n\nEm relação à experiência profissional, apresenta vivência em ${c.area || "área não especificada"}, com histórico envolvendo ${c.experiencia || c.descricao_experiencia || "atividades descritas no processo"}. Observa-se potencial de atuação dentro das demandas da posição, considerando o contexto da vaga.\n\nNo aspecto técnico, destacam-se competências como ${c.competencias_tecnicas || "competências ainda não detalhadas"}. Recomenda-se validação prática junto ao gestor, especialmente para avaliar profundidade técnica e aplicação real.\n\nNo âmbito comportamental, foram identificados pontos relacionados a ${c.competencias_comportamentais || "comunicação, organização e relacionamento interpessoal"}. A avaliação sugere aprofundamento em exemplos práticos para melhor previsibilidade de adaptação ao ambiente.\n\nSobre deficiência e acessibilidade, a análise é conduzida de forma profissional, neutra e sem gerar viés. ${c.deficiencia_acessibilidade || "Até o momento, não foram registradas necessidades específicas de adaptação para a função."}\n\nDe forma geral, o perfil apresenta aderência ${c.aderencia || "a avaliar"} à posição. Recomenda-se seguir com validação junto ao gestor considerando experiência, comunicação e alinhamento com o contexto da oportunidade.\n\nObservações adicionais:\n${transcricao || "Sem informações complementares registradas."}`;
    App.Utils.setValue("p_texto", texto);
    try { await App.Data.update("candidatos", c.id, { parecer: texto, parecer_resumo: c.contexto || "", parecer_experiencia: c.experiencia || c.descricao_experiencia || "", parecer_comportamental: c.competencias_comportamentais || "", parecer_deficiencia: c.deficiencia_acessibilidade || "", parecer_conclusao: `Aderência ${c.aderencia || "a avaliar"} para ${vaga}` }); await App.Data.refreshAll(); }
    catch (error) { alert("Parecer gerado, mas não foi salvo: " + error.message); }
  }
};

// ============================================================
// FEEDBACK INTELIGENTE + WHATSAPP
// ============================================================

App.Controllers.Feedback = {
  populateSelects() {
    const vagaSelect = document.getElementById("f_vaga"); const candidatoSelect = document.getElementById("f_candidato");
    if (vagaSelect) { const atual = vagaSelect.value; vagaSelect.innerHTML = `<option value="">Selecione</option>` + App.State.vagas.map(v => App.Utils.option(v.id, App.Utils.getVagaNome(v))).join(""); vagaSelect.value = atual; vagaSelect.onchange = () => this.atualizarCandidatos(); }
    if (candidatoSelect) { const atual = candidatoSelect.value; candidatoSelect.innerHTML = `<option value="">Selecione</option>` + App.State.candidatos.map(c => App.Utils.option(c.id, c.nome)).join(""); candidatoSelect.value = atual; candidatoSelect.onchange = () => this.atualizarEmpresa(); }
    const tipo = document.getElementById("f_tipo_reprovacao");
    if (tipo && !tipo.options.length) tipo.innerHTML = `<option value="">Selecione</option><option>Reprovação interna</option><option>Reprovação pelo cliente</option><option>Falta de aderência técnica</option><option>Falta de aderência comportamental</option><option>Distância/localização</option><option>Pretensão salarial incompatível</option><option>Indisponibilidade de horário</option><option>Laudo pendente/não aderente</option><option>Cliente avançou com outro candidato da SL</option><option>Vaga congelada/cancelada</option><option>Banco de talentos</option><option>Aprovado</option><option>Em andamento</option>`;
  },
  atualizarCandidatos() {
    const vagaId = App.Utils.value("f_vaga"); const candidatoSelect = document.getElementById("f_candidato"); if (!candidatoSelect) return;
    const candidatos = App.State.candidatos.filter(c => !vagaId || c.vaga_id === vagaId);
    candidatoSelect.innerHTML = `<option value="">Selecione</option>` + candidatos.map(c => App.Utils.option(c.id, c.nome)).join("");
  },
  atualizarEmpresa() {
    const candidato = App.State.candidatos.find(item => item.id === App.Utils.value("f_candidato")); if (!candidato) return;
    App.Utils.setValue("f_empresa", App.Utils.getCandidatoCliente(candidato));
    App.Utils.setValue("f_motivo_reprovacao", candidato.motivo_reprovacao || "");
    App.Utils.setValue("f_tipo_reprovacao", candidato.tipo_reprovacao || "");
  },
  gerarTexto(candidato, vaga, etapa, tipo, motivo) {
    const nomeVaga = App.Utils.getVagaNome(vaga) || candidato.vaga_interesse || App.Utils.getVagaNome(candidato.vagas) || "a oportunidade";
    const empresa = App.Utils.getCandidatoCliente(candidato);
    const abertura = `Olá, ${candidato.nome}. Tudo bem?\n\nPassando para te atualizar sobre o processo seletivo para a vaga de ${nomeVaga}${empresa ? `, na empresa ${empresa}` : ""}.\n\n`;
    const fechamento = `\n\nAgradeço muito pelo seu tempo, disponibilidade e interesse ao longo do processo. Seguimos à disposição e, havendo novas oportunidades mais aderentes ao seu perfil, poderemos considerar seu cadastro novamente.\n\nAtenciosamente,\nTalentos+`;
    const contexto = motivo || tipo || etapa || "aderência ao perfil da vaga";
    if (tipo === "Aprovado" || etapa === "Aprovado") return `${abertura}Temos uma boa notícia: você avançou positivamente no processo. Em breve, retornaremos com os próximos alinhamentos e orientações sobre as etapas seguintes.\n\nParabéns pela evolução até aqui!${fechamento}`;
    if (tipo === "Em andamento" || etapa === "Cliente" || etapa === "Entrevista") return `${abertura}Seu perfil segue em análise na etapa de ${etapa || "continuidade do processo"}. Assim que tivermos uma nova atualização, retornaremos com os próximos passos.\n\nObrigada pela disponibilidade até aqui.${fechamento}`;
    if (tipo === "Cliente avançou com outro candidato da SL" || motivo === "Cliente avançou com outro candidato da SL") return `${abertura}Recebemos o retorno de que o cliente optou por avançar com outra pessoa candidata da shortlist que, neste momento, apresentou maior aderência ao recorte priorizado para a vaga.\n\nÉ importante reforçar que isso não invalida sua trajetória nem os pontos positivos do seu perfil. Em muitos processos, a decisão final considera comparativos específicos entre perfis, momento da vaga e critérios do gestor.${fechamento}`;
    if (tipo === "Falta de aderência técnica" || contexto.includes("técnic") || contexto.includes("tecnic")) return `${abertura}Após análise do perfil para esta oportunidade, neste momento não seguiremos com sua candidatura por uma questão de aderência técnica aos requisitos priorizados para a vaga.\n\nEsse retorno está relacionado ao recorte específico desta posição e não diminui sua experiência profissional. Para futuras oportunidades, seu perfil poderá fazer mais sentido conforme o escopo técnico solicitado.${fechamento}`;
    if (tipo === "Falta de aderência comportamental" || contexto.includes("comportamental") || contexto.includes("postura") || contexto.includes("comunicação")) return `${abertura}Após avaliação da etapa, neste momento não seguiremos com sua candidatura considerando pontos comportamentais/comunicacionais priorizados para o contexto desta vaga.\n\nEsse retorno é específico para esta oportunidade e pode variar conforme cultura, liderança e perfil esperado pela área.${fechamento}`;
    if (tipo === "Distância/localização" || contexto.includes("distância") || contexto.includes("distancia") || contexto.includes("localização")) return `${abertura}Neste momento, não seguiremos com sua candidatura por uma questão de localização/distância em relação ao formato e rotina da vaga.\n\nSabemos que esse ponto não está ligado à sua capacidade profissional, mas pode impactar deslocamento, disponibilidade e continuidade no processo.${fechamento}`;
    if (tipo === "Pretensão salarial incompatível" || contexto.includes("salarial") || contexto.includes("salário")) return `${abertura}Neste momento, não seguiremos com sua candidatura porque houve desalinhamento entre a pretensão salarial informada e a faixa prevista para a oportunidade.\n\nEsse retorno não invalida sua experiência. A decisão está relacionada ao orçamento específico da vaga neste momento.${fechamento}`;
    if (tipo === "Reprovação pelo cliente") return `${abertura}Após análise do cliente, recebemos o retorno de que a empresa seguirá com outro direcionamento para esta vaga. O principal ponto considerado foi: ${contexto}.\n\nEsse retorno está relacionado ao recorte específico da posição e à comparação entre perfis avaliados pelo gestor.${fechamento}`;
    if (tipo === "Reprovação interna" || etapa === "Reprovado") return `${abertura}Após análise interna do perfil para esta vaga, neste momento não seguiremos com sua candidatura para as próximas etapas. O principal ponto considerado foi: ${contexto}.\n\nBuscamos conduzir esse retorno com transparência e respeito, considerando os requisitos específicos desta oportunidade.${fechamento}`;
    if (tipo === "Banco de talentos") return `${abertura}Neste momento, a posição seguirá com outro direcionamento, mas seu perfil poderá permanecer em nosso banco de talentos para futuras oportunidades mais aderentes.\n\nAgradecemos sua participação e disponibilidade.${fechamento}`;
    return `${abertura}Neste momento, temos uma atualização sobre sua candidatura. Status atual: ${etapa || "em análise"}. ${contexto ? `Ponto considerado: ${contexto}.` : "Seguimos acompanhando a evolução do processo."}${fechamento}`;
  },
  async gerar() {
    const candidato = App.State.candidatos.find(item => item.id === App.Utils.value("f_candidato"));
    const vaga = App.State.vagas.find(item => item.id === App.Utils.value("f_vaga"));
    const etapa = App.Utils.value("f_etapa"); const tipo = App.Utils.value("f_tipo_reprovacao"); const motivo = App.Utils.value("f_motivo_reprovacao");
    if (!candidato || !etapa) return alert("Selecione candidato e etapa.");
    const texto = this.gerarTexto(candidato, vaga, etapa, tipo, motivo);
    App.Utils.setValue("f_texto", texto);
    const update = { feedback_candidato: texto, data_feedback: new Date().toISOString(), tipo_reprovacao: tipo || candidato.tipo_reprovacao, motivo_reprovacao: motivo || candidato.motivo_reprovacao };
    if (tipo === "Reprovação interna" || tipo === "Falta de aderência técnica" || tipo === "Falta de aderência comportamental") update.reprovacao_interna = "Sim";
    if (tipo === "Reprovação pelo cliente" || tipo === "Cliente avançou com outro candidato da SL") update.reprovacao_cliente = "Sim";
    try { await App.Data.update("candidatos", candidato.id, update); await App.Data.refreshAll(); }
    catch (error) { alert("Feedback gerado, mas não foi salvo: " + error.message); }
  },
  enviarWhatsApp() {
    const candidato = App.State.candidatos.find(item => item.id === App.Utils.value("f_candidato"));
    const texto = App.Utils.value("f_texto");
    if (!candidato || !candidato.telefone || !texto) return alert("Gere o feedback e confira o telefone do candidato.");
    const telefone = candidato.telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(texto)}`, "_blank");
  }
};

// ============================================================
// RETORNO AO CLIENTE - MANTIDO
// ============================================================

App.Controllers.Retorno = {
  populateSelects() {
    const clienteSelect = document.getElementById("r_cliente"); const vagaSelect = document.getElementById("r_vaga");
    if (clienteSelect) {
      const atual = clienteSelect.value; const clientes = App.Utils.unique(App.State.vagas.map(v => App.Utils.getVagaCliente(v)));
      clienteSelect.innerHTML = `<option value="">Selecione</option>` + clientes.map(c => App.Utils.option(c, c)).join(""); clienteSelect.value = atual;
      clienteSelect.onchange = () => { const cliente = App.Utils.value("r_cliente"); const vagas = App.State.vagas.filter(v => !cliente || App.Utils.getVagaCliente(v) === cliente); if (vagaSelect) vagaSelect.innerHTML = `<option value="">Selecione</option>` + vagas.map(v => App.Utils.option(v.id, App.Utils.getVagaNome(v))).join(""); };
    }
    if (vagaSelect) { const atual = vagaSelect.value; vagaSelect.innerHTML = `<option value="">Selecione</option>` + App.State.vagas.map(v => App.Utils.option(v.id, App.Utils.getVagaNome(v))).join(""); vagaSelect.value = atual; }
  },
  gerar() {
    const vagaId = App.Utils.value("r_vaga"); const vaga = App.State.vagas.find(item => item.id === vagaId); if (!vaga) return alert("Selecione a vaga.");
    const candidatos = App.State.candidatos.filter(c => c.vaga_id === vagaId); const total = candidatos.length;
    const interessados = candidatos.filter(c => ["Interessado", "Entrevista agendada", "Entrevistado", "Enviado ao cliente", "Entrevista com cliente", "Aprovado"].includes(c.status)).length;
    const entrevistas = candidatos.filter(c => ["Entrevista", "Entrevista agendada", "Entrevistado", "Entrevista com cliente"].includes(c.status)).length;
    const enviados = candidatos.filter(c => ["Enviado ao cliente", "Shortlist enviada", "Entrevista com cliente"].includes(c.status)).length;
    const aprovados = candidatos.filter(c => c.status === "Aprovado").length; const reprovados = candidatos.filter(c => c.status === "Reprovado" || c.reprovacao_interna === "Sim" || c.reprovacao_cliente === "Sim").length;
    const semRetorno = candidatos.filter(c => c.status === "Sem retorno" || c.motivo_reprovacao === "Falta de retorno").length; const motivos = {};
    candidatos.forEach(c => { if (c.motivo_reprovacao) motivos[c.motivo_reprovacao] = (motivos[c.motivo_reprovacao] || 0) + 1; });
    const principaisMotivos = Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([motivo, qtd]) => `- ${motivo}: ${qtd}`).join("\n") || "Sem motivos registrados.";
    const texto = `Olá, time.\n\nSegue atualização consultiva da vaga ${App.Utils.getVagaNome(vaga)}, cliente ${App.Utils.getVagaCliente(vaga) || "não informado"}.\n\nResumo do processo:\n- Total de candidatos abordados/cadastrados: ${total}\n- Candidatos interessados: ${interessados}\n- Candidatos em entrevista: ${entrevistas}\n- Candidatos enviados ao cliente: ${enviados}\n- Candidatos aprovados: ${aprovados}\n- Candidatos reprovados/perdas: ${reprovados}\n- Candidatos sem retorno: ${semRetorno}\n\nPrincipais motivos de perda:\n${principaisMotivos}\n\nStatus geral da vaga:\n${vaga.status || "Não informado"}\n\nLeitura consultiva:\nA vaga deve ser acompanhada considerando aderência técnica, conversão dos candidatos, critérios do gestor, competitividade da proposta e possíveis barreiras de localização, salário, horário ou acessibilidade.\n\nCaso os motivos de perda se concentrem em salário, distância, requisitos técnicos ou decisão comparativa do cliente, recomenda-se reavaliar estratégia de atração, flexibilizações e alinhamento com o gestor.\n\nSeguimos acompanhando a evolução do processo e recomendamos manter as definições de perfil bem alinhadas para evitar alongamento de SLA.`;
    App.Utils.setValue("r_texto", texto);
    const dashboard = document.getElementById("r_dashboard");
    if (dashboard) dashboard.innerHTML = `<div class="mini-dashboard-grid"><div class="mini-kpi"><span>Total</span><strong>${total}</strong></div><div class="mini-kpi"><span>Interessados</span><strong>${interessados}</strong></div><div class="mini-kpi"><span>Entrevistas</span><strong>${entrevistas}</strong></div><div class="mini-kpi"><span>Enviados</span><strong>${enviados}</strong></div><div class="mini-kpi"><span>Aprovados</span><strong>${aprovados}</strong></div><div class="mini-kpi"><span>Reprovados</span><strong>${reprovados}</strong></div><div class="mini-kpi"><span>Sem retorno</span><strong>${semRetorno}</strong></div><div class="mini-kpi"><span>Status</span><strong>${App.Utils.safe(vaga.status || "-")}</strong></div></div><div class="mini-dashboard-section"><strong>Principais motivos de perda</strong><pre>${App.Utils.safe(principaisMotivos)}</pre></div><div class="mini-dashboard-section"><strong>Leitura consultiva</strong><p>Acompanhar aderência, conversão e motivos de perda para orientar decisões do cliente.</p></div>`;
  }
};

// ============================================================
// DIVERSIDADE / DASHBOARD RESTAURADO
// ============================================================

App.Controllers.Diversidade = {
  render() {
    App.Utils.renderCountList("chart_genero", App.State.candidatos, c => c.genero || "Não informado");
    App.Utils.renderCountList("chart_deficiencia", App.State.candidatos, c => c.deficiencia || "Não informado");
    App.Utils.renderCountList("chart_raca", App.State.candidatos, c => c.raca || "Não informado");
    App.Utils.renderCountList("chart_estado", App.State.candidatos, c => c.estado || "Não informado");
    App.Utils.renderCountList("chart_escolaridade", App.State.candidatos, c => c.escolaridade || "Não informado");
    App.Utils.renderCountList("chart_idade", App.State.candidatos, c => App.Utils.faixaEtaria(c.data_nascimento));
    App.Utils.renderCountList("chart_faixa_etaria", App.State.candidatos, c => App.Utils.faixaEtaria(c.data_nascimento));
    const result = document.getElementById("d_resultado");
    if (result) result.innerText = `Total de candidatos: ${App.State.candidatos.length}`;
  }
};

App.Controllers.Dashboard = {
  render() {
    App.Utils.renderCountList("chart_funil", App.State.candidatos, c => c.etapa || c.status || "Não informado");
    App.Utils.renderCountList("chart_conversao", App.State.candidatos, c => c.aderencia || "Não informado");
    App.Utils.renderCountList("chart_desistencia", App.State.candidatos, c => c.motivo_reprovacao || c.origem || "Não informado");
    App.Utils.renderCountList("chart_tempo", App.State.candidatos, c => c.data_contratacao ? "Contratado" : "Sem contratação registrada");
    App.Utils.renderCountList("chart_status", App.State.candidatos, c => c.status || "Não informado");
    App.Utils.renderCountList("chart_etapas", App.State.candidatos, c => c.etapa || "Não informado");
    App.Utils.renderCountList("chart_reprovacao_interna", App.State.candidatos, c => c.reprovacao_interna === "Sim" ? "Reprovação interna" : "Não informado");
    App.Utils.renderCountList("chart_reprovacao_cliente", App.State.candidatos, c => c.reprovacao_cliente === "Sim" ? "Reprovação cliente" : "Não informado");
    App.Utils.renderCountList("chart_motivos_reprovacao", App.State.candidatos, c => c.motivo_reprovacao || "Sem motivo registrado");
    const total = App.State.candidatos.length; const aprovados = App.State.candidatos.filter(c => c.status === "Aprovado").length; const contratados = App.State.candidatos.filter(c => c.status === "Contratado" || c.data_contratacao).length; const banco = App.State.candidatos.filter(c => c.vaga_interesse === "Banco de Talentos" || c.origem === "Banco de Talentos" || c.status === "Banco de talentos").length; const repInterna = App.State.candidatos.filter(c => c.reprovacao_interna === "Sim").length; const repCliente = App.State.candidatos.filter(c => c.reprovacao_cliente === "Sim").length;
    const resumo = document.getElementById("dash_geral_resumo");
    if (resumo) resumo.innerHTML = `<div class="dashboard-summary"><div><strong>Total de candidatos:</strong> ${total}</div><div><strong>Candidatos aprovados:</strong> ${aprovados}</div><div><strong>Candidatos contratados:</strong> ${contratados}</div><div><strong>Banco de talentos:</strong> ${banco}</div><div><strong>Reprovação interna:</strong> ${repInterna}</div><div><strong>Reprovação cliente:</strong> ${repCliente}</div><div><strong>Vagas cadastradas:</strong> ${App.State.vagas.length}</div><div><strong>Mapeamentos salvos:</strong> ${App.State.mapeamentos.length}</div></div>`;
  }
};

window.App = App;
window.showPage = showPage;
window.login = login;
window.logout = logout;

// ============================================================
// FIM DO APP.JS
// ============================================================
