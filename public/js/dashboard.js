// Módulo de Dashboard, Indicadores e Gargalos - Gráfica EPA
const DashboardModule = {
  charts: {},

  async init() {
    this.setupEventListeners();
    await this.carregarDashboard();
  },

  setupEventListeners() {
    document.querySelectorAll('.btn-dash-periodo').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-dash-periodo').forEach((b) => b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600'));
        btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        this.carregarDashboard(btn.dataset.dias);
      });
    });

    // Período personalizado: 7/30 dias ou data escolhida pelo usuário
    const btnAplicar = document.getElementById('btn-dash-aplicar-periodo');
    if (btnAplicar) {
      btnAplicar.addEventListener('click', () => this.aplicarPeriodoPersonalizado());
    }
    const btnLimpar = document.getElementById('btn-dash-limpar-periodo');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', () => {
        document.getElementById('dash-data-inicio').value = '';
        document.getElementById('dash-data-fim').value = '';
        document.querySelector('.btn-dash-periodo[data-dias="30"]')?.click();
      });
    }
    ['dash-data-inicio', 'dash-data-fim'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.aplicarPeriodoPersonalizado();
        });
      }
    });
  },

  // Aplicar período com datas personalizadas
  aplicarPeriodoPersonalizado() {
    const dataInicio = document.getElementById('dash-data-inicio').value;
    const dataFim = document.getElementById('dash-data-fim').value;

    if (!dataInicio || !dataFim) {
      App.mostrarToast('Selecione a data de início e a data fim do período.', 'erro');
      return;
    }
    if (dataInicio > dataFim) {
      App.mostrarToast('A data de início não pode ser maior que a data fim.', 'erro');
      return;
    }

    document.querySelectorAll('.btn-dash-periodo').forEach((b) => b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600'));
    this.carregarDashboard({ data_inicio: dataInicio, data_fim: dataFim });
  },

  // Carregar dados e renderizar gráficos
  async carregarDashboard(periodo = 30) {
    try {
      let dataInicio = '';
      let dataFim = '';

      if (periodo && typeof periodo === 'object') {
        // Período personalizado (datas escolhidas)
        dataInicio = periodo.data_inicio || '';
        dataFim = periodo.data_fim || '';
      } else if (periodo !== 'todos') {
        // Períodos fixos: 7, 30 dias...
        dataFim = new Date().toISOString().slice(0, 10);
        if (periodo) {
          const d = new Date();
          d.setDate(d.getDate() - parseInt(periodo, 10));
          dataInicio = d.toISOString().slice(0, 10);
        }
      }

      const res = await API.dashboard.obterMetricas({
        data_inicio: dataInicio,
        data_fim: dataFim
      });

      this.renderizarKPIs(res.kpis);
      this.renderizarComerciais(res.comerciais);
      this.renderizarGraficoTimeline(res.graficos.producaoPorDia);
      this.renderizarGraficoMateriais(res.graficos.producaoPorMaterial);
      this.renderizarGraficoTurnos(res.graficos.producaoPorTurno);
      this.renderizarGraficoOperadores(res.graficos.producaoPorOperador);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      App.mostrarToast('Erro ao carregar métricas do dashboard.', 'erro');
    }
  },

  // Renderizar Cartões de KPI
  renderizarKPIs(kpis) {
    if (!kpis) return;

    document.getElementById('kpi-total-jobs').textContent = kpis.totalLancamentos.toLocaleString('pt-BR');
    document.getElementById('kpi-dias-trabalhados').textContent = `${kpis.diasTrabalhados} dias`;
    document.getElementById('kpi-total-ocorrencias').textContent = kpis.totalOcorrencias;

    const topMatElem = document.getElementById('kpi-top-material');
    if (topMatElem && kpis.topMaterial) {
      topMatElem.textContent = `${kpis.topMaterial.nome} (${Number(kpis.topMaterial.quantidade).toLocaleString('pt-BR')} ${kpis.topMaterial.unidade})`;
    } else if (topMatElem) {
      topMatElem.textContent = 'Sem registros no período';
    }
  },

  // Renderizar Indicadores Comerciais
  renderizarComerciais(comerciais) {
    if (!comerciais) return;

    // Atualizar cards de indicadores comerciais se existirem
    const totalPedidosElem = document.getElementById('kpi-total-pedidos');
    if (totalPedidosElem) {
      totalPedidosElem.textContent = comerciais.totalPedidos.toLocaleString('pt-BR');
    }

    const faturamentoElem = document.getElementById('kpi-faturamento');
    if (faturamentoElem) {
      faturamentoElem.textContent = `R$ ${Number(comerciais.faturamentoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    const ticketMedioElem = document.getElementById('kpi-ticket-medio');
    if (ticketMedioElem) {
      ticketMedioElem.textContent = `R$ ${Number(comerciais.ticketMedio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    const taxaPrazoElem = document.getElementById('kpi-taxa-prazo');
    if (taxaPrazoElem) {
      taxaPrazoElem.textContent = `${comerciais.cumprimentoPrazos.taxaCumprimento || 0}%`;
    }

    // Renderizar lista de pedidos por serviço
    const servicosContainer = document.getElementById('dash-pedidos-servico');
    if (servicosContainer && comerciais.pedidosPorServico) {
      if (comerciais.pedidosPorServico.length === 0) {
        servicosContainer.innerHTML = '<p class="text-xs text-slate-400">Sem dados no período.</p>';
      } else {
        let html = '<div class="space-y-2">';
        comerciais.pedidosPorServico.slice(0, 6).forEach((s) => {
          html += `
            <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <p class="text-xs font-bold text-slate-800">${s.servico_nome}</p>
                <p class="text-[10px] text-slate-500">${s.total_pedidos} pedido(s) • ${Number(s.total_quantidade || 0).toLocaleString('pt-BR')} ${s.unidade}</p>
              </div>
              <span class="text-xs font-black text-blue-700">R$ ${Number(s.faturamento || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          `;
        });
        html += '</div>';
        servicosContainer.innerHTML = html;
      }
    }

    // Renderizar taxa de cumprimento de prazos
    const prazoContainer = document.getElementById('dash-cumprimento-prazos');
    if (prazoContainer && comerciais.cumprimentoPrazos) {
      const cp = comerciais.cumprimentoPrazos;
      const taxa = cp.taxaCumprimento || 0;
      let corBarra = 'bg-emerald-500';
      if (taxa < 70) corBarra = 'bg-red-500';
      else if (taxa < 90) corBarra = 'bg-amber-500';

      prazoContainer.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-700">Taxa de Cumprimento de Prazos</span>
            <span class="font-black text-slate-900">${taxa}%</span>
          </div>
          <div class="w-full bg-slate-200 rounded-full h-2.5">
            <div class="${corBarra} h-2.5 rounded-full" style="width: ${taxa}%"></div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-500">
            <span> ${cp.noPrazo || 0} no prazo</span>
            <span> ${cp.atrasados || 0} atrasados</span>
            <span> ${cp.totalConcluidos || 0} concluídos</span>
          </div>
        </div>
      `;
    }
  },

  // 1. Gráfico de Evolução Diária da Produção
  renderizarGraficoTimeline(dados) {
    const ctx = document.getElementById('chart-timeline')?.getContext('2d');
    if (!ctx) return;

    if (this.charts.timeline) {
      this.charts.timeline.destroy();
    }

    const labels = (dados || []).map((d) => {
      const [ano, mes, dia] = d.data.split('-');
      return `${dia}/${mes}`;
    });

    const volumes = (dados || []).map((d) => d.volume_bruto);
    const jobs = (dados || []).map((d) => d.total_jobs);

    this.charts.timeline = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Volume Total Produzido',
            data: volumes,
            backgroundColor: 'rgba(49, 88, 216, 0.75)',
            borderColor: '#3158D8',
            borderWidth: 1,
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Total de Lotes/Trabalhos',
            data: jobs,
            type: 'line',
            borderColor: '#8FA6D9',
            backgroundColor: 'rgba(143, 166, 217, 0.12)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#8FA6D9',
            yAxisID: 'y1',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: '#f1f5f9' },
            title: { display: true, text: 'Volume Total' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Qtd. de Trabalhos' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  // 2. Gráfico de Distribuição por Material (Doughnut)
  renderizarGraficoMateriais(dados) {
    const ctx = document.getElementById('chart-materiais')?.getContext('2d');
    if (!ctx) return;

    if (this.charts.materiais) {
      this.charts.materiais.destroy();
    }

    const labels = (dados || []).map((d) => d.material_nome);
    const volumes = (dados || []).map((d) => d.total_quantidade);
    // Paleta institucional (variações de azul/cinza) para manter o painel limpo
    const paletaAzul = ['#3158D8', '#2446B8', '#1E3A8A', '#6E8FE8', '#B8CCF7', '#94A3B8', '#CBD5E1'];
    const cores = (dados || []).map((d, i) => paletaAzul[i % paletaAzul.length]);

    this.charts.materiais = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: volumes,
            backgroundColor: cores,
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 11 }
            }
          }
        }
      }
    });
  },

  // 3. Gráfico Comparativo por Turno (1º vs 2º vs 3º)
  renderizarGraficoTurnos(dados) {
    const ctx = document.getElementById('chart-turnos')?.getContext('2d');
    if (!ctx) return;

    if (this.charts.turnos) {
      this.charts.turnos.destroy();
    }

    const labels = (dados || []).map((d) => d.turno_nome);
    const jobs = (dados || []).map((d) => d.total_jobs);

    this.charts.turnos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Trabalhos Concluídos',
            data: jobs,
            backgroundColor: '#3158D8',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#f1f5f9' }, beginAtZero: true }
        },
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  },

  // 4. Gráfico de Produção por Operador
  renderizarGraficoOperadores(dados) {
    const ctx = document.getElementById('chart-operadores')?.getContext('2d');
    if (!ctx) return;

    if (this.charts.operadores) {
      this.charts.operadores.destroy();
    }

    const labels = (dados || []).map((d) => d.operador_nome);
    const jobs = (dados || []).map((d) => d.total_jobs);

    this.charts.operadores = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Total de Trabalhos Finalizados',
            data: jobs,
            backgroundColor: '#2446B8',
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          y: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  },

};
