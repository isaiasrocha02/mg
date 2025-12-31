const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = "minha_chave_secreta_super_segura"; // Em produção, use variáveis de ambiente

// Middleware
app.use(express.json({ limit: '50mb' })); // Aumentado limite para uploads grandes
app.use(cors());
app.use(express.static(path.join(__dirname, '.'))); // Serve os arquivos HTML/CSS/JS da pasta atual

// Banco de Dados SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
    console.log('Conectado ao banco de dados SQLite.');
});

// Criação das Tabelas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        email TEXT UNIQUE,
        password TEXT,
        is_admin INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS apostas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        jogos TEXT, -- Salvaremos o JSON dos jogos aqui
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // Criar Admin padrão se não existir
    const adminPass = "admin"; // Senha padrão
    const adminEmail = "admin@mega.sena";
    
    db.get("SELECT * FROM users WHERE email = ?", [adminEmail], (err, row) => {
        if (!row) {
            bcrypt.hash(adminPass, 10, (err, hash) => {
                db.run("INSERT INTO users (nome, email, password, is_admin) VALUES (?, ?, ?, ?)", 
                ["Administrador", adminEmail, hash, 1]);
                console.log("Admin padrão criado: admin@mega.sena / admin");
            });
        }
    });
});

// --- ROTAS ---

// Cadastro
app.post('/auth/register', async (req, res) => {
    const { nome, email, password } = req.body;

    // Validação simples de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Formato de e-mail inválido." });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (nome, email, password) VALUES (?, ?, ?)", [nome, email, hash], function(err) {
            if (err) {
                if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "E-mail já cadastrado." });
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: "Usuário criado com sucesso!" });
        });
    } catch (e) {
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// Login
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Usuário ou senha incorretos." });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Usuário ou senha incorretos." });

        const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin, nome: user.nome }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { nome: user.nome, email: user.email, is_admin: user.is_admin } });
    });
});

// Middleware de Autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Salvar Apostas (Sobrescreve as atuais do usuário)
app.post('/api/apostas', authenticateToken, (req, res) => {
    const { apostas } = req.body; // Array de arrays
    const apostasString = JSON.stringify(apostas);
    
    // Verifica se já existe registro para atualizar ou criar novo
    db.get("SELECT id FROM apostas WHERE user_id = ?", [req.user.id], (err, row) => {
        if (row) {
            db.run("UPDATE apostas SET jogos = ? WHERE user_id = ?", [apostasString, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Apostas atualizadas." });
            });
        } else {
            db.run("INSERT INTO apostas (user_id, jogos) VALUES (?, ?)", [req.user.id, apostasString], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Apostas salvas." });
            });
        }
    });
});

// Ler Apostas do Usuário Logado
app.get('/api/apostas', authenticateToken, (req, res) => {
    db.get("SELECT jogos FROM apostas WHERE user_id = ?", [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const jogos = row ? JSON.parse(row.jogos) : [];
        res.json(jogos);
    });
});

// --- ROTAS DE SORTEIO (GABARITO) ---
app.get('/api/sorteio', (req, res) => {
    db.get("SELECT value FROM config WHERE key = 'sorteio'", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? JSON.parse(row.value) : []);
    });
});

app.post('/api/sorteio', authenticateToken, (req, res) => {
    const { numeros } = req.body;
    db.run("REPLACE INTO config (key, value) VALUES ('sorteio', ?)", [JSON.stringify(numeros)], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Sorteio salvo." });
    });
});

// Rota de Admin: Pegar todos os usuários e seus jogos
app.get('/api/admin/users', authenticateToken, (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Acesso negado." });

    const query = `SELECT u.nome, u.email, a.jogos FROM users u LEFT JOIN apostas a ON u.id = a.user_id WHERE u.is_admin = 0`;
    
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const data = rows.map(row => ({
            nome: row.nome,
            email: row.email,
            apostas: row.jogos ? JSON.parse(row.jogos) : []
        }));
        res.json(data);
    });
});

// Recuperação de Senha (Simulado)
app.post('/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    // Em um sistema real, aqui enviaríamos um e-mail com um token.
    // Como é simulado, apenas logamos no console do servidor.
    console.log(`[SIMULAÇÃO] Solicitação de recuperação para: ${email}. Link enviado (fictício).`);
    res.json({ message: "Se o e-mail estiver cadastrado, enviamos um link de recuperação." });
});

// Alterar Senha (Usuário Logado)
app.post('/auth/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    db.get("SELECT password FROM users WHERE id = ?", [userId], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Usuário não encontrado." });

        const match = await bcrypt.compare(currentPassword, row.password);
        if (!match) return res.status(400).json({ error: "Senha atual incorreta." });

        const hash = await bcrypt.hash(newPassword, 10);
        db.run("UPDATE users SET password = ? WHERE id = ?", [hash, userId], (err) => {
            if (err) return res.status(500).json({ error: "Erro ao atualizar senha." });
            res.json({ message: "Senha alterada com sucesso!" });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});