const { db, initDatabase } = require('./database');

async function seedDatabase(force = false) {
  await initDatabase();

  const countOperadores = await db.getAsync('SELECT COUNT(*) as total FROM operadores');
  if (countOperadores.total > 0 && !force) {
    console.log('Banco de dados já contém registros. Seed ignorado (use force para recriar).');
    return;
  }

  console.log('Populando banco de dados com dados iniciais da Gráfica EPA...');

  // Desabilitar foreign keys durante o seed para permitir limpeza completa
  await db.runAsync('PRAGMA foreign_keys = OFF');

  // 1. Turnos
  await db.runAsync(`DELETE FROM turnos`);
  await db.runAsync(`INSERT INTO turnos (id, nome, hora_inicio, hora_fim, descricao) VALUES
    (1, '1º Turno (Manhã)', '06:00', '14:00', 'Turno matutino de alta produção'),
    (2, '2º Turno (Tarde)', '14:00', '22:00', 'Turno vespertino com foco em acabamento e impressão rápida'),
    (3, '3º Turno (Noite)', '22:00', '06:00', 'Turno noturno para grandes tiragens e demandas especiais')
  `);

  // 2. Operadores
  await db.runAsync(`DELETE FROM operadores`);
  await db.runAsync(`INSERT INTO operadores (id, nome, cargo, turno_padrao) VALUES
    (1, 'Carlos Henrique', 'Operador de Produção Gráfica', 1),
    (2, 'Marcos Souza', 'Operador de Impressão Digital', 2),
    (3, 'Ana Paula Silva', 'Operadora de Acabamento e Refile', 1),
    (4, 'Roberto Mendes', 'Operador de Produção Noturna', 3),
    (5, 'Juliana Costa', 'Operadora de Grandes Formatos / Plotter', 2)
  `);

  // 3. Materiais Gráficos
  await db.runAsync(`DELETE FROM materiais`);
  await db.runAsync(`INSERT INTO materiais (id, nome, unidade, categoria, meta_hora, icone, cor) VALUES
    (1, 'Banners em Lona', 'm²', 'Comunicação Visual', 25.0, 'image', '#3b82f6'),
    (2, 'Panfletos Promocionais', 'Milheiros', 'Impressão Offset/Digital', 8.0, 'file-text', '#10b981'),
    (3, 'Cartões de Visita', 'Milheiros', 'Papelaria Comercial', 12.0, 'credit-card', '#8b5cf6'),
    (4, 'Adesivos em Vinil', 'm²', 'Comunicação Visual', 20.0, 'tag', '#f59e0b'),
    (5, 'Folders e Catálogos', 'Unidades', 'Impressão Comercial', 400.0, 'book-open', '#ec4899'),
    (6, 'Envelopes Personalizados', 'Milheiros', 'Papelaria Corporativa', 5.0, 'mail', '#06b6d4'),
    (7, 'Faixas e Testeiras', 'Metros', 'Comunicação Visual', 15.0, 'flag', '#e11d48'),
    (8, 'Rótulos e Etiquetas', 'Milheiros', 'Embalagens e Rótulos', 30.0, 'layers', '#84cc16')
  `);

  // 4. Produção histórica dos últimos 14 dias para alimentar gráficos e indicadores
  await db.runAsync(`DELETE FROM producao`);

  const hoje = new Date();
  const registros = [];

  const ocorrenciasExemplos = [
    { tipo: 'NORMAL', obs: 'Produção contínua sem intercorrências.' },
    { tipo: 'NORMAL', obs: 'Tiragem padrão finalizada no prazo.' },
    { tipo: 'NORMAL', obs: 'Lote aprovado pelo controle de qualidade.' },
    { tipo: 'MANUTENCAO', obs: 'Pausa de 20 min para limpeza da cabeça de impressão.' },
    { tipo: 'MATERIAL', obs: 'Troca de bobina de vinil fosco e calibração de cor.' },
    { tipo: 'AJUSTE', obs: 'Ajuste de faca de corte e refile na guilhotina.' },
    { tipo: 'URGENCIA', obs: 'Pedido prioritário com entrega expressa para o cliente.' }
  ];

  // Gerar lançamentos para os últimos 14 dias
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(hoje.getDate() - i);
    const dataStr = d.toISOString().slice(0, 10);

    // Turno 1 (Carlos Henrique & Ana Paula)
    registros.push({
      data: dataStr,
      hora: '08:30',
      turno_id: 1,
      operador_id: 1, // Carlos Henrique
      material_id: 1, // Banners
      quantidade: Math.floor(60 + Math.random() * 80),
      unidade: 'm²',
      tipo_ocorrencia: 'NORMAL',
      observacoes: 'Produção do 1º lote matutino.'
    });

    registros.push({
      data: dataStr,
      hora: '11:15',
      turno_id: 1,
      operador_id: 1, // Carlos Henrique
      material_id: 4, // Adesivos
      quantidade: Math.floor(40 + Math.random() * 50),
      unidade: 'm²',
      tipo_ocorrencia: i % 4 === 0 ? 'MATERIAL' : 'NORMAL',
      observacoes: i % 4 === 0 ? 'Troca de bobina de vinil.' : 'Adesivos recortados prontos.'
    });

    registros.push({
      data: dataStr,
      hora: '10:00',
      turno_id: 1,
      operador_id: 3, // Ana Paula
      material_id: 2, // Panfletos
      quantidade: Math.floor(15 + Math.random() * 25),
      unidade: 'Milheiros',
      tipo_ocorrencia: 'NORMAL',
      observacoes: 'Panfletos 10x14cm 4x0 cores.'
    });

    // Turno 2 (Marcos Souza & Juliana)
    registros.push({
      data: dataStr,
      hora: '15:40',
      turno_id: 2,
      operador_id: 2, // Marcos
      material_id: 3, // Cartões de Visita
      quantidade: Math.floor(20 + Math.random() * 30),
      unidade: 'Milheiros',
      tipo_ocorrencia: 'NORMAL',
      observacoes: 'Cartões com verniz localizado.'
    });

    registros.push({
      data: dataStr,
      hora: '18:20',
      turno_id: 2,
      operador_id: 5, // Juliana
      material_id: 1, // Banners
      quantidade: Math.floor(50 + Math.random() * 70),
      unidade: 'm²',
      tipo_ocorrencia: i % 5 === 0 ? 'MANUTENCAO' : 'NORMAL',
      observacoes: i % 5 === 0 ? 'Manutenção preventiva na cabeça de impressão.' : 'Banners com ilhós e reforço.'
    });

    // Turno 3 (Roberto Mendes)
    registros.push({
      data: dataStr,
      hora: '23:30',
      turno_id: 3,
      operador_id: 4, // Roberto
      material_id: 5, // Folders
      quantidade: Math.floor(800 + Math.random() * 1200),
      unidade: 'Unidades',
      tipo_ocorrencia: 'NORMAL',
      observacoes: 'Tiragem noturna contínua de folders promocionais.'
    });
  }

  for (const reg of registros) {
    await db.runAsync(
      `INSERT INTO producao (data, hora, turno_id, operador_id, material_id, quantidade, unidade, observacoes, tipo_ocorrencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reg.data, reg.hora, reg.turno_id, reg.operador_id, reg.material_id, reg.quantidade, reg.unidade, reg.observacoes, reg.tipo_ocorrencia]
    );
  }

  // ==========================================
  // SEED DAS NOVAS TABELAS - ERP DE PRODUÇÃO
  // ==========================================

  // 5. Serviços / Produtos
  await db.runAsync(`DELETE FROM servicos`);
  await db.runAsync(`INSERT INTO servicos (id, nome, unidade, categoria, icone, cor) VALUES
    (1, 'Banners em Lona', 'm²', 'Comunicação Visual', 'image', '#3b82f6'),
    (2, 'Panfletos Promocionais', 'Milheiros', 'Impressão Offset/Digital', 'file-text', '#10b981'),
    (3, 'Cartões de Visita', 'Milheiros', 'Papelaria Comercial', 'credit-card', '#8b5cf6'),
    (4, 'Adesivos em Vinil', 'm²', 'Comunicação Visual', 'tag', '#f59e0b'),
    (5, 'Folders e Catálogos', 'Unidades', 'Impressão Comercial', 'book-open', '#ec4899'),
    (6, 'Envelopes Personalizados', 'Milheiros', 'Papelaria Corporativa', 'mail', '#06b6d4'),
    (7, 'Faixas e Testeiras', 'Metros', 'Comunicação Visual', 'flag', '#e11d48'),
    (8, 'Rótulos e Etiquetas', 'Milheiros', 'Embalagens e Rótulos', 'layers', '#84cc16'),
    (9, 'Placas em PS', 'm²', 'Comunicação Visual', 'layout', '#f97316'),
    (10, 'Brindes Personalizados', 'Unidades', 'Brindes', 'gift', '#14b8a6')
  `);

  // 6. Acabamentos
  await db.runAsync(`DELETE FROM acabamentos`);
  await db.runAsync(`INSERT INTO acabamentos (id, nome) VALUES
    (1, 'Ilhós'),
    (2, 'Laminação Fosca'),
    (3, 'Laminação Brilho'),
    (4, 'Refile'),
    (5, 'Vinco'),
    (6, 'Dobra'),
    (7, 'Corte Especial'),
    (8, 'Verniz Localizado'),
    (9, 'Plastificação'),
    (10, 'Colagem')
  `);

  // 7. Etapas de Produção (Kanban)
  await db.runAsync(`DELETE FROM etapas_producao`);
  await db.runAsync(`INSERT INTO etapas_producao (id, nome, ordem, cor, icone) VALUES
    (1, 'Aguardando Pré-Impressão', 1, '#f59e0b', '📋'),
    (2, 'Em Impressão / Produção', 2, '#3b82f6', '🖨️'),
    (3, 'Acabamento & Corte', 3, '#8b5cf6', '✂️'),
    (4, 'Controle de Qualidade', 4, '#10b981', '🔍'),
    (5, 'Pronto para Retirada', 5, '#22c55e', '✅')
  `);

  // 8. Usuários do sistema
  await db.runAsync(`DELETE FROM usuarios`);
  await db.runAsync(`INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES
    (1, 'Administrador', 'admin@graficaepa.com', 'admin123', 'ADMIN'),
    (2, 'Atendimento', 'atendimento@graficaepa.com', 'atend123', 'ATENDIMENTO'),
    (3, 'Operador', 'operador@graficaepa.com', 'oper123', 'OPERADOR'),
    (4, 'Cliente', 'cliente@graficaepa.com', 'cliente123', 'CLIENTE')
  `);

  // 9. Clientes de exemplo
  await db.runAsync(`DELETE FROM clientes`);
  await db.runAsync(`INSERT INTO clientes (id, nome, telefone, email, whatsapp) VALUES
    (1, 'Padaria Pão Dourado', '(11) 98765-4321', 'contato@paodourado.com.br', 1),
    (2, 'Auto Peças Silva', '(11) 97654-3210', 'vendas@autopecassilva.com.br', 1),
    (3, 'Clínica Vida Saudável', '(11) 96543-2109', 'contato@clinicavida.com.br', 1),
    (4, 'Restaurante Sabor Caseiro', '(11) 95432-1098', 'saborcaseiro@gmail.com', 1),
    (5, 'Construtora Horizonte', '(11) 94321-0987', 'contato@construtorahorizonte.com.br', 1)
  `);

  // 10. Pedidos de exemplo (OS) para alimentar o Kanban
  await db.runAsync(`DELETE FROM pedidos`);
  await db.runAsync(`DELETE FROM historico_pedido`);

  const pedidosExemplo = [
    {
      numero_os: 'OS-2026-0001',
      cliente_id: 1,
      servico_id: 1,
      quantidade: 25,
      unidade: 'm²',
      dimensao_largura: 100,
      dimensao_altura: 250,
      material: 'Lona 440g',
      acabamento_id: 1,
      observacoes_tecnicas: 'Impressão 4x0 cores, com ilhós a cada 50cm. Arte final em PDF.',
      data_prometida: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      hora_prometida: '14:00',
      valor_total: 350.00,
      condicao_pagamento: 'Sinal 50%',
      status_pagamento: 'SINAL_50',
      etapa_atual: 2,
      prioridade: 'NORMAL'
    },
    {
      numero_os: 'OS-2026-0002',
      cliente_id: 2,
      servico_id: 3,
      quantidade: 5,
      unidade: 'Milheiros',
      dimensao_largura: 9,
      dimensao_altura: 5,
      material: 'Papel Couché 300g',
      acabamento_id: 8,
      observacoes_tecnicas: 'Cartões com verniz localizado no logo. Cores institucionais.',
      data_prometida: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
      hora_prometida: '10:00',
      valor_total: 450.00,
      condicao_pagamento: 'Pago',
      status_pagamento: 'PAGO',
      etapa_atual: 3,
      prioridade: 'URGENTE'
    },
    {
      numero_os: 'OS-2026-0003',
      cliente_id: 3,
      servico_id: 2,
      quantidade: 10,
      unidade: 'Milheiros',
      dimensao_largura: 10,
      dimensao_altura: 14,
      material: 'Papel Couché 150g',
      acabamento_id: 4,
      observacoes_tecnicas: 'Panfletos 10x14cm, 4x4 cores, refile com cantos arredondados.',
      data_prometida: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      hora_prometida: '16:00',
      valor_total: 680.00,
      condicao_pagamento: 'Pendente',
      status_pagamento: 'PENDENTE',
      etapa_atual: 1,
      prioridade: 'NORMAL'
    },
    {
      numero_os: 'OS-2026-0004',
      cliente_id: 4,
      servico_id: 4,
      quantidade: 15,
      unidade: 'm²',
      dimensao_largura: 50,
      dimensao_altura: 30,
      material: 'Vinil Adesivado',
      acabamento_id: 2,
      observacoes_tecnicas: 'Adesivos para vitrine com laminação fosca. Recorte especial.',
      data_prometida: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
      hora_prometida: '12:00',
      valor_total: 280.00,
      condicao_pagamento: 'Sinal 50%',
      status_pagamento: 'SINAL_50',
      etapa_atual: 4,
      prioridade: 'NORMAL'
    },
    {
      numero_os: 'OS-2026-0005',
      cliente_id: 5,
      servico_id: 7,
      quantidade: 40,
      unidade: 'Metros',
      dimensao_largura: 60,
      dimensao_altura: 200,
      material: 'Lona 440g',
      acabamento_id: 1,
      observacoes_tecnicas: 'Faixas para obra com ilhós reforçados. Texto: "VENDE-SE"',
      data_prometida: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
      hora_prometida: '09:00',
      valor_total: 520.00,
      condicao_pagamento: 'Pago',
      status_pagamento: 'PAGO',
      etapa_atual: 5,
      prioridade: 'URGENTE'
    }
  ];

  for (const pedido of pedidosExemplo) {
    const result = await db.runAsync(
      `INSERT INTO pedidos (numero_os, cliente_id, servico_id, quantidade, unidade, dimensao_largura, dimensao_altura, material, acabamento_id, observacoes_tecnicas, data_prometida, hora_prometida, valor_total, condicao_pagamento, status_pagamento, etapa_atual, prioridade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pedido.numero_os,
        pedido.cliente_id,
        pedido.servico_id,
        pedido.quantidade,
        pedido.unidade,
        pedido.dimensao_largura,
        pedido.dimensao_altura,
        pedido.material,
        pedido.acabamento_id,
        pedido.observacoes_tecnicas,
        pedido.data_prometida,
        pedido.hora_prometida,
        pedido.valor_total,
        pedido.condicao_pagamento,
        pedido.status_pagamento,
        pedido.etapa_atual,
        pedido.prioridade
      ]
    );

    // Registrar histórico de criação
    await db.runAsync(
      `INSERT INTO historico_pedido (pedido_id, acao, descricao, usuario_id, usuario_nome) VALUES (?, 'CRIACAO', ?, 1, 'Administrador')`,
      [result.lastID, `Pedido ${pedido.numero_os} criado no sistema.`]
    );
  }

  // 11. Registros de auditoria de exemplo
  await db.runAsync(`DELETE FROM auditoria`);
  await db.runAsync(`INSERT INTO auditoria (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes) VALUES
    (1, 'Administrador', 'CRIACAO_PEDIDO', 'pedidos', 1, 'Pedido OS-2026-0001 criado para o cliente Padaria Pão Dourado'),
    (1, 'Administrador', 'CRIACAO_PEDIDO', 'pedidos', 2, 'Pedido OS-2026-0002 criado para o cliente Auto Peças Silva'),
    (1, 'Administrador', 'CRIACAO_PEDIDO', 'pedidos', 3, 'Pedido OS-2026-0003 criado para o cliente Clínica Vida Saudável'),
    (1, 'Administrador', 'CRIACAO_PEDIDO', 'pedidos', 4, 'Pedido OS-2026-0004 criado para o cliente Restaurante Sabor Caseiro'),
    (1, 'Administrador', 'CRIACAO_PEDIDO', 'pedidos', 5, 'Pedido OS-2026-0005 criado para o cliente Construtora Horizonte'),
    (3, 'Operador', 'MOVIMENTACAO_PEDIDO', 'pedidos', 1, 'Pedido OS-2026-0001 movido para etapa "Em Impressão / Produção"'),
    (3, 'Operador', 'MOVIMENTACAO_PEDIDO', 'pedidos', 2, 'Pedido OS-2026-0002 movido para etapa "Acabamento & Corte"'),
    (3, 'Operador', 'MOVIMENTACAO_PEDIDO', 'pedidos', 4, 'Pedido OS-2026-0004 movido para etapa "Controle de Qualidade"'),
    (3, 'Operador', 'MOVIMENTACAO_PEDIDO', 'pedidos', 5, 'Pedido OS-2026-0005 movido para etapa "Pronto para Retirada"')
  `);

  // Reabilitar foreign keys
  await db.runAsync('PRAGMA foreign_keys = ON');

  console.log(`Seed concluído com sucesso! ${registros.length} lançamentos de produção e ${pedidosExemplo.length} pedidos inseridos.`);
}

if (require.main === module) {
  seedDatabase(true).then(() => {
    console.log('Seed finalizado.');
    process.exit(0);
  }).catch((err) => {
    console.error('Erro no seed:', err);
    process.exit(1);
  });
}

module.exports = { seedDatabase };