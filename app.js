import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Mantemos o mesmo banco de dados, mas vamos usar coleções (tabelas) novas
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
// CONTROLE DE NAVEGAÇÃO (ABAS)
// ==========================================
window.mudarAba = (aba) => {
    // Esconde todos os painéis e remove o "active" dos botões
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    // Mostra o painel correto e marca o botão correspondente
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
    
    window.mostrarToast(`Arquivo ${extensao.toUpperCase()} detectado. Preparando motor de leitura...`);
    
    // Na próxima fase, aqui entrará o Leitor de OFX e CSV!
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

// Fica escutando se o usuário está logado
onAuthStateChanged(auth, (user) => {
    if (user) { 
        document.getElementById('tela-login').classList.add('hidden'); 
        document.getElementById('app').classList.remove('hidden'); 
        // Na próxima fase, aqui vamos colocar a função: carregarRegrasETransacoes()
    } 
    else { 
        document.getElementById('tela-login').classList.remove('hidden'); 
        document.getElementById('app').classList.add('hidden'); 
    }
});
