const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/operadores - Listar operadores
router.get('/', async (req, res) => {
  try {
    const apenasAtivos = req.query.todos !== 'true';
    let sql = `
      SELECT o.*, t.nome as turno_nome 
      FROM operadores o 
      LEFT JOIN turnos t ON o.turno_padrao = t.id
    `;
    if (apenasAtivos) {
      sql += ' WHERE o.ativo = 1';
    }
    sql += ' ORDER BY o.id ASC';

    const rows = await db.allAsync(sql);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar operadores:', error);
    res.status(500).json({ error: 'Erro ao buscar operadores.' });
  }
});

// POST /api/operadores - Cadastrar operador
router.post('/', async (req, res) => {
  try {
    const { nome, cargo = 'Operador de Produção', turno_padrao = 1 } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome do operador é obrigatório.' });
    }

    const result = await db.runAsync(
      `INSERT INTO operadores (nome, cargo, turno_padrao, ativo) VALUES (?, ?, ?, 1)`,
      [nome.trim(), cargo.trim(), Number(turno_padrao)]
    );

    const novo = await db.getAsync('SELECT * FROM operadores WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Operador cadastrado com sucesso!', operador: novo });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Já existe um operador cadastrado com este nome.' });
    }
    console.error('Erro ao criar operador:', error);
    res.status(500).json({ error: 'Erro ao cadastrar operador.' });
  }
});

// PUT /api/operadores/:id - Editar operador
router.put('/:id', async (req, res) => {
  try {
    const { nome, cargo, turno_padrao, ativo } = req.body;
    const id = req.params.id;

    await db.runAsync(
      `UPDATE operadores 
       SET nome = ?, cargo = ?, turno_padrao = ?, ativo = ? 
       WHERE id = ?`,
      [nome.trim(), cargo, Number(turno_padrao), ativo === undefined ? 1 : Number(ativo), id]
    );

    const atualizado = await db.getAsync('SELECT * FROM operadores WHERE id = ?', [id]);
    res.json({ message: 'Operador atualizado com sucesso!', operador: atualizado });
  } catch (error) {
    console.error('Erro ao atualizar operador:', error);
    res.status(500).json({ error: 'Erro ao atualizar operador.' });
  }
});

// DELETE /api/operadores/:id - Desativar/Excluir operador
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const producoes = await db.getAsync('SELECT COUNT(*) as count FROM producao WHERE operador_id = ?', [id]);
    if (producoes.count > 0) {
      await db.runAsync('UPDATE operadores SET ativo = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Operador desativado com sucesso (mantido no histórico).' });
    }

    await db.runAsync('DELETE FROM operadores WHERE id = ?', [id]);
    res.json({ message: 'Operador excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir operador:', error);
    res.status(500).json({ error: 'Erro ao excluir operador.' });
  }
});

// GET /api/operadores/turnos - Listar turnos
router.get('/turnos/lista', async (req, res) => {
  try {
    const rows = await db.allAsync('SELECT * FROM turnos WHERE ativo = 1 ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar turnos:', error);
    res.status(500).json({ error: 'Erro ao buscar turnos.' });
  }
});

module.exports = router;
