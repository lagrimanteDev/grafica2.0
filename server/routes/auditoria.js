const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/auditoria - Listar registros de auditoria
router.get('/', async (req, res) => {
  try {
    const {
      data_inicio,
      data_fim,
      usuario_id,
      acao,
      entidade,
      limit = 100,
      offset = 0
    } = req.query;

    let sql = `
      SELECT a.*, u.nome AS usuario_nome_ref
      FROM auditoria a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (data_inicio) {
      sql += ` AND DATE(a.data_hora) >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ` AND DATE(a.data_hora) <= ?`;
      params.push(data_fim);
    }
    if (usuario_id) {
      sql += ` AND a.usuario_id = ?`;
      params.push(Number(usuario_id));
    }
    if (acao) {
      sql += ` AND a.acao LIKE ?`;
      params.push(`%${acao}%`);
    }
    if (entidade) {
      sql += ` AND a.entidade = ?`;
      params.push(entidade);
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const countRow = await db.getAsync(countSql, params);

    sql += ` ORDER BY a.data_hora DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = await db.allAsync(sql, params);

    res.json({
      total: countRow.total,
      limit: Number(limit),
      offset: Number(offset),
      dados: rows
    });
  } catch (error) {
    console.error('Erro ao listar auditoria:', error);
    res.status(500).json({ error: 'Erro ao consultar auditoria.' });
  }
});

// GET /api/auditoria/acoes - Listar ações distintas para filtro
router.get('/acoes', async (req, res) => {
  try {
    const rows = await db.allAsync('SELECT DISTINCT acao FROM auditoria ORDER BY acao ASC');
    res.json(rows.map((r) => r.acao));
  } catch (error) {
    console.error('Erro ao listar ações:', error);
    res.status(500).json({ error: 'Erro ao listar ações.' });
  }
});

module.exports = router;