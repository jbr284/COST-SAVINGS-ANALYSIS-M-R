import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

window.transacoes = [];
window.contas = [];
window.categoriasExtras = [];
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

function getTodasCategorias() { return [...CATEGORIAS_PADRAO, ...window.categoriasExtras]; }
function getCatLabel(val) { const found = getTodasCategorias().find(c => c.v === val); return found ? found.l : val; }

window.togglePrivacy = () => {
  document.body.classList.toggle('privacy-mode');
  if (chartInstance) chartInstance.update();
};

window.alternarModoPeriodo = () => {
  const modo = document.getElementById('modoPeriodo').value;
  if (modo === 'mes') {
    document.getElementById('blocoFiltroMes').classList.remove('hidden');
    document.getElementById('blocoFiltroDataInicio').classList.add('hidden');
    document.getElementById('blocoFiltroDataFim').classList.add('hidden');
  } else {
    document.getElementById('blocoFiltroMes').classList.add('hidden');
    document.getElementById('blocoFiltroDataInicio').classList.remove('hidden');
    document.getElementById('blocoFiltroDataFim').classList.remove('hidden');
  }
  window.renderizarRegistrosSalvos();
};

window.atualizarFiltroMeses = () => {
  const sel = document.getElementById('filtroMes');
  if (!sel) return;
  const valAtual = sel.value;
  const meses = new Set();
  window.transacoes.forEach(t => { const [y, m] = t.data.split('-'); meses.add(`${m}/${y}`); });
  const mesesArr = Array.from(meses).sort((a,b) => {
    const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/');
    return new Date(`${yb}-${mb}-01`) - new Date(`${ya}-${ma}-01`);
  });
  sel.innerHTML = '<option value="todos">Todos os Meses</option>' + mesesArr.map(m => `<option value="${m}">${m}</option>`).join('');
  if (mesesArr.includes(valAtual)) sel.value = valAtual;
};

window.carregarTodosOsDados = async () => {
  try {
    const [snapContas, snapTransacoes, snapCats] = await Promise.all([
      getDocs(collection(db, "banco_contas")),
      getDocs(collection(db, "banco_transacoes")),
      getDocs(collection(db, "banco_categorias"))
    ]);

    window.contas = snapContas.docs.map(d => d.data());
    window.transacoes = snapTransacoes.docs.map(d => d.data());
    window.categoriasExtras = snapCats.docs.map(d => d.data());
    
    window.atualizarFiltroMeses();
    window.renderizarRegistrosSalvos();
    window.renderizarDashboard();
  } catch (e) { console.error("Erro DB: ", e); }
};

window.renderizarRegistrosSalvos = () => {
  const containerArea = document.getElementById('area-registros-filtrados');
  const containerResumo = document.getElementById('painel-resumo-filtros');
  const appContent = document.getElementById('app-content');
  const currentScroll = appContent ? appContent.scrollTop : 0;
  
  const modoPeriodo = document.getElementById('modoPeriodo').value;
  const fTextoRaw = document.getElementById('filtroTexto').value.trim();
  let trns = [...window.transacoes];
  
  if (modoPeriodo === 'mes') {
    const fMes = document.getElementById('filtroMes').value;
    if (fMes !== 'todos') trns = trns.filter(t => { const [y, m] = t.data.split('-'); return `${m}/${y}` === fMes; });
  } else {
    const fDataInicio = document.getElementById('filtroDataInicio').value;
    const fDataFim = document.getElementById('filtroDataFim').value;
    if (fDataInicio) trns = trns.filter(t => t.data >= fDataInicio);
    if (fDataFim) trns = trns.filter(t => t.data <= fDataFim);
  }

  if (fTextoRaw !== '') {
    const txt = fTextoRaw.toLowerCase();
    trns = trns.filter(t => t.descricao.toLowerCase().includes(txt) || Math.abs(t.valor).toString().includes(txt) || getCatLabel(t.categoria).toLowerCase().includes(txt));
  }
  
  trns.sort((itemA, itemB) => itemB.data.localeCompare(itemA.data));

  if (trns.length === 0) {
    containerResumo.innerHTML = "";
    containerArea.innerHTML = `<div class="dash-card" style="text-align:center; color:#666;">Nenhum registro encontrado.</div>`;
    return;
  }

  let resReceitas = 0; let resDespesas = 0;
  trns.forEach(t => { if (t.valor >= 0) resReceitas += t.valor; else resDespesas += Math.abs(t.valor); });
  let resSaldo = resReceitas - resDespesas;
  
  containerResumo.innerHTML = `
    <div class="dash-card">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size:12px; font-weight:bold; color:var(--text-main);">Entradas</span>
        <span class="ocultar-valor" style="font-size:14px; font-weight:900; color:var(--success);">R$ ${resReceitas.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
        <span style="font-size:12px; font-weight:bold; color:var(--text-main);">Saídas</span>
        <span class="ocultar-valor" style="font-size:14px; font-weight:900; color:var(--danger);">R$ ${resDespesas.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="font-size:14px; font-weight:800; color:var(--text-main);">Balanço</span>
        <span class="ocultar-valor" style="font-size:18px; font-weight:900; color:${resSaldo >= 0 ? 'var(--success)' : 'var(--danger)'};">R$ ${resSaldo.toFixed(2)}</span>
      </div>
    </div>
  `;

  let htmlS = ``;
  trns.forEach(t => {
    const [,mes, dia] = t.data.split('-');
    let nomeBanco = "Manual";
    if (t.contaOrigem !== 'Manual') {
      const contaEncontrada = window.contas.find(c => c.id === t.contaOrigem);
      if (contaEncontrada) nomeBanco = contaEncontrada.banco;
    }
    
    htmlS += `
      <div class="txn-card">
        <div class="txn-header"><span>${nomeBanco}</span><span>${dia}/${mes}</span></div>
        <div class="txn-desc">${t.descricao}</div>
        <div class="txn-footer">
          <span class="txn-cat">${getCatLabel(t.categoria)}</span>
          <span class="txn-val occultar-valor ${t.valor<0 ? 'val-neg' : 'val-pos'}">R$ ${t.valor.toFixed(2)}</span>
        </div>
      </div>
    `;
  });
  
  containerArea.innerHTML = htmlS;
  if (appContent) setTimeout(() => { appContent.scrollTop = currentScroll; }, 10);
};

window.renderizarDashboard = () => {
  const container = document.getElementById('painel-dashboard-content');
  if (!container) return;
  if (window.transacoes.length === 0) { container.innerHTML = `<div class="dash-card" style="text-align: center;">Sem dados.</div>`; return; }
  
  let tReceitas = 0, tDespesas = 0;
  let porCategoria = {}; let bancosResumo = {};
  
  window.transacoes.forEach(t => {
    if (t.categoria === 'transferencia_interna') return;
    if (!bancosResumo[t.contaOrigem]) bancosResumo[t.contaOrigem] = { r: 0, d: 0 };
    if (t.tipo === 'receita' || t.valor > 0) { tReceitas += t.valor; bancosResumo[t.contaOrigem].r += t.valor; } 
    else {
      let val = Math.abs(t.valor); tDespesas += val; bancosResumo[t.contaOrigem].d += val;
      const catName = getCatLabel(t.categoria);
      if (!porCategoria[catName]) porCategoria[catName] = 0;
      porCategoria[catName] += val;
    }
  });
  
  let balanco = tReceitas - tDespesas;
  
  let htmlBancos = `<div style="margin-top: 15px;"><h4 style="font-size:13px; text-transform:uppercase; margin-bottom:10px;">Resumo por Banco</h4>`;
  for(let bId in bancosResumo) {
    let nBanco = "Geral / Manual";
    if(bId !== 'Manual') { const bx = window.contas.find(c => c.id === bId); if(bx) nBanco = bx.banco; }
    let bS = bancosResumo[bId].r - bancosResumo[bId].d;
    htmlBancos += `<div class="dash-card" style="padding:12px; margin-bottom:10px;">
      <div style="font-weight: 800; font-size: 13px; margin-bottom: 8px;">${nBanco}</div>
      <div style="font-size: 12px; display: flex; justify-content: space-between;"><span>Entradas:</span> <span class="ocultar-valor" style="color:var(--success)">R$ ${bancosResumo[bId].r.toFixed(2)}</span></div>
      <div style="font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 6px;"><span>Saídas:</span> <span class="ocultar-valor" style="color:var(--danger)">R$ ${bancosResumo[bId].d.toFixed(2)}</span></div>
      <div style="font-size: 13px; display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #E2E8F0; padding-top: 6px;">
        <span>Saldo:</span> <span class="ocultar-valor" style="color:${bS>=0?'var(--success)':'var(--danger)'}">R$ ${bS.toFixed(2)}</span>
      </div>
    </div>`;
  }
  htmlBancos += `</div>`;

  let catArray = Object.keys(porCategoria).map(k => ({ nome: k, valor: porCategoria[k] }));
  catArray.sort((a,b) => b.valor - a.valor);
  let chartHeight = Math.max(250, catArray.length * 35); 
  
  container.innerHTML = `
    <div style="display:flex; gap:10px; margin-bottom:10px;">
      <div class="dash-total-box" style="flex:1; background:#F0FDF4; border:1px solid #BBF7D0;">
        <div style="font-size:10px; color:#166534; font-weight:bold;">RECEITAS</div>
        <div class="ocultar-valor" style="font-size:16px; font-weight:900; color:var(--success);">R$ ${tReceitas.toFixed(2)}</div>
      </div>
      <div class="dash-total-box" style="flex:1; background:#FEF2F2; border:1px solid #FECACA;">
        <div style="font-size:10px; color:#991B1B; font-weight:bold;">DESPESAS</div>
        <div class="ocultar-valor" style="font-size:16px; font-weight:900; color:var(--danger);">R$ ${tDespesas.toFixed(2)}</div>
      </div>
    </div>
    <div class="dash-total-box" style="background:${balanco>=0?'#F0FDF4':'#FEF2F2'}; border:1px solid ${balanco>=0?'#BBF7D0':'#FECACA'};">
      <div style="font-size:11px; font-weight:bold; color:${balanco>=0?'#166534':'#991B1B'};">SALDO LÍQUIDO DO ANO</div>
      <div class="ocultar-valor" style="font-size:22px; font-weight:900; color:${balanco>=0?'var(--success)':'var(--danger)'};">R$ ${balanco.toFixed(2)}</div>
    </div>
    ${htmlBancos}
    <div class="dash-card" style="margin-top: 20px;">
      <h4 style="margin: 0 0 15px 0; font-size:13px; text-transform:uppercase; text-align:center;">Despesas por Categoria</h4>
      <div style="position: relative; height: ${chartHeight}px; width: 100%;"><canvas id="graficoCat"></canvas></div>
    </div>
  `;
  
  const coresDistintas = ['#e53935', '#1e88e5', '#43a047', '#ffb300', '#8e24aa', '#00acc1', '#d81b60', '#f4511e', '#7cb342', '#3949ab', '#6d4c41', '#546e7a', '#00897b', '#c0ca33', '#5e35b1', '#ff8a65', '#81c784', '#64b5f6', '#ba68c8', '#a1887f'];
  
  setTimeout(() => {
    const ctx = document.getElementById('graficoCat');
    if (ctx) {
      Chart.register(ChartDataLabels);
      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: catArray.map(c => c.nome.substring(0,18)), // Trunca nomes longos na tela pequena
          datasets: [{ data: catArray.map(c => c.valor), backgroundColor: coresDistintas, borderRadius: 4 }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 50 } },
          plugins: {
            legend: { display: false },
            datalabels: { color: '#475569', anchor: 'end', align: 'end', font: { weight: 'bold', size: 10 }, formatter: (value) => { return document.body.classList.contains('privacy-mode') ? "R$ •••" : "R$ " + value.toFixed(0); } }
          },
          scales: { x: { display: false }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } }
        }
      });
    }
  }, 100);
};

window.mudarAba = (aba) => {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`btn-tab-${aba}`);
  if(btn) btn.classList.add('active');
  const painelAtivo = document.getElementById(`painel-${aba}`);
  if(painelAtivo) painelAtivo.classList.add('active');
  if (aba === 'registros') window.renderizarRegistrosSalvos();
  if (aba === 'dashboard') window.renderizarDashboard();
};

window.fazerLogin = async () => {
  const e = document.getElementById('emailLogin').value.trim();
  const s = document.getElementById('senhaLogin').value;
  if (!e || !s) return alert("Preencha os dados.");
  const btn = document.getElementById('btnAcesso');
  btn.innerText = "Aguarde..."; btn.disabled = true;
  try { await signInWithEmailAndPassword(auth, e, s); } 
  catch (er) { alert("Falha no login. Verifique as credenciais."); btn.innerText = "ENTRAR"; btn.disabled = false; }
};

window.sairApp = async () => { if(confirm("Deseja sair do aplicativo?")) await signOut(auth); };

onAuthStateChanged(auth, (u) => {
  if (u) { 
    document.getElementById('tela-login').classList.add('hidden'); 
    document.getElementById('app').classList.remove('hidden');
    window.carregarTodosOsDados(); 
  } else { 
    document.getElementById('tela-login').classList.remove('hidden'); 
    document.getElementById('app').classList.add('hidden');
  }
});
