const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/clientes - Listar clientes
router.get('/', async (req, res) => {
  try {
    const apenasAtivos = req.query.todos !== 'true';
    let sql = 'SELECT * FROM clientes';
    if (apenasAtivos) {
      sql += ' WHERE ativo = 1';
    }
    sql += ' ORDER BY nome ASC';

    const rows = await db.allAsync(sql);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

// GET /api/clientes/:id - Obter cliente específico
router.get('/:id', async (req, res) => {
  try {
    const row = await db.getAsync('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }
    res.json(row);
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: 'Erro ao obter cliente.' });
  }
});

// POST /api/clientes - Criar cliente
router.post('/', async (req, res) => {
  try {
    const { nome, telefone, email, whatsapp = 1, observacoes } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
    }

    const result = await db.runAsync(
      `INSERT INTO clientes (nome, telefone, email, whatsapp, observacoes) VALUES (?, ?, ?, ?, ?)`,
      [nome.trim(), telefone || '', email || '', whatsapp ? 1 : 0, observacoes || '']
    );

    const novo = await db.getAsync('SELECT * FROM clientes WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Cliente cadastrado com sucesso!', cliente: novo });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
});

// PUT /api/clientes/:id - Atualizar cliente
router.put('/:id', async (req, res) => {
  try {
    const { nome, telefone, email, whatsapp, observacoes, ativo } = req.body;
    const id = req.params.id;

    await db.runAsync(
      `UPDATE clientes SET nome = ?, telefone = ?, email = ?, whatsapp = ?, observacoes = ?, ativo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [nome.trim(), telefone || '', email || '', whatsapp ? 1 : 0, observacoes || '', ativo === undefined ? 1 : Number(ativo), id]
    );

    const atualizado = await db.getAsync('SELECT * FROM clientes WHERE id = ?', [id]);
    res.json({ message: 'Cliente atualizado com sucesso!', cliente: atualizado });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
});

// DELETE /api/clientes/:id - Desativar/Excluir cliente
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const pedidos = await db.getAsync('SELECT COUNT(*) as count FROM pedidos WHERE cliente_id = ?', [id]);
    if (pedidos.count > 0) {
      await db.runAsync('UPDATE clientes SET ativo = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Cliente desativado com sucesso (mantido no histórico).' });
    }

    await db.runAsync('DELETE FROM clientes WHERE id = ?', [id]);
    res.json({ message: 'Cliente excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
});

module.exports = router;