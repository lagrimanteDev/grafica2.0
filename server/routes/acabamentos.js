const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/acabamentos - Listar acabamentos
router.get('/', async (req, res) => {
  try {
    const apenasAtivos = req.query.todos !== 'true';
    let sql = 'SELECT * FROM acabamentos';
    if (apenasAtivos) {
      sql += ' WHERE ativo = 1';
    }
    sql += ' ORDER BY id ASC';

    const rows = await db.allAsync(sql);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar acabamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar acabamentos.' });
  }
});

// POST /api/acabamentos - Cadastrar novo acabamento
router.post('/', async (req, res) => {
  try {
    const { nome } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome do acabamento é obrigatório.' });
    }

    const result = await db.runAsync(
      `INSERT INTO acabamentos (nome, ativo) VALUES (?, 1)`,
      [nome.trim()]
    );

    const novo = await db.getAsync('SELECT * FROM acabamentos WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Acabamento cadastrado com sucesso!', acabamento: novo });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Já existe um acabamento cadastrado com este nome.' });
    }
    console.error('Erro ao criar acabamento:', error);
    res.status(500).json({ error: 'Erro ao cadastrar acabamento.' });
  }
});

// PUT /api/acabamentos/:id - Editar acabamento
router.put('/:id', async (req, res) => {
  try {
    const { nome, ativo } = req.body;
    const id = req.params.id;

    await db.runAsync(
      `UPDATE acabamentos SET nome = ?, ativo = ? WHERE id = ?`,
      [nome.trim(), ativo === undefined ? 1 : Number(ativo), id]
    );

    const atualizado = await db.getAsync('SELECT * FROM acabamentos WHERE id = ?', [id]);
    res.json({ message: 'Acabamento atualizado com sucesso!', acabamento: atualizado });
  } catch (error) {
    console.error('Erro ao atualizar acabamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar acabamento.' });
  }
});

// PATCH /api/acabamentos/:id/status - Ativar/Desativar acabamento
router.patch('/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const ativo = Number(req.body.ativo) === 1 ? 1 : 0;
    const result = await db.runAsync('UPDATE acabamentos SET ativo = ? WHERE id = ?', [ativo, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Acabamento não encontrado.' });
    }
    res.json({ message: ativo === 1 ? 'Acabamento ativado com sucesso!' : 'Acabamento desativado com sucesso!' });
  } catch (error) {
    console.error('Erro ao alterar status do acabamento:', error);
    res.status(500).json({ error: 'Erro ao alterar status do acabamento.' });
  }
});

// DELETE /api/acabamentos/:id - Desativar/Excluir acabamento
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const pedidos = await db.getAsync('SELECT COUNT(*) as count FROM pedidos WHERE acabamento_id = ?', [id]);
    if (pedidos.count > 0) {
      await db.runAsync('UPDATE acabamentos SET ativo = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Acabamento desativado com sucesso (mantido no histórico).' });
    }

    await db.runAsync('DELETE FROM acabamentos WHERE id = ?', [id]);
    res.json({ message: 'Acabamento excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir acabamento:', error);
    res.status(500).json({ error: 'Erro ao excluir acabamento.' });
  }
});

module.exports = router;