import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Conexão com o seu Firebase atual (apenas vamos usar coleções novas)
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
window.transacoes = []; // Guarda os extratos lidos e confirmados
window.regras = [];     // Guarda a IA de categorização (ex: "IFOOD" = "Alimentação")
window.contas = [];     // Guarda as contas para a regra de Transferência Interna

// ==========================================
// INICIALIZAÇÃO E LEITURA DO FIREBASE
// ==========================================
window.carregarTodosOsDados = async () => {
    try {
        // 1. Carrega as Contas Internas
        const snapContas = await getDocs(collection(db, "banco_contas"));
        window.contas = snapContas.docs.map(d => d.data());

        // 2. Carrega as Regras de Categoria
        const snapRegras = await getDocs(collection(db, "banco_regras"));
        window.regras = snapRegras.docs.map(d => d.data());

        // 3. Carrega o Histórico de Extratos
        const snapTransacoes = await getDocs(collection(db, "banco_transacoes"));
        window.transacoes = snapTransacoes.docs.map(d => d.data());

        console.log("DB Sincronizado:", { 
            contas: window.contas.length, 
            regras: window.regras.length, 
            transacoes: window.transacoes.length 
        });

        // No futuro, chamaremos a renderização da tela de Dashboard e Configurações aqui
        
    } catch (e) { 
        console.error("Erro ao carregar o Banco de Dados: ", e); 
        window.mostrarToast("Erro de sincronização.");
    }
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
};

// ==========================================
// FUNÇÕES PLACEHOLDER (Para a próxima etapa)
// ==========================================
window.processarArquivo = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const extensao = file.name.split('.').pop().toLowerCase();
    window.mostrarToast(`Arquivo ${extensao.toUpperCase()} detectado. Preparando motor...`);
    
    // Na próxima fase, a inteligência de ler OFX/CSV vai entrar aqui!
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
        
        // Puxa as informações do banco de dados quando entra!
        window.carregarTodosOsDados();
    } 
    else { 
        document.getElementById('tela-login').classList.remove('hidden'); 
        document.getElementById('app').classList.add('hidden'); 
        
        // Limpa a memória por segurança
        window.transacoes = [];
        window.regras = [];
        window.contas = [];
    }
});
