import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// VARIÁVEIS GLOBAIS
window.transacoes = []; 
window.regras = [];     
window.contas = [];
window.transacoesPendentes = []; 

// ==========================================
// INICIALIZAÇÃO
// ==========================================
window.carregarTodosOsDados = async () => {
    try {
        const snapContas = await getDocs(collection(db, "banco_contas"));
        window.contas = snapContas.docs.map(d => d.data());

        const snapRegras = await getDocs(collection(db, "banco_regras"));
        window.regras = snapRegras.docs.map(d => d.data());

        const snapTransacoes = await getDocs(collection(db, "banco_transacoes"));
        window.transacoes = snapTransacoes.docs.map(d => d.data());

        console.log("DB Sincronizado. Regras Ativas:", window.regras.length);
        window.renderizarContas();
        window.renderizarDropdownContas();
    } catch (e) { 
        console.error("Erro ao carregar DB: ", e); 
        window.mostrarToast("Erro de sincronização.");
    }
};

// ==========================================
// LÓGICA DE CADASTRO DE CONTAS E DROPDOWN
// ==========================================
window.renderizarDropdownContas = () => {
    const select = document.getElementById('contaImportacao');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- OBRIGATÓRIO: Selecione a Conta --</option>';
    window.contas.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.text = `${c.banco} - ${c.titular}`;
        select.appendChild(opt);
    });
};

window.adicionarConta = async () => {
    const banco = document.getElementById('cadBanco').value.trim();
    const titular = document.getElementById('cadTitular').value.trim();
    const fonte = document.getElementById('cadFonte').value.trim();

    if (!banco || !titular) return alert("Preencha o Banco e o Titular da conta.");

    const idUnico = `CTA-${Date.now()}`;
    const novaConta = { id: idUnico, banco, titular, fonte };

    try {
        await setDoc(doc(db, "banco_contas", idUnico), novaConta);
        window.contas.push(novaConta);
        window.renderizarContas();
        window.renderizarDropdownContas();
        
        document.getElementById('cadBanco').value = '';
        document.getElementById('cadTitular').value = '';
        document.getElementById('cadFonte').value = '';
        window.mostrarToast("Conta adicionada com sucesso!");
    } catch (e) { alert("Erro ao salvar conta."); }
};

window.excluirConta = async (id) => {
    if (!confirm("Excluir esta conta?")) return;
    try {
        await deleteDoc(doc(db, "banco_contas", id));
        window.contas = window.contas.filter(c => c.id !== id);
        window.renderizarContas();
        window.renderizarDropdownContas();
        window.mostrarToast("Conta excluída!");
    } catch(e) {}
};

window.renderizarContas = () => {
    const container = document.getElementById('lista-contas-container');
    if (!container) return;
    if (window.contas.length === 0) {
        container.innerHTML = `<div style="background: white; padding: 20px; border-radius: 8px; text-align: center; color: #666; border: 1px solid #ddd;">Nenhuma conta cadastrada.</div>`;
        return;
    }
    let htmlRows = window.contas.map(c => `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 12px 10px; font-weight: bold; color: #1565c0;">${c.banco}</td><td style="padding: 12px 10px;">${c.titular}</td><td style="padding: 12px 10px; color: #f57c00;">${c.fonte || '-'}</td><td style="padding: 12px 10px; text-align: center;"><button class="btn-icon" style="color:#d32f2f; font-size:16px; border:none; background:none; cursor:pointer;" onclick="window.excluirConta('${c.id}')">🗑️</button></td></tr>`).join('');
    container.innerHTML = `<div style="background: white; border-radius: 8px; border: 1px solid #cfd8dc;"><table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;"><thead><tr style="background: #e3f2fd;"><th style="padding: 12px 10px;">Banco</th><th style="padding: 12px 10px;">Titular</th><th style="padding: 12px 10px;">Fonte</th><th style="padding: 12px 10px; text-align: center;">Ação</th></tr></thead><tbody>${htmlRows}</tbody></table></div>`;
};

// ==========================================
// INTELIGÊNCIA: DESCOBRIR CATEGORIA E LIMPAR DADOS
// ==========================================
function autoCategorizar(descricaoBanco) {
    const descUpper = descricaoBanco.toUpperCase();
    for (const regra of window.regras) {
        if (descUpper.includes(regra.palavra_chave)) {
            return regra.categoria;
        }
    }
    return 'classificar'; 
}

function limparMoedaCSV(val) {
    if (!val) return 0;
    let numStr = val.toString().replace(/[R\$\s]/gi, '').trim();
    if (numStr.includes('.') && numStr.includes(',')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.');
    } else if (numStr.includes(',')) {
        numStr = numStr.replace(',', '.');
    }
    return parseFloat(numStr) || 0;
}

// ==========================================
// MOTOR DE LEITURA HÍBRIDO (OFX E CSV COM PAPA PARSE)
// ==========================================
window.processarArquivo = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const contaSelecionadaId = document.getElementById('contaImportacao').value;
    if (!contaSelecionadaId) {
        alert("⚠️ ERRO: Por favor, selecione de qual CONTA é este extrato antes de importar!");
        document.getElementById('arquivoExtrato').value = '';
        return;
    }
    
    const extensao = file.name.split('.').pop().toLowerCase();
    window.mostrarToast(`Lendo arquivo ${extensao.toUpperCase()}...`);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const conteudo = e.target.result;
        if (extensao === 'ofx') {
            window.processarOFX(conteudo, contaSelecionadaId);
        } else if (extensao === 'csv') {
            window.processarCSV(conteudo, contaSelecionadaId);
        } else {
            alert("Formato inválido. Use .ofx ou .csv.");
        }
        document.getElementById('arquivoExtrato').value = ''; 
    };
    reader.readAsText(file, 'ISO-8859-1'); 
};

window.processarOFX = (ofxString, contaId) => {
    window.transacoesPendentes = [];
    const transacoesBrutas = ofxString.split('<STMTTRN>');
    
    for (let i = 1; i < transacoesBrutas.length; i++) {
        const bloco = transacoesBrutas[i];
        
        const dataMatch = bloco.match(/<DTPOSTED>(.*?)(?:\r\n|\n|<)/);
        const valorMatch = bloco.match(/<TRNAMT>(.*?)(?:\r\n|\n|<)/);
        const memoMatch = bloco.match(/<MEMO>(.*?)(?:\r\n|\n|<)/);
        const nameMatch = bloco.match(/<NAME>(.*?)(?:\r\n|\n|<)/);
        
        if (dataMatch && valorMatch) {
            const dataBruta = dataMatch[1].substring(0, 8);
            const dataFormatada = `${dataBruta.substring(0,4)}-${dataBruta.substring(4,6)}-${dataBruta.substring(6,8)}`;
            const valor = parseFloat(valorMatch[1]);
            
            let descricao = "";
            if (memoMatch && memoMatch[1]) descricao = memoMatch[1].trim();
            else if (nameMatch && nameMatch[1]) descricao = nameMatch[1].trim();
            
            const categoriaIA = autoCategorizar(descricao);
            
            window.transacoesPendentes.push({
                id: `TEMP-${Date.now()}-${i}`,
                data: dataFormatada,
                descricao: descricao,
                valor: valor,
                tipo: valor < 0 ? 'despesa' : 'receita',
                categoria: categoriaIA,
                contaOrigem: contaId
            });
        }
    }
    finalizarImportacao();
};

window.processarCSV = (csvString, contaId) => {
    window.transacoesPendentes = [];
    
    Papa.parse(csvString, {
        skipEmptyLines: true,
        complete: function(results) {
            const linhas = results.data;

            linhas.forEach((colunas, i) => {
                if (colunas.length < 2) return; 

                let data = "";
                let valor = 0;
                let desc = "";
                let valorEncontrado = false;

                colunas.forEach(col => {
                    if (typeof col !== 'string') return;
                    let colLimpa = col.trim();

                    if (!data && (colLimpa.match(/^\d{2}\/\d{2}\/\d{4}/) || colLimpa.match(/^\d{4}-\d{2}-\d{2}/))) {
                        data = colLimpa.substring(0, 10);
                    } 
                    else if (!valorEncontrado && colLimpa.match(/^-?R?\s*\$?\s*\d{1,3}(\.?\d{3})*,\d{2}$|^-?\d+(\.\d+)?$/)) {
                        let vTemp = limparMoedaCSV(colLimpa);
                        if (vTemp !== 0) {
                            valor = vTemp;
                            valorEncontrado = true;
                        }
                    } 
                    else {
                        if (colLimpa && colLimpa.length > desc.length && !colLimpa.match(/^[0-9]+$/)) {
                            desc = colLimpa;
                        }
                    }
                });

                if (data && valorEncontrado) {
                    let dataFmt = data;
                    if (data.includes('/')) {
                        const parts = data.split('/');
                        dataFmt = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }

                    const categoriaIA = autoCategorizar(desc);

                    window.transacoesPendentes.push({
                        id: `TEMP-${Date.now()}-${i}`,
                        data: dataFmt,
                        descricao: desc || "Sem descrição",
                        valor: valor,
                        tipo: valor < 0 ? 'despesa' : 'receita',
                        categoria: categoriaIA,
                        contaOrigem: contaId
                    });
                }
            });
            
            finalizarImportacao();
        },
        error: function(error) {
            alert("Erro ao ler o CSV: " + error.message);
        }
    });
};

function finalizarImportacao() {
    if (window.transacoesPendentes.length > 0) {
        window.mostrarToast(`${window.transacoesPendentes.length} transações extraídas!`);
        window.mudarAba('classificacao');
        window.renderizarClassificacao();
    } else {
        alert("Não foi possível encontrar transações válidas neste arquivo CSV/OFX.");
    }
}

// ==========================================
// RENDERIZAÇÃO E SALVAMENTO (O APRENDIZADO)
// ==========================================
window.renderizarClassificacao = () => {
    const container = document.getElementById('classificacao-container');
    
    if (window.transacoesPendentes.length === 0) {
        container.innerHTML = "Nenhum extrato aguardando classificação.";
        return;
    }
    
    window.transacoesPendentes.sort((a, b) => new Date(a.data) - new Date(b.data));
    
    const contaSelecionada = window.contas.find(c => c.id === window.transacoesPendentes[0].contaOrigem);
    const nomeConta = contaSelecionada ? `${contaSelecionada.banco} - ${contaSelecionada.titular}` : 'Desconhecida';
    
    let htmlTabela = `
        <h4 style="color: #f57c00; text-align:left; margin-bottom: 15px;">Extrato da conta: <b>${nomeConta}</b></h4>
        <div style="background: white; border: 1px solid #cfd8dc; border-radius: 8px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;" id="tabela-classificacao">
                <thead>
                    <tr style="background: #e3f2fd; border-bottom: 2px solid #90caf9;">
                        <th style="padding: 10px; color: #0d47a1;">Data</th>
                        <th style="padding: 10px; color: #0d47a1;">Descrição do Banco</th>
                        <th style="padding: 10px; text-align: right; color: #0d47a1;">Valor</th>
                        <th style="padding: 10px; color: #0d47a1;">Categoria</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    window.transacoesPendentes.forEach(t => {
        const [ano, mes, dia] = t.data.split('-');
        const dataFmt = `${dia}/${mes}/${ano}`;
        const corValor = t.valor < 0 ? '#d32f2f' : '#2e7d32';
        
        htmlTabela += `
            <tr style="border-bottom: 1px solid #eee;" data-id="${t.id}">
                <td style="padding: 10px;">${dataFmt}</td>
                <td style="padding: 10px; font-weight: bold; color: #455a64;">${t.descricao}</td>
                <td style="padding: 10px; text-align: right; color: ${corValor}; font-weight: bold;">R$ ${t.valor.toFixed(2)}</td>
                <td style="padding: 10px;">
                    <select class="select-categoria" style="padding: 6px; border: 1px solid ${t.categoria === 'classificar' ? '#f57c00' : '#81c784'}; border-radius: 4px; width: 100%; background: ${t.categoria === 'classificar' ? '#fff3e0' : '#e8f5e9'};">
                        <option value="classificar" ${t.categoria === 'classificar' ? 'selected' : ''}>⚠️ A Classificar</option>
                        <option value="transferencia_interna" ${t.categoria === 'transferencia_interna' ? 'selected' : ''}>🔄 Transferência Interna</option>
                        <option value="alimentacao" ${t.categoria === 'alimentacao' ? 'selected' : ''}>🍔 Alimentação / Supermercado</option>
                        <option value="transporte" ${t.categoria === 'transporte' ? 'selected' : ''}>🚗 Transporte / Combustível</option>
                        <option value="moradia" ${t.categoria === 'moradia' ? 'selected' : ''}>🏠 Moradia / Contas</option>
                        <option value="lazer" ${t.categoria === 'lazer' ? 'selected' : ''}>🎉 Lazer / Compras</option>
                        <option value="salario" ${t.categoria === 'salario' ? 'selected' : ''}>💰 Salário / Renda Externa</option>
                    </select>
                </td>
            </tr>
        `;
    });
    
    htmlTabela += `
                </tbody>
            </table>
        </div>
        <div style="margin-top: 15px; text-align: right;">
            <button class="btn-action btn-green" style="width: auto; padding: 12px 24px;" onclick="window.salvarExtratoReal()">💾 Salvar Extrato no Banco de Dados</button>
        </div>
    `;
    
    container.innerHTML = htmlTabela;
};

window.salvarExtratoReal = async () => {
    const rows = document.querySelectorAll('#tabela-classificacao tbody tr');
    let salvas = 0;
    
    const btn = document.querySelector('#painel-classificacao .btn-green');
    if(btn) {
        btn.innerText = "Salvando e Aprendendo...";
        btn.disabled = true;
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const tId = row.getAttribute('data-id');
        const selectCat = row.querySelector('.select-categoria').value;

        const t = window.transacoesPendentes.find(x => x.id === tId);
        if (t) {
            t.categoria = selectCat;

            const novoId = `TRN-${Date.now()}-${Math.floor(Math.random()*1000)}`;
            const trnDB = {
                id: novoId,
                data: t.data,
                descricao: t.descricao,
                valor: t.valor,
                tipo: t.tipo,
                categoria: t.categoria,
                contaOrigem: t.contaOrigem
            };

            await setDoc(doc(db, "banco_transacoes", novoId), trnDB);
            window.transacoes.push(trnDB);
            salvas++;

            if (selectCat !== 'classificar') {
                const chave = t.descricao.trim().toUpperCase();
                const regraExiste = window.regras.find(r => r.palavra_chave === chave);
                
                if (!regraExiste) {
                    const novaRegra = { id: `REG-${Date.now()}-${Math.floor(Math.random()*100)}`, palavra_chave: chave, categoria: selectCat };
                    await setDoc(doc(db, "banco_regras", novaRegra.id), novaRegra);
                    window.regras.push(novaRegra);
                }
            }
        }
    }

    window.mostrarToast(`${salvas} transações salvas e aprendidas!`);
    window.transacoesPendentes = [];
    window.renderizarClassificacao();
    window.mudarAba('dashboard');
};

// ==========================================
// NAVEGAÇÃO E AUTH
// ==========================================
window.mudarAba = (aba) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const panel = document.getElementById(`painel-${aba}`);
    const btn = document.getElementById(`btn-tab-${aba}`);
    
    if (panel) panel.classList.add('active');
    if (btn) btn.classList.add('active');
    if (aba === 'configuracoes') window.renderizarContas();
};

window.fazerLogin = async () => {
    const email = document.getElementById('emailLogin').value; 
    const senha = document.getElementById('senhaLogin').value;
    if (!email || !senha) return alert("Preencha e-mail e senha.");
    const btn = document.querySelector('#tela-login .btn-action'); 
    btn.innerText = "Entrando...";
    try { await signInWithEmailAndPassword(auth, email, senha); } 
    catch (e) { alert("Credenciais inválidas."); } 
    finally { btn.innerText = "Entrar no Sistema"; }
};

window.sairApp = async () => { if (confirm("Deseja sair do Cost Savings Analysis?")) await signOut(auth); };

window.mostrarToast = (msg) => { 
    const t = document.getElementById('toast'); 
    if (!t) return; 
    t.innerText = msg; 
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), 3000); 
};

onAuthStateChanged(auth, (user) => {
    if (user) { 
        document.getElementById('tela-login').classList.add('hidden'); 
        document.getElementById('app').classList.remove('hidden'); 
        window.carregarTodosOsDados();
    } else { 
        document.getElementById('tela-login').classList.remove('hidden'); 
        document.getElementById('app').classList.add('hidden'); 
        window.transacoes = []; window.regras = []; window.contas = [];
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date(); 
    const ano = hoje.getFullYear(); 
    const mes = String(hoje.getMonth() + 1).padStart(2, '0'); 
    const dia = String(hoje.getDate()).padStart(2, '0');
    if (document.getElementById('avulsoData')) document.getElementById('avulsoData').value = `${ano}-${mes}-${dia}`;
});
