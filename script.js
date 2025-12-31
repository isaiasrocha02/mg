// --- CONFIGURAÇÃO DO SERVIDOR ---
const API_URL = "https://mg-58kv.onrender.com"; // ⚠️ Cole o link do Render aqui

if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && API_URL.includes("localhost")) {
  alert("⚠️ ERRO: O site está no GitHub Pages, mas configurado para 'localhost'.\n\nVocê precisa hospedar o backend (no Render) e atualizar a API_URL neste arquivo.");
}

// ---------------------- AUTENTICAÇÃO ----------------------
const currentUser = JSON.parse(localStorage.getItem("currentUser"));
const token = localStorage.getItem("token");

// Se não estiver logado, manda para o login
if (!currentUser) {
  window.location.href = "index.html";
} else {
  // Exibe nome do usuário
  const greeting = document.getElementById("userGreeting");
  if(greeting) greeting.innerText = `Olá, ${currentUser.nome}`;
}

// ---------------------- TEMA CLARO/ESCURO ----------------------
const temaSalvo = localStorage.getItem("tema") || "escuro";
if (temaSalvo === "claro") document.body.classList.add("tema-claro");

function alternarTema() {
  document.body.classList.toggle("tema-claro");

  const temaAtual = document.body.classList.contains("tema-claro") ? "claro" : "escuro";
  localStorage.setItem("tema", temaAtual);

  // troca o ícone do botão
  const btn = document.getElementById("btnTema");
  btn.innerText = temaAtual === "claro" ? "🌞" : "🌙";
}

// garante que o ícone certo aparece ao carregar a página
window.addEventListener("load", () => {
  const btn = document.getElementById("btnTema");
  btn.innerText = document.body.classList.contains("tema-claro") ? "🌞" : "🌙";
});





function toggleTodos() {
    const checks = document.querySelectorAll(".chkJogo");
    const algumMarcado = Array.from(checks).some(c => c.checked);
    checks.forEach(c => c.checked = !algumMarcado);
}

function removerSelecionados() {
    const checks = document.querySelectorAll(".chkJogo:checked");
    const idxs = Array.from(checks).map(c => parseInt(c.dataset.index));

    if (!idxs.length) return alert("Nenhum jogo marcado.");

    // remover do final para o começo
    idxs.sort((a, b) => b - a).forEach(i => apostas.splice(i, 1));

    salvarApostas();
    atualizarApostas();
}





// script.js - lógica principal

// helpers
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const inRange = n => Number.isInteger(n) && n >= 1 && n <= 60;

// armazenamento
let numerosSorteados = []; // Será carregado da API

// CARREGA APOSTAS ESPECÍFICAS DO USUÁRIO LOGADO
let apostas = []; // Será carregado da API
let concurso = "";
let dataSorteio = "";

// Inputs de Concurso e Data
const concursoInput = $("concursoInput");
const dataSorteioInput = $("dataSorteioInput");

// Listeners para salvar automaticamente ao mudar concurso/data
if(concursoInput) concursoInput.addEventListener("input", (e) => { concurso = e.target.value; salvarApostas(); });
if(dataSorteioInput) dataSorteioInput.addEventListener("input", (e) => { dataSorteio = e.target.value; salvarApostas(); });

// elementos
const sorteioGrid = $("sorteioGrid");
const limparSorteioBtn = $("limparSorteioBtn");
const pdfInput = $("pdfInput");
const pdfLog = $("pdfLog");
const listaApostas = $("listaApostas");
const nenhumaAposta = $("nenhumaAposta");
const manualInputs = $("manualInputs");
const addFieldBtn = $("addField");
const removeFieldBtn = $("removeField");
const criarApostaManualBtn = $("criarApostaManual");
const manualErro = $("manualErro");
const entrarManualSorteioBtn = $("entrarManualSorteioBtn");
const manualSorteioArea = $("manualSorteio");
const sorteioInputs = $("sorteioInputs");
const salvarSorteioManualBtn = $("salvarSorteioManual");
const importJsonInput = $("importJsonInput");

// montar grid 1–60
function montarGrid() {
  sorteioGrid.innerHTML = "";
  for (let i = 1; i <= 60; i++) {
    const div = document.createElement("div");
    div.className = "numero";
    div.innerText = pad(i);
    if (numerosSorteados.includes(i)) div.classList.add("selecionado");
    div.addEventListener("click", () => {
      toggleSorteioNum(i);
    });
    sorteioGrid.appendChild(div);
  }
}
function toggleSorteioNum(n) {
  if (numerosSorteados.includes(n)) {
    numerosSorteados = numerosSorteados.filter(x => x !== n);
  } else {
    if (numerosSorteados.length >= 6) {
      alert("Somente 6 dezenas podem ser selecionadas para o sorteio.");
      return;
    }
    numerosSorteados.push(n);
  }
  salvarSorteio();
  montarGrid();
  atualizarApostas();
}
function limparSorteio() {
  numerosSorteados = [];
  salvarSorteio();
  montarGrid();
  atualizarApostas();
}
limparSorteioBtn.addEventListener("click", limparSorteio);

// manual sorteio UI
entrarManualSorteioBtn.addEventListener("click", () => {
  manualSorteioArea.style.display = manualSorteioArea.style.display === "none" ? "block" : "none";
  construirSorteioInputs();
});
function construirSorteioInputs() {
  sorteioInputs.innerHTML = "";
  const count = Math.max(numerosSorteados.length, 6);
  for (let i = 0; i < 6; i++) {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.className = "small-input";
    inp.min = 1; inp.max = 60;
    inp.value = numerosSorteados[i] ? pad(numerosSorteados[i]) : "";
    inp.addEventListener("input", onSorteioManualInput);
    sorteioInputs.appendChild(inp);
  }
}
function onSorteioManualInput(e) {
  const all = Array.from(sorteioInputs.querySelectorAll("input"));
  // auto-pulo
  if (e.target.value.length >= 2) {
    const idx = all.indexOf(e.target);
    if (idx < all.length - 1) all[idx + 1].focus();
  }
}
salvarSorteioManualBtn.addEventListener("click", () => {
  const vals = Array.from(sorteioInputs.querySelectorAll("input"))
    .map(i => parseInt(i.value))
    .filter(v => !isNaN(v));
  if (vals.length !== 6) return alert("Digite exatamente 6 dezenas do sorteio.");
  // valida e não repete
  const uniq = [...new Set(vals)];
  if (uniq.length !== 6) return alert("Não pode repetir dezenas no sorteio.");
  if (!uniq.every(inRange)) return alert("Dezenas devem estar entre 01 e 60.");
  numerosSorteados = uniq;
  salvarSorteio();
  montarGrid();
  atualizarApostas();
  manualSorteioArea.style.display = "none";
});

// salvar sorteio
async function salvarSorteio() {
  localStorage.setItem("sorteio", JSON.stringify(numerosSorteados));
  try {
    await fetch(`${API_URL}/api/sorteio`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ numeros: numerosSorteados })
    });
  } catch (err) { console.error("Erro ao salvar sorteio", err); }
}

// carregar apostas e exibir
async function salvarApostas() {
  try {
    await fetch(`${API_URL}/api/apostas`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ apostas, concurso, data: dataSorteio })
    });
  } catch (err) {
    console.error("Erro ao salvar no servidor", err);
    alert("⚠️ Erro ao salvar aposta no servidor! Verifique sua conexão.");
  }
}
function atualizarApostas() {

  // limpa a lista antes de montar tudo
  listaApostas.innerHTML = "";

  // 🔵 BOTÕES FIXOS ACIMA DA LISTA
  const barraAcoes = document.createElement("div");
  barraAcoes.style.marginBottom = "15px";
  barraAcoes.style.display = "flex";
  barraAcoes.style.gap = "10px";

  const btnRemoveSel = document.createElement("button");
  btnRemoveSel.innerText = "Remover Selecionados";
  btnRemoveSel.className = "danger";
  btnRemoveSel.onclick = removerSelecionados;

  const btnSelectAll = document.createElement("button");
  btnSelectAll.innerText = "Marcar / Desmarcar Todos";
  btnSelectAll.onclick = toggleTodos;

  const btnBaixar = document.createElement("button");
  btnBaixar.innerText = "Baixar";
  btnBaixar.className = "secondary";
  btnBaixar.onclick = baixarApostas;

  const btnAnexar = document.createElement("button");
  btnAnexar.innerText = "Anexar";
  btnAnexar.className = "secondary";
  btnAnexar.onclick = () => importJsonInput.click();

  barraAcoes.appendChild(btnRemoveSel);
  barraAcoes.appendChild(btnSelectAll);
  barraAcoes.appendChild(btnBaixar);
  barraAcoes.appendChild(btnAnexar);

  // adiciona a barra acima da lista
  listaApostas.appendChild(barraAcoes);

  // caso não existam apostas
  if (!apostas.length) {
    nenhumaAposta.innerText = "Nenhuma aposta carregada.";
    return;
  } else {
    nenhumaAposta.innerText = "";
  }

  // 🔵 LISTA DE APOSTAS
  apostas.forEach((jogo, idx) => {

    const cont = document.createElement("div");
    cont.className = "jogo";

    // checkbox + título
    const header = document.createElement("div");
    header.className = "jogo-header";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "chkJogo";
    check.dataset.index = idx;

    const title = document.createElement("strong");
    title.innerText = `Jogo ${idx + 1}`;

    const del = document.createElement("button");
    del.className = "danger";
    del.innerText = "Remover";
    del.addEventListener("click", () => {
      if (!confirm("Remover esse jogo?")) return;
      apostas.splice(idx, 1);
      salvarApostas();
      atualizarApostas();
    });

    header.appendChild(check);
    header.appendChild(title);
    header.appendChild(del);

    // dezenas
    const numsDiv = document.createElement("div");
    numsDiv.className = "jogo-numeros";

    let acertos = 0;

    jogo.forEach(num => {
      const s = document.createElement("span");
      s.className = "num";
      s.innerText = pad(num);

      if (numerosSorteados.includes(num)) {
        s.classList.add("acerto");
        acertos++;
      } else {
        s.classList.add("erro");
      }

      numsDiv.appendChild(s);
    });

    const resultado = document.createElement("div");
    resultado.className = "resultado";
    if (acertos === 4) resultado.innerText = "🎉 Você acertou uma QUADRA!";
    else if (acertos === 5) resultado.innerText = "🥳 Você acertou uma QUINA!";
    else if (acertos === 6) resultado.innerText = "💰💰 Você é um MILIONÁRIO!";
    else resultado.innerText = `${acertos} acertos`;

    cont.appendChild(header);
    cont.appendChild(numsDiv);
    cont.appendChild(resultado);

    listaApostas.appendChild(cont);

  });
}

// inicialização
async function init() {
  
  // Carregar Sorteio do Servidor
  try {
    const resSorteio = await fetch(`${API_URL}/api/sorteio`);
    if (resSorteio.ok) numerosSorteados = await resSorteio.json();
  } catch (e) { console.error("Erro ao carregar sorteio", e); }
  
  montarGrid(); // Monta o grid já com os números certos

  try {
    const res = await fetch(`${API_URL}/api/apostas`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      // Verifica se é o formato antigo (array) ou novo (objeto)
      if (Array.isArray(data)) {
        apostas = data;
      } else {
        apostas = data.games || [];
        concurso = data.concurso || "";
        dataSorteio = data.data || "";
      }
      if(concursoInput) concursoInput.value = concurso;
      if(dataSorteioInput) dataSorteioInput.value = dataSorteio;
    } else if (res.status === 401) {
      logout();
      return;
    }
  } catch (err) {
    console.error("Erro ao carregar apostas do servidor", err);
  }
  atualizarApostas();
}
init();

// --- MONTE O FORMULÁRIO PARA CRIAR APOSTA MANUAL ---
let manualFieldCount = 6;
function construirManualInputs() {
  manualInputs.innerHTML = "";
  for (let i = 0; i < manualFieldCount; i++) {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = 1; inp.max = 60;
    inp.className = "small-input";
    inp.placeholder = pad(i + 1);
    inp.addEventListener("input", (e) => {
      // auto-pulo
      if (e.target.value.length >= 2) {
        const elems = Array.from(manualInputs.querySelectorAll("input"));
        const idx = elems.indexOf(e.target);
        if (idx < elems.length - 1) elems[idx + 1].focus();
      }
      // remover zeros à esquerda e manter número
      if (e.target.value) {
        let v = parseInt(e.target.value);
        if (!isNaN(v)) e.target.value = v;
      }
    });
    manualInputs.appendChild(inp);
  }
  manualErro.innerText = "";
}
addFieldBtn.addEventListener("click", () => {
  if (manualFieldCount >= 8) return;
  manualFieldCount++;
  construirManualInputs();
});
removeFieldBtn.addEventListener("click", () => {
  if (manualFieldCount <= 6) return;
  manualFieldCount--;
  construirManualInputs();
});
criarApostaManualBtn.addEventListener("click", () => {
  const vals = Array.from(manualInputs.querySelectorAll("input"))
    .map(i => parseInt(i.value))
    .filter(v => !isNaN(v));
  if (vals.length < 6) return manualErro.innerText = "Insira pelo menos 6 dezenas.";
  if (vals.length > 8) return manualErro.innerText = "Máximo 8 dezenas.";
  if (!vals.every(inRange)) return manualErro.innerText = "Valores inválidos (01–60).";
  const uniq = [...new Set(vals)];
  if (uniq.length !== vals.length) return manualErro.innerText = "Não repita dezenas no mesmo jogo.";
  apostas.push(uniq);
  salvarApostas();
  atualizarApostas();
  manualErro.innerText = "Aposta adicionada!";
  setTimeout(() => manualErro.innerText = "", 1500);
  // reset fields
  manualInputs.querySelectorAll("input").forEach(i => i.value = "");
});

// construir inicialmente 6 campos
construirManualInputs();

// --- LEITURA DE PDFs E EXTRAÇÃO DE JOGOS ---
function logPdf(msg) {
  const p = document.createElement("div");
  p.innerText = msg;
  pdfLog.prepend(p);
}

// --- LEITURA DE PDFs E EXTRAÇÃO MELHORADA (agrupa tokens por linha usando posições do pdf.js)
pdfInput.addEventListener("change", async (ev) => {
  const files = Array.from(ev.target.files);
  if (!files.length) return;
  logPdf(`Processando ${files.length} arquivo(s)...`);
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let foundThisFile = 0;
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        // AGRUPAR ITENS POR LINHA USANDO A COORDENADA Y (transform[5])
        const linesMap = new Map();
        content.items.forEach(it => {
          const y = Math.round((it.transform && it.transform.length >= 6) ? it.transform[5] : 0);
          if (!linesMap.has(y)) linesMap.set(y, []);
          linesMap.get(y).push({ str: it.str, x: (it.transform && it.transform.length >= 4) ? it.transform[4] : 0 });
        });
        const ys = Array.from(linesMap.keys()).sort((a,b)=>b-a);
        const pageTextLines = ys.map(y => {
          const parts = linesMap.get(y).sort((a,b)=>a.x-b.x).map(x=>x.str);
          return parts.join(' ');
        });
        const conteudo = pageTextLines.join('\n');

        const matches = new Set();

        // 1) linhas com pipes (09 | 32 | 41 | ...)
        const pipeRegex = /((?:\b\d{1,2}\b\s*\|\s*){5,7}\b\d{1,2}\b)/g;
        let m;
        while ((m = pipeRegex.exec(conteudo)) !== null) {
          const nums = Array.from(m[0].matchAll(/\b(\d{1,2})\b/g)).map(x=>parseInt(x[1])).filter(n => n>=1 && n<=60);
          if (nums.length >=6 && nums.length <=8) matches.add(JSON.stringify(nums));
        }

        // 2) procurar após 'Jogo X' (pega até 300 chars depois)
        const jogoHeaderRegex = /Jogo\s*(\d+)/gi;
        while ((m = jogoHeaderRegex.exec(conteudo)) !== null) {
          const startIdx = m.index + m[0].length;
          const tail = conteudo.substring(startIdx, startIdx + 300);
          const nums = Array.from(tail.matchAll(/\b(\d{1,2})\b/g)).map(x=>parseInt(x[1])).filter(n => n>=1 && n<=60);
          if (nums.length >=6 && nums.length <=8) matches.add(JSON.stringify(nums.slice(0,8)));
        }

        // 3) fallback: sequências de 6-8 números na mesma linha
        pageTextLines.forEach(line => {
          const seqRegex = /((?:\b\d{1,2}\b[\s,;.|-]*){6,8})/g;
          let mm;
          while ((mm = seqRegex.exec(line)) !== null) {
            const nums = Array.from(mm[0].matchAll(/\b(\d{1,2})\b/g)).map(x=>parseInt(x[1])).filter(n => n>=1 && n<=60);
            if (nums.length >=6 && nums.length <=8) matches.add(JSON.stringify(nums));
          }
        });

        // adicionar matches detectados
        for (const j of matches) {
          const arr = JSON.parse(j);
          const existe = apostas.some(a => JSON.stringify(a) === JSON.stringify(arr));
          if (!existe) {
            apostas.push(arr);
            foundThisFile++;
          }
        }
      } // pages
      salvarApostas();
      atualizarApostas();
      logPdf(`Arquivo "${file.name}" -> adicionados ${foundThisFile} jogo(s).`);
    } catch (err) {
      console.error(err);
      logPdf(`Erro ao processar "${file.name}": ${err.message}`);
    }
  }
  ev.target.value = "";
});

function baixarApostas() {
  if (!apostas.length) return alert("Nenhuma aposta para baixar.");
  const blob = new Blob([JSON.stringify(apostas)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "apostas.json";
  a.click();
  URL.revokeObjectURL(url);
}

importJsonInput.addEventListener("change", () => {
  const file = importJsonInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const novos = JSON.parse(e.target.result);
      if (!Array.isArray(novos)) return alert("Arquivo inválido.");
      const antes = apostas.length;
      novos.forEach(n => {
        // verifica se é array e se já não existe exatamente igual
        if (Array.isArray(n) && !apostas.some(a => JSON.stringify(a) === JSON.stringify(n))) {
          apostas.push(n);
        }
      });
      salvarApostas();
      atualizarApostas();
      alert(`${apostas.length - antes} apostas anexadas com sucesso.`);
    } catch (err) {
      alert("Erro ao ler JSON.");
    }
    importJsonInput.value = "";
  };
  reader.readAsText(file);
});

function abrirModalSenha() {
  document.getElementById("modalSenha").style.display = "block";
  document.getElementById("senhaAtual").value = "";
  document.getElementById("novaSenha").value = "";
}

async function salvarNovaSenha() {
  const currentPassword = document.getElementById("senhaAtual").value;
  const newPassword = document.getElementById("novaSenha").value;
  
  if (!currentPassword || !newPassword) return alert("Preencha os campos.");

  try {
    const res = await fetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    
    if (res.ok) {
      alert("Senha alterada com sucesso!");
      document.getElementById("modalSenha").style.display = "none";
    } else {
      alert(data.error || "Erro ao alterar senha.");
    }
  } catch (err) {
    alert("Erro de conexão.");
  }
}

function logout() {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("token");
  window.location.href = "index.html";
}