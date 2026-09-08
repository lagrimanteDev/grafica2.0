const express = require('express');
const router = express.Router();
const { db } = require('../database');

// GET /api/dashboard/metricas - Métricas consolidadas, gráficos e detecção de gargalos
router.get('/metricas', async (req, res) => {
  try {
    const { data_inicio, data_fim, turno_id } = req.query;

    let filtroWhere = ' WHERE 1=1';
    const params = [];

    if (data_inicio) {
      filtroWhere += ' AND p.data >= ?';
      params.push(data_inicio);
    }
    if (data_fim) {
      filtroWhere += ' AND p.data <= ?';
      params.push(data_fim);
    }
    if (turno_id) {
      filtroWhere += ' AND p.turno_id = ?';
      params.push(Number(turno_id));
    }

    // 1. Resumo Geral (KPIs)
    const kpiTotal = await db.getAsync(
      `SELECT 
        COUNT(*) as total_lancamentos,
        COUNT(DISTINCT p.data) as dias_trabalhados,
        COUNT(DISTINCT p.operador_id) as operadores_ativos,
        SUM(CASE WHEN p.tipo_ocorrencia != 'NORMAL' THEN 1 ELSE 0 END) as total_ocorrencias
       FROM producao p ${filtroWhere}`,
      params
    );

    // Material mais produzido
    const topMaterial = await db.getAsync(
      `SELECT m.nome, p.unidade, SUM(p.quantidade) as total_qtd, COUNT(*) as jobs
       FROM producao p
       JOIN materiais m ON p.material_id = m.id
       ${filtroWhere}
       GROUP BY p.material_id, p.unidade
       ORDER BY total_qtd DESC
       LIMIT 1`,
      params
    );

    // 2. Produção por Dia (Timeline para Gráfico de Linha/Barras)
    const producaoPorDia = await db.allAsync(
      `SELECT 
        p.data,
        COUNT(p.id) as total_jobs,
        SUM(CASE WHEN m.nome LIKE '%Banner%' THEN p.quantidade ELSE 0 END) as banners_m2,
        SUM(CASE WHEN m.nome LIKE '%Adesivo%' THEN p.quantidade ELSE 0 END) as adesivos_m2,
        SUM(CASE WHEN m.nome LIKE '%Panfleto%' THEN p.quantidade ELSE 0 END) as panfletos_milh,
        SUM(CASE WHEN m.nome LIKE '%Cart%' THEN p.quantidade ELSE 0 END) as cartoes_milh,
        SUM(p.quantidade) as volume_bruto
       FROM producao p
       JOIN materiais m ON p.material_id = m.id
       ${filtroWhere}
       GROUP BY p.data
       ORDER BY p.data ASC`,
      params
    );

    // 3. Distribuição por Material (Gráfico de Pizza / Rosca)
    const producaoPorMaterial = await db.allAsync(
      `SELECT 
        m.id,
        m.nome as material_nome,
        m.unidade,
        m.cor,
        m.icone,
        SUM(p.quantidade) as total_quantidade,
        COUNT(p.id) as total_jobs,
        ROUND(AVG(p.quantidade), 1) as media_por_job
       FROM producao p
       JOIN materiais m ON p.material_id = m.id
       ${filtroWhere}
       GROUP BY m.id
       ORDER BY total_quantidade DESC`,
      params
    );

    // 4. Comparativo por Turno (1º vs 2º vs 3º)
    const producaoPorTurno = await db.allAsync(
      `SELECT 
        t.id as turno_id,
        t.nome as turno_nome,
        COUNT(p.id) as total_jobs,
        SUM(p.quantidade) as total_quantidade,
        SUM(CASE WHEN p.tipo_ocorrencia != 'NORMAL' THEN 1 ELSE 0 END) as ocorrencias,
        ROUND(AVG(p.quantidade), 1) as media_volume
       FROM turnos t
       LEFT JOIN producao p ON p.turno_id = t.id ${data_inicio ? ' AND p.data >= ?' : ''} ${data_fim ? ' AND p.data <= ?' : ''}
       GROUP BY t.id
       ORDER BY t.id ASC`,
      [...(data_inicio ? [data_inicio] : []), ...(data_fim ? [data_fim] : [])]
    );

    // 5. Desempenho por Operador
    const producaoPorOperador = await db.allAsync(
      `SELECT 
        o.id,
        o.nome as operador_nome,
        o.cargo,
        t.nome as turno_nome,
        COUNT(p.id) as total_jobs,
        SUM(p.quantidade) as total_quantidade,
        SUM(CASE WHEN p.tipo_ocorrencia != 'NORMAL' THEN 1 ELSE 0 END) as ocorrencias
       FROM operadores o
       LEFT JOIN turnos t ON o.turno_padrao = t.id
       LEFT JOIN producao p ON p.operador_id = o.id ${data_inicio ? ' AND p.data >= ?' : ''} ${data_fim ? ' AND p.data <= ?' : ''}
       WHERE o.ativo = 1
       GROUP BY o.id
       ORDER BY total_jobs DESC`,
      [...(data_inicio ? [data_inicio] : []), ...(data_fim ? [data_fim] : [])]
    );

    // 6. Análise de Gargalos e Ocorrências Recentes
    const ocorrenciasRecentes = await db.allAsync(
      `SELECT 
        p.id,
        p.data,
        p.hora,
        t.nome as turno_nome,
        o.nome as operador_nome,
        m.nome as material_nome,
        p.tipo_ocorrencia,
        p.observacoes
       FROM producao p
       JOIN turnos t ON p.turno_id = t.id
       JOIN operadores o ON p.operador_id = o.id
       JOIN materiais m ON p.material_id = m.id
       WHERE p.tipo_ocorrencia != 'NORMAL' ${data_inicio ? ' AND p.data >= ?' : ''} ${data_fim ? ' AND p.data <= ?' : ''}
       ORDER BY p.data DESC, p.hora DESC
       LIMIT 10`,
      [...(data_inicio ? [data_inicio] : []), ...(data_fim ? [data_fim] : [])]
    );

    // ==========================================
    // INDICADORES COMERCIAIS (PEDIDOS / OS)
    // ==========================================

    // Filtro para pedidos
    let pedidoWhere = ' WHERE 1=1';
    const pedidoParams = [];

    if (data_inicio) {
      pedidoWhere += ' AND DATE(ped.created_at) >= ?';
      pedidoParams.push(data_inicio);
    }
    if (data_fim) {
      pedidoWhere += ' AND DATE(ped.created_at) <= ?';
      pedidoParams.push(data_fim);
    }

    // KPIs Comerciais
    const kpisComerciais = await db.getAsync(
      `SELECT 
        COUNT(*) as total_pedidos,
        SUM(CASE WHEN ped.status = 'ATIVO' THEN 1 ELSE 0 END) as pedidos_ativos,
        SUM(CASE WHEN ped.status = 'CANCELADO' THEN 1 ELSE 0 END) as pedidos_cancelados,
        SUM(CASE WHEN ped.status_pagamento = 'PAGO' THEN ped.valor_total ELSE 0 END) as faturamento_pago,
        SUM(ped.valor_total) as faturamento_total,
        ROUND(AVG(CASE WHEN ped.valor_total > 0 THEN ped.valor_total END), 2) as ticket_medio
       FROM pedidos ped ${pedidoWhere}`,
      pedidoParams
    );

    // Pedidos por dia
    const pedidosPorDia = await db.allAsync(
      `SELECT 
        DATE(ped.created_at) as data,
        COUNT(*) as total_pedidos,
        SUM(ped.valor_total) as faturamento
       FROM pedidos ped ${pedidoWhere}
       GROUP BY DATE(ped.created_at)
       ORDER BY data ASC`,
      pedidoParams
    );

    // Pedidos por serviço
    const pedidosPorServico = await db.allAsync(
      `SELECT 
        s.id,
        s.nome as servico_nome,
        s.unidade,
        COUNT(ped.id) as total_pedidos,
        SUM(ped.quantidade) as total_quantidade,
        SUM(ped.valor_total) as faturamento
       FROM servicos s
       LEFT JOIN pedidos ped ON ped.servico_id = s.id ${data_inicio ? ' AND DATE(ped.created_at) >= ?' : ''} ${data_fim ? ' AND DATE(ped.created_at) <= ?' : ''}
       WHERE s.ativo = 1
       GROUP BY s.id
       ORDER BY total_pedidos DESC`,
      [...(data_inicio ? [data_inicio] : []), ...(data_fim ? [data_fim] : [])]
    );

    // Taxa de cumprimento de prazos
    const cumprimentoPrazos = await db.getAsync(
      `SELECT 
        COUNT(*) as total_concluidos,
        SUM(CASE WHEN DATE(ped.concluido_em) <= ped.data_prometida THEN 1 ELSE 0 END) as no_prazo,
        SUM(CASE WHEN DATE(ped.concluido_em) > ped.data_prometida THEN 1 ELSE 0 END) as atrasados
       FROM pedidos ped
       WHERE ped.etapa_atual = 5 AND ped.concluido_em IS NOT NULL ${data_inicio ? ' AND DATE(ped.concluido_em) >= ?' : ''} ${data_fim ? ' AND DATE(ped.concluido_em) <= ?' : ''}`,
      [...(data_inicio ? [data_inicio] : []), ...(data_fim ? [data_fim] : [])]
    );

    // Tempo médio por etapa (gargalos de produção)
    const tempoPorEtapa = await db.allAsync(
      `SELECT 
        e.id as etapa_id,
        e.nome as etapa_nome,
        e.ordem,
        e.cor,
        e.icone,
        COUNT(hp.id) as total_movimentacoes
       FROM etapas_producao e
       LEFT JOIN historico_pedido hp ON hp.acao = 'MOVIMENTACAO' AND hp.descricao LIKE '%' || e.nome || '%'
       GROUP BY e.id
       ORDER BY e.ordem ASC`
    );

    res.json({
      periodo: {
        inicio: data_inicio || 'Início do histórico',
        fim: data_fim || 'Data atual'
      },
      kpis: {
        totalLancamentos: kpiTotal ? kpiTotal.total_lancamentos : 0,
        diasTrabalhados: kpiTotal ? kpiTotal.dias_trabalhados : 0,
        operadoresAtivos: kpiTotal ? kpiTotal.operadores_ativos : 0,
        totalOcorrencias: kpiTotal ? kpiTotal.total_ocorrencias : 0,
        topMaterial: topMaterial ? {
          nome: topMaterial.nome,
          quantidade: topMaterial.total_qtd,
          unidade: topMaterial.unidade,
          jobs: topMaterial.jobs
        } : null
      },
      comerciais: {
        totalPedidos: kpisComerciais ? kpisComerciais.total_pedidos : 0,
        pedidosAtivos: kpisComerciais ? kpisComerciais.pedidos_ativos : 0,
        pedidosCancelados: kpisComerciais ? kpisComerciais.pedidos_cancelados : 0,
        faturamentoPago: kpisComerciais ? kpisComerciais.faturamento_pago : 0,
        faturamentoTotal: kpisComerciais ? kpisComerciais.faturamento_total : 0,
        ticketMedio: kpisComerciais ? kpisComerciais.ticket_medio : 0,
        pedidosPorDia,
        pedidosPorServico,
        cumprimentoPrazos: {
          totalConcluidos: cumprimentoPrazos ? cumprimentoPrazos.total_concluidos : 0,
          noPrazo: cumprimentoPrazos ? cumprimentoPrazos.no_prazo : 0,
          atrasados: cumprimentoPrazos ? cumprimentoPrazos.atrasados : 0,
          taxaCumprimento: cumprimentoPrazos && cumprimentoPrazos.total_concluidos > 0
            ? Math.round((cumprimentoPrazos.no_prazo / cumprimentoPrazos.total_concluidos) * 100)
            : 0
        }
      },
      graficos: {
        producaoPorDia,
        producaoPorMaterial,
        producaoPorTurno,
        producaoPorOperador
      },
      gargalos: {
        totalOcorrencias: kpiTotal ? kpiTotal.total_ocorrencias : 0,
        ocorrenciasRecentes,
        tempoPorEtapa
      }
    });
  } catch (error) {
    console.error('Erro ao calcular métricas do dashboard:', error);
    res.status(500).json({ error: 'Erro ao obter dados do dashboard.' });
  }
});

module.exports = router;