const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/usuarios - Listar usuários
router.get('/', async (req, res) => {
  try {
    const apenasAtivos = req.query.todos !== 'true';
    let sql = 'SELECT id, nome, email, perfil, ativo, created_at, updated_at FROM usuarios';
    if (apenasAtivos) {
      sql += ' WHERE ativo = 1';
    }
    sql += ' ORDER BY id ASC';

    const rows = await db.allAsync(sql);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

// POST /api/usuarios - Criar usuário
router.post('/', async (req, res) => {
  try {
    const { nome, email, senha, perfil = 'OPERADOR' } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const result = await db.runAsync(
      `INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)`,
      [nome.trim(), email.trim().toLowerCase(), senha, perfil]
    );

    const novo = await db.getAsync('SELECT id, nome, email, perfil, ativo, created_at FROM usuarios WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', usuario: novo });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Já existe um usuário com este e-mail.' });
    }
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

// PUT /api/usuarios/:id - Atualizar usuário
router.put('/:id', async (req, res) => {
  try {
    const { nome, email, senha, perfil, ativo } = req.body;
    const id = req.params.id;

    let sql = 'UPDATE usuarios SET nome = ?, email = ?, perfil = ?, ativo = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [nome.trim(), email.trim().toLowerCase(), perfil, ativo === undefined ? 1 : Number(ativo)];

    if (senha) {
      sql += ', senha = ?';
      params.push(senha);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await db.runAsync(sql, params);

    const atualizado = await db.getAsync('SELECT id, nome, email, perfil, ativo, created_at, updated_at FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Usuário atualizado com sucesso!', usuario: atualizado });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
});

// DELETE /api/usuarios/:id - Desativar/Excluir usuário
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const pedidos = await db.getAsync('SELECT COUNT(*) as count FROM pedidos WHERE created_by = ?', [id]);
    if (pedidos.count > 0) {
      await db.runAsync('UPDATE usuarios SET ativo = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Usuário desativado com sucesso (mantido no histórico).' });
    }

    await db.runAsync('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Usuário excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
});

// POST /api/usuarios/login - Autenticação simples
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const usuario = await db.getAsync(
      'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE email = ? AND senha = ? AND ativo = 1',
      [email.trim().toLowerCase(), senha]
    );

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    res.json({
      message: 'Login realizado com sucesso!',
      usuario
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao realizar login.' });
  }
});

module.exports = router;