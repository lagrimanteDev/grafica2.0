const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/producao - Listar lançamentos com filtros avançados
router.get('/', async (req, res) => {
  try {
    const {
      data_inicio,
      data_fim,
      turno_id,
      operador_id,
      material_id,
      tipo_ocorrencia,
      busca,
      limit = 100,
      offset = 0
    } = req.query;

    let sql = `
      SELECT 
        p.id,
        p.data,
        p.hora,
        p.turno_id,
        t.nome AS turno_nome,
        p.operador_id,
        o.nome AS operador_nome,
        p.material_id,
        m.nome AS material_nome,
        m.categoria AS material_categoria,
        m.icone AS material_icone,
        m.cor AS material_cor,
        p.quantidade,
        p.unidade,
        p.observacoes,
        p.tipo_ocorrencia,
        p.created_at,
        p.updated_at
      FROM producao p
      JOIN turnos t ON p.turno_id = t.id
      JOIN operadores o ON p.operador_id = o.id
      JOIN materiais m ON p.material_id = m.id
      WHERE 1=1
    `;

    const params = [];

    if (data_inicio) {
      sql += ` AND p.data >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ` AND p.data <= ?`;
      params.push(data_fim);
    }
    if (turno_id) {
      sql += ` AND p.turno_id = ?`;
      params.push(Number(turno_id));
    }
    if (operador_id) {
      sql += ` AND p.operador_id = ?`;
      params.push(Number(operador_id));
    }
    if (material_id) {
      sql += ` AND p.material_id = ?`;
      params.push(Number(material_id));
    }
    if (tipo_ocorrencia) {
      sql += ` AND p.tipo_ocorrencia = ?`;
      params.push(tipo_ocorrencia);
    }
    if (busca) {
      sql += ` AND (o.nome LIKE ? OR m.nome LIKE ? OR p.observacoes LIKE ?)`;
      const termo = `%${busca}%`;
      params.push(termo, termo, termo);
    }

    // Contagem total para paginação
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const countRow = await db.getAsync(countSql, params);

    sql += ` ORDER BY p.data DESC, p.hora DESC, p.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = await db.allAsync(sql, params);

    res.json({
      total: countRow.total,
      limit: Number(limit),
      offset: Number(offset),
      dados: rows
    });
  } catch (error) {
    console.error('Erro ao listar produção:', error);
    res.status(500).json({ error: 'Erro interno ao consultar produção.' });
  }
});

// GET /api/producao/ultimos - Últimos lançamentos do dia para a tela do operador
router.get('/ultimos', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const operador_id = req.query.operador_id;
    const data = req.query.data || new Date().toISOString().slice(0, 10);

    let sql = `
      SELECT 
        p.id,
        p.data,
        p.hora,
        p.turno_id,
        t.nome AS turno_nome,
        p.operador_id,
        o.nome AS operador_nome,
        p.material_id,
        m.nome AS material_nome,
        m.icone AS material_icone,
        m.cor AS material_cor,
        p.quantidade,
        p.unidade,
        p.observacoes,
        p.tipo_ocorrencia,
        p.created_at
      FROM producao p
      JOIN turnos t ON p.turno_id = t.id
      JOIN operadores o ON p.operador_id = o.id
      JOIN materiais m ON p.material_id = m.id
      WHERE p.data = ?
    `;
    const params = [data];

    if (operador_id) {
      sql += ` AND p.operador_id = ?`;
      params.push(Number(operador_id));
    }

    sql += ` ORDER BY p.id DESC LIMIT ?`;
    params.push(limit);

    const rows = await db.allAsync(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar últimos lançamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar últimos lançamentos.' });
  }
});

// GET /api/producao/:id - Obter um registro específico
router.get('/:id', async (req, res) => {
  try {
    const row = await db.getAsync(
      `SELECT p.*, t.nome AS turno_nome, o.nome AS operador_nome, m.nome AS material_nome 
       FROM producao p
       JOIN turnos t ON p.turno_id = t.id
       JOIN operadores o ON p.operador_id = o.id
       JOIN materiais m ON p.material_id = m.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ error: 'Registro de produção não encontrado.' });
    }
    res.json(row);
  } catch (error) {
    console.error('Erro ao buscar registro de produção:', error);
    res.status(500).json({ error: 'Erro ao obter registro.' });
  }
});

// POST /api/producao - Novo lançamento de produção
router.post('/', async (req, res) => {
  try {
    const {
      data,
      hora,
      turno_id,
      operador_id,
      material_id,
      quantidade,
      unidade,
      observacoes,
      tipo_ocorrencia = 'NORMAL'
    } = req.body;

    // Validações básicas
    if (!turno_id || !operador_id || !material_id || quantidade === undefined || quantidade === null) {
      return res.status(400).json({
        error: 'Campos obrigatórios: turno, operador, material e quantidade.'
      });
    }

    const qtdNum = parseFloat(quantidade);
    if (isNaN(qtdNum) || qtdNum <= 0) {
      return res.status(400).json({ error: 'A quantidade deve ser um número positivo.' });
    }

    // Se data ou hora não forem fornecidas, usar data/hora local atual
    const now = new Date();
    const dataFinal = data || now.toISOString().slice(0, 10);
    const horaFinal = hora || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Buscar unidade padrão do material se não fornecida
    let unidadeFinal = unidade;
    if (!unidadeFinal) {
      const mat = await db.getAsync('SELECT unidade FROM materiais WHERE id = ?', [material_id]);
      unidadeFinal = mat ? mat.unidade : 'un';
    }

    const result = await db.runAsync(
      `INSERT INTO producao (data, hora, turno_id, operador_id, material_id, quantidade, unidade, observacoes, tipo_ocorrencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dataFinal,
        horaFinal,
        Number(turno_id),
        Number(operador_id),
        Number(material_id),
        qtdNum,
        unidadeFinal,
        observacoes || '',
        tipo_ocorrencia || 'NORMAL'
      ]
    );

    // Retornar o registro completo recém-criado
    const novoRegistro = await db.getAsync(
      `SELECT p.*, t.nome AS turno_nome, o.nome AS operador_nome, m.nome AS material_nome, m.icone AS material_icone, m.cor AS material_cor
       FROM producao p
       JOIN turnos t ON p.turno_id = t.id
       JOIN operadores o ON p.operador_id = o.id
       JOIN materiais m ON p.material_id = m.id
       WHERE p.id = ?`,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Registro de produção gravado com sucesso!',
      registro: novoRegistro
    });
  } catch (error) {
    console.error('Erro ao salvar produção:', error);
    res.status(500).json({ error: 'Erro interno ao salvar produção.' });
  }
});

// PUT /api/producao/:id - Atualizar lançamento (correção fácil)
router.put('/:id', async (req, res) => {
  try {
    const {
      data,
      hora,
      turno_id,
      operador_id,
      material_id,
      quantidade,
      unidade,
      observacoes,
      tipo_ocorrencia
    } = req.body;

    const id = req.params.id;
    const existente = await db.getAsync('SELECT id FROM producao WHERE id = ?', [id]);
    if (!existente) {
      return res.status(404).json({ error: 'Registro não encontrado para atualização.' });
    }

    const qtdNum = parseFloat(quantidade);
    if (isNaN(qtdNum) || qtdNum <= 0) {
      return res.status(400).json({ error: 'A quantidade deve ser um número positivo.' });
    }

    await db.runAsync(
      `UPDATE producao 
       SET data = ?, hora = ?, turno_id = ?, operador_id = ?, material_id = ?, 
           quantidade = ?, unidade = ?, observacoes = ?, tipo_ocorrencia = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data,
        hora,
        Number(turno_id),
        Number(operador_id),
        Number(material_id),
        qtdNum,
        unidade,
        observacoes || '',
        tipo_ocorrencia || 'NORMAL',
        id
      ]
    );

    const atualizado = await db.getAsync(
      `SELECT p.*, t.nome AS turno_nome, o.nome AS operador_nome, m.nome AS material_nome, m.icone AS material_icone, m.cor AS material_cor
       FROM producao p
       JOIN turnos t ON p.turno_id = t.id
       JOIN operadores o ON p.operador_id = o.id
       JOIN materiais m ON p.material_id = m.id
       WHERE p.id = ?`,
      [id]
    );

    res.json({
      message: 'Registro corrigido com sucesso!',
      registro: atualizado
    });
  } catch (error) {
    console.error('Erro ao atualizar produção:', error);
    res.status(500).json({ error: 'Erro ao atualizar registro de produção.' });
  }
});

// DELETE /api/producao/:id - Excluir lançamento
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.runAsync('DELETE FROM producao WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    res.json({ message: 'Lançamento excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir lançamento:', error);
    res.status(500).json({ error: 'Erro ao excluir registro.' });
  }
});

module.exports = router;
