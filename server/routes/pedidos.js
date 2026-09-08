const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../database');

// Configuração do multer para upload de arte final
const uploadDir = path.join(__dirname, '..', 'temp_uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.cdr', '.ai', '.png', '.jpg', '.jpeg', '.tiff', '.psd', '.eps'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não permitido. Use PDF, CDR, AI, PNG, JPG, TIFF, PSD ou EPS.'));
    }
  }
});

// Função para gerar número de OS sequencial
async function gerarNumeroOS() {
  const ano = new Date().getFullYear();
  const row = await db.getAsync(
    `SELECT COUNT(*) as total FROM pedidos WHERE numero_os LIKE ?`,
    [`OS-${ano}-%`]
  );
  const proximo = (row.total || 0) + 1;
  return `OS-${ano}-${String(proximo).padStart(4, '0')}`;
}

// Função para registrar auditoria
async function registrarAuditoria(usuarioId, usuarioNome, acao, entidade, entidadeId, detalhes) {
  try {
    await db.runAsync(
      `INSERT INTO auditoria (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes) VALUES (?, ?, ?, ?, ?, ?)`,
      [usuarioId || null, usuarioNome || 'Sistema', acao, entidade, entidadeId || null, detalhes || '']
    );
  } catch (e) {
    console.error('Erro ao registrar auditoria:', e.message);
  }
}

// GET /api/pedidos - Listar pedidos com filtros
router.get('/', async (req, res) => {
  try {
    const {
      etapa,
      status,
      busca,
      data_inicio,
      data_fim,
      cliente_id,
      limit = 200,
      offset = 0
    } = req.query;

    let sql = `
      SELECT 
        p.id,
        p.numero_os,
        p.cliente_id,
        c.nome AS cliente_nome,
        c.telefone AS cliente_telefone,
        c.email AS cliente_email,
        c.whatsapp AS cliente_whatsapp,
        p.servico_id,
        s.nome AS servico_nome,
        s.unidade AS servico_unidade,
        p.quantidade,
        p.unidade,
        p.dimensao_largura,
        p.dimensao_altura,
        p.material,
        p.acabamento_id,
        a.nome AS acabamento_nome,
        p.observacoes_tecnicas,
        p.arquivo_arte,
        p.arquivo_original,
        p.data_prometida,
        p.hora_prometida,
        p.valor_total,
        p.condicao_pagamento,
        p.status_pagamento,
        p.etapa_atual,
        e.nome AS etapa_nome,
        e.ordem AS etapa_ordem,
        e.cor AS etapa_cor,
        e.icone AS etapa_icone,
        p.prioridade,
        p.status,
        p.created_by,
        u.nome AS criado_por_nome,
        p.created_at,
        p.updated_at,
        p.concluido_em
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN servicos s ON p.servico_id = s.id
      LEFT JOIN acabamentos a ON p.acabamento_id = a.id
      JOIN etapas_producao e ON p.etapa_atual = e.id
      LEFT JOIN usuarios u ON p.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    if (etapa) {
      sql += ` AND p.etapa_atual = ?`;
      params.push(Number(etapa));
    }
    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }
    if (cliente_id) {
      sql += ` AND p.cliente_id = ?`;
      params.push(Number(cliente_id));
    }
    if (data_inicio) {
      sql += ` AND p.data_prometida >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ` AND p.data_prometida <= ?`;
      params.push(data_fim);
    }
    if (busca) {
      sql += ` AND (p.numero_os LIKE ? OR c.nome LIKE ? OR s.nome LIKE ? OR p.observacoes_tecnicas LIKE ?)`;
      const termo = `%${busca}%`;
      params.push(termo, termo, termo, termo);
    }

    // Contagem total
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const countRow = await db.getAsync(countSql, params);

    sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = await db.allAsync(sql, params);

    res.json({
      total: countRow.total,
      limit: Number(limit),
      offset: Number(offset),
      dados: rows
    });
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ error: 'Erro interno ao consultar pedidos.' });
  }
});

// GET /api/pedidos/kanban - Pedidos agrupados por etapa para o Kanban
router.get('/kanban', async (req, res) => {
  try {
    const etapas = await db.allAsync(
      `SELECT * FROM etapas_producao WHERE ativo = 1 ORDER BY ordem ASC`
    );

    const pedidos = await db.allAsync(`
      SELECT 
        p.id,
        p.numero_os,
        p.cliente_id,
        c.nome AS cliente_nome,
        c.telefone AS cliente_telefone,
        p.servico_id,
        s.nome AS servico_nome,
        p.quantidade,
        p.unidade,
        p.dimensao_largura,
        p.dimensao_altura,
        p.material,
        p.acabamento_id,
        a.nome AS acabamento_nome,
        p.observacoes_tecnicas,
        p.arquivo_arte,
        p.arquivo_original,
        p.data_prometida,
        p.hora_prometida,
        p.valor_total,
        p.condicao_pagamento,
        p.status_pagamento,
        p.etapa_atual,
        p.prioridade,
        p.status,
        p.created_at,
        p.updated_at,
        p.concluido_em
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN servicos s ON p.servico_id = s.id
      LEFT JOIN acabamentos a ON p.acabamento_id = a.id
      WHERE p.status = 'ATIVO'
      ORDER BY 
        CASE p.prioridade 
          WHEN 'URGENTE' THEN 1 
          WHEN 'ALTA' THEN 2 
          ELSE 3 
        END,
        p.data_prometida ASC
    `);

    // Agrupar por etapa
    const resultado = etapas.map((etapa) => ({
      ...etapa,
      pedidos: pedidos.filter((p) => p.etapa_atual === etapa.id)
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao carregar Kanban:', error);
    res.status(500).json({ error: 'Erro ao carregar dados do Kanban.' });
  }
});

// GET /api/pedidos/etapas - Listar etapas de produção
router.get('/etapas', async (req, res) => {
  try {
    const rows = await db.allAsync('SELECT * FROM etapas_producao WHERE ativo = 1 ORDER BY ordem ASC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar etapas:', error);
    res.status(500).json({ error: 'Erro ao listar etapas.' });
  }
});

// GET /api/pedidos/:id - Obter pedido específico
router.get('/:id', async (req, res) => {
  try {
    const row = await db.getAsync(
      `SELECT 
        p.*,
        c.nome AS cliente_nome,
        c.telefone AS cliente_telefone,
        c.email AS cliente_email,
        c.whatsapp AS cliente_whatsapp,
        s.nome AS servico_nome,
        s.unidade AS servico_unidade,
        a.nome AS acabamento_nome,
        e.nome AS etapa_nome,
        e.ordem AS etapa_ordem,
        e.cor AS etapa_cor,
        e.icone AS etapa_icone,
        u.nome AS criado_por_nome
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN servicos s ON p.servico_id = s.id
      LEFT JOIN acabamentos a ON p.acabamento_id = a.id
      JOIN etapas_producao e ON p.etapa_atual = e.id
      LEFT JOIN usuarios u ON p.created_by = u.id
      WHERE p.id = ?`,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    // Buscar histórico do pedido
    const historico = await db.allAsync(
      `SELECT * FROM historico_pedido WHERE pedido_id = ? ORDER BY data_hora DESC`,
      [row.id]
    );

    res.json({ ...row, historico });
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ error: 'Erro ao obter pedido.' });
  }
});

// POST /api/pedidos - Criar novo pedido (OS)
router.post('/', upload.single('arquivo_arte'), async (req, res) => {
  try {
    const {
      cliente_id,
      cliente_nome,
      cliente_telefone,
      cliente_email,
      cliente_whatsapp,
      servico_id,
      quantidade,
      unidade,
      dimensao_largura,
      dimensao_altura,
      material,
      acabamento_id,
      observacoes_tecnicas,
      data_prometida,
      hora_prometida,
      valor_total,
      condicao_pagamento,
      status_pagamento,
      prioridade,
      usuario_id,
      usuario_nome
    } = req.body;

    // Validações
    if (!servico_id || !quantidade || !data_prometida) {
      return res.status(400).json({ error: 'Campos obrigatórios: serviço, quantidade e data prometida.' });
    }

    // Criar ou buscar cliente
    let clienteIdFinal = cliente_id;
    if (!clienteIdFinal) {
      if (!cliente_nome) {
        return res.status(400).json({ error: 'Informe o nome do cliente.' });
      }

      // Verificar se já existe cliente com mesmo nome
      const clienteExistente = await db.getAsync('SELECT id FROM clientes WHERE nome = ?', [cliente_nome.trim()]);
      if (clienteExistente) {
        clienteIdFinal = clienteExistente.id;
      } else {
        const novoCliente = await db.runAsync(
          `INSERT INTO clientes (nome, telefone, email, whatsapp) VALUES (?, ?, ?, ?)`,
          [cliente_nome.trim(), cliente_telefone || '', cliente_email || '', cliente_whatsapp === 'false' ? 0 : 1]
        );
        clienteIdFinal = novoCliente.lastID;
      }
    }

    // Gerar número da OS
    const numeroOS = await gerarNumeroOS();

    // Arquivo de arte
    let arquivoArte = null;
    let arquivoOriginal = null;
    if (req.file) {
      arquivoArte = `/uploads/${req.file.filename}`;
      arquivoOriginal = req.file.originalname;
    }

    const result = await db.runAsync(
      `INSERT INTO pedidos (
        numero_os, cliente_id, servico_id, quantidade, unidade, dimensao_largura, dimensao_altura,
        material, acabamento_id, observacoes_tecnicas, arquivo_arte, arquivo_original,
        data_prometida, hora_prometida, valor_total, condicao_pagamento, status_pagamento,
        prioridade, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numeroOS,
        clienteIdFinal,
        Number(servico_id),
        parseFloat(quantidade),
        unidade || 'un',
        dimensao_largura ? parseFloat(dimensao_largura) : null,
        dimensao_altura ? parseFloat(dimensao_altura) : null,
        material || '',
        acabamento_id ? Number(acabamento_id) : null,
        observacoes_tecnicas || '',
        arquivoArte,
        arquivoOriginal,
        data_prometida,
        hora_prometida || '',
        parseFloat(valor_total) || 0,
        condicao_pagamento || 'Pendente',
        status_pagamento || 'PENDENTE',
        prioridade || 'NORMAL',
        usuario_id ? Number(usuario_id) : null
      ]
    );

    // Registrar histórico
    await db.runAsync(
      `INSERT INTO historico_pedido (pedido_id, acao, descricao, usuario_id, usuario_nome) VALUES (?, 'CRIACAO', ?, ?, ?)`,
      [result.lastID, `Pedido ${numeroOS} criado no sistema.`, usuario_id ? Number(usuario_id) : null, usuario_nome || 'Sistema']
    );

    // Registrar auditoria
    await registrarAuditoria(
      usuario_id ? Number(usuario_id) : null,
      usuario_nome || 'Sistema',
      'CRIACAO_PEDIDO',
      'pedidos',
      result.lastID,
      `Pedido ${numeroOS} criado para o cliente ${cliente_nome || `ID ${clienteIdFinal}`}`
    );

    // Buscar pedido completo
    const novoPedido = await db.getAsync(
      `SELECT p.*, c.nome AS cliente_nome, s.nome AS servico_nome, e.nome AS etapa_nome
       FROM pedidos p
       JOIN clientes c ON p.cliente_id = c.id
       JOIN servicos s ON p.servico_id = s.id
       JOIN etapas_producao e ON p.etapa_atual = e.id
       WHERE p.id = ?`,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Pedido criado com sucesso!',
      pedido: novoPedido
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro interno ao criar pedido.' });
  }
});

// PUT /api/pedidos/:id - Atualizar pedido
router.put('/:id', upload.single('arquivo_arte'), async (req, res) => {
  try {
    const id = req.params.id;
    const existente = await db.getAsync('SELECT * FROM pedidos WHERE id = ?', [id]);
    if (!existente) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const {
      cliente_id,
      servico_id,
      quantidade,
      unidade,
      dimensao_largura,
      dimensao_altura,
      material,
      acabamento_id,
      observacoes_tecnicas,
      data_prometida,
      hora_prometida,
      valor_total,
      condicao_pagamento,
      status_pagamento,
      prioridade,
      status,
      usuario_id,
      usuario_nome
    } = req.body;

    let arquivoArte = existente.arquivo_arte;
    let arquivoOriginal = existente.arquivo_original;
    if (req.file) {
      arquivoArte = `/uploads/${req.file.filename}`;
      arquivoOriginal = req.file.originalname;
    }

    await db.runAsync(
      `UPDATE pedidos SET
        cliente_id = ?, servico_id = ?, quantidade = ?, unidade = ?,
        dimensao_largura = ?, dimensao_altura = ?, material = ?, acabamento_id = ?,
        observacoes_tecnicas = ?, arquivo_arte = ?, arquivo_original = ?,
        data_prometida = ?, hora_prometida = ?, valor_total = ?,
        condicao_pagamento = ?, status_pagamento = ?, prioridade = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        Number(cliente_id),
        Number(servico_id),
        parseFloat(quantidade),
        unidade || 'un',
        dimensao_largura ? parseFloat(dimensao_largura) : null,
        dimensao_altura ? parseFloat(dimensao_altura) : null,
        material || '',
        acabamento_id ? Number(acabamento_id) : null,
        observacoes_tecnicas || '',
        arquivoArte,
        arquivoOriginal,
        data_prometida,
        hora_prometida || '',
        parseFloat(valor_total) || 0,
        condicao_pagamento || 'Pendente',
        status_pagamento || 'PENDENTE',
        prioridade || 'NORMAL',
        status || 'ATIVO',
        id
      ]
    );

    // Registrar histórico
    await db.runAsync(
      `INSERT INTO historico_pedido (pedido_id, acao, descricao, usuario_id, usuario_nome) VALUES (?, 'EDICAO', ?, ?, ?)`,
      [id, `Pedido ${existente.numero_os} atualizado.`, usuario_id ? Number(usuario_id) : null, usuario_nome || 'Sistema']
    );

    // Registrar auditoria
    await registrarAuditoria(
      usuario_id ? Number(usuario_id) : null,
      usuario_nome || 'Sistema',
      'EDICAO_PEDIDO',
      'pedidos',
      id,
      `Pedido ${existente.numero_os} atualizado`
    );

    const atualizado = await db.getAsync(
      `SELECT p.*, c.nome AS cliente_nome, s.nome AS servico_nome, e.nome AS etapa_nome
       FROM pedidos p
       JOIN clientes c ON p.cliente_id = c.id
       JOIN servicos s ON p.servico_id = s.id
       JOIN etapas_producao e ON p.etapa_atual = e.id
       WHERE p.id = ?`,
      [id]
    );

    res.json({ message: 'Pedido atualizado com sucesso!', pedido: atualizado });
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    res.status(500).json({ error: 'Erro ao atualizar pedido.' });
  }
});

// POST /api/pedidos/:id/mover - Mover pedido para outra etapa (Kanban)
router.post('/:id/mover', async (req, res) => {
  try {
    const id = req.params.id;
    const { nova_etapa, usuario_id, usuario_nome } = req.body;

    if (!nova_etapa) {
      return res.status(400).json({ error: 'Etapa de destino é obrigatória.' });
    }

    const pedido = await db.getAsync('SELECT * FROM pedidos WHERE id = ?', [id]);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const etapaDestino = await db.getAsync('SELECT * FROM etapas_producao WHERE id = ?', [nova_etapa]);
    if (!etapaDestino) {
      return res.status(400).json({ error: 'Etapa de destino inválida.' });
    }

    const etapaOrigem = await db.getAsync('SELECT * FROM etapas_producao WHERE id = ?', [pedido.etapa_atual]);

    // Atualizar etapa
    let concluidoEm = pedido.concluido_em;
    if (Number(nova_etapa) === 5) {
      concluidoEm = new Date().toISOString();
    } else if (Number(nova_etapa) < 5) {
      concluidoEm = null;
    }

    await db.runAsync(
      `UPDATE pedidos SET etapa_atual = ?, concluido_em = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [Number(nova_etapa), concluidoEm, id]
    );

    // Registrar histórico
    await db.runAsync(
      `INSERT INTO historico_pedido (pedido_id, acao, descricao, usuario_id, usuario_nome) VALUES (?, 'MOVIMENTACAO', ?, ?, ?)`,
      [
        id,
        `Pedido ${pedido.numero_os} movido de "${etapaOrigem ? etapaOrigem.nome : '?'}" para "${etapaDestino.nome}".`,
        usuario_id ? Number(usuario_id) : null,
        usuario_nome || 'Sistema'
      ]
    );

    // Registrar auditoria
    await registrarAuditoria(
      usuario_id ? Number(usuario_id) : null,
      usuario_nome || 'Sistema',
      'MOVIMENTACAO_PEDIDO',
      'pedidos',
      id,
      `Pedido ${pedido.numero_os} movido para etapa "${etapaDestino.nome}"`
    );

    // Se movido para "Pronto para Retirada" (etapa 5), registrar notificação
    if (Number(nova_etapa) === 5) {
      const cliente = await db.getAsync('SELECT * FROM clientes WHERE id = ?', [pedido.cliente_id]);
      const servico = await db.getAsync('SELECT * FROM servicos WHERE id = ?', [pedido.servico_id]);

      if (cliente) {
        const mensagem = `Olá ${cliente.nome}! 😊\n\nSeu pedido ${pedido.numero_os} (${servico ? servico.nome : 'produto'}) já está PRONTO PARA RETIRADA na Gráfica EPA! ✅\n\nAgradecemos a preferência!`;

        // Registrar notificação WhatsApp
        if (cliente.telefone) {
          await db.runAsync(
            `INSERT INTO notificacoes (pedido_id, tipo, canal, destinatario, mensagem) VALUES (?, 'PRONTO_RETIRADA', 'WHATSAPP', ?, ?)`,
            [id, cliente.telefone, mensagem]
          );
        }

        // Registrar notificação E-mail
        if (cliente.email) {
          await db.runAsync(
            `INSERT INTO notificacoes (pedido_id, tipo, canal, destinatario, mensagem) VALUES (?, 'PRONTO_RETIRADA', 'EMAIL', ?, ?)`,
            [id, cliente.email, mensagem]
          );
        }
      }
    }

    res.json({
      message: `Pedido movido para "${etapaDestino.nome}" com sucesso!`,
      etapa: etapaDestino
    });
  } catch (error) {
    console.error('Erro ao mover pedido:', error);
    res.status(500).json({ error: 'Erro ao mover pedido.' });
  }
});

// DELETE /api/pedidos/:id - Cancelar/Excluir pedido
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { usuario_id, usuario_nome } = req.body;

    const pedido = await db.getAsync('SELECT * FROM pedidos WHERE id = ?', [id]);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    // Soft delete - marcar como cancelado
    await db.runAsync(
      `UPDATE pedidos SET status = 'CANCELADO', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    // Registrar histórico
    await db.runAsync(
      `INSERT INTO historico_pedido (pedido_id, acao, descricao, usuario_id, usuario_nome) VALUES (?, 'CANCELAMENTO', ?, ?, ?)`,
      [id, `Pedido ${pedido.numero_os} cancelado.`, usuario_id ? Number(usuario_id) : null, usuario_nome || 'Sistema']
    );

    // Registrar auditoria
    await registrarAuditoria(
      usuario_id ? Number(usuario_id) : null,
      usuario_nome || 'Sistema',
      'CANCELAMENTO_PEDIDO',
      'pedidos',
      id,
      `Pedido ${pedido.numero_os} cancelado`
    );

    res.json({ message: 'Pedido cancelado com sucesso!' });
  } catch (error) {
    console.error('Erro ao cancelar pedido:', error);
    res.status(500).json({ error: 'Erro ao cancelar pedido.' });
  }
});

// GET /api/pedidos/:id/etiqueta - Gerar dados da etiqueta com QR Code
router.get('/:id/etiqueta', async (req, res) => {
  try {
    const id = req.params.id;
    const pedido = await db.getAsync(
      `SELECT 
        p.id, p.numero_os, p.quantidade, p.unidade, p.data_prometida, p.hora_prometida,
        c.nome AS cliente_nome,
        s.nome AS servico_nome,
        e.nome AS etapa_nome,
        e.ordem AS etapa_ordem
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN servicos s ON p.servico_id = s.id
      JOIN etapas_producao e ON p.etapa_atual = e.id
      WHERE p.id = ?`,
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    // URL para o QR Code (abre direto a tela do pedido)
    const urlPedido = `${req.protocol}://${req.get('host')}/?pedido=${pedido.id}`;

    res.json({
      ...pedido,
      url_qr: urlPedido
    });
  } catch (error) {
    console.error('Erro ao gerar etiqueta:', error);
    res.status(500).json({ error: 'Erro ao gerar etiqueta.' });
  }
});

module.exports = router;