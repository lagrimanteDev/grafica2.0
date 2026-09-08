const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  backupDir,
  createDatabaseBackup,
  exportFullJsonData,
  listBackups
} = require('../backup');
const { dbPath } = require('../database');

// Configuração do multer para upload de arquivo de restauração
const upload = multer({ dest: path.join(__dirname, '..', 'temp_uploads') });

// GET /api/backup - Listar backups disponíveis
router.get('/', async (req, res) => {
  try {
    const lista = await listBackups();
    res.json(lista);
  } catch (error) {
    console.error('Erro ao listar backups:', error);
    res.status(500).json({ error: 'Erro ao listar backups.' });
  }
});

// POST /api/backup/criar - Criar backup manual imediatamente
router.post('/criar', async (req, res) => {
  try {
    const resultado = await createDatabaseBackup('MANUAL');
    res.json({
      message: 'Backup gerado com sucesso!',
      backup: resultado
    });
  } catch (error) {
    console.error('Erro ao criar backup manual:', error);
    res.status(500).json({ error: 'Erro ao gerar backup.' });
  }
});

// GET /api/backup/download/:arquivo - Baixar arquivo de backup SQLite
router.get('/download/:arquivo', (req, res) => {
  try {
    const fileName = path.basename(req.params.arquivo);
    const filePath = path.join(backupDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo de backup não encontrado.' });
    }

    res.download(filePath, fileName);
  } catch (error) {
    console.error('Erro no download do backup:', error);
    res.status(500).json({ error: 'Erro ao baixar backup.' });
  }
});

// GET /api/backup/exportar-json - Baixar todos os dados em formato JSON
router.get('/exportar-json', async (req, res) => {
  try {
    const jsonDump = await exportFullJsonData();
    res.setHeader('Content-Disposition', `attachment; filename=grafica_epa_dados_${new Date().toISOString().slice(0, 10)}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(jsonDump, null, 2));
  } catch (error) {
    console.error('Erro ao exportar JSON:', error);
    res.status(500).json({ error: 'Erro ao exportar dados em JSON.' });
  }
});

// POST /api/backup/restaurar - Restaurar banco a partir de um arquivo SQLite enviado
router.post('/restaurar', upload.single('backup_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const uploadedPath = req.file.path;
    // Fazer backup de segurança antes de sobrescrever
    await createDatabaseBackup('PRE_RESTAURACAO');

    // Substituir banco de dados
    fs.copyFileSync(uploadedPath, dbPath);
    // Remover arquivo temporário
    fs.unlinkSync(uploadedPath);

    res.json({ message: 'Banco de dados restaurado com sucesso! Recarregue a página.' });
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    res.status(500).json({ error: 'Erro ao restaurar banco de dados.' });
  }
});

module.exports = router;
