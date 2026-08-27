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
window.categoriasExtras = []; // NOVA VARIÁVEL!
window.transacoesPendentes = []; 
let chartInstance = null; 

// CATEGORIAS FIXAS DO SISTEMA
const CATEGORIAS_PADRAO = [
    {v: 'classificar', l: '⚠️ A Classificar'},
    {v: 'transferencia_interna', l: '🔄 Transferência Interna'},
    {v: 'alimentacao', l: '🍔 Alimentação'},
    {v: 'transporte', l: '🚗 Transporte'},
    {v: 'moradia', l: '🏠 Moradia'},
    {v: 'lazer', l: '🎉 Lazer / Compras'},
    {v: 'saude', l: '⚕️ Saúde'},
    {v: 'salario', l: '💰 Renda Externa'},
    {v: 'avulso', l: '📥 Saldo Inicial'}
];

window.carregarTodosOsDados = async () => {
    try {
        const snapContas = await getDocs(collection(db, "banco_contas"));
        window.contas = snapContas.docs.map(d => d.data());

        const snapRegras = await getDocs(collection(db, "banco_regras"));
        window.regras = snapRegras.docs.map(d => d.data());

        const snapTransacoes = await getDocs(collection(db, "banco_transacoes"));
        window.transacoes = snapTransacoes.docs.map(d => d.data());
        
        // Puxa as Categorias Customizadas do Firebase
        const snapCats = await getDocs(collection(db, "banco_categorias"));
        window.categoriasExtras = snapCats.docs.map(d => d.data());

        window.renderizarContas();
        window.renderizarDropdownContas();
        
        window.renderizarCategoriasConfig(); // Desenha na aba configurações
        window.renderizarFiltroCategoria();  // Desenha no Filtro da Peneira

        window.renderizarRegistrosSalvos();
        window.renderizarDashboard();
    } catch (e) { console.error("Erro DB: ", e); }
};

// ==========================================
// MÓDULO DE CATEGORIAS CUSTOMIZADAS
// ==========================================
// Pega todas as categorias juntas (Padrão + Extras)
function getTodasCategorias() {
    return [...CATEGORIAS_PADRAO, ...window.categoriasExtras];
}

// Retorna o rótulo bonito (com emoji) para usar no Dashboard
function getCatLabel(val) {
    const found = getTodasCategorias().find(c => c.v === val);
    return found ? found.l : val.toUpperCase();
}

// Cria o HTML das tags <option> para os selects
function getSelectOptions(catSelected) {
    return getTodasCategorias().map(c => `<option value="${c.v}" ${catSelected === c.v ? 'selected' : ''}>${c.l}</option>`).join('');
}

// Preenche o Filtro da Aba Registros
window.renderizarFiltroCategoria = () => {
    const sel = document.getElementById('filtroCategoria');
    if(!sel) return;
    sel.innerHTML = '<option value="todas">Todas as Categorias</option>' + getSelectOptions('');
};

window.adicionarCategoria = async () => {
    const emoji = document.getElementById('cadCatEmoji').value.trim() || '🏷️';
    const nome = document.getElementById('cadCatNome').value.trim();
    
    if(!nome) return alert("Preencha o nome da categoria.");
    
    // Transforma "Cartão de Crédito" em "cartao_de_credito"
    const valorID = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    const labelVisual = `${emoji} ${nome}`;
    
    // Verifica se já existe
    if(getTodasCategorias().find(c => c.v === valorID)) return alert("Esta categoria já existe!");

    const novaCat = { id: `CAT-${Date.now()}`, v: valorID, l: labelVisual };
    
    try {
        await setDoc(doc(db, "banco_categorias", novaCat.id), novaCat);
        window.categoriasExtras.push(novaCat);
        
        document.getElementById('cadCatEmoji').value = '';
        document.getElementById('cadCatNome').value = '';
        
        window.renderizarCategoriasConfig();
        window.renderizarFiltroCategoria();
        window.renderizarRegistrosSalvos(); // Atualiza tabelas abertas
        window.mostrarToast("Categoria Criada!");
    } catch(e) { alert("Erro ao criar categoria."); }
};

window.excluirCategoria = async (id) => {
    if(!confirm("Tem certeza que deseja excluir esta categoria customizada?")) return;
    try {
        await deleteDoc(doc(db, "banco_categorias", id));
        window.categoriasExtras = window.categoriasExtras.filter(c => c.id !== id);
        
        window.renderizarCategoriasConfig();
        window.renderizarFiltroCategoria();
        window.renderizarRegistrosSalvos();
        window.mostrarToast("Categoria Removida!");
    } catch(e) {}
};

window.renderizarCategoriasConfig = () => {
    const div = document.getElementById('lista-categorias-container');
    if(!div) return;
    if(window.categoriasExtras.length === 0) {
        div.innerHTML = `<div style="background:white; padding:15px; border-radius:6px; color:#666; text-align:center; border:1px solid #ccc;">Nenhuma categoria customizada criada.</div>`;
        return;
    }
    div.innerHTML = window.categoriasExtras.map(c => 
        `<div style="background:white; padding:10px 15px; margin-bottom:5px; border:1px solid #ccc; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:bold; color:#1565c0;">${c.l}</span>
            <button class="btn-icon" style="color:#d32f2f; background:none; border:none; cursor:pointer; font-size:16px;" onclick="window.excluirCategoria('${c.id}')">🗑️</button>
        </div>`
    ).join('');
};


// ==========================================
// MÓDULO 1: IMPORTAÇÃO E CAÇADOR
// ==========================================
function autoCategorizar(desc) {
    if(!desc) return 'classificar';
    const dUpper = desc.toUpperCase();
    for (let r of window.regras) { if (dUpper.includes(r.palavra_chave)) return r.categoria; }
    return 'classificar'; 
}

function limparMoedaCSV(val) {
    let n = val.toString().replace(/[R\$\s]/gi, '').trim();
    if (n.includes('.') && n.includes(',')) n = n.replace(/\./g, '').replace(',', '.');
    else if (n.includes(',')) n = n.replace(',', '.'); 
    return parseFloat(n) || 0;
}

window.processarArquivo = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const contaId = document.getElementById('contaImportacao').value;
    if (!contaId) {
        alert("⚠️ Selecione a CONTA deste extrato primeiro!");
        document.getElementById('arquivoExtrato').value = '';
        return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (e) => {
        if (ext === 'ofx') window.processarOFX(e.target.result, contaId);
        else if (ext === 'csv') window.processarCSV(e.target.result, contaId);
        document.getElementById('arquivoExtrato').value = ''; 
    };
    reader.readAsText(file, 'ISO-8859-1'); 
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
            window.transacoesPendentes.push({
                id: `TEMP-${Date.now()}-${i}`, data: `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`,
                descricao: desc.substring(0,50), valor: v, tipo: v < 0 ? 'despesa' : 'receita', categoria: autoCategorizar(desc), contaOrigem: contaId
            });
        }
    }
    finalizarImportacao();
};

window.processarCSV = (csv, contaId) => {
    window.transacoesPendentes = [];
    Papa.parse(csv, { skipEmptyLines: true, complete: function(res) {
        res.data.forEach((cols, i) => {
            if (cols.length < 2) return; 
            let data = "", vals = [], descArr = [];
            cols.forEach(col => {
                if(typeof col !== 'string') return;
                let cl = col.trim();
                let dM = cl.match(/^(\d{2}\/\d{2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);
                if (!data && dM) { data = dM[1]; return; }
                if (cl.match(/^-?\s*(R\$)?\s*\d{1,3}(\.?\d{3})*,\d{2}$/) || cl.match(/^-?\s*(R\$)?\s*\d+(\.\d{2})$/)) {
                    let v = limparMoedaCSV(cl); if (v !== 0) vals.push(v); return;
                }
                if (!cl.match(/^[0-9\-\.]+$/) && cl !== '') descArr.push(cl);
            });
            if (data && vals.length > 0) {
                if (descArr.some(d => ['SALDO','HISTÓRICO'].includes(d.toUpperCase()))) return;
                let valor = vals[0];
                descArr = descArr.filter(d => !['Aprovado','Concluído','Saldo'].includes(d));
                let desc = descArr.sort((a,b)=>b.length - a.length)[0] || "Sem descrição";
                let dF = data;
                if (data.includes('/')) {
                    let p = data.split('/');
                    if(p[2].length === 2) p[2] = "20"+p[2];
                    dF = `${p[2]}-${p[1]}-${p[0]}`;
                }
                window.transacoesPendentes.push({
                    id: `TEMP-${Date.now()}-${i}`, data: dF, descricao: desc.substring(0,50),
                    valor: valor, tipo: valor < 0 ? 'despesa' : 'receita', categoria: autoCategorizar(desc), contaOrigem: contaId
                });
            }
        });
        finalizarImportacao();
    }});
};

function finalizarImportacao() {
    if (window.transacoesPendentes.length > 0) {
        window.mudarAba('registros'); 
        window.renderizarRegistrosSalvos();
    } else alert("Nenhuma transação válida encontrada.");
}

// ==========================================
// MÓDULO 2: REGISTROS (A SANFONA)
// ==========================================
window.renderizarRegistrosSalvos = () => {
    const containerSanfona = document.getElementById('area-sanfonas');
    const containerPend = document.getElementById('area-pendentes');
    
    // PENDENTES
    if (window.transacoesPendentes.length > 0) {
        let htmlP = `<div style="background: #fff3e0; border: 2px solid #f57c00; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <h4 style="color: #d84315; margin-top:0;">⚠️ ${window.transacoesPendentes.length} Lançamentos Pendentes</h4>
            <div style="max-height: 300px; overflow-y: auto; background: white; border: 1px solid #ffcc80;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;" id="tabela-pendentes">
                    <thead><tr style="background: #ffe0b2;"><th>Data</th><th>Descrição</th><th style="text-align:right;">Valor</th><th>Categoria</th></tr></thead>
                    <tbody>`;
        window.transacoesPendentes.forEach(t => {
            const [,m,d] = t.data.split('-');
            htmlP += `<tr style="border-bottom: 1px solid #eee;" data-id="${t.id}">
                <td style="padding: 8px;">${d}/${m}</td><td style="padding: 8px; font-weight:bold;">${t.descricao}</td>
                <td style="padding: 8px; text-align:right; color:${t.valor<0?'#c62828':'#2e7d32'};">R$ ${t.valor.toFixed(2)}</td>
                <td style="padding: 8px;"><select class="select-categoria" style="padding:4px; width:100%;">${getSelectOptions(t.categoria)}</select></td>
            </tr>`;
        });
        htmlP += `</tbody></table></div>
        <button class="btn-action" style="background: #f57c00; margin-top: 10px; padding: 10px;" onclick="window.salvarExtratoReal()">💾 Salvar Lançamentos e Aprender</button></div>`;
        containerPend.innerHTML = htmlP;
    } else {
        containerPend.innerHTML = "";
    }

    // FILTROS
    let tFiltradas = [...window.transacoes];
    const fCat = document.getElementById('filtroCategoria').value;
    const fTipo = document.getElementById('filtroTipo').value;
    
    if (fCat !== 'todas') tFiltradas = tFiltradas.filter(t => t.categoria === fCat);
    if (fTipo !== 'todos') tFiltradas = tFiltradas.filter(t => t.tipo === fTipo);

    // AGRUPAMENTO
    const grupos = {};
    tFiltradas.sort((a,b) => new Date(b.data) - new Date(a.data));
    
    tFiltradas.forEach(t => {
        const [a, m] = t.data.split('-');
        const mesAno = `${m}/${a}`;
        if(!grupos[mesAno]) grupos[mesAno] = [];
        grupos[mesAno].push(t);
    });

    if (Object.keys(grupos).length === 0) {
        containerSanfona.innerHTML = "<p style='text-align:center; color:#666;'>Nenhum registro encontrado para este filtro.</p>";
        return;
    }

    const mesesNomes = {'01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril','05':'Maio','06':'Junho','07':'Julho','08':'Agosto','09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro'};
    let htmlS = "";
    
    for (let mesAno in grupos) {
        const [m, a] = mesAno.split('/');
        const trns = grupos[mesAno];
        let subtotal = trns.reduce((acc, curr) => acc + curr.valor, 0);
        let corSub = subtotal >= 0 ? '#4caf50' : '#f44336';

        htmlS += `<button class="accordion">${mesesNomes[m]} de ${a} <span style="color:${corSub}; font-weight:900;">R$ ${subtotal.toFixed(2)}</span></button>
                  <div class="accordion-panel">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 10px 0;">
                        <thead>
                            <tr style="border-bottom: 2px solid #ddd; color: #555;">
                                <th style="padding: 10px 5px; text-align:left;">Data</th>
                                <th style="padding: 10px 5px; text-align:left;">Descrição</th>
                                <th style="padding: 10px 5px; text-align:right;">Valor</th>
                                <th style="padding: 10px 5px; text-align:left;">Categoria</th>
                                <th class="noprint" style="padding: 10px 5px; text-align:center;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>`;
        
        trns.forEach(t => {
            const [,mes,dia] = t.data.split('-');
            const bgCat = t.categoria === 'classificar' ? 'background:#fff3e0;' : '';
            htmlS += `<tr style="border-bottom: 1px solid #eee; ${bgCat}">
                <td style="padding: 10px 5px; width: 10%;">${dia}/${mes}</td>
                <td style="padding: 10px 5px; font-weight: bold; color: #333; width: 35%;">${t.descricao}</td>
                <td style="padding: 10px 5px; text-align: right; color: ${t.valor<0?'#d32f2f':'#2e7d32'}; font-weight: bold; width: 15%;">R$ ${t.valor.toFixed(2)}</td>
                <td style="padding: 10px 5px; width: 25%;">
                    <select class="noprint" onchange="window.recategorizarInline('${t.id}', this, '${t.categoria}')" style="padding: 4px; font-size:12px; width:100%;">
                        ${getSelectOptions(t.categoria)}
                    </select>
                    <span class="onlyprint">${getCatLabel(t.categoria)}</span>
                </td>
                <td class="noprint" style="padding: 10px 5px; text-align: center; width: 15%;">
                    ${t.contaOrigem === 'Manual' ? `<button style="background:none; border:none; cursor:pointer; font-size:16px; margin-right:8px;" onclick="window.abrirModalEdicao('${t.id}')" title="Editar">✏️</button>` : ''}
                    <button style="background:none; border:none; cursor:pointer; font-size:16px;" onclick="window.excluirLancamento('${t.id}')" title="Excluir">🗑️</button>
                </td>
            </tr>`;
        });
        htmlS += `</tbody></table></div>`;
    }
    containerSanfona.innerHTML = htmlS;

    const acc = document.getElementsByClassName("accordion");
    for (let i = 0; i < acc.length; i++) {
        acc[i].onclick = function() {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            if (panel.style.maxHeight) panel.style.maxHeight = null;
            else panel.style.maxHeight = panel.scrollHeight + "px";
        }
    }
    if(acc.length > 0) acc[0].click();
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
                const chave = t.descricao.trim().toUpperCase();
                if (!window.regras.find(r => r.palavra_chave === chave)) {
                    const novaRegra = { id: `REG-${Date.now()}`, palavra_chave: chave, categoria: selectCat };
                    await setDoc(doc(db, "banco_regras", novaRegra.id), novaRegra);
                    window.regras.push(novaRegra);
                }
            }
        }
    }
    window.mostrarToast(`${salvas} lançamentos salvos!`);
    window.transacoesPendentes = [];
    window.renderizarRegistrosSalvos();
    window.renderizarDashboard();
};

// ==========================================
// SEGURANÇA E EDIÇÃO
// ==========================================
window.recategorizarInline = async (id, selectEl, oldCat) => {
    const novaCat = selectEl.value;
    if (!confirm(`⚠️ ALERTA DE SEGURANÇA:\nTem a certeza que deseja alterar a categoria deste lançamento para "${getCatLabel(novaCat)}"?`)) {
        selectEl.value = oldCat; 
        return;
    }
    try {
        await updateDoc(doc(db, "banco_transacoes", id), { categoria: novaCat });
        const t = window.transacoes.find(x => x.id === id);
        if (t) t.categoria = novaCat;
        window.mostrarToast("Categoria atualizada com sucesso!");
        window.renderizarRegistrosSalvos(); 
        window.renderizarDashboard();
    } catch(e) { 
        alert("Erro ao atualizar."); 
        selectEl.value = oldCat;
    }
};

window.excluirLancamento = async (id) => {
    if (!confirm("⚠️ PERIGO: Tem a certeza absoluta que deseja EXCLUIR este lançamento?")) return;
    try {
        await deleteDoc(doc(db, "banco_transacoes", id));
        window.transacoes = window.transacoes.filter(t => t.id !== id);
        window.mostrarToast("Lançamento excluído permanentemente!");
        window.renderizarRegistrosSalvos();
        window.renderizarDashboard();
    } catch (e) { alert("Erro ao tentar excluir."); }
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
    
    if (!data || !desc || v <= 0) return alert("Preencha todos os campos corretamente.");
    if (!confirm("Salvar estas alterações?")) return;

    const valorReal = tipo === 'despesa' ? -Math.abs(v) : Math.abs(v);
    
    try {
        await updateDoc(doc(db, "banco_transacoes", id), { data: data, descricao: desc, valor: valorReal, tipo: tipo });
        const t = window.transacoes.find(x => x.id === id);
        if (t) { t.data = data; t.descricao = desc; t.valor = valorReal; t.tipo = tipo; }
        
        document.getElementById('modal-editar').classList.add('hidden');
        window.mostrarToast("Lançamento corrigido com sucesso!");
        window.renderizarRegistrosSalvos();
        window.renderizarDashboard();
    } catch (e) { alert("Erro ao salvar edição."); }
};

window.adicionarLancamentoAvulso = async () => {
    const data = document.getElementById('avulsoData').value;
    const desc = document.getElementById('avulsoDesc').value.trim();
    const v = parseFloat(document.getElementById('avulsoValor').value) || 0;
    const tipo = document.getElementById('avulsoTipo').value;
    
    if (!data || !desc || v <= 0) return alert("Preencha todos os campos.");
    const valor = tipo === 'despesa' ? -Math.abs(v) : Math.abs(v);
    const novoId = `TRN-AVU-${Date.now()}`;
    const trn = { id: novoId, data: data, descricao: desc, valor: valor, tipo: tipo, categoria: 'avulso', contaOrigem: 'Manual' };
    
    await setDoc(doc(db, "banco_transacoes", novoId), trn);
    window.transacoes.push(trn);
    window.mostrarToast("Lançamento Adicionado!");
    document.getElementById('avulsoDesc').value = '';
    document.getElementById('avulsoValor').value = '';
    
    window.mudarAba('registros');
    window.renderizarRegistrosSalvos();
    window.renderizarDashboard();
};

// ==========================================
// MÓDULO 3: DASHBOARD EXECUTIVO
// ==========================================
window.renderizarDashboard = () => {
    const container = document.getElementById('painel-dashboard-content');
    if (!container) return;
    
    if (window.transacoes.length === 0) {
        container.innerHTML = `<div style="background: white; padding: 20px; border-radius: 8px; text-align: center; color: #666;">Sem dados para gerar dashboard.</div>`;
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
            
            // Usa a função inteligente para buscar o Nome+Emoji da categoria!
            const catName = getCatLabel(t.categoria);
            if (!porCategoria[catName]) porCategoria[catName] = 0;
            porCategoria[catName] += val;
        }
    });

    let balanco = tReceitas - tDespesas;
    let corB = balanco >= 0 ? '#2e7d32' : '#d32f2f';

    let htmlBancos = `<div style="margin-top: 20px; margin-bottom: 20px;">
        <h4 style="color: #0d47a1; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom:5px;">Resumo por Banco</h4>
        <div class="grid-input" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">`;
    
    for(let bId in bancosResumo) {
        let nBanco = "Lançamentos Manuais";
        if(bId !== 'Manual') {
            const bx = window.contas.find(c => c.id === bId);
            if(bx) nBanco = bx.banco;
        }
        let bR = bancosResumo[bId].r;
        let bD = bancosResumo[bId].d;
        let bS = bR - bD;
        
        htmlBancos += `<div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-weight: bold; color: #1565c0; font-size: 14px; margin-bottom: 8px;">🏦 ${nBanco}</div>
            <div style="font-size: 12px; color: #2e7d32; display:flex; justify-content:space-between;"><span>Entradas (+):</span> <b>R$ ${bR.toFixed(2)}</b></div>
            <div style="font-size: 12px; color: #d32f2f; display:flex; justify-content:space-between;"><span>Saídas (-):</span> <b>R$ ${bD.toFixed(2)}</b></div>
            <div style="font-size: 13px; color: ${bS>=0?'#2e7d32':'#d32f2f'}; display:flex; justify-content:space-between; margin-top:5px; border-top:1px dashed #ccc; padding-top:5px;">
                <span>Saldo Atual:</span> <b>R$ ${bS.toFixed(2)}</b>
            </div>
        </div>`;
    }
    htmlBancos += `</div></div>`;

    container.innerHTML = `
        <div class="grid-input" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom: 10px;">
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-bottom: 4px solid #43a047; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <h4 style="margin: 0 0 5px 0; color: #666; font-size: 12px;">RECEITA TOTAL</h4>
                <div style="font-size: 18px; font-weight: bold; color: #2e7d32;">R$ ${tReceitas.toFixed(2)}</div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-bottom: 4px solid #e53935; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <h4 style="margin: 0 0 5px 0; color: #666; font-size: 12px;">DESPESA TOTAL</h4>
                <div style="font-size: 18px; font-weight: bold; color: #c62828;">R$ ${tDespesas.toFixed(2)}</div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-bottom: 4px solid ${corB}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <h4 style="margin: 0 0 5px 0; color: #666; font-size: 12px;">SALDO LÍQUIDO</h4>
                <div style="font-size: 18px; font-weight: bold; color: ${corB};">R$ ${balanco.toFixed(2)}</div>
            </div>
        </div>

        ${htmlBancos}

        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <h4 style="color: #0d47a1; margin-top: 0; margin-bottom: 15px; text-align: center;">Divisão de Custos (%)</h4>
            <div style="position: relative; height: 300px; width: 100%;"><canvas id="graficoCat"></canvas></div>
        </div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('graficoCat');
        if (ctx) {
            Chart.register(ChartDataLabels);
            if (chartInstance) chartInstance.destroy();
            
            const lbs = Object.keys(porCategoria);
            const dts = Object.values(porCategoria);

            chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: lbs, datasets: [{ data: dts, backgroundColor: ['#ef5350','#ab47bc','#7e57c2','#5c6bc0','#42a5f5','#26c6da','#26a69a','#66bb6a','#ffa726','#ec407a','#ffca28','#8d6e63'], borderWidth: 1 }] },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { position: 'right' },
                        datalabels: {
                            color: '#fff', font: { weight: 'bold', size: 12 },
                            formatter: (value, ctx) => {
                                let sum = 0;
                                ctx.chart.data.datasets[0].data.map(data => { sum += data; });
                                return (value*100 / sum).toFixed(1)+"%";
                            }
                        }
                    } 
                }
            });
        }
    }, 100);
};

// ==========================================
// FUNÇÕES AUXILIARES (CONTAS, NAVEGAÇÃO, AUTH)
// ==========================================
window.renderizarDropdownContas = () => { 
    const sel = document.getElementById('contaImportacao');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- OBRIGATÓRIO: Selecione a Conta --</option>';
    window.contas.forEach(c => { sel.appendChild(new Option(`${c.banco} - ${c.titular}`, c.id)); });
};
window.adicionarConta = async () => { 
    const b = document.getElementById('cadBanco').value.trim();
    const t = document.getElementById('cadTitular').value.trim();
    const f = document.getElementById('cadFonte').value.trim();
    if(!b || !t) return;
    const nC = { id: `CTA-${Date.now()}`, banco: b, titular: t, fonte: f };
    await setDoc(doc(db, "banco_contas", nC.id), nC);
    window.contas.push(nC); window.renderizarContas(); window.renderizarDropdownContas(); window.mostrarToast("Conta Salva!");
};
window.renderizarContas = () => { 
    const div = document.getElementById('lista-contas-container');
    if(!div) return;
    div.innerHTML = window.contas.map(c => `<div style="background:white; padding:10px; margin-bottom:5px; border:1px solid #ccc;">${c.banco} - ${c.titular}</div>`).join('');
};

window.mudarAba = (aba) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`painel-${aba}`).classList.add('active');
    document.getElementById(`btn-tab-${aba}`).classList.add('active');
    if (aba === 'registros') window.renderizarRegistrosSalvos();
    if (aba === 'dashboard') window.renderizarDashboard();
};

window.fazerLogin = async () => {
    const e = document.getElementById('emailLogin').value, s = document.getElementById('senhaLogin').value;
    try { await signInWithEmailAndPassword(auth, e, s); } catch (er) { alert("Erro de Login"); }
};
window.sairApp = async () => { if(confirm("Sair?")) await signOut(auth); };
window.mostrarToast = (m) => { const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 3000); };

onAuthStateChanged(auth, (u) => {
    if (u) { document.getElementById('tela-login').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); window.carregarTodosOsDados(); } 
    else { document.getElementById('tela-login').classList.remove('hidden'); document.getElementById('app').classList.add('hidden'); window.transacoes=[]; window.contas=[]; window.categoriasExtras=[]; }
});
