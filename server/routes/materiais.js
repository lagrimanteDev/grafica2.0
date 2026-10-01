const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/materiais - Listar materiais ativos
router.get('/', async (req, res) => {
  try {
    const apenasAtivos = req.query.todos !== 'true';
    let sql = 'SELECT * FROM materiais';
    if (apenasAtivos) {
      sql += ' WHERE ativo = 1';
    }
    sql += ' ORDER BY id ASC';

    const rows = await db.allAsync(sql);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar materiais:', error);
    res.status(500).json({ error: 'Erro ao buscar materiais.' });
  }
});

// POST /api/materiais - Cadastrar novo material
router.post('/', async (req, res) => {
  try {
    const { nome, unidade, categoria, meta_hora = 0, icone = 'printer', cor = '#2563eb' } = req.body;

    if (!nome || !unidade) {
      return res.status(400).json({ error: 'Nome e Unidade são obrigatórios.' });
    }

    const result = await db.runAsync(
      `INSERT INTO materiais (nome, unidade, categoria, meta_hora, icone, cor, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [nome.trim(), unidade.trim(), categoria ? categoria.trim() : 'Geral', Number(meta_hora), icone, cor]
    );

    const novo = await db.getAsync('SELECT * FROM materiais WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Material cadastrado com sucesso!', material: novo });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Já existe um material cadastrado com este nome.' });
    }
    console.error('Erro ao criar material:', error);
    res.status(500).json({ error: 'Erro ao cadastrar material.' });
  }
});

// PUT /api/materiais/:id - Editar material
router.put('/:id', async (req, res) => {
  try {
    const { nome, unidade, categoria, meta_hora, icone, cor, ativo } = req.body;
    const id = req.params.id;

    await db.runAsync(
      `UPDATE materiais 
       SET nome = ?, unidade = ?, categoria = ?, meta_hora = ?, icone = ?, cor = ?, ativo = ? 
       WHERE id = ?`,
      [nome.trim(), unidade.trim(), categoria, Number(meta_hora), icone, cor, ativo === undefined ? 1 : Number(ativo), id]
    );

    const atualizado = await db.getAsync('SELECT * FROM materiais WHERE id = ?', [id]);
    res.json({ message: 'Material atualizado com sucesso!', material: atualizado });
  } catch (error) {
    console.error('Erro ao atualizar material:', error);
    res.status(500).json({ error: 'Erro ao atualizar material.' });
  }
});

// PATCH /api/materiais/:id/status - Ativar/Desativar material
router.patch('/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const ativo = Number(req.body.ativo) === 1 ? 1 : 0;
    const result = await db.runAsync('UPDATE materiais SET ativo = ? WHERE id = ?', [ativo, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Material não encontrado.' });
    }
    res.json({ message: ativo === 1 ? 'Material ativado com sucesso!' : 'Material desativado com sucesso!' });
  } catch (error) {
    console.error('Erro ao alterar status do material:', error);
    res.status(500).json({ error: 'Erro ao alterar status do material.' });
  }
});

// DELETE /api/materiais/:id - Desativar/Excluir material
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Checar se existem registros de produção associados
    const producoes = await db.getAsync('SELECT COUNT(*) as count FROM producao WHERE material_id = ?', [id]);
    if (producoes.count > 0) {
      // Soft delete para não violar integridade
      await db.runAsync('UPDATE materiais SET ativo = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Material desativado com sucesso (mantido no histórico).' });
    }

    await db.runAsync('DELETE FROM materiais WHERE id = ?', [id]);
    res.json({ message: 'Material excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir material:', error);
    res.status(500).json({ error: 'Erro ao excluir material.' });
  }
});

module.exports = router;
