import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNHOPKa320_cY0KUY8vBVVYRmcYkmWo0Y",
  authDomain: "bd-saripan.firebaseapp.com",
  projectId: "bd-saripan",
  storageBucket: "bd-saripan.firebasestorage.app",
  messagingSenderId: "545578993360",
  appId: "1:545578993360:web:d410a5cbedd914ad3800d5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.db = db;
window.transacoes = [];
window.regras = [];
window.contas = [];
window.categoriasExtras = [];
window.transacoesPendentes = [];
let chartInstance = null;

const CATEGORIAS_PADRAO = [
  {v: 'classificar', l: '🏷️ A Classificar'},
  {v: 'transferencia_interna', l: '🔄 Transferência Interna'},
  {v: 'alimentacao', l: '🍔 Alimentação'},
  {v: 'transporte', l: '🚗 Transporte'},
  {v: 'moradia', l: '🏠 Moradia'},
  {v: 'lazer', l: '🎬 Lazer / Compras'},
  {v: 'saude', l: '💊 Saúde'},
  {v: 'salario', l: '💰 Renda Externa'},
  {v: 'avulso', l: '🏛️ Saldo Inicial'}
];

window.limparTextoParaIA = (texto) => {
  if (!texto) return "";
  let limpo = texto.toUpperCase();
  limpo = limpo.replace(/PIX.*?DES:/g, '')
               .replace(/PAGTO ELETRONICO TRIBUTO/g, '')
               .replace(/TED C SAL P\/POUPANCA/g, '');
  limpo = limpo.replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g, ''); 
  limpo = limpo.replace(/\b\d{5,}\b/g, ''); 
  limpo = limpo.replace(/[-/]/g, ' ').replace(/\s+/g, ' ').trim();
  return limpo;
};

// Alterna a interface visual entre Fatura Mensal e Período Livre
window.alternarModoPeriodo = () => {
  const modo = document.getElementById('modoPeriodo').value;
  const bMes = document.getElementById('blocoFiltroMes');
  const bIni = document.getElementById('blocoFiltroDataInicio');
  const bFim = document.getElementById('blocoFiltroDataFim');

  if (modo === 'mes') {
    bMes.classList.remove('hidden');
    bIni.classList.add('hidden');
    bFim.classList.add('hidden');
  } else {
    bMes.classList.add('hidden');
    bIni.classList.remove('hidden');
    bFim.classList.remove('hidden');
  }
  window.renderizarRegistrosSalvos();
};

window.atualizarFiltroMeses = () => {
  const sel = document.getElementById('filtroMes');
  if (!sel) return;
  const valAtual = sel.value;
  const meses = new Set();
  window.transacoes.forEach(t => {
    const [y, m] = t.data.split('-');
    meses.add(`${m}/${y}`);
  });
  const mesesArr = Array.from(meses).sort((a,b) => {
    const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/');
    return new Date(`${yb}-${mb}-01`) - new Date(`${ya}-${ma}-01`);
  });
  sel.innerHTML = '<option value="todos">Todos os Meses</option>' + mesesArr.map(m => `<option value="${m}">${m}</option>`).join('');
  if (mesesArr.includes(valAtual)) sel.value = valAtual;
};

window.carregarTodosOsDados = async () => {
  try {
    const [snapContas, snapRegras, snapTransacoes, snapCats] = await Promise.all([
      getDocs(collection(db, "banco_contas")),
      getDocs(collection(db, "banco_regras")),
      getDocs(collection(db, "banco_transacoes")),
      getDocs(collection(db, "banco_categorias"))
    ]);

    window.contas = snapContas.docs.map(d => d.data());
    window.regras = snapRegras.docs.map(d => d.data());
    window.transacoes = snapTransacoes.docs.map(d => d.data());
    window.categoriasExtras = snapCats.docs.map(d => d.data());
    
    window.atualizarFiltroMeses();
    window.renderizarContas();
    window.renderizarDropdownContas();
    window.renderizarCategoriasConfig();
    window.renderizarFiltroCategoria();
    window.renderizarRegistrosSalvos();
    window.renderizarDashboard();
  } catch (e) { console.error("Erro DB: ", e); }
};

function getTodasCategorias() { return [...CATEGORIAS_PADRAO, ...window.categoriasExtras]; }
function getCatLabel(val) { const found = getTodasCategorias().find(c => c.v === val); return found ? found.l : val; }
function getSelectOptions(catSelected) { return getTodasCategorias().map(c => `<option value="${c.v}" ${catSelected === c.v ? 'selected' : ''}>${c.l}</option>`).join(''); }

window.renderizarFiltroCategoria = () => {
  const sel = document.getElementById('filtroCategoria');
  if(sel) sel.innerHTML = '<option value="todas">Todas as Categorias</option>' + getSelectOptions('');
};

window.adicionarCategoria = async () => {
  const emoji = document.getElementById('cadCatEmoji').value || '';
  const nome = document.getElementById('cadCatNome').value.trim();
  if(!nome) return alert("Preencha o nome da categoria.");
  
  const valorID = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
  const labelVisual = `${emoji} ${nome}`;
  if(getTodasCategorias().find(c => c.v === valorID)) return alert("Esta categoria já existe!");
  
  const novaCat = { id: `CAT-${Date.now()}`, v: valorID, l: labelVisual, emoji: emoji, nome: nome };
  try {
    await setDoc(doc(db, "banco_categorias", novaCat.id), novaCat);
    window.categoriasExtras.push(novaCat);
    document.getElementById('cadCatNome').value = '';
    window.renderizarCategoriasConfig();
    window.renderizarFiltroCategoria();
    window.renderizarRegistrosSalvos();
    window.mostrarToast("Categoria Criada!");
  } catch(e) { alert("Erro ao criar categoria."); }
};

window.excluirCategoria = async (id) => {
  if(!confirm("Deseja excluir esta categoria customizada?")) return;
  try {
    await deleteDoc(doc(db, "banco_categorias", id));
    window.categoriasExtras = window.categoriasExtras.filter(c => c.id !== id);
    window.renderizarCategoriasConfig();
    window.renderizarFiltroCategoria();
    window.renderizarRegistrosSalvos();
    window.mostrarToast("Categoria Removida!");
  } catch(e) {}
};

window.abrirModalEdicaoCategoria = (id) => {
  const c = window.categoriasExtras.find(x => x.id === id);
  if (!c) return;
  document.getElementById('editCatId').value = c.id;
  if (c.nome && c.emoji) {
    document.getElementById('editCatEmoji').value = c.emoji;
    document.getElementById('editCatNome').value = c.nome;
  } else {
    const espaco = c.l.indexOf(' ');
    document.getElementById('editCatEmoji').value = c.l.substring(0, espaco) || '';
    document.getElementById('editCatNome').value = c.l.substring(espaco + 1);
  }
  document.getElementById('modal-editar-categoria').classList.remove('hidden');
};

window.salvarEdicaoCategoria = async () => {
  const id = document.getElementById('editCatId').value;
  const emoji = document.getElementById('editCatEmoji').value || '';
  const nome = document.getElementById('editCatNome').value.trim();
  if (!nome) return alert("Preencha o nome da categoria.");
  
  const labelVisual = `${emoji} ${nome}`;
  try {
    await updateDoc(doc(db, "banco_categorias", id), { l: labelVisual, emoji: emoji, nome: nome });
    const c = window.categoriasExtras.find(x => x.id === id);
    if (c) { c.l = labelVisual; c.emoji = emoji; c.nome = nome; }
    document.getElementById('modal-editar-categoria').classList.add('hidden');
    window.renderizarCategoriasConfig();
    window.renderizarFiltroCategoria();
    window.renderizarRegistrosSalvos();
    window.renderizarDashboard();
    window.mostrarToast("Categoria Atualizada!");
  } catch (e) { alert("Erro ao editar categoria."); }
};

window.renderizarCategoriasConfig = () => {
  const div = document.getElementById('lista-categorias-container');
  if(!div) return;
  if(window.categoriasExtras.length === 0) {
    div.innerHTML = `<div style="background: white; padding: 15px; border-radius: 6px; color: #666; text-align:center;">Nenhuma categoria customizada.</div>`;
    return;
  }
  div.innerHTML = window.categoriasExtras.map(c => `
    <div style="background: white; padding: 10px 15px; margin-bottom:5px; border:1px solid #ccc; border-radius: 6px; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-weight:bold; color:#1565c0;">${c.l}</span>
      <div>
        <button class="btn-icon" style="color:#1565c0;" onclick="window.abrirModalEdicaoCategoria('${c.id}')">✏️</button>
        <button class="btn-icon" style="color:#d32f2f;" onclick="window.excluirCategoria('${c.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
};

function limparMoedaCSV(val) {
  let n = val.toString().replace(/[R\$\s\+]/gi, '').trim();
  if (n.includes('.') && n.includes(',')) n = n.replace(/\./g,'').replace(',', '.');
  else if (n.includes(',')) n = n.replace(',', '.');
  return parseFloat(n) || 0;
}

window.processarArquivo = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const contaId = document.getElementById('contaImportacao').value;
  if (!contaId) {
    alert("Selecione a CONTA deste extrato primeiro!");
    document.getElementById('arquivoExtrato').value = '';
    return;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  window.mostrarToast(`Lendo arquivo ${ext.toUpperCase()}...`);
  
  const reader = new FileReader();
  reader.onload = (e) => {
    if (ext === 'ofx') window.processarOFX(e.target.result, contaId);
    else if (ext === 'csv') window.processarCSV(e.target.result, contaId);
    document.getElementById('arquivoExtrato').value = '';
  };
  reader.readAsText(file, ext === 'csv' ? 'UTF-8' : 'ISO-8859-1');
};

window.processarOFX = (ofx, contaId) => {
  window.transacoesPendentes = [];
  const blocos = ofx.split('<STMTTRN>');
  for (let i = 1; i < blocos.length; i++) {
    const b = blocos[i];
    const dt = b.match(/<DTPOSTED>(.*?)(?:\r\n|\n|<)/);
    const vl = b.match(/<TRNAMT>(.*?)(?:\r\n|\n|<)/);
    const mm = b.match(/<MEMO>(.*?)(?:\r\n|\n|<)/);
    const nm = b.match(/<NAME>(.*?)(?:\r\n|\n|<)/);
    
    if (dt && vl) {
      const d = dt[1].substring(0,8);
      const v = parseFloat(vl[1]);
      let desc = (mm && mm[1]) ? mm[1].trim() : ((nm && nm[1]) ? nm[1].trim() : "");
      if (v === 0) continue;
      
      const tipoTransacao = v < 0 ? 'despesa' : 'receita';
      
      window.transacoesPendentes.push({
        id: `TEMP-${Date.now()}-${i}`, data: `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`,
        descricao: desc.substring(0,50), valor: v, tipo: tipoTransacao, categoria: autoCategorizar(desc, tipoTransacao), contaOrigem: contaId
      });
    }
  }
  finalizarImportacao();
};

window.processarCSV = (csv, contaId) => {
  window.transacoesPendentes = [];
  let credIdx = -1;
  let debIdx = -1;

  Papa.parse(csv, { skipEmptyLines: true, complete: function(res) {
    res.data.forEach((cols, i) => {
      if (cols.length < 2) return;
      let data = "", vals = [], descArr = [];
      let isHeaderRow = false;
      
      cols.forEach((col, idx) => {
        if(typeof col !== 'string') return;
        let cl = col.trim().replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-');
        if(!cl) return;
        let up = cl.toUpperCase();
        
        const isCredHeader = up === 'CRÉDITO (R$)' || up === 'CREDITO (R$)' || up === 'CRÉDITO' || up === 'CREDITO' || up === 'ENTRADAS' || up === 'VALOR RECEBIDO';
        const isDebHeader = up === 'DÉBITO (R$)' || up === 'DEBITO (R$)' || up === 'DÉBITO' || up === 'DEBITO' || up === 'SAÍDAS' || up === 'SAIDAS' || up === 'VALOR PAGO';
        const isDataHeader = up === 'DATA' || up === 'DATA DE' || up === 'DATA LANÇAMENTO' || up === 'DATA LANCAMENTO';
        const isHistHeader = up === 'HISTÓRICO' || up === 'HISTORICO' || up === 'DESCRIÇÃO' || up === 'DESCRICAO' || up === 'LANÇAMENTO' || up === 'LANCAMENTO';
        const isOtherHeader = up === 'VALOR' || up === 'SALDO' || up === 'SALDO (R$)' || up === 'DOCTO.' || up === 'DOCUMENTO';

        if (isCredHeader || isDebHeader || isDataHeader || isHistHeader || isOtherHeader) { 
          isHeaderRow = true; 
          if (isCredHeader) credIdx = idx;
          if (isDebHeader) debIdx = idx;
        }
        
        let dM = cl.match(/(?:^|\s)(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})(?:\$|\s|T|$)/);
        if (!data && dM) { data = dM[1]; return; }
        
        let numCheck = cl.replace(/\s/g,'').toUpperCase();
        let isMoney = false;
        if (/^[+-]?(R\$|BRL|U\$|\$)?\d{1,3}(\.?\d{3})*,\d{1,2}$/.test(numCheck)) isMoney = true;
        else if (/^[+-]?(R\$|BRL|U\$|\$)?\d{1,3}(,?\d{3})*\.\d{1,2}$/.test(numCheck)) isMoney = true;
        else if (/^[+-]?(R\$|BRL|U\$|\$)\d+$/.test(numCheck)) isMoney = true;
        
        if (isMoney) { let v = limparMoedaCSV(cl); vals.push({v: v, idx: idx}); return; }
        
        if (!cl.match(/^[0-9\-\.]+$/) && cl !== '') descArr.push(cl);
      });
      
      if (isHeaderRow) return;
      if (data && vals.length > 0) {
        let valor = 0;
        if (credIdx > -1 && debIdx > -1) {
          let credObj = vals.find(x => x.idx === credIdx);
          let debObj = vals.find(x => x.idx === debIdx);
          if (credObj && credObj.v !== 0) valor = Math.abs(credObj.v);
          else if (debObj && debObj.v !== 0) valor = -Math.abs(debObj.v); 
        } else { valor = vals[0].v; }

        if (valor === 0) return;
        
        const lixo = ['aprovado', 'concluído', 'concluido', 'saldo', 'cartão', 'cartao', 'pix', 'pix recebido', 'pix enviado', 'transferência', 'transferencia', 'ted', 'doc', 'com saldo'];
        descArr = descArr.filter(d => !lixo.includes(d.trim().toLowerCase()));
        descArr = descArr.filter(d => !d.match(/^\d{1,2}:\d{2}(:\d{2})?$/));
        let desc = descArr.sort((a,b)=>b.length - a.length)[0] || "Sem descrição";
        
        let dF = data;
        let sep = data.includes('/') ? '/' : '-';
        let p = data.split(sep);
        if (p[0].length === 4) { dF = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`; }
        else { let ano = p[2].length === 2 ? "20" + p[2] : p[2]; dF = `${ano}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`; }
        
        const tipoTransacao = valor < 0 ? 'despesa' : 'receita';

        window.transacoesPendentes.push({
          id: `TEMP-${Date.now()}-${i}`, data: dF, descricao: desc.substring(0,50),
          valor: valor, tipo: tipoTransacao, categoria: autoCategorizar(desc, tipoTransacao), contaOrigem: contaId
        });
      }
    });
    finalizarImportacao();
  }});
};

function autoCategorizar(desc, tipoTransacao) {
  if(!desc) return 'classificar';
  const dClean = window.limparTextoParaIA(desc);
  for (let r of window.regras) { 
    if (dClean.includes(r.palavra_chave) && r.tipo === tipoTransacao) return r.categoria; 
  }
  return 'classificar';
}

function finalizarImportacao() {
  if (window.transacoesPendentes.length > 0) {
    window.mudarAba('registros');
    window.renderizarRegistrosSalvos();
  } else alert("Nenhuma transação válida encontrada.");
}

window.renderizarRegistrosSalvos = () => {
  const containerArea = document.getElementById('area-registros-filtrados');
  const containerResumo = document.getElementById('painel-resumo-filtros');
  const containerPend = document.getElementById('area-pendentes');
  
  if (window.transacoesPendentes.length > 0) {
    let htmlP = `<div class="noprint" style="background: #fff3e0; border: 2px solid #f57c00; border-radius: 8px; padding: 15px; margin-bottom:20px;">
      <h4 style="color: #d84315; margin-top:0;">${window.transacoesPendentes.length} Lançamentos Pendentes</h4>
      <div class="table-container" style="max-height: 300px; border-color: #ffcc80;">
      <table class="table-registros" id="tabela-pendentes">
      <thead style="background-color: #ffe0b2;"><tr><th>Data</th><th>Descrição</th><th style="text-align:right;">Valor</th><th>Categoria</th></tr></thead><tbody>`;
    window.transacoesPendentes.forEach(t => {
      const [,m,d] = t.data.split('-');
      htmlP += `<tr data-id="${t.id}">
        <td>${d}/${m}</td>
        <td style="font-weight:bold;">${t.descricao}</td>
        <td style="text-align:right; color:${t.valor<0?'#c62828':'#2e7d32'};">R$ ${t.valor.toFixed(2)}</td>
        <td><select class="select-categoria" style="padding: 6px; width:100%; border-radius:4px; border:1px solid #ccc;">${getSelectOptions(t.categoria)}</select></td>
      </tr>`;
    });
    htmlP += `</tbody></table></div>
      <button class="btn" style="background-color: #f57c00; margin-top: 15px;" onclick="window.salvarExtratoReal()">Gravar Lançamentos e Ensinar IA</button>
    </div>`;
    if(containerPend) containerPend.innerHTML = htmlP;
  } else { if(containerPend) containerPend.innerHTML = ""; }

  const modoPeriodo = document.getElementById('modoPeriodo') ? document.getElementById('modoPeriodo').value : 'mes';
  const fConta = document.getElementById('filtroConta') ? document.getElementById('filtroConta').value : 'todas';
  const fCat = document.getElementById('filtroCategoria') ? document.getElementById('filtroCategoria').value : 'todas';
  const fTipo = document.getElementById('filtroTipo') ? document.getElementById('filtroTipo').value : 'todos';
  const fTextoRaw = document.getElementById('filtroTexto') ? document.getElementById('filtroTexto').value.trim() : '';

  let trns = [...window.transacoes];
  
  // O NOVO FILTRO DUAL (MÊS FECHADO OU PERÍODO LIVRE)
  if (modoPeriodo === 'mes') {
    const fMes = document.getElementById('filtroMes') ? document.getElementById('filtroMes').value : 'todos';
    if (fMes !== 'todos') {
      trns = trns.filter(t => {
        const [y, m] = t.data.split('-');
        return `${m}/${y}` === fMes;
      });
    }
  } else {
    const fDataInicio = document.getElementById('filtroDataInicio') ? document.getElementById('filtroDataInicio').value : '';
    const fDataFim = document.getElementById('filtroDataFim') ? document.getElementById('filtroDataFim').value : '';
    if (fDataInicio) trns = trns.filter(t => t.data >= fDataInicio);
    if (fDataFim) trns = trns.filter(t => t.data <= fDataFim);
  }

  if (fConta !== 'todas') trns = trns.filter(t => t.contaOrigem === fConta);
  if (fCat !== 'todas') trns = trns.filter(t => t.categoria === fCat);
  if (fTipo !== 'todos') trns = trns.filter(t => t.tipo === fTipo);
  if (fTextoRaw !== '') {
    const txt = fTextoRaw.toLowerCase();
    trns = trns.filter(t => t.descricao.toLowerCase().includes(txt) || Math.abs(t.valor).toString().includes(txt));
  }
  
  trns.sort((itemA, itemB) => itemB.data.localeCompare(itemA.data));

  if (trns.length === 0) {
    if(containerResumo) containerResumo.innerHTML = "";
    if(containerArea) containerArea.innerHTML = `<div class="card" style="text-align:center; color:#666; font-size: 15px;">Nenhum registro encontrado para este filtro exato.</div>`;
    return;
  }

  let resReceitas = 0;
  let resDespesas = 0;
  trns.forEach(t => {
    if (t.valor >= 0) resReceitas += t.valor;
    else resDespesas += Math.abs(t.valor);
  });
  let resSaldo = resReceitas - resDespesas;
  
  if(containerResumo) {
    containerResumo.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; background: #F8FAFC; padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
        <div>
          <h4 style="margin: 0 0 5px 0; color: #166534; font-size: 13px; text-transform: uppercase;">Entradas do Filtro</h4>
          <div style="font-size: 20px; font-weight: 900; color: var(--success);">R$ ${resReceitas.toFixed(2)}</div>
        </div>
        <div>
          <h4 style="margin: 0 0 5px 0; color: #991B1B; font-size: 13px; text-transform: uppercase;">Saídas do Filtro</h4>
          <div style="font-size: 20px; font-weight: 900; color: var(--danger);">R$ ${resDespesas.toFixed(2)}</div>
        </div>
        <div style="border-left: 2px solid #E2E8F0; padding-left: 15px;">
          <h4 style="margin: 0 0 5px 0; color: var(--text-main); font-size: 13px; text-transform: uppercase;">Balanço Líquido</h4>
          <div style="font-size: 20px; font-weight: 900; color: ${resSaldo >= 0 ? 'var(--success)' : 'var(--danger)'};">R$ ${resSaldo.toFixed(2)}</div>
        </div>
      </div>
    `;
  }

  // Tabela de Registros com Container de Scroll (Cabeçalho Fixo feito via CSS)
  let htmlS = `
    <div class="table-container">
      <table class="table-registros">
        <thead>
          <tr>
            <th style="width: 10%;">Data</th>
            <th style="width: 40%;">Descrição</th>
            <th style="text-align:right; width: 15%;">Valor</th>
            <th style="width: 20%;">Categoria</th>
            <th class="noprint" style="text-align:center; width: 15%;">Ações</th>
          </tr>
        </thead>
        <tbody>`;
        
  trns.forEach(t => {
    const [,mes, dia] = t.data.split('-');
    const bgCat = t.categoria === 'classificar' ? 'background:#FEF9C3;' : '';
    
    htmlS += `<tr style="${bgCat}">
      <td style="color: #64748B;">${dia}/${mes}</td>
      <td style="font-weight: 600;">${t.descricao}</td>
      <td style="text-align: right; color: ${t.valor<0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">R$ ${t.valor.toFixed(2)}</td>
      <td>
        <select class="noprint" onchange="window.recategorizarInline('${t.id}', this, '${t.categoria}')" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; font-size: 12px;">
          ${getSelectOptions(t.categoria)}
        </select>
        <span class="onlyprint">${getCatLabel(t.categoria)}</span>
      </td>
      <td class="noprint" style="text-align: center;">
        ${t.contaOrigem === 'Manual' ? `<button class="btn-icon" style="color:var(--tab-bg); border:none; background:none; cursor:pointer;" onclick="window.abrirModalEdicao('${t.id}')">✏️</button>` : ''}
        <button class="btn-icon" style="color:var(--danger); border:none; background:none; cursor:pointer;" onclick="window.excluirLancamento('${t.id}')">🗑️</button>
      </td>
    </tr>`;
  });
  htmlS += `</tbody></table></div>`;
  
  if(containerArea) containerArea.innerHTML = htmlS;
};

window.salvarExtratoReal = async () => {
  const rows = document.querySelectorAll('#tabela-pendentes tbody tr');
  let salvas = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const tId = rows[i].getAttribute('data-id');
    const selectCat = rows[i].querySelector('.select-categoria').value;
    const t = window.transacoesPendentes.find(x => x.id === tId);
    
    if (t) {
      t.categoria = selectCat;
      const novoId = `TRN-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const trnDB = { id: novoId, data: t.data, descricao: t.descricao, valor: t.valor, tipo: t.tipo, categoria: t.categoria, contaOrigem: t.contaOrigem };
      
      await setDoc(doc(db, "banco_transacoes", novoId), trnDB);
      window.transacoes.push(trnDB);
      salvas++;
      
      if (selectCat !== 'classificar' && selectCat !== 'transferencia_interna' && selectCat !== 'avulso') {
        const chave = window.limparTextoParaIA(t.descricao);
        if (!window.regras.find(r => r.palavra_chave === chave && r.tipo === t.tipo)) {
          const novaRegra = { id: `REG-${Date.now()}`, palavra_chave: chave, tipo: t.tipo, categoria: selectCat };
          await setDoc(doc(db, "banco_regras", novaRegra.id), novaRegra);
          window.regras.push(novaRegra);
        }
      }
    }
  }
  
  window.mostrarToast(`${salvas} lançamentos salvos!`);
  window.transacoesPendentes = [];
  window.atualizarFiltroMeses();
  window.renderizarRegistrosSalvos();
  window.renderizarDashboard();
};

window.apagarTodoOExtrato = () => {
  document.getElementById('acaoDestrutivaAlvo').value = 'extrato';
  document.getElementById('modal-seguranca-texto').innerText = 'Tem a certeza ABSOLUTA que deseja APAGAR TODO O SEU HISTÓRICO FINANCEIRO? (As contas e categorias serão mantidas).';
  document.getElementById('inputSenhaConfirmacao').value = '';
  document.getElementById('modal-confirmacao-senha').classList.remove('hidden');
};

window.apagarRegrasIA = () => {
  document.getElementById('acaoDestrutivaAlvo').value = 'ia';
  document.getElementById('modal-seguranca-texto').innerText = 'Deseja apagar todas as regras de categorização automática? O sistema esquecerá tudo o que aprendeu.';
  document.getElementById('inputSenhaConfirmacao').value = '';
  document.getElementById('modal-confirmacao-senha').classList.remove('hidden');
};

window.executarAcaoDestrutiva = async () => {
  const pwd = document.getElementById('inputSenhaConfirmacao').value;
  const acao = document.getElementById('acaoDestrutivaAlvo').value;
  if (!pwd) return alert("⚠️ Digite a sua senha de acesso para confirmar a operação.");
  const btnConf = document.getElementById('btnConfirmarReset');
  btnConf.innerText = "Aguarde...";
  btnConf.disabled = true;
  try {
    window.mostrarToast("Validando segurança...");
    await signInWithEmailAndPassword(auth, auth.currentUser.email, pwd);
    document.getElementById('modal-confirmacao-senha').classList.add('hidden');
    
    if (acao === 'extrato') {
      window.mostrarToast("Apagando a Base de Dados... Aguarde.");
      for (let t of window.transacoes) { await deleteDoc(doc(db, "banco_transacoes", t.id)); }
      window.transacoes = [];
      window.mostrarToast("Sistema financeiro limpo e zerado!");
      window.atualizarFiltroMeses();
      window.renderizarRegistrosSalvos();
      window.renderizarDashboard();
    } else if (acao === 'ia') {
      window.mostrarToast("Apagando memória da I.A...");
      for (let r of window.regras) { await deleteDoc(doc(db, "banco_regras", r.id)); }
      window.regras = [];
      window.mostrarToast("Memória da Inteligência Artificial limpa com sucesso!");
    }
  } catch (e) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') { alert("❌ Senha incorreta. Operação de segurança bloqueada."); } 
    else { alert("Erro ao executar ação: " + e.message); }
  } finally {
    btnConf.innerText = "Confirmar e Apagar";
    btnConf.disabled = false;
  }
};

window.recategorizarInline = async (id, selectEl, oldCat) => {
  const novaCat = selectEl.value;
  if (!confirm(`Deseja alterar a categoria deste lançamento para "${getCatLabel(novaCat)}"?`)) {
    selectEl.value = oldCat; return;
  }
  
  try {
    await updateDoc(doc(db, "banco_transacoes", id), { categoria: novaCat });
    const t = window.transacoes.find(x => x.id === id);
    if (t) {
      t.categoria = novaCat;
      if (novaCat !== 'classificar' && novaCat !== 'transferencia_interna' && novaCat !== 'avulso') {
        const chave = window.limparTextoParaIA(t.descricao);
        const regraExiste = window.regras.find(r => r.palavra_chave === chave && r.tipo === t.tipo);
        
        if (regraExiste) {
          await updateDoc(doc(db, "banco_regras", regraExiste.id), { categoria: novaCat });
          regraExiste.categoria = novaCat;
        } else {
          const novaRegra = { id: `REG-${Date.now()}`, palavra_chave: chave, tipo: t.tipo, categoria: novaCat };
          await setDoc(doc(db, "banco_regras", novaRegra.id), novaRegra);
          window.regras.push(novaRegra);
        }
      }
    }
    window.mostrarToast("Categoria atualizada com sucesso!");
    selectEl.setAttribute('onchange', `window.recategorizarInline('${id}', this, '${novaCat}')`);
    const printSpan = selectEl.nextElementSibling;
    if (printSpan && printSpan.classList.contains('onlyprint')) printSpan.innerText = getCatLabel(novaCat);
    const tr = selectEl.closest('tr');
    if (tr) tr.style.background = (novaCat === 'classificar') ? '#FEF9C3' : 'transparent';
    window.renderizarDashboard();
  } catch(e) { alert("Erro ao atualizar."); selectEl.value = oldCat; }
};

window.excluirLancamento = async (id) => {
  if (!confirm("⚠️ PERIGO: Deseja EXCLUIR permanentemente este lançamento?")) return;
  try {
    await deleteDoc(doc(db, "banco_transacoes", id));
    window.transacoes = window.transacoes.filter(t => t.id !== id);
    window.mostrarToast("Lançamento excluído.");
    window.atualizarFiltroMeses();
    window.renderizarRegistrosSalvos();
    window.renderizarDashboard();
  } catch (e) { alert("Erro ao excluir."); }
};

window.abrirModalEdicao = (id) => {
  const t = window.transacoes.find(x => x.id === id);
  if (!t) return;
  document.getElementById('editId').value = t.id;
  document.getElementById('editData').value = t.data;
  document.getElementById('editDesc').value = t.descricao;
  document.getElementById('editValor').value = Math.abs(t.valor);
  document.getElementById('editTipo').value = t.tipo;
  document.getElementById('modal-editar').classList.remove('hidden');
};

window.salvarEdicao = async () => {
  const id = document.getElementById('editId').value;
  const data = document.getElementById('editData').value;
  const desc = document.getElementById('editDesc').value.trim();
  const v = parseFloat(document.getElementById('editValor').value) || 0;
  const tipo = document.getElementById('editTipo').value;
  
  if (!data || !desc || v <= 0) return alert("Preencha todos os campos.");
  
  const valorReal = tipo === 'despesa' ? -Math.abs(v) : Math.abs(v);
  
  try {
    await updateDoc(doc(db, "banco_transacoes", id), { data: data, descricao: desc, valor: valorReal, tipo: tipo });
    const t = window.transacoes.find(x => x.id === id);
    if (t) { t.data = data; t.descricao = desc; t.valor = valorReal; t.tipo = tipo; }
    
    document.getElementById('modal-editar').classList.add('hidden');
    window.mostrarToast("Lançamento corrigido!");
    window.renderizarRegistrosSalvos();
    window.renderizarDashboard();
  } catch (e) { alert("Erro ao salvar."); }
};

window.adicionarLancamentoAvulso = async () => {
  const data = document.getElementById('avulsoData').value;
  const desc = document.getElementById('avulsoDesc').value.trim();
  const v = parseFloat(document.getElementById('avulsoValor').value) || 0;
  const tipo = document.getElementById('avulsoTipo').value;
  const cId = document.getElementById('avulsoConta').value;
  
  if (!data || !desc || v <= 0 || !cId) return alert("Preencha todos os campos.");
  
  const valor = tipo === 'despesa' ? -Math.abs(v) : Math.abs(v);
  const novoId = `TRN-AVU-${Date.now()}`;
  
  const trn = { id: novoId, data: data, descricao: desc, valor: valor, tipo: tipo, categoria: 'avulso', contaOrigem: cId };
  
  await setDoc(doc(db, "banco_transacoes", novoId), trn);
  window.transacoes.push(trn);
  
  window.mostrarToast("Lançamento Adicionado!");
  document.getElementById('avulsoDesc').value = '';
  document.getElementById('avulsoValor').value = '';
  
  window.atualizarFiltroMeses();
  window.mudarAba('registros');
  window.renderizarRegistrosSalvos();
  window.renderizarDashboard();
};

window.renderizarDashboard = () => {
  const container = document.getElementById('painel-dashboard-content');
  if (!container) return;
  
  if (window.transacoes.length === 0) {
    container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Sem dados para gerar gráficos. Importe extratos primeiro.</div>`;
    return;
  }
  
  let tReceitas = 0, tDespesas = 0;
  let porCategoria = {};
  let bancosResumo = {};
  
  window.transacoes.forEach(t => {
    if (t.categoria === 'transferencia_interna') return;
    
    if (!bancosResumo[t.contaOrigem]) bancosResumo[t.contaOrigem] = { r: 0, d: 0 };
    
    if (t.tipo === 'receita' || t.valor > 0) {
      tReceitas += t.valor;
      bancosResumo[t.contaOrigem].r += t.valor;
    } else {
      let val = Math.abs(t.valor);
      tDespesas += val;
      bancosResumo[t.contaOrigem].d += val;
      const catName = getCatLabel(t.categoria);
      if (!porCategoria[catName]) porCategoria[catName] = 0;
      porCategoria[catName] += val;
    }
  });
  
  let balanco = tReceitas - tDespesas;
  let corB = balanco >= 0 ? 'var(--success)' : 'var(--danger)';
  
  let htmlBancos = `<div style="margin-top: 20px; margin-bottom: 20px;">
    <h4 style="color: var(--tab-bg); margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom:5px;">Resumo por Instituição (Ignorando Transferências)</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">`;
    
  for(let bId in bancosResumo) {
    let nBanco = "Geral / Manual";
    if(bId !== 'Manual') {
      const bx = window.contas.find(c => c.id === bId);
      if(bx) nBanco = bx.banco;
    }
    let bS = bancosResumo[bId].r - bancosResumo[bId].d;
    
    htmlBancos += `<div style="background: #F8FAFC; padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
      <div style="font-weight: 800; color: var(--text-main); font-size: 14px; margin-bottom: 12px;">${nBanco}</div>
      <div style="font-size: 13px; color: var(--success); display: flex; justify-content: space-between;"><span>Entradas:</span> <span>R$ ${bancosResumo[bId].r.toFixed(2)}</span></div>
      <div style="font-size: 13px; color: var(--danger); display: flex; justify-content: space-between; margin-bottom: 10px;"><span>Saídas:</span> <span>R$ ${bancosResumo[bId].d.toFixed(2)}</span></div>
      <div style="font-size: 14px; color: ${bS>=0?'var(--success)':'var(--danger)'}; display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #E2E8F0; padding-top: 8px;">
        <span>Saldo:</span> <span>R$ ${bS.toFixed(2)}</span>
      </div>
    </div>`;
  }
  htmlBancos += `</div></div>`;
  
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
      <div style="background: #F0FDF4; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #BBF7D0;">
        <h4 style="margin: 0 0 5px 0; color: #166534; font-size: 12px;">RECEITA TOTAL</h4>
        <div style="font-size: 22px; font-weight: 900; color: var(--success);">R$ ${tReceitas.toFixed(2)}</div>
      </div>
      <div style="background: #FEF2F2; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #FECACA;">
        <h4 style="margin: 0 0 5px 0; color: #991B1B; font-size: 12px;">DESPESA TOTAL</h4>
        <div style="font-size: 22px; font-weight: 900; color: var(--danger);">R$ ${tDespesas.toFixed(2)}</div>
      </div>
      <div style="background: ${balanco>=0?'#F0FDF4':'#FEF2F2'}; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid ${balanco>=0?'#BBF7D0':'#FECACA'};">
        <h4 style="margin: 0 0 5px 0; color: ${balanco>=0?'#166534':'#991B1B'}; font-size: 12px;">SALDO LÍQUIDO</h4>
        <div style="font-size: 22px; font-weight: 900; color: ${corB};">R$ ${balanco.toFixed(2)}</div>
      </div>
    </div>
    ${htmlBancos}
    <div style="margin-top: 30px;">
      <h4 style="color: var(--tab-bg); margin-top: 0; margin-bottom: 20px; text-align: center;">Divisão de Custos (Despesas)</h4>
      <div style="position: relative; height: 350px; width: 100%;"><canvas id="graficoCat"></canvas></div>
    </div>
  `;
  
  const coresDistintas = ['#e53935', '#1e88e5', '#43a047', '#ffb300', '#8e24aa', '#00acc1', '#d81b60', '#f4511e', '#7cb342', '#3949ab', '#6d4c41', '#546e7a', '#00897b', '#c0ca33', '#5e35b1', '#ff8a65', '#81c784', '#64b5f6', '#ba68c8', '#a1887f'];
  
  setTimeout(() => {
    const ctx = document.getElementById('graficoCat');
    if (ctx) {
      Chart.register(ChartDataLabels);
      if (chartInstance) chartInstance.destroy();
      
      chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(porCategoria),
          datasets: [{ data: Object.values(porCategoria), backgroundColor: coresDistintas, borderWidth: 2, borderColor: '#ffffff' }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' },
            datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, formatter: (value, ctx) => { let sum = 0; ctx.chart.data.datasets[0].data.map(data => { sum += data; }); return (value * 100 / sum).toFixed(1) + "%"; } }
          }
        }
      });
    }
  }, 100);
};

window.renderizarDropdownContas = () => {
  const selC = document.getElementById('contaImportacao');
  const selF = document.getElementById('filtroConta');
  const selA = document.getElementById('avulsoConta');
  
  if(selC) selC.innerHTML = '<option value="">-- OBRIGATÓRIO: Selecione a Conta --</option>';
  if(selF) selF.innerHTML = '<option value="todas">Todas as Contas</option>';
  if(selA) selA.innerHTML = '';
  
  window.contas.forEach(c => {
    if(selC) selC.appendChild(new Option(`${c.banco} - ${c.titular}`, c.id));
    if(selF) selF.appendChild(new Option(`${c.banco} - ${c.titular}`, c.id));
    if(selA) selA.appendChild(new Option(`${c.banco} - ${c.titular}`, c.id));
  });
  
  if(selF) selF.appendChild(new Option('Lançamentos Manuais / Gerais', 'Manual'));
  if(selA) selA.appendChild(new Option('Geral / Manual', 'Manual'));
};

window.adicionarConta = async () => {
  const b = document.getElementById('cadBanco').value.trim();
  const t = document.getElementById('cadTitular').value.trim();
  const f = document.getElementById('cadFonte').value.trim();
  
  if(!b || !t) return alert("Banco e Titular são obrigatórios.");
  
  const nC = { id: `CTA-${Date.now()}`, banco: b, titular: t, fonte: f };
  await setDoc(doc(db, "banco_contas", nC.id), nC);
  
  window.contas.push(nC);
  window.renderizarContas();
  window.renderizarDropdownContas();
  window.mostrarToast("Conta Cadastrada!");
  document.getElementById('cadBanco').value = '';
  document.getElementById('cadTitular').value = '';
  document.getElementById('cadFonte').value = '';
};

window.renderizarContas = () => {
  const div = document.getElementById('lista-contas-container');
  if(!div) return;
  if(window.contas.length === 0) {
    div.innerHTML = `<div style="background: white; padding: 15px; border-radius: 6px; color: #666; text-align:center;">Nenhuma conta cadastrada.</div>`;
    return;
  }
  div.innerHTML = window.contas.map(c => `
    <div style="background: #F8FAFC; padding: 15px; margin-bottom:10px; border: 1px solid var(--border-color); border-radius: 6px;">
      <div style="font-weight: 800; color: var(--tab-bg); font-size: 15px;">${c.banco}</div>
      <div style="font-size: 13px; color: var(--text-main); margin-top: 5px;">Titular: <b>${c.titular}</b> ${c.fonte ? `| Fonte: ${c.fonte}` : ''}</div>
    </div>
  `).join('');
};

window.mudarAba = (aba) => {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  
  const header = document.getElementById('app-header');
  const tabs = document.getElementById('app-tabs');
  const content = document.getElementById('app-content');

  if (aba === 'home') {
    if(header) header.classList.add('hidden');
    if(tabs) tabs.classList.add('hidden');
    if(content) content.style.padding = '0';
  } else {
    if(header) header.classList.remove('hidden');
    if(tabs) tabs.classList.remove('hidden');
    if(content) content.style.padding = '30px';
    const btn = document.getElementById(`btn-tab-${aba}`);
    if(btn) btn.classList.add('active');
  }

  const painelAtivo = document.getElementById(`painel-${aba}`);
  if(painelAtivo) painelAtivo.classList.add('active');

  if (aba === 'registros') window.renderizarRegistrosSalvos();
  if (aba === 'dashboard') window.renderizarDashboard();
};

window.fazerLogin = async () => {
  const e = document.getElementById('emailLogin').value.trim();
  const s = document.getElementById('senhaLogin').value;
  
  if (!e || !s) return alert("⚠️ Por favor, preencha o e-mail e a senha antes de entrar.");
  const btn = document.getElementById('btnAcesso');
  const txtOriginal = btn.innerText;
  btn.innerText = "Autenticando...";
  btn.disabled = true;

  try { 
    await signInWithEmailAndPassword(auth, e, s); 
  } catch (er) { 
    console.error("Erro Auth:", er.code, er.message);
    if (er.code === 'auth/invalid-email') alert("⚠️ O formato do e-mail é inválido.");
    else if (er.code === 'auth/user-not-found' || er.code === 'auth/invalid-credential') alert("⚠️ Credenciais incorretas ou usuário não encontrado.");
    else alert("⚠️ Falha no login. Verifique as credenciais e tente novamente.");
  } finally {
    btn.innerText = txtOriginal;
    btn.disabled = false;
  }
};

window.sairApp = async () => { if(confirm("Deseja realmente sair?")) await signOut(auth); };

window.mostrarToast = (m) => { 
  const t = document.getElementById('toast'); 
  t.innerText = m; 
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show'); 
};

onAuthStateChanged(auth, (u) => {
  if (u) { 
    document.getElementById('tela-login').classList.add('hidden'); 
    document.getElementById('app').classList.remove('hidden');
    window.carregarTodosOsDados(); 
    window.mudarAba('home');
  } else { 
    document.getElementById('tela-login').classList.remove('hidden'); 
    document.getElementById('app').classList.add('hidden');
  }
});
