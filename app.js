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
window.transacoesPendentes = []; // Ficam aqui até serem salvas após leitura do extrato

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

        console.log("DB Sincronizado. Contas ativas: ", window.contas.length);
        window.renderizarContas();
    } catch (e) { 
        console.error("Erro ao carregar DB: ", e); 
        window.mostrarToast("Erro de sincronização.");
    }
};

// ==========================================
// LÓGICA DE CADASTRO DE CONTAS (ABAS CONFIG)
// ==========================================
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
        
        document.getElementById('cadBanco').value = '';
        document.getElementById('cadTitular').value = '';
        document.getElementById('cadFonte').value = '';
        
        window.mostrarToast("Conta adicionada com sucesso!");
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar conta.");
    }
};

window.excluirConta = async (id) => {
    if (!confirm("Excluir esta conta?")) return;
    try {
        await deleteDoc(doc(db, "banco_contas", id));
        window.contas = window.contas.filter(c => c.id !== id);
        window.renderizarContas();
        window.mostrarToast("Conta excluída!");
    } catch(e) {
        console.error(e);
    }
};

window.renderizarContas = () => {
    const container = document.getElementById('lista-contas-container');
    if (!container) return;
    
    if (window.contas.length === 0) {
        container.innerHTML = `<div style="background: white; padding: 20px; border-radius: 8px; text-align: center; color: #666; border: 1px solid #ddd;">Nenhuma conta cadastrada.</div>`;
        return;
    }

    let htmlRows = window.contas.map(c => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 10px; font-weight: bold; color: #1565c0;">${c.banco}</td>
            <td style="padding: 12px 10px;">${c.titular}</td>
            <td style="padding: 12px 10px; font-weight: bold; color: #f57c00; font-size: 12px;">${c.fonte || '-'}</td>
            <td style="padding: 12px 10px; text-align: center;">
                <button class="btn-icon" style="color:#d32f2f; font-size:16px; border:none; background:none; cursor:pointer;" onclick="window.excluirConta('${c.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #cfd8dc;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                    <tr style="background: #e3f2fd; border-bottom: 2px solid #90caf9;">
                        <th style="padding: 12px 10px; color: #0d47a1;">Banco</th>
                        <th style="padding: 12px 10px; color: #0d47a1;">Titular</th>
                        <th style="padding: 12px 10px; color: #0d47a1;">Fonte/Origem</th>
                        <th style="padding: 12px 10px; text-align: center; color: #0d47a1;">Ação</th>
                    </tr>
                </thead>
                <tbody>${htmlRows}</tbody>
            </table>
        </div>
    `;
};

// ==========================================
// MOTOR DE LEITURA OFX E CSV
// ==========================================
window.processarArquivo = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const extensao = file.name.split('.').pop().toLowerCase();
    window.mostrarToast(`Processando ${extensao.toUpperCase()}...`);
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const conteudo = e.target.result;
        
        if (extensao === 'ofx') {
            window.processarOFX(conteudo);
        } else if (extensao === 'csv') {
            window.processarCSV(conteudo);
        } else {
            alert("Formato não suportado. Use .ofx ou .csv.");
        }
        
        document.getElementById('arquivoExtrato').value = ''; // Limpa input
    };
    
    reader.readAsText(file, 'ISO-8859-1'); 
};

window.processarOFX = (ofxString) => {
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
            
            window.transacoesPendentes.push({
                id: `TEMP-${Date.now()}-${i}`,
                data: dataFormatada,
                descricao: descricao,
                valor: valor,
                tipo: valor < 0 ? 'despesa' : 'receita',
                categoria: 'A Classificar'
            });
        }
    }
    
    if (window.transacoesPendentes.length > 0) {
        window.mostrarToast(`${window.transacoesPendentes.length} transações lidas!`);
        window.mudarAba('classificacao');
        window.renderizarClassificacao();
    } else {
        alert("Não foi possível encontrar transações válidas neste arquivo.");
    }
};

window.processarCSV = (csvString) => {
    alert("Motor CSV ativado! Mapeamento de colunas em breve.");
};

window.renderizarClassificacao = () => {
    const container = document.getElementById('classificacao-container');
    
    if (window.transacoesPendentes.length === 0) {
        container.innerHTML = "Nenhum extrato aguardando classificação.";
        return;
    }
    
    window.transacoesPendentes.sort((a, b) => new Date(a.data) - new Date(b.data));
    
    let htmlTabela = `
        <div style="background: white; border: 1px solid #cfd8dc; border-radius: 8px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
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
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">${dataFmt}</td>
                <td style="padding: 10px; font-weight: bold; color: #455a64;">${t.descricao}</td>
                <td style="padding: 10px; text-align: right; color: ${corValor}; font-weight: bold;">R$ ${t.valor.toFixed(2)}</td>
                <td style="padding: 10px;">
                    <select style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; width: 100%;">
                        <option value="classificar">A Classificar</option>
                        <option value="transferencia_interna">Transferência Interna</option>
                        <option value="alimentacao">Alimentação</option>
                        <option value="transporte">Transporte / Combustível</option>
                        <option value="moradia">Moradia</option>
                        <option value="salario">Salário / Renda</option>
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
            <button class="btn-action btn-green" style="width: auto; padding: 12px 24px;" onclick="alert('Lógica de salvamento na próxima fase!')">💾 Salvar Extrato no Banco de Dados</button>
        </div>
    `;
    
    container.innerHTML = htmlTabela;
};

// ==========================================
// CONTROLE DE NAVEGAÇÃO E AUTH
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
