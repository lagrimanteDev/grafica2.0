const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/servicos - Listar serviços/produtos
router.get('/', async (req, res) => {
  try {
    const apenasAtivos = req.query.todos !== 'true';
    let sql = 'SELECT * FROM servicos';
    if (apenasAtivos) {
      sql += ' WHERE ativo = 1';
    }
    sql += ' ORDER BY id ASC';

    const rows = await db.allAsync(sql);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar serviços:', error);
    res.status(500).json({ error: 'Erro ao buscar serviços.' });
  }
});

// POST /api/servicos - Cadastrar novo serviço
router.post('/', async (req, res) => {
  try {
    const { nome, unidade = 'un', categoria = 'Geral', icone = 'printer', cor = '#2563eb' } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome do serviço é obrigatório.' });
    }

    const result = await db.runAsync(
      `INSERT INTO servicos (nome, unidade, categoria, icone, cor, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
      [nome.trim(), unidade.trim(), categoria.trim(), icone, cor]
    );

    const novo = await db.getAsync('SELECT * FROM servicos WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Serviço cadastrado com sucesso!', servico: novo });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Já existe um serviço cadastrado com este nome.' });
    }
    console.error('Erro ao criar serviço:', error);
    res.status(500).json({ error: 'Erro ao cadastrar serviço.' });
  }
});

// PUT /api/servicos/:id - Editar serviço
router.put('/:id', async (req, res) => {
  try {
    const { nome, unidade, categoria, icone, cor, ativo } = req.body;
    const id = req.params.id;

    await db.runAsync(
      `UPDATE servicos SET nome = ?, unidade = ?, categoria = ?, icone = ?, cor = ?, ativo = ? WHERE id = ?`,
      [nome.trim(), unidade.trim(), categoria, icone, cor, ativo === undefined ? 1 : Number(ativo), id]
    );

    const atualizado = await db.getAsync('SELECT * FROM servicos WHERE id = ?', [id]);
    res.json({ message: 'Serviço atualizado com sucesso!', servico: atualizado });
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error);
    res.status(500).json({ error: 'Erro ao atualizar serviço.' });
  }
});

// DELETE /api/servicos/:id - Desativar/Excluir serviço
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const pedidos = await db.getAsync('SELECT COUNT(*) as count FROM pedidos WHERE servico_id = ?', [id]);
    if (pedidos.count > 0) {
      await db.runAsync('UPDATE servicos SET ativo = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Serviço desativado com sucesso (mantido no histórico).' });
    }

    await db.runAsync('DELETE FROM servicos WHERE id = ?', [id]);
    res.json({ message: 'Serviço excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir serviço:', error);
    res.status(500).json({ error: 'Erro ao excluir serviço.' });
  }
});

module.exports = router;