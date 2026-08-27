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

// ==========================================
// VARIÁVEIS DE MEMÓRIA (O NOSSO NOVO DB)
// ==========================================
window.transacoes = []; 
window.regras = [];     
window.contas = [];     

// ==========================================
// INICIALIZAÇÃO E LEITURA DO FIREBASE
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

        // Renderiza as tabelas se estiver nas respectivas abas
        window.renderizarContas();
        
    } catch (e) { 
        console.error("Erro ao carregar o Banco de Dados: ", e); 
        window.mostrarToast("Erro de sincronização.");
    }
};

// ==========================================
// LÓGICA DE CADASTRO DE CONTAS E FONTES
// ==========================================
window.adicionarConta = async () => {
    const banco = document.getElementById('cadBanco').value.trim();
    const titular = document.getElementById('cadTitular').value.trim();
    const fonte = document.getElementById('cadFonte').value.trim();

    if (!banco || !titular) {
        return alert("Por favor, preencha pelo menos o nome do Banco e o Titular da conta.");
    }

    const idUnico = `CTA-${Date.now()}`;
    const novaConta = { id: idUnico, banco, titular, fonte };

    try {
        await setDoc(doc(db, "banco_contas", idUnico), novaConta);
        window.contas.push(novaConta);
        window.renderizarContas();
        
        // Limpa o formulário
        document.getElementById('cadBanco').value = '';
        document.getElementById('cadTitular').value = '';
        document.getElementById('cadFonte').value = '';
        
        window.mostrarToast("Conta adicionada com sucesso!");
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar a conta no banco de dados.");
    }
};

window.excluirConta = async (id) => {
    if (!confirm("Tem a certeza que deseja excluir esta conta?")) return;
    
    try {
        await deleteDoc(doc(db, "banco_contas", id));
        window.contas = window.contas.filter(c => c.id !== id);
        window.renderizarContas();
        window.mostrarToast("Conta excluída!");
    } catch(e) {
        console.error(e);
        alert("Erro ao excluir conta.");
    }
};

window.renderizarContas = () => {
    const container = document.getElementById('lista-contas-container');
    if (!container) return;
    
    if (window.contas.length === 0) {
        container.innerHTML = `<div style="background: white; padding: 20px; border-radius: 8px; text-align: center; color: #666; border: 1px solid #ddd;">Nenhuma conta bancária cadastrada.</div>`;
        return;
    }

    let htmlRows = window.contas.map(c => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 10px; font-weight: bold; color: #1565c0;">${c.banco}</td>
            <td style="padding: 12px 10px;">${c.titular}</td>
            <td style="padding: 12px 10px; font-weight: bold; color: #f57c00; font-size: 12px;">${c.fonte || '-'}</td>
            <td style="padding: 12px 10px; text-align: center;">
                <button class="btn-icon" style="color:#d32f2f; font-size:16px; border:none; background:none; cursor:pointer;" onclick="window.excluirConta('${c.id}')" title="Excluir Conta">🗑️</button>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #cfd8dc;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                    <tr style="background: #e3f2fd; border-bottom: 2px solid #90caf9;">
                        <th style="padding: 12px 10px; color: #0d47a1;">Banco</th>
                        <th style="padding: 12px 10px; color: #0d47a1;">Titular (Conta)</th>
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
// CONTROLE DE NAVEGAÇÃO (ABAS)
// ==========================================
window.mudarAba = (aba) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const panel = document.getElementById(`painel-${aba}`);
    const btn = document.getElementById(`btn-tab-${aba}`);
    
    if (panel) panel.classList.add('active');
    if (btn) btn.classList.add('active');

    // Sempre que entra nas configurações, renderiza a tabela para garantir
    if(aba === 'configuracoes') window.renderizarContas();
};

// ==========================================
// FUNÇÕES PLACEHOLDER (Para a próxima etapa)
// ==========================================
window.processarArquivo = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const extensao = file.name.split('.').pop().toLowerCase();
    window.mostrarToast(`Arquivo ${extensao.toUpperCase()} detectado. Preparando motor...`);
    
    setTimeout(() => {
        window.mudarAba('classificacao');
    }, 1500);
};

// ==========================================
// AUTENTICAÇÃO E LOGIN
// ==========================================
window.fazerLogin = async () => {
    const email = document.getElementById('emailLogin').value; 
    const senha = document.getElementById('senhaLogin').value;
    
    if (!email || !senha) return alert("Preencha e-mail e senha.");
    
    const btn = document.querySelector('#tela-login .btn-action'); 
    btn.innerText = "Entrando...";
    
    try { 
        await signInWithEmailAndPassword(auth, email, senha); 
    } catch (e) { 
        alert("Credenciais inválidas."); 
    } finally { 
        btn.innerText = "Entrar no Sistema"; 
    }
};

window.sairApp = async () => { 
    if (confirm("Deseja sair do Cost Savings Analysis?")) await signOut(auth); 
};

window.mostrarToast = (msg) => { 
    const t = document.getElementById('toast'); 
    if (!t) return; 
    t.innerText = msg; 
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), 3000); 
};

// ==========================================
// MONITOR DE ESTADO DO USUÁRIO
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) { 
        document.getElementById('tela-login').classList.add('hidden'); 
        document.getElementById('app').classList.remove('hidden'); 
        
        window.carregarTodosOsDados();
    } 
    else { 
        document.getElementById('tela-login').classList.remove('hidden'); 
        document.getElementById('app').classList.add('hidden'); 
        
        window.transacoes = [];
        window.regras = [];
        window.contas = [];
    }
});

// Ao carregar a página, se o usuário já tem login, preenche os inputs vazios
window.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date(); 
    const ano = hoje.getFullYear(); 
    const mes = String(hoje.getMonth() + 1).padStart(2, '0'); 
    const dia = String(hoje.getDate()).padStart(2, '0');
    if (document.getElementById('avulsoData')) document.getElementById('avulsoData').value = `${ano}-${mes}-${dia}`;
});
