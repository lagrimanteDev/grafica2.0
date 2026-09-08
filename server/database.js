const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'grafica_epa.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco SQLite:', err.message);
  } else {
    console.log('Conectado com sucesso ao banco SQLite da Gráfica EPA em:', dbPath);
  }
});

// Promisify database operations for modern async/await
db.runAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

db.getAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

db.allAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Database initialization
async function initDatabase() {
  await db.runAsync('PRAGMA foreign_keys = ON');

  // Turnos (1º, 2º, 3º)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT NOT NULL,
      descricao TEXT,
      ativo INTEGER DEFAULT 1
    )
  `);

  // Operadores
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS operadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      cargo TEXT DEFAULT 'Operador de Produção',
      turno_padrao INTEGER,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (turno_padrao) REFERENCES turnos(id)
    )
  `);

  // Materiais gráficos
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS materiais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      unidade TEXT NOT NULL,
      categoria TEXT DEFAULT 'Geral',
      meta_hora REAL DEFAULT 0,
      icone TEXT DEFAULT 'printer',
      cor TEXT DEFAULT '#2563eb',
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Lançamentos de Produção Diária
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS producao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      hora TEXT NOT NULL,
      turno_id INTEGER NOT NULL,
      operador_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantidade REAL NOT NULL,
      unidade TEXT NOT NULL,
      observacoes TEXT,
      tipo_ocorrencia TEXT DEFAULT 'NORMAL',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (turno_id) REFERENCES turnos(id),
      FOREIGN KEY (operador_id) REFERENCES operadores(id),
      FOREIGN KEY (material_id) REFERENCES materiais(id)
    )
  `);

  // Registro de Backups
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arquivo TEXT NOT NULL,
      caminho TEXT NOT NULL,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      tamanho_bytes INTEGER,
      tipo TEXT DEFAULT 'AUTOMATICO'
    )
  `);

  // ==========================================
  // NOVAS TABELAS - ERP DE PRODUÇÃO GRÁFICA
  // ==========================================

  // Clientes
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      whatsapp INTEGER DEFAULT 1,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Serviços / Produtos (menu dinâmico do formulário de atendimento)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      unidade TEXT NOT NULL DEFAULT 'un',
      categoria TEXT DEFAULT 'Geral',
      icone TEXT DEFAULT 'printer',
      cor TEXT DEFAULT '#2563eb',
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Acabamentos
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS acabamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Usuários do sistema (Atendimento, Operador, Administrador)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'OPERADOR',
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Etapas do fluxo produtivo (Kanban)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS etapas_producao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      ordem INTEGER NOT NULL,
      cor TEXT DEFAULT '#3b82f6',
      icone TEXT DEFAULT '📋',
      ativo INTEGER DEFAULT 1
    )
  `);

  // Pedidos / Ordens de Serviço (OS)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_os TEXT NOT NULL UNIQUE,
      cliente_id INTEGER NOT NULL,
      servico_id INTEGER NOT NULL,
      quantidade REAL NOT NULL,
      unidade TEXT NOT NULL,
      dimensao_largura REAL,
      dimensao_altura REAL,
      material TEXT,
      acabamento_id INTEGER,
      observacoes_tecnicas TEXT,
      arquivo_arte TEXT,
      arquivo_original TEXT,
      data_prometida TEXT NOT NULL,
      hora_prometida TEXT,
      valor_total REAL DEFAULT 0,
      condicao_pagamento TEXT DEFAULT 'Pendente',
      status_pagamento TEXT DEFAULT 'PENDENTE',
      etapa_atual INTEGER DEFAULT 1,
      prioridade TEXT DEFAULT 'NORMAL',
      status TEXT DEFAULT 'ATIVO',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      concluido_em DATETIME,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (servico_id) REFERENCES servicos(id),
      FOREIGN KEY (acabamento_id) REFERENCES acabamentos(id),
      FOREIGN KEY (etapa_atual) REFERENCES etapas_producao(id),
      FOREIGN KEY (created_by) REFERENCES usuarios(id)
    )
  `);

  // Histórico de movimentação / Auditoria
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS historico_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      acao TEXT NOT NULL,
      descricao TEXT,
      usuario_id INTEGER,
      usuario_nome TEXT,
      data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  // Log de Auditoria Geral do Sistema
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
      usuario_id INTEGER,
      usuario_nome TEXT,
      acao TEXT NOT NULL,
      entidade TEXT,
      entidade_id INTEGER,
      detalhes TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  // Notificações enviadas (WhatsApp / E-mail)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      canal TEXT NOT NULL,
      destinatario TEXT NOT NULL,
      mensagem TEXT,
      status TEXT DEFAULT 'ENVIADO',
      data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    )
  `);

  console.log('Tabelas do banco de dados verificadas e inicializadas com sucesso.');
}

module.exports = {
  db,
  dbPath,
  dataDir,
  initDatabase
};