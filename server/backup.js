const fs = require('fs');
const path = require('path');
const { db, dbPath } = require('./database');

const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Formatar data para nome de arquivo
function getTimestampString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// Criar backup físico do arquivo SQLite
async function createDatabaseBackup(tipo = 'AUTOMATICO') {
  try {
    if (!fs.existsSync(dbPath)) {
      throw new Error('Arquivo de banco de dados não encontrado.');
    }

    const timestamp = getTimestampString();
    const backupFileName = `backup_grafica_epa_${timestamp}.sqlite`;
    const destPath = path.join(backupDir, backupFileName);

    // Cópia atômica do arquivo SQLite
    fs.copyFileSync(dbPath, destPath);
    const stats = fs.statSync(destPath);

    // Registrar no banco
    await db.runAsync(
      `INSERT INTO backups (arquivo, caminho, tamanho_bytes, tipo) VALUES (?, ?, ?, ?)`,
      [backupFileName, destPath, stats.size, tipo]
    );

    console.log(`[BACKUP] Backup (${tipo}) criado com sucesso: ${backupFileName} (${(stats.size / 1024).toFixed(1)} KB)`);

    // Limpar backups antigos mantendo os últimos 30
    await cleanupOldBackups();

    return {
      success: true,
      arquivo: backupFileName,
      tamanhoBytes: stats.size,
      dataCriacao: new Date().toISOString(),
      tipo
    };
  } catch (error) {
    console.error('[BACKUP] Erro ao criar backup:', error);
    throw error;
  }
}

// Exportar todos os dados em formato JSON portátil
async function exportFullJsonData() {
  const turnos = await db.allAsync('SELECT * FROM turnos ORDER BY id ASC');
  const operadores = await db.allAsync('SELECT * FROM operadores ORDER BY id ASC');
  const materiais = await db.allAsync('SELECT * FROM materiais ORDER BY id ASC');
  const producao = await db.allAsync('SELECT * FROM producao ORDER BY data DESC, hora DESC');
  const backups = await db.allAsync('SELECT * FROM backups ORDER BY id DESC LIMIT 50');
  const clientes = await db.allAsync('SELECT * FROM clientes ORDER BY id ASC');
  const servicos = await db.allAsync('SELECT * FROM servicos ORDER BY id ASC');
  const acabamentos = await db.allAsync('SELECT * FROM acabamentos ORDER BY id ASC');
  const usuarios = await db.allAsync('SELECT id, nome, email, perfil, ativo, created_at, updated_at FROM usuarios ORDER BY id ASC');
  const etapas = await db.allAsync('SELECT * FROM etapas_producao ORDER BY ordem ASC');
  const pedidos = await db.allAsync('SELECT * FROM pedidos ORDER BY id DESC');
  const historicoPedidos = await db.allAsync('SELECT * FROM historico_pedido ORDER BY id DESC');
  const auditoria = await db.allAsync('SELECT * FROM auditoria ORDER BY id DESC LIMIT 200');
  const notificacoes = await db.allAsync('SELECT * FROM notificacoes ORDER BY id DESC LIMIT 200');

  return {
    meta: {
      sistema: 'ERP & Dashboard de Produção Gráfica - Gráfica EPA',
      versao: '2.0.0',
      dataExportacao: new Date().toISOString(),
      totalRegistrosProducao: producao.length,
      totalPedidos: pedidos.length
    },
    dados: {
      turnos,
      operadores,
      materiais,
      producao,
      backups,
      clientes,
      servicos,
      acabamentos,
      usuarios,
      etapas,
      pedidos,
      historicoPedidos,
      auditoria,
      notificacoes
    }
  };
}

// Listar todos os backups disponíveis
async function listBackups() {
  try {
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sqlite') || f.endsWith('.json'));
    const list = [];

    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      list.push({
        arquivo: file,
        caminho: filePath,
        tamanhoBytes: stats.size,
        tamanhoFormatado: `${(stats.size / 1024).toFixed(1)} KB`,
        dataCriacao: stats.mtime
      });
    }

    // Ordenar do mais recente para o mais antigo
    list.sort((a, b) => b.dataCriacao - a.dataCriacao);
    return list;
  } catch (error) {
    console.error('[BACKUP] Erro ao listar backups:', error);
    return [];
  }
}

// Manter histórico rotativo dos últimos 30 backups
async function cleanupOldBackups(maxFiles = 30) {
  try {
    const backups = await listBackups();
    if (backups.length > maxFiles) {
      const toDelete = backups.slice(maxFiles);
      for (const item of toDelete) {
        if (fs.existsSync(item.caminho)) {
          fs.unlinkSync(item.caminho);
          console.log(`[BACKUP] Limpeza de arquivo antigo: ${item.arquivo}`);
        }
      }
    }
  } catch (error) {
    console.error('[BACKUP] Erro ao limpar backups antigos:', error);
  }
}

// Agendador de backup automático diário
function startAutoBackupScheduler() {
  console.log('[BACKUP] Rotina diária de backup automatizado ativada.');

  // Executa uma verificação a cada 1 hora para ver se o dia virou e precisa de backup
  const checkIntervalMs = 60 * 60 * 1000;

  async function checkAndBackup() {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const ultimoBackupHoje = await db.getAsync(
        `SELECT id FROM backups WHERE DATE(data_criacao) = DATE('now') LIMIT 1`
      );

      if (!ultimoBackupHoje) {
        console.log(`[BACKUP] Executando backup diário programado para ${todayStr}...`);
        await createDatabaseBackup('AUTOMATICO');
      }
    } catch (e) {
      console.error('[BACKUP] Falha no agendador de backup:', e.message);
    }
  }

  // Executa checagem inicial após 10 segundos da inicialização
  setTimeout(checkAndBackup, 10000);
  // Mantém checagem periódica
  setInterval(checkAndBackup, checkIntervalMs);
}

module.exports = {
  backupDir,
  createDatabaseBackup,
  exportFullJsonData,
  listBackups,
  startAutoBackupScheduler
};
