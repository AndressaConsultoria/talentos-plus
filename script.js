// ============================================================
// TALENTOS+ | SCRIPT COMPLETO INTEGRADO AO SUPABASE
// Mantém estrutura App.Controllers do sistema original.
// Troque apenas a SUPABASE_KEY pela sua anon public key.
// ============================================================

const SUPABASE_URL = "https://xidodhapgrtkranvzdpx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZG9kaGFwZ3J0a3JhbnZ6ZHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Nzg2MzYsImV4cCI6MjA5MjU1NDYzNn0.WmHKHolSy2tg0bcjE17lhXl8kvCzV6tXUtIfsh9l10w";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const App = {
  State: {
    user: null,
    profile: null,
    vagas: [],
    candidatos: [],
    mapeamentos: []
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

    money(value) {
      if (!value) return "Não informado";
      return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    },

    safe(text) {
      return (text || "").toString().replace(/[<>&]/g, (m) => ({
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

    download(filename, content, type = "application/json") {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  },

  Data: {
    async refreshAll() {
      await Promise.all([
        App.Data.loadVagas(),
        App.Data.loadCandidatos(),
        App.Data.loadMapeamentos()
      ]);

      App.Controllers.Vagas.renderGestao();
      App.Controllers.Vagas.populateSelects();
      App.Controllers.Candidatos.renderGestao();
      App.Controllers.Candidatos.populateSelects();
      App.Controllers.MapeIA.renderHistorico();
      App.Controllers.Diversidade.render();
      App.Controllers.Dashboard.render();
      App.Controllers.Retorno.populateSelects();
      App.Controllers.Feedback.populateSelects();
      App.Controllers.Parecer.populateSelects();
    },

    async loadVagas() {
      const { data, error } = await supabaseClient
        .from("vagas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        alert("Erro ao carregar vagas: " + error.message);
        return;
      }

      App.State.vagas = data || [];
    },

    async loadCandidatos() {
      const { data, error } = await supabaseClient
        .from("candidatos")
        .select("*, vagas(nome, cliente)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        alert("Erro ao carregar candidatos: " + error.message);
        return;
      }

      App.State.candidatos = data || [];
    },

    async loadMapeamentos() {
      const { data, error } = await supabaseClient
        .from("mapeamentos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        alert("Erro ao carregar mapeamentos: " + error.message);
        return;
      }

      App.State.mapeamentos = data || [];
    }
  },

  Controllers: {}
};

// ============================================================
// AUTH SUPABASE
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  const loginBtn = document.getElementById("authLoginBtn");
  if (loginBtn) loginBtn.addEventListener("click", login);

  const portalBtn = document.getElementById("pc_enviar");
  if (portalBtn) portalBtn.addEventListener("click", () => App.Controllers.Portal.enviar());

  const restore = document.getElementById("restoreFile");
  if (restore) restore.addEventListener("change", App.Controllers.System.restaurarBackup);

  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    await bootUser();
  } else {
    showAuth();
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

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    if (errorBox) errorBox.innerText = "Erro no login: " + error.message;
    return;
  }

  await bootUser();
}

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

async function bootUser() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !userData.user) {
    showAuth();
    return;
  }

  App.State.user = userData.user;

  let { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", App.State.user.id)
    .maybeSingle();

  if (profileError) {
    alert("Erro ao carregar perfil: " + profileError.message);
    showAuth();
    return;
  }

  if (!profile) {
    const { error: insertProfileError } = await supabaseClient
      .from("profiles")
      .insert([{
        id: App.State.user.id,
        email: App.State.user.email,
        tipo: "candidato"
      }]);

    if (insertProfileError) {
      alert("Erro ao criar perfil: " + insertProfileError.message);
      showAuth();
      return;
    }

    profile = {
      id: App.State.user.id,
      email: App.State.user.email,
      tipo: "candidato"
    };
  }

  App.State.profile = profile;

  showApp();
  applyAccess(profile.tipo);
  await App.Data.refreshAll();

  if (profile.tipo === "candidato") {
    const portalBtn = document.querySelector('[data-page="portalCandidato"]');
    showPage("portalCandidato", portalBtn);
    await App.Controllers.Portal.carregarMeuCadastro();
  } else {
    const firstBtn = document.querySelector('[data-page="mapeia"]');
    showPage("mapeia", firstBtn);
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
  if (badge && App.State.user) {
    badge.innerText = `${App.State.profile?.tipo || ""} | ${App.State.user.email}`;
  }
}

function applyAccess(tipo) {
  const isAdmin = tipo === "admin";

  document.querySelectorAll(".admin-only").forEach(btn => {
    btn.style.display = isAdmin ? "block" : "none";
  });

  document.body.classList.toggle("auth-candidato", !isAdmin);
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function showPage(id, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(id);
  if (page) page.classList.add("active");

  document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (id === "dashboard") App.Controllers.Dashboard.render();
  if (id === "diversidade") App.Controllers.Diversidade.render();
  if (id === "portalCandidato") App.Controllers.Portal.carregarMeuCadastro();
}

// ============================================================
// MAPEIA
// ============================================================

App.Controllers.MapeIA = {
  estimarSalario(vaga, senioridade, localizacao) {
    const texto = `${vaga} ${senioridade} ${localizacao}`.toLowerCase();
    let min = 2500;
    let max = 4000;

    if (texto.includes("assistente") || texto.includes("auxiliar")) {
      min = 1800; max = 3200;
    }
    if (texto.includes("analista") && texto.includes("júnior")) {
      min = 3000; max = 4500;
    }
    if (texto.includes("analista") && texto.includes("pleno")) {
      min = 4500; max = 7000;
    }
    if (texto.includes("analista") && (texto.includes("sênior") || texto.includes("senior"))) {
      min = 6500; max = 9500;
    }
    if (texto.includes("especialista")) {
      min = 8000; max = 13000;
    }
    if (texto.includes("coord")) {
      min = 9000; max = 15000;
    }
    if (texto.includes("ger")) {
      min = 14000; max = 25000;
    }
    if (texto.includes("são paulo") || texto.includes("sp") || texto.includes("vila olímpia")) {
      min = Math.round(min * 1.15);
      max = Math.round(max * 1.2);
    }

    return `R$ ${min.toLocaleString("pt-BR")} a R$ ${max.toLocaleString("pt-BR")}`;
  },

  calcularDificuldade(salario, idioma, requisito, pcd, descricao) {
    let pontos = 0;
    const texto = `${idioma} ${requisito} ${pcd} ${descricao}`.toLowerCase();

    if (texto.includes("inglês") || texto.includes("ingles")) pontos++;
    if (texto.includes("excel avançado") || texto.includes("power bi") || texto.includes("sap")) pontos++;
    if (texto.includes("obrigatório") || texto.includes("imprescindível")) pontos++;
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

    const analise = `Resumo executivo:
A vaga ${vaga || "não informada"} para o cliente ${cliente || "não informado"} apresenta senioridade ${senioridade || "não informada"} e localização ${localizacao || "não informada"}.

Inteligência salarial:
Salário informado: ${salario ? App.Utils.money(salario) : "não informado"}.
Referência estimada de mercado: ${salarioMercado}.

Dificuldade de contratação:
${dificuldade}.

Análise consultiva:
A posição deve ser avaliada considerando o alinhamento entre escopo, salário, senioridade, requisitos técnicos e contexto de vaga PcD. Caso a remuneração esteja abaixo da faixa de mercado ou os requisitos estejam muito elevados, há risco de baixa conversão, alongamento de SLA e perda de candidatos aderentes.

Recomendação:
Validar requisitos obrigatórios, flexibilizações possíveis e atratividade da proposta antes de intensificar a busca.`;

    App.Utils.setValue("m_resultado", analise);
  },

  async salvar() {
    const vaga = App.Utils.value("m_vaga");
    if (!vaga) {
      alert("Informe o nome da vaga para salvar o mapeamento.");
      return;
    }

    if (!App.Utils.value("m_resultado")) this.gerar();

    const salarioMercado = this.estimarSalario(
      vaga,
      App.Utils.value("m_senioridade"),
      App.Utils.value("m_localizacao")
    );

    const dificuldade = this.calcularDificuldade(
      App.Utils.value("m_salario"),
      App.Utils.value("m_idioma"),
      App.Utils.value("m_requisito"),
      App.Utils.value("m_pcd"),
      App.Utils.value("m_descricao")
    );

    const { error } = await supabaseClient
      .from("mapeamentos")
      .insert([{
        cliente: App.Utils.value("m_cliente"),
        vaga,
        cargo: vaga,
        senioridade: App.Utils.value("m_senioridade"),
        salario_oferecido: App.Utils.value("m_salario") ? Number(App.Utils.value("m_salario")) : null,
        localizacao: App.Utils.value("m_localizacao"),
        idioma: App.Utils.value("m_idioma"),
        requisito: App.Utils.value("m_requisito"),
        pcd: App.Utils.value("m_pcd"),
        descricao: App.Utils.value("m_descricao"),
        salario_mercado: salarioMercado,
        dificuldade,
        analise: App.Utils.value("m_resultado")
      }]);

    if (error) {
      alert("Erro ao salvar mapeamento: " + error.message);
      return;
    }

    alert("Mapeamento salvo!");
    await App.Data.refreshAll();
  },

  limpar() {
    ["m_cliente", "m_vaga", "m_senioridade", "m_salario", "m_localizacao", "m_idioma", "m_requisito", "m_pcd", "m_descricao", "m_resultado"]
      .forEach(id => App.Utils.setValue(id, ""));
  },

  renderHistorico() {
    const cliente = App.Utils.value("mh_busca_cliente").toLowerCase();
    const vaga = App.Utils.value("mh_busca_vaga").toLowerCase();

    const list = document.getElementById("listaMapeamentos");
    if (!list) return;

    const items = App.State.mapeamentos.filter(m => {
      const c = (m.cliente || "").toLowerCase();
      const v = (m.vaga || m.cargo || "").toLowerCase();
      return (!cliente || c.includes(cliente)) && (!vaga || v.includes(vaga));
    });

    if (!items.length) {
      list.innerHTML = `<div class="card-item"><div class="card-text">Nenhum mapeamento salvo ainda.</div></div>`;
      return;
    }

    list.innerHTML = items.map(m => `
      <div class="card-item">
        <div class="card-title">${App.Utils.safe(m.vaga || m.cargo)}</div>
        <div class="card-text">
          Cliente: ${App.Utils.safe(m.cliente || "Não informado")}<br>
          Senioridade: ${App.Utils.safe(m.senioridade || "Não informado")}<br>
          Mercado: ${App.Utils.safe(m.salario_mercado || "-")}<br>
          Dificuldade: ${App.Utils.safe(m.dificuldade || "-")}
        </div>
        <div class="card-actions">
          <button class="action-mini" onclick="App.Controllers.MapeIA.carregar('${m.id}')">Carregar</button>
          <button class="action-mini" onclick="App.Controllers.MapeIA.excluir('${m.id}')">Excluir</button>
        </div>
      </div>
    `).join("");
  },

  carregar(id) {
    const m = App.State.mapeamentos.find(item => item.id === id);
    if (!m) return;

    App.Utils.setValue("m_cliente", m.cliente);
    App.Utils.setValue("m_vaga", m.vaga || m.cargo);
    App.Utils.setValue("m_senioridade", m.senioridade);
    App.Utils.setValue("m_salario", m.salario_oferecido);
    App.Utils.setValue("m_localizacao", m.localizacao);
    App.Utils.setValue("m_idioma", m.idioma);
    App.Utils.setValue("m_requisito", m.requisito);
    App.Utils.setValue("m_pcd", m.pcd);
    App.Utils.setValue("m_descricao", m.descricao);
    App.Utils.setValue("m_resultado", m.analise);
  },

  async excluir(id) {
    if (!confirm("Excluir este mapeamento?")) return;

    const { error } = await supabaseClient.from("mapeamentos").delete().eq("id", id);
    if (error) return alert("Erro ao excluir: " + error.message);

    await App.Data.refreshAll();
  }
};

// ============================================================
// VAGAS
// ============================================================

App.Controllers.Vagas = {
  async salvar() {
    const id = App.Utils.value("v_id");
    const dados = {
      cliente: App.Utils.value("v_cliente"),
      nome: App.Utils.value("v_nome"),
      data_abertura: App.Utils.value("v_data") || null,
      senioridade: App.Utils.value("v_senioridade"),
      salario: App.Utils.value("v_salario") ? Number(App.Utils.value("v_salario")) : null,
      localizacao: App.Utils.value("v_localizacao"),
      tipo: App.Utils.value("v_tipo"),
      classificacao: App.Utils.value("v_classificacao"),
      status: App.Utils.value("v_status") || "Aberta",
      gestor: App.Utils.value("v_gestor"),
      idioma: App.Utils.value("v_idioma"),
      requisito: App.Utils.value("v_requisito"),
      pcd: App.Utils.value("v_pcd"),
      descricao: App.Utils.value("v_descricao")
    };

    if (!dados.nome) return alert("Informe o cargo/vaga.");

    let result;
    if (id) {
      result = await supabaseClient.from("vagas").update(dados).eq("id", id);
    } else {
      result = await supabaseClient.from("vagas").insert([dados]);
    }

    if (result.error) return alert("Erro ao salvar vaga: " + result.error.message);

    alert("Vaga salva!");
    this.limparFormulario();
    await App.Data.refreshAll();
  },

  limparFormulario() {
    ["v_id","v_cliente","v_nome","v_data","v_senioridade","v_salario","v_localizacao","v_tipo","v_classificacao","v_status","v_gestor","v_idioma","v_requisito","v_pcd","v_descricao"]
      .forEach(id => App.Utils.setValue(id, ""));
    const sla = document.getElementById("v_sla_view");
    if (sla) sla.innerText = "Prazo SLA: —";
  },

  editar(id) {
    const v = App.State.vagas.find(item => item.id === id);
    if (!v) return;

    App.Utils.setValue("v_id", v.id);
    App.Utils.setValue("v_cliente", v.cliente);
    App.Utils.setValue("v_nome", v.nome);
    App.Utils.setValue("v_data", v.data_abertura);
    App.Utils.setValue("v_senioridade", v.senioridade);
    App.Utils.setValue("v_salario", v.salario);
    App.Utils.setValue("v_localizacao", v.localizacao);
    App.Utils.setValue("v_tipo", v.tipo);
    App.Utils.setValue("v_classificacao", v.classificacao);
    App.Utils.setValue("v_status", v.status);
    App.Utils.setValue("v_gestor", v.gestor);
    App.Utils.setValue("v_idioma", v.idioma);
    App.Utils.setValue("v_requisito", v.requisito);
    App.Utils.setValue("v_pcd", v.pcd);
    App.Utils.setValue("v_descricao", v.descricao);

    const btn = document.querySelector('[data-page="cadastroVagas"]');
    showPage("cadastroVagas", btn);
  },

  async excluir(id) {
    if (!confirm("Excluir esta vaga?")) return;
    const { error } = await supabaseClient.from("vagas").delete().eq("id", id);
    if (error) return alert("Erro ao excluir vaga: " + error.message);
    await App.Data.refreshAll();
  },

  populateSelects() {
    const selects = ["c_vaga", "gc_vaga", "f_vaga", "p_vaga", "r_vaga", "pc_vaga"];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `<option value="">Selecione</option>` + App.State.vagas.map(v => App.Utils.option(v.id, v.nome)).join("");
    });

    const clienteSelects = ["gv_filtro_cliente", "gc_cliente", "r_cliente", "dash_cliente"];
    clienteSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const clientes = App.Utils.unique(App.State.vagas.map(v => v.cliente));
      el.innerHTML = `<option value="">Todos</option>` + clientes.map(c => App.Utils.option(c, c)).join("");
    });

    const gvNome = document.getElementById("gv_filtro_nome");
    if (gvNome) {
      gvNome.innerHTML = `<option value="">Todas</option>` + App.State.vagas.map(v => App.Utils.option(v.id, v.nome)).join("");
    }
  },

  renderGestao() {
    const list = document.getElementById("listaGestaoVagas");
    if (!list) return;

    const cliente = App.Utils.value("gv_filtro_cliente");
    const status = App.Utils.value("gv_filtro_status");
    const nomeId = App.Utils.value("gv_filtro_nome");

    let vagas = App.State.vagas.filter(v =>
      (!cliente || v.cliente === cliente) &&
      (!status || v.status === status) &&
      (!nomeId || v.id === nomeId)
    );

    const ativas = App.State.vagas.filter(v => ["Aberta","Em andamento","Reaberta"].includes(v.status)).length;
    const fechadas = App.State.vagas.filter(v => v.status === "Fechada").length;
    const canceladas = App.State.vagas.filter(v => v.status === "Cancelada").length;

    const elAtivas = document.getElementById("gv_kpi_ativas");
    const elFechadas = document.getElementById("gv_kpi_fechadas");
    const elCanceladas = document.getElementById("gv_kpi_canceladas");
    if (elAtivas) elAtivas.innerText = ativas;
    if (elFechadas) elFechadas.innerText = fechadas;
    if (elCanceladas) elCanceladas.innerText = canceladas;

    if (!vagas.length) {
      list.innerHTML = `<div class="card-item"><div class="card-text">Nenhuma vaga encontrada.</div></div>`;
      return;
    }

    list.innerHTML = vagas.map(v => `
      <div class="card-item">
        <div class="card-title">${App.Utils.safe(v.nome)}</div>
        <div class="card-text">
          Cliente: ${App.Utils.safe(v.cliente || "-")}<br>
          Status: ${App.Utils.safe(v.status || "-")}<br>
          Senioridade: ${App.Utils.safe(v.senioridade || "-")}<br>
          Localização: ${App.Utils.safe(v.localizacao || "-")}<br>
          Salário: ${v.salario ? App.Utils.money(v.salario) : "-"}
        </div>
        <div class="card-actions">
          <button class="action-mini" onclick="App.Controllers.Vagas.editar('${v.id}')">Editar</button>
          <button class="action-mini" onclick="App.Controllers.Vagas.excluir('${v.id}')">Excluir</button>
        </div>
      </div>
    `).join("");
  }
};

// ============================================================
// CANDIDATOS
// ============================================================

App.Controllers.Candidatos = {
  gerarAderencia(texto) {
    const t = (texto || "").toLowerCase();
    let score = 0;
    if (t.includes("experiência")) score++;
    if (t.includes("comunicação")) score++;
    if (t.includes("excel")) score++;
    if (t.includes("indicador")) score++;
    if (t.includes("hospital")) score++;
    if (t.includes("cliente")) score++;
    if (score >= 4) return "Alta";
    if (score >= 2) return "Média";
    return "Baixa";
  },

  gerarAnaliseIA(nome, vaga, texto) {
    const aderencia = this.gerarAderencia(texto);
    return `O candidato ${nome} apresenta aderência ${aderencia} para a vaga de ${vaga || "vaga não informada"}. A análise considera as informações registradas no cadastro, competências técnicas, comportamentais, contexto profissional e informações de acessibilidade. Recomenda-se validar com o gestor a profundidade técnica, exemplos práticos e alinhamento com o contexto da posição.`;
  },

  async salvar() {
    const vagaId = App.Utils.value("c_vaga");
    const vaga = App.State.vagas.find(v => v.id === vagaId);

    const textoBase = [
      App.Utils.value("c_experiencia"),
      App.Utils.value("c_competencias_tecnicas"),
      App.Utils.value("c_competencias_comportamentais"),
      App.Utils.value("c_contexto"),
      App.Utils.value("c_deficiencia_acessibilidade")
    ].join(" ");

    const nome = App.Utils.value("c_nome");
    if (!nome) return alert("Informe o nome do candidato.");

    const dados = {
      nome,
      vaga_id: vagaId || null,
      cliente: App.Utils.value("c_cliente") || (vaga ? vaga.cliente : ""),
      status: App.Utils.value("c_status") || "Triagem",
      etapa: App.Utils.value("c_status") || "Triagem",
      telefone: App.Utils.value("c_telefone"),
      email: App.Utils.value("c_email"),
      estado: App.Utils.value("c_estado"),
      cidade: App.Utils.value("c_cidade"),
      deficiencia: App.Utils.value("c_deficiencia"),
      genero: App.Utils.value("c_genero"),
      raca: App.Utils.value("c_raca"),
      escolaridade: App.Utils.value("c_escolaridade"),
      formacao: App.Utils.value("c_formacao"),
      area: App.Utils.value("c_area"),
      data_contratacao: App.Utils.value("c_data_contratacao") || null,
      origem: App.Utils.value("c_origem"),
      curriculo_nome: App.Utils.value("c_curriculo_nome"),
      laudo_nome: App.Utils.value("c_laudo_nome"),
      experiencia: App.Utils.value("c_experiencia"),
      competencias_tecnicas: App.Utils.value("c_competencias_tecnicas"),
      competencias_comportamentais: App.Utils.value("c_competencias_comportamentais"),
      contexto: App.Utils.value("c_contexto"),
      deficiencia_acessibilidade: App.Utils.value("c_deficiencia_acessibilidade"),
      parecer_resumo: App.Utils.value("c_contexto"),
      parecer_experiencia: App.Utils.value("c_experiencia"),
      parecer_comportamental: App.Utils.value("c_competencias_comportamentais"),
      parecer_deficiencia: App.Utils.value("c_deficiencia_acessibilidade"),
      parecer_conclusao: "",
      aderencia: this.gerarAderencia(textoBase),
      analise_ia: this.gerarAnaliseIA(nome, vaga ? vaga.nome : "", textoBase)
    };

    const id = App.Utils.value("c_id");
    let result;

    if (id) {
      result = await supabaseClient.from("candidatos").update(dados).eq("id", id);
    } else {
      result = await supabaseClient.from("candidatos").insert([dados]);
    }

    if (result.error) return alert("Erro ao salvar candidato: " + result.error.message);

    alert("Candidato salvo!");
    this.limparFormulario();
    await App.Data.refreshAll();
  },

  limparFormulario() {
    [
      "c_id","c_nome","c_vaga","c_cliente","c_status","c_telefone","c_email","c_estado","c_cidade",
      "c_deficiencia","c_genero","c_raca","c_escolaridade","c_formacao","c_area","c_data_contratacao",
      "c_origem","c_curriculo_nome","c_laudo_nome","c_experiencia","c_competencias_tecnicas",
      "c_competencias_comportamentais","c_contexto","c_deficiencia_acessibilidade"
    ].forEach(id => App.Utils.setValue(id, ""));
  },

  populateSelects() {
    const selects = ["gc_candidato", "f_candidato", "p_candidato"];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `<option value="">Selecione</option>` + App.State.candidatos.map(c => App.Utils.option(c.id, c.nome)).join("");
    });
  },

  async mudarEtapa(id, etapa) {
    const { error } = await supabaseClient.from("candidatos").update({ etapa, status: etapa }).eq("id", id);
    if (error) return alert("Erro ao atualizar etapa: " + error.message);
    await App.Data.refreshAll();
  },

  editar(id) {
    const c = App.State.candidatos.find(item => item.id === id);
    if (!c) return;

    App.Utils.setValue("c_id", c.id);
    App.Utils.setValue("c_nome", c.nome);
    App.Utils.setValue("c_vaga", c.vaga_id);
    App.Utils.setValue("c_cliente", c.cliente);
    App.Utils.setValue("c_status", c.status);
    App.Utils.setValue("c_telefone", c.telefone);
    App.Utils.setValue("c_email", c.email);
    App.Utils.setValue("c_estado", c.estado);
    App.Utils.setValue("c_cidade", c.cidade);
    App.Utils.setValue("c_deficiencia", c.deficiencia);
    App.Utils.setValue("c_genero", c.genero);
    App.Utils.setValue("c_raca", c.raca);
    App.Utils.setValue("c_escolaridade", c.escolaridade);
    App.Utils.setValue("c_formacao", c.formacao);
    App.Utils.setValue("c_area", c.area);
    App.Utils.setValue("c_data_contratacao", c.data_contratacao);
    App.Utils.setValue("c_origem", c.origem);
    App.Utils.setValue("c_curriculo_nome", c.curriculo_nome);
    App.Utils.setValue("c_laudo_nome", c.laudo_nome);
    App.Utils.setValue("c_experiencia", c.experiencia);
    App.Utils.setValue("c_competencias_tecnicas", c.competencias_tecnicas);
    App.Utils.setValue("c_competencias_comportamentais", c.competencias_comportamentais);
    App.Utils.setValue("c_contexto", c.contexto);
    App.Utils.setValue("c_deficiencia_acessibilidade", c.deficiencia_acessibilidade);

    const btn = document.querySelector('[data-page="cadastroCandidatos"]');
    showPage("cadastroCandidatos", btn);
  },

  async excluir(id) {
    if (!confirm("Excluir este candidato?")) return;
    const { error } = await supabaseClient.from("candidatos").delete().eq("id", id);
    if (error) return alert("Erro ao excluir candidato: " + error.message);
    await App.Data.refreshAll();
  },

  async abrirLaudo(path) {
    if (!path) return;

    const { data, error } = await supabaseClient
      .storage
      .from("laudos")
      .createSignedUrl(path, 60 * 10);

    if (error) return alert("Erro ao abrir laudo: " + error.message);
    window.open(data.signedUrl, "_blank");
  },

  renderGestao() {
    const list = document.getElementById("listaGestaoCandidatos");
    if (!list) return;

    const cliente = App.Utils.value("gc_cliente");
    const vagaId = App.Utils.value("gc_vaga");
    const status = App.Utils.value("gc_status");
    const busca = App.Utils.value("gc_busca").toLowerCase();

    const clientes = App.Utils.unique(App.State.candidatos.map(c => c.cliente));
    const gcCliente = document.getElementById("gc_cliente");
    if (gcCliente && gcCliente.options.length <= 1) {
      gcCliente.innerHTML = `<option value="">Todos</option>` + clientes.map(c => App.Utils.option(c, c)).join("");
    }

    let candidatos = App.State.candidatos.filter(c =>
      (!cliente || c.cliente === cliente) &&
      (!vagaId || c.vaga_id === vagaId) &&
      (!status || c.status === status) &&
      (!busca || (c.nome || "").toLowerCase().includes(busca))
    );

    this.renderFunil(candidatos);

    if (!candidatos.length) {
      list.innerHTML = `<div class="card-item"><div class="card-text">Nenhum candidato encontrado.</div></div>`;
      return;
    }

    list.innerHTML = candidatos.map(c => `
      <div class="card-item">
        <div class="card-title">${App.Utils.safe(c.nome)}</div>
        <div class="card-text">
          Vaga: ${App.Utils.safe(c.vagas?.nome || "Não vinculada")}<br>
          Cliente: ${App.Utils.safe(c.cliente || c.vagas?.cliente || "-")}<br>
          Status: <span class="status-badge">${App.Utils.safe(c.status || "-")}</span><br>
          Aderência: <strong>${App.Utils.safe(c.aderencia || "-")}</strong><br>
          Telefone: ${App.Utils.safe(c.telefone || "-")}<br>
          Email: ${App.Utils.safe(c.email || "-")}<br>
          Deficiência: ${App.Utils.safe(c.deficiencia || "-")}<br>
          ${c.laudo_url ? "Laudo: enviado" : "Laudo: não enviado"}<br><br>
          <strong>Análise IA:</strong><br>${App.Utils.safe(c.analise_ia || "-")}
        </div>
        <div class="card-actions">
          <button class="action-mini" onclick="App.Controllers.Candidatos.editar('${c.id}')">Editar</button>
          ${c.laudo_url ? `<button class="action-mini" onclick="App.Controllers.Candidatos.abrirLaudo('${c.laudo_url}')">Ver laudo</button>` : ""}
          <button class="action-mini" onclick="App.Controllers.Candidatos.excluir('${c.id}')">Excluir</button>
        </div>
      </div>
    `).join("");
  },

  renderFunil(candidatos) {
    const map = {
      "novo": "funilNovo",
      "Triagem": "funilTriagem",
      "triagem": "funilTriagem",
      "Entrevista": "funilEntrevista",
      "entrevista": "funilEntrevista",
      "Entrevista agendada": "funilEntrevista",
      "Entrevistado": "funilEntrevista",
      "Entrevista com cliente": "funilEntrevista",
      "Aprovado": "funilAprovado",
      "aprovado": "funilAprovado",
      "Reprovado": "funilReprovado",
      "reprovado": "funilReprovado"
    };

    ["funilNovo","funilTriagem","funilEntrevista","funilAprovado","funilReprovado"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });

    candidatos.forEach(c => {
      const target = map[c.etapa] || map[c.status] || "funilNovo";
      const el = document.getElementById(target);
      if (!el) return;

      el.innerHTML += `
        <div class="funil-card">
          <strong>${App.Utils.safe(c.nome)}</strong><br>
          <small>${App.Utils.safe(c.vagas?.nome || "Sem vaga")}</small>
          <select onchange="App.Controllers.Candidatos.mudarEtapa('${c.id}', this.value)">
            <option value="novo" ${c.etapa === "novo" ? "selected" : ""}>Novo</option>
            <option value="Triagem" ${c.etapa === "Triagem" || c.status === "Triagem" ? "selected" : ""}>Triagem</option>
            <option value="Entrevista" ${c.etapa === "Entrevista" ? "selected" : ""}>Entrevista</option>
            <option value="Aprovado" ${c.etapa === "Aprovado" || c.status === "Aprovado" ? "selected" : ""}>Aprovado</option>
            <option value="Reprovado" ${c.etapa === "Reprovado" || c.status === "Reprovado" ? "selected" : ""}>Reprovado</option>
          </select>
        </div>
      `;
    });
  }
};

// ============================================================
// PORTAL DO CANDIDATO
// ============================================================

App.Controllers.Portal = {
  async carregarMeuCadastro() {
    if (!App.State.user) return;

    App.Controllers.Vagas.populateSelects();

    const { data, error } = await supabaseClient
      .from("candidatos")
      .select("*, vagas(nome, cliente)")
      .eq("user_id", App.State.user.id)
      .maybeSingle();

    if (error) {
      const result = document.getElementById("pc_resultado");
      if (result) result.innerHTML = `<span class="resultado-error">Erro ao carregar cadastro: ${error.message}</span>`;
      return;
    }

    App.Utils.setValue("pc_email", App.State.user.email);

    if (data) {
      App.Utils.setValue("pc_nome", data.nome);
      App.Utils.setValue("pc_email", data.email || App.State.user.email);
      App.Utils.setValue("pc_telefone", data.telefone);
      App.Utils.setValue("pc_vaga", data.vaga_id);
      App.Utils.setValue("pc_empresa", data.cliente || data.vagas?.cliente);
      App.Utils.setValue("pc_estado", data.estado);
      App.Utils.setValue("pc_cidade", data.cidade);
      App.Utils.setValue("pc_area", data.area);
      App.Utils.setValue("pc_escolaridade", data.escolaridade);
      App.Utils.setValue("pc_formacao", data.formacao);
      App.Utils.setValue("pc_experiencia", data.experiencia);
      App.Utils.setValue("pc_competencias_tecnicas", data.competencias_tecnicas);
      App.Utils.setValue("pc_competencias_comportamentais", data.competencias_comportamentais);
      App.Utils.setValue("pc_contexto", data.contexto);
      App.Utils.setValue("pc_deficiencia", data.deficiencia);
      App.Utils.setValue("pc_genero", data.genero);
      App.Utils.setValue("pc_raca", data.raca);
      App.Utils.setValue("pc_deficiencia_acessibilidade", data.deficiencia_acessibilidade);

      const result = document.getElementById("pc_resultado");
      if (result) {
        result.innerHTML = `
          <span class="resultado-success">Cadastro carregado.</span><br>
          Vaga: ${App.Utils.safe(data.vagas?.nome || "Não selecionada")}<br>
          Status: ${App.Utils.safe(data.status || "Novo")}<br>
          Laudo: ${data.laudo_url ? "Enviado" : "Não enviado"}
        `;
      }
    }
  },

  async uploadArquivo(inputId, bucketPrefix) {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];

    if (!file) return null;

    const extensao = file.name.split(".").pop();
    const fileName = `${App.State.user.id}/${Date.now()}-${bucketPrefix}.${extensao}`;

    const { error } = await supabaseClient
      .storage
      .from("laudos")
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    return fileName;
  },

  async enviar() {
    if (!App.State.user) return alert("Faça login novamente.");

    const nome = App.Utils.value("pc_nome").trim();
    const email = App.Utils.value("pc_email").trim();
    const telefone = App.Utils.value("pc_telefone").trim();
    const vagaId = App.Utils.value("pc_vaga");

    if (!nome || !email || !telefone || !vagaId) {
      const result = document.getElementById("pc_resultado");
      if (result) result.innerHTML = `<span class="resultado-error">Preencha nome, email, telefone e vaga.</span>`;
      return;
    }

    const vaga = App.State.vagas.find(v => v.id === vagaId);

    let curriculoPath = null;
    let laudoPath = null;

    try {
      curriculoPath = await this.uploadArquivo("pc_curriculo", "curriculo");
      laudoPath = await this.uploadArquivo("pc_laudo", "laudo");
    } catch (error) {
      const result = document.getElementById("pc_resultado");
      if (result) result.innerHTML = `<span class="resultado-error">Erro ao enviar documento: ${error.message}</span>`;
      return;
    }

    const dados = {
      user_id: App.State.user.id,
      nome,
      email,
      telefone,
      vaga_id: vagaId,
      cliente: App.Utils.value("pc_empresa") || vaga?.cliente || "",
      estado: App.Utils.value("pc_estado"),
      cidade: App.Utils.value("pc_cidade"),
      area: App.Utils.value("pc_area"),
      escolaridade: App.Utils.value("pc_escolaridade"),
      formacao: App.Utils.value("pc_formacao"),
      experiencia: App.Utils.value("pc_experiencia"),
      competencias_tecnicas: App.Utils.value("pc_competencias_tecnicas"),
      competencias_comportamentais: App.Utils.value("pc_competencias_comportamentais"),
      contexto: App.Utils.value("pc_contexto"),
      deficiencia: App.Utils.value("pc_deficiencia"),
      genero: App.Utils.value("pc_genero"),
      raca: App.Utils.value("pc_raca"),
      deficiencia_acessibilidade: App.Utils.value("pc_deficiencia_acessibilidade"),
      status: "Triagem",
      etapa: "Triagem",
      origem: "Portal do candidato"
    };

    if (curriculoPath) {
      dados.curriculo_url = curriculoPath;
      dados.curriculo_nome = document.getElementById("pc_curriculo").files[0].name;
    }

    if (laudoPath) {
      dados.laudo_url = laudoPath;
      dados.laudo_nome = document.getElementById("pc_laudo").files[0].name;
    }

    const { data: existente } = await supabaseClient
      .from("candidatos")
      .select("id")
      .eq("user_id", App.State.user.id)
      .maybeSingle();

    let result;
    if (existente) {
      result = await supabaseClient.from("candidatos").update(dados).eq("id", existente.id);
    } else {
      result = await supabaseClient.from("candidatos").insert([dados]);
    }

    if (result.error) {
      const box = document.getElementById("pc_resultado");
      if (box) box.innerHTML = `<span class="resultado-error">Erro ao salvar cadastro: ${result.error.message}</span>`;
      return;
    }

    const box = document.getElementById("pc_resultado");
    if (box) box.innerHTML = `<span class="resultado-success">Cadastro enviado com sucesso!</span>`;

    await App.Data.refreshAll();
    await this.carregarMeuCadastro();
  },

  limparFormulario() {
    [
      "pc_nome","pc_email","pc_telefone","pc_vaga","pc_empresa","pc_estado","pc_cidade","pc_area",
      "pc_escolaridade","pc_formacao","pc_experiencia","pc_competencias_tecnicas","pc_competencias_comportamentais",
      "pc_contexto","pc_deficiencia","pc_genero","pc_raca","pc_deficiencia_acessibilidade"
    ].forEach(id => App.Utils.setValue(id, ""));

    const result = document.getElementById("pc_resultado");
    if (result) result.innerHTML = "";
  }
};

// ============================================================
// UPLOAD CSV
// ============================================================

App.Controllers.Upload = {
  baixarModeloCSV() {
    const csv = "nome,email,telefone,estado,cidade,deficiencia,genero,raca,escolaridade,area,status\\n";
    App.Utils.download("modelo_candidatos.csv", csv, "text/csv;charset=utf-8");
  },

  importarCSV() {
    const file = document.getElementById("csvFile")?.files?.[0];
    const box = document.getElementById("uploadResumo");

    if (!file) {
      if (box) box.innerText = "Selecione um arquivo CSV.";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const linhas = e.target.result.split(/\r?\n/).filter(Boolean);
      const headers = linhas.shift().split(",").map(h => h.trim());

      const registros = linhas.map(linha => {
        const cols = linha.split(",");
        const obj = {};
        headers.forEach((h, i) => obj[h] = cols[i] || "");
        return {
          nome: obj.nome,
          email: obj.email,
          telefone: obj.telefone,
          estado: obj.estado,
          cidade: obj.cidade,
          deficiencia: obj.deficiencia,
          genero: obj.genero,
          raca: obj.raca,
          escolaridade: obj.escolaridade,
          area: obj.area,
          status: obj.status || "Triagem",
          etapa: obj.status || "Triagem",
          origem: "Upload CSV"
        };
      });

      const { error } = await supabaseClient.from("candidatos").insert(registros);

      if (error) {
        if (box) box.innerText = "Erro ao importar: " + error.message;
        return;
      }

      if (box) box.innerText = `${registros.length} candidatos importados com sucesso.`;
      await App.Data.refreshAll();
    };

    reader.readAsText(file, "UTF-8");
  }
};

// ============================================================
// FEEDBACK
// ============================================================

App.Controllers.Feedback = {
  populateSelects() {
    const vagaSelect = document.getElementById("f_vaga");
    const candSelect = document.getElementById("f_candidato");

    if (vagaSelect) {
      vagaSelect.innerHTML = `<option value="">Selecione</option>` + App.State.vagas.map(v => App.Utils.option(v.id, v.nome)).join("");
      vagaSelect.onchange = () => this.atualizarCandidatos();
    }

    if (candSelect) {
      candSelect.innerHTML = `<option value="">Selecione</option>` + App.State.candidatos.map(c => App.Utils.option(c.id, c.nome)).join("");
      candSelect.onchange = () => this.atualizarEmpresa();
    }
  },

  atualizarCandidatos() {
    const vagaId = App.Utils.value("f_vaga");
    const candSelect = document.getElementById("f_candidato");
    if (!candSelect) return;

    const candidatos = App.State.candidatos.filter(c => !vagaId || c.vaga_id === vagaId);
    candSelect.innerHTML = `<option value="">Selecione</option>` + candidatos.map(c => App.Utils.option(c.id, c.nome)).join("");
  },

  atualizarEmpresa() {
    const c = App.State.candidatos.find(item => item.id === App.Utils.value("f_candidato"));
    App.Utils.setValue("f_empresa", c?.cliente || c?.vagas?.cliente || "");
  },

  async gerar() {
    const c = App.State.candidatos.find(item => item.id === App.Utils.value("f_candidato"));
    const etapa = App.Utils.value("f_etapa");

    if (!c || !etapa) return alert("Selecione candidato e etapa.");

    const texto = `Olá, ${c.nome}. Tudo bem?

Passando para te atualizar sobre o processo seletivo${c.vagas?.nome ? ` para a vaga de ${c.vagas.nome}` : ""}.

Neste momento, seu status no processo é: ${etapa}.

Agradecemos muito pelo seu tempo, interesse e disponibilidade ao longo do processo. Seguimos à disposição e, havendo novidades ou oportunidades aderentes ao seu perfil, entraremos em contato.

Atenciosamente,
Talentos+`;

    App.Utils.setValue("f_texto", texto);

    const { error } = await supabaseClient
      .from("candidatos")
      .update({
        feedback_candidato: texto,
        data_feedback: new Date().toISOString()
      })
      .eq("id", c.id);

    if (!error) await App.Data.refreshAll();
  },

  enviarWhatsApp() {
    const c = App.State.candidatos.find(item => item.id === App.Utils.value("f_candidato"));
    const texto = App.Utils.value("f_texto");

    if (!c || !c.telefone || !texto) return alert("Gere o feedback e confira o telefone do candidato.");

    const telefone = c.telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(texto)}`, "_blank");
  }
};

// ============================================================
// PARECER
// ============================================================

App.Controllers.Parecer = {
  populateSelects() {
    const vagaSelect = document.getElementById("p_vaga");
    const candSelect = document.getElementById("p_candidato");

    if (vagaSelect) {
      vagaSelect.innerHTML = `<option value="">Selecione</option>` + App.State.vagas.map(v => App.Utils.option(v.id, v.nome)).join("");
      vagaSelect.onchange = () => {
        const vagaId = App.Utils.value("p_vaga");
        const candidatos = App.State.candidatos.filter(c => !vagaId || c.vaga_id === vagaId);
        candSelect.innerHTML = `<option value="">Selecione</option>` + candidatos.map(c => App.Utils.option(c.id, c.nome)).join("");
      };
    }

    if (candSelect) {
      candSelect.innerHTML = `<option value="">Selecione</option>` + App.State.candidatos.map(c => App.Utils.option(c.id, c.nome)).join("");
    }
  },

  async gerar() {
    const c = App.State.candidatos.find(item => item.id === App.Utils.value("p_candidato"));
    const transcricao = App.Utils.value("p_transcricao");

    if (!c) return alert("Selecione um candidato.");

    const vaga = c.vagas?.nome || "vaga não informada";

    const texto = `${c.nome} participa do processo seletivo para a ${vaga}. ${c.contexto || "A pessoa candidata apresenta interesse na oportunidade e disponibilidade para avaliação do perfil."}

Em relação à experiência profissional, observa-se trajetória relacionada a ${c.area || "área informada no cadastro"}, com vivências descritas em ${c.experiencia || "informações registradas no processo"}. A análise indica potencial de aderência às demandas da posição, especialmente considerando o contexto da vaga e os requisitos apresentados.

No aspecto técnico, destacam-se competências como ${c.competencias_tecnicas || "competências ainda não detalhadas"}. Esses elementos devem ser validados em etapa técnica ou conversa com gestor, especialmente para confirmar profundidade prática e consistência nas entregas.

Sobre competências comportamentais, foram identificados pontos relacionados a ${c.competencias_comportamentais || "comunicação, postura, organização e relacionamento interpessoal"}. A avaliação sugere considerar exemplos práticos em entrevista para ampliar a previsibilidade de adaptação ao ambiente.

Sobre deficiência e acessibilidade, a análise deve ser conduzida de forma profissional, neutra e sem gerar viés. ${c.deficiencia_acessibilidade || "Até o momento, não foram registradas necessidades específicas de adaptação para o processo ou função."}

De forma geral, o perfil apresenta aderência ${c.aderencia || "a avaliar"} à posição. Recomenda-se seguir com validação junto ao gestor, considerando experiência, comunicação, aderência técnica e alinhamento com o contexto da oportunidade.

Observações da entrevista:
${transcricao || "Sem transcrição adicional inserida."}`;

    App.Utils.setValue("p_texto", texto);

    const { error } = await supabaseClient
      .from("candidatos")
      .update({
        parecer: texto,
        parecer_resumo: c.contexto || "",
        parecer_experiencia: c.experiencia || "",
        parecer_comportamental: c.competencias_comportamentais || "",
        parecer_deficiencia: c.deficiencia_acessibilidade || "",
        parecer_conclusao: `Aderência ${c.aderencia || "a avaliar"} para ${vaga}.`
      })
      .eq("id", c.id);

    if (error) alert("Parecer gerado, mas não foi salvo: " + error.message);
    await App.Data.refreshAll();
  }
};

// ============================================================
// RETORNO AO CLIENTE
// ============================================================

App.Controllers.Retorno = {
  populateSelects() {
    const clienteSelect = document.getElementById("r_cliente");
    const vagaSelect = document.getElementById("r_vaga");

    if (clienteSelect) {
      const clientes = App.Utils.unique(App.State.vagas.map(v => v.cliente));
      clienteSelect.innerHTML = `<option value="">Selecione</option>` + clientes.map(c => App.Utils.option(c, c)).join("");
      clienteSelect.onchange = () => {
        const cliente = App.Utils.value("r_cliente");
        const vagas = App.State.vagas.filter(v => !cliente || v.cliente === cliente);
        if (vagaSelect) vagaSelect.innerHTML = `<option value="">Selecione</option>` + vagas.map(v => App.Utils.option(v.id, v.nome)).join("");
      };
    }

    if (vagaSelect) {
      vagaSelect.innerHTML = `<option value="">Selecione</option>` + App.State.vagas.map(v => App.Utils.option(v.id, v.nome)).join("");
    }
  },

  gerar() {
    const vagaId = App.Utils.value("r_vaga");
    const vaga = App.State.vagas.find(v => v.id === vagaId);
    const candidatos = App.State.candidatos.filter(c => c.vaga_id === vagaId);

    if (!vaga) return alert("Selecione a vaga.");

    const texto = `Olá, time.

Segue atualização consultiva da vaga ${vaga.nome}, cliente ${vaga.cliente || "não informado"}.

Até o momento, temos ${candidatos.length} candidato(s) vinculados ao processo.

Distribuição por status:
${this.statusResumo(candidatos)}

Leitura consultiva:
A vaga deve ser acompanhada considerando aderência técnica, conversão de candidatos e eventuais barreiras relacionadas a salário, localização, requisitos obrigatórios e acessibilidade. Recomenda-se manter alinhamento constante para evitar alongamento de SLA.`;

    App.Utils.setValue("r_texto", texto);

    const dash = document.getElementById("r_dashboard");
    if (dash) dash.innerText = `Total de candidatos: ${candidatos.length}\n${this.statusResumo(candidatos)}`;
  },

  statusResumo(candidatos) {
    const map = {};
    candidatos.forEach(c => {
      const s = c.status || "Sem status";
      map[s] = (map[s] || 0) + 1;
    });

    return Object.entries(map).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- Sem candidatos vinculados";
  }
};

// ============================================================
// DIVERSIDADE + DASHBOARD
// ============================================================

App.Controllers.Diversidade = {
  render() {
    this.renderLista("chart_genero", "genero");
    this.renderLista("chart_deficiencia", "deficiencia");
    this.renderLista("chart_raca", "raca");
    this.renderLista("chart_estado", "estado");

    const result = document.getElementById("d_resultado");
    if (result) result.innerText = `Base total: ${App.State.candidatos.length} candidatos.`;
  },

  renderLista(id, campo) {
    const el = document.getElementById(id);
    if (!el) return;

    const map = {};
    App.State.candidatos.forEach(c => {
      const value = c[campo] || "Não informado";
      map[value] = (map[value] || 0) + 1;
    });

    el.innerHTML = `<div style="padding:16px;">${Object.entries(map).map(([k, v]) => `
      <div style="margin-bottom:10px;">
        <strong>${App.Utils.safe(k)}</strong>: ${v}
      </div>
    `).join("")}</div>`;
  }
};

App.Controllers.Dashboard = {
  render() {
    this.renderChart("chart_funil", "status");
    this.renderChart("chart_conversao", "aderencia");
    this.renderChart("chart_desistencia", "origem");
    this.renderChart("chart_tempo_contratacao", "data_contratacao");

    const vagas = App.State.vagas.length;
    const candidatos = App.State.candidatos.length;
    const mapeamentos = App.State.mapeamentos.length;
    const aprovados = App.State.candidatos.filter(c => c.status === "Aprovado").length;

    const resumo = document.getElementById("dash_geral_resumo");
    if (resumo) resumo.innerText = `Vagas: ${vagas}\nCandidatos: ${candidatos}\nMapeamentos: ${mapeamentos}\nAprovados: ${aprovados}`;

    const op = document.getElementById("dash_operacional");
    if (op) op.innerText = `Funil operacional atualizado com ${candidatos} candidatos cadastrados.`;

    const est = document.getElementById("dash_estrategico");
    if (est) est.innerText = `Visão estratégica: acompanhar conversão, aderência e gargalos por vaga/cliente.`;

    const clienteSelect = document.getElementById("dash_cliente");
    if (clienteSelect) {
      const clientes = App.Utils.unique(App.State.vagas.map(v => v.cliente));
      clienteSelect.innerHTML = `<option value="">Selecione</option>` + clientes.map(c => App.Utils.option(c, c)).join("");
    }
  },

  renderChart(id, campo) {
    const el = document.getElementById(id);
    if (!el) return;

    const map = {};
    App.State.candidatos.forEach(c => {
      const value = c[campo] || "Não informado";
      map[value] = (map[value] || 0) + 1;
    });

    el.innerHTML = `<div style="padding:16px;">${Object.entries(map).map(([k, v]) => `
      <div style="margin-bottom:10px;">
        <strong>${App.Utils.safe(k)}</strong>: ${v}
      </div>
    `).join("") || "Sem dados"}</div>`;
  },

  atualizarCliente() {
    const cliente = App.Utils.value("dash_cliente");
    const vagas = App.State.vagas.filter(v => v.cliente === cliente);
    const candidatos = App.State.candidatos.filter(c => c.cliente === cliente || c.vagas?.cliente === cliente);

    const el = document.getElementById("dash_cliente_resultado");
    if (el) el.innerText = `Cliente: ${cliente || "não selecionado"}\nVagas: ${vagas.length}\nCandidatos: ${candidatos.length}`;
  }
};

// ============================================================
// SYSTEM
// ============================================================

App.Controllers.System = {
  exportarBackup() {
    const backup = {
      exportado_em: new Date().toISOString(),
      vagas: App.State.vagas,
      candidatos: App.State.candidatos,
      mapeamentos: App.State.mapeamentos
    };

    App.Utils.download("backup_talentos_plus.json", JSON.stringify(backup, null, 2));
  },

  restaurarBackup() {
    alert("Restauração direta via arquivo será tratada em uma próxima etapa para evitar sobrescrever dados do Supabase sem validação.");
  },

  gerarResumoTecnico() {
    const el = document.getElementById("systemResumo");
    if (el) {
      el.innerText = `Sistema conectado ao Supabase.\nLogin por Auth.\nControle por profiles.tipo.\nBucket privado: laudos.\nTabelas: vagas, candidatos, mapeamentos.`;
    }
  }
};