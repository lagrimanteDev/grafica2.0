// Módulo de Histórico, Filtros e Relatórios - Gráfica EPA
const HistoryModule = {
  paginaAtual: 1,
  limitePorPagina: 25,
  totalRegistros: 0,
  dadosAtuais: [],

  async init() {
    this.setupEventListeners();
    this.definirPeriodo('30');
  },

  // Calcula o intervalo de datas dos períodos rápidos (7/30 dias / Todos)
  calcularRangoPeriodo(dias) {
    this.dataInicio = '';
    this.dataFim = '';

    if (!dias || dias === 'todos') return;

    const hoje = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    this.dataFim = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
    const d = new Date();
    d.setDate(hoje.getDate() - parseInt(dias, 10));
    this.dataInicio = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  // Aplica um período rápido (mesmo comportamento do Painel de Gestão)
  definirPeriodo(periodo) {
    document.querySelectorAll('.btn-hist-periodo').forEach((b) => b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600'));
    const btnAtivo = document.querySelector(`.btn-hist-periodo[data-dias="${periodo}"]`);
    if (btnAtivo) {
      btnAtivo.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
    }

    this.calcularRangoPeriodo(periodo);

    const dataInicioInput = document.getElementById('hist-data-inicio');
    const dataFimInput = document.getElementById('hist-data-fim');
    if (dataInicioInput) dataInicioInput.value = this.dataInicio;
    if (dataFimInput) dataFimInput.value = this.dataFim;

    this.atualizarRotuloPeriodo();
    this.paginaAtual = 1;
    this.carregarHistorico();
  },

  // Método mantido por compatibilidade (os filtros avançados foram removidos)
  carregarFiltrosSelects() {},

  // Configurar listeners (modal de edição e período)
  setupEventListeners() {
    // Botões de período rápido (estilo Painel de Gestão)
    document.querySelectorAll('.btn-hist-periodo').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.definirPeriodo(btn.dataset.dias);
      });
    });

    // Botão Aplicar (período personalizado De/Até)
    const btnAplicarPeriodo = document.getElementById('btn-hist-aplicar-periodo');
    if (btnAplicarPeriodo) {
      btnAplicarPeriodo.addEventListener('click', () => this.aplicarPeriodoPersonalizado());
    }

    // Botão Limpar (voltar para 30 dias)
    const btnLimparPeriodo = document.getElementById('btn-hist-limpar-periodo');
    if (btnLimparPeriodo) {
      btnLimparPeriodo.addEventListener('click', () => this.limparPeriodo());
    }

    // Enter nos campos de data aplica o período
    ['hist-data-inicio', 'hist-data-fim'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.aplicarPeriodoPersonalizado();
        });
      }
    });

    // Campo de quantidade do modal de edição: limpar destaque ao corrigir
    const editQtdInput = document.getElementById('edit-quantidade');
    if (editQtdInput) {
      editQtdInput.addEventListener('input', () => {
        const valido = !!(editQtdInput.value && parseFloat(editQtdInput.value) > 0);
        App.campoInvalido(editQtdInput, !valido);
      });
    }

    // Limpar destaque dos demais campos do modal assim que forem corrigidos
    const limparCampoEdicao = (idElemento) => {
      const el = document.getElementById(idElemento);
      if (!el) return;
      const aoCorrigir = () => {
        if (el.value && el.value.trim() !== '') {
          App.campoInvalido(el, false);
        }
      };
      el.addEventListener('input', aoCorrigir);
      el.addEventListener('change', aoCorrigir);
    };
    ['edit-data', 'edit-hora', 'edit-turno-id', 'edit-operador-id', 'edit-material-id'].forEach(limparCampoEdicao);

    // Modal de Edição - Submissão
    const formEdicao = document.getElementById('form-modal-edicao');
    if (formEdicao) {
      formEdicao.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.salvarEdicaoModal();
      });
    }
  },

  // Atualizar o rótulo do período selecionado
  atualizarRotuloPeriodo() {
    const lblPeriodo = document.getElementById('hist-periodo-lbl');
    if (!lblPeriodo) return;

    const dataInicio = this.dataInicio || '';
    const dataFim = this.dataFim || '';

    if (!dataInicio && !dataFim) {
      lblPeriodo.textContent = 'Período selecionado';
      return;
    }

    const formatar = (iso) => {
      if (!iso) return '';
      const partes = iso.split('-');
      return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
    };

    if (dataInicio && dataFim) {
      lblPeriodo.textContent = dataInicio === dataFim
        ? `${formatar(dataInicio)}`
        : `${formatar(dataInicio)} até ${formatar(dataFim)}`;
    } else if (dataInicio) {
      lblPeriodo.textContent = `a partir de ${formatar(dataInicio)}`;
    } else {
      lblPeriodo.textContent = `até ${formatar(dataFim)}`;
    }
  },

  // Aplicar período personalizado com datas informadas (De/Até)
  aplicarPeriodoPersonalizado() {
    const dataInicioInput = document.getElementById('hist-data-inicio');
    const dataFimInput = document.getElementById('hist-data-fim');
    if (!dataInicioInput || !dataFimInput) return;

    const dataInicio = dataInicioInput.value;
    const dataFim = dataFimInput.value;

    if (!dataInicio || !dataFim) {
      App.mostrarToast('Selecione a data de início e a data fim do período.', 'erro');
      return;
    }
    if (dataInicio > dataFim) {
      App.mostrarToast('A data de início não pode ser maior que a data fim.', 'erro');
      return;
    }

    document.querySelectorAll('.btn-hist-periodo').forEach((b) => b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600'));

    this.dataInicio = dataInicio;
    this.dataFim = dataFim;
    this.atualizarRotuloPeriodo();
    this.paginaAtual = 1;
    this.carregarHistorico();
  },

  // Reiniciar o período para o padrão (30 dias)
  limparPeriodo() {
    const dataInicioInput = document.getElementById('hist-data-inicio');
    const dataFimInput = document.getElementById('hist-data-fim');
    if (dataInicioInput) dataInicioInput.value = '';
    if (dataFimInput) dataFimInput.value = '';

    document.querySelector('.btn-hist-periodo[data-dias="30"]')?.click();
  },

  // Carregar histórico da API
  async carregarHistorico() {
    const tbody = document.getElementById('tabela-historico-corpo');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-400">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p>Carregando histórico de produção...</p>
        </td>
      </tr>
    `;

    try {
      const params = {
        data_inicio: this.dataInicio || '',
        data_fim: this.dataFim || '',
        limit: this.limitePorPagina,
        offset: (this.paginaAtual - 1) * this.limitePorPagina
      };

      const res = await API.producao.listar(params);
      this.dadosAtuais = res.dados || [];
      this.totalRegistros = res.total || 0;

      this.renderizarTabela(this.dadosAtuais);
      this.renderizarPaginacao();
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-6 text-center text-red-500 font-medium">
            Erro ao carregar dados do histórico. Verifique a conexão com o servidor.
          </td>
        </tr>
      `;
    }
  },

  // Renderizar linhas da tabela
  renderizarTabela(dados) {
    const tbody = document.getElementById('tabela-historico-corpo');
    if (!tbody) return;

    if (!dados || dados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-400">
            <p class="text-slate-600 font-medium">Nenhum registro encontrado para o período selecionado.</p>
            <p class="text-xs text-slate-400 mt-1">Tente ajustar o período ou verificar os lançamentos.</p>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    dados.forEach((reg) => {
      const [ano, mes, dia] = reg.data.split('-');
      const dataFormatada = `${dia}/${mes}/${ano}`;
      const isOcorrencia = reg.tipo_ocorrencia !== 'NORMAL';

      let turnoBadgeClass = 'badge-turno-1';
      if (reg.turno_id === 2) turnoBadgeClass = 'badge-turno-2';
      if (reg.turno_id === 3) turnoBadgeClass = 'badge-turno-3';

      html += `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${isOcorrencia ? 'bg-amber-50/30' : ''}">
          <td class="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">
            ${dataFormatada} <span class="text-xs text-slate-400 font-normal ml-1">${reg.hora}</span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${turnoBadgeClass}">
              ${reg.turno_nome}
            </span>
          </td>
          <td class="py-3 px-4 font-medium text-slate-800 truncate" title="${reg.operador_nome || ''}">
            ${reg.operador_nome}
          </td>
          <td class="py-3 px-4 truncate" title="${reg.material_nome || ''}">
            <span class="font-bold text-slate-800">${reg.material_nome}</span>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <span class="text-base font-extrabold text-blue-700">${Number(reg.quantidade).toLocaleString('pt-BR')}</span>
            <span class="text-xs font-semibold text-slate-500 ml-1">${reg.unidade}</span>
          </td>
          <td class="py-3 px-4 text-xs text-slate-600 truncate" title="${reg.observacoes || ''}">
            ${isOcorrencia ? `<span class="inline-block bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold mr-1">[${reg.tipo_ocorrencia}]</span>` : ''}
            ${reg.observacoes ? reg.observacoes : '<span class="text-slate-300">-</span>'}
          </td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <div class="flex items-center justify-center space-x-2">
              <button onclick="OperatorModule.abrirModalCorrecao(${reg.id})" class="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition" title="Editar lançamento">
                Editar
              </button>
              <button onclick="HistoryModule.excluirLancamento(${reg.id})" class="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition" title="Excluir lançamento">
                Excluir
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // Renderizar paginação
  renderizarPaginacao() {
    const container = document.getElementById('paginacao-historico');
    if (!container) return;

    const totalPaginas = Math.ceil(this.totalRegistros / this.limitePorPagina) || 1;
    const inicio = (this.paginaAtual - 1) * this.limitePorPagina + 1;
    const fim = Math.min(this.paginaAtual * this.limitePorPagina, this.totalRegistros);

    container.innerHTML = `
      <div class="text-xs text-slate-500 font-medium">
        Mostrando <strong class="text-slate-700">${this.totalRegistros > 0 ? inicio : 0}</strong> a <strong class="text-slate-700">${fim}</strong> de <strong class="text-slate-700">${this.totalRegistros}</strong> registros
      </div>
      <div class="flex items-center space-x-2">
        <button onclick="HistoryModule.mudarPagina(${this.paginaAtual - 1})" ${this.paginaAtual <= 1 ? 'disabled' : ''} class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
          Anterior
        </button>
        <span class="text-xs font-bold text-slate-700 px-2">Página ${this.paginaAtual} de ${totalPaginas}</span>
        <button onclick="HistoryModule.mudarPagina(${this.paginaAtual + 1})" ${this.paginaAtual >= totalPaginas ? 'disabled' : ''} class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
          Próxima
        </button>
      </div>
    `;
  },

  mudarPagina(novaPagina) {
    this.paginaAtual = novaPagina;
    this.carregarHistorico();
  },

  // Salvar Edição do Modal
  async salvarEdicaoModal() {
    const id = document.getElementById('edit-id').value;
    const data = document.getElementById('edit-data').value;
    const hora = document.getElementById('edit-hora').value;
    const turno_id = document.getElementById('edit-turno-id').value;
    const operador_id = document.getElementById('edit-operador-id').value;
    const material_id = document.getElementById('edit-material-id').value;
    const quantidade = document.getElementById('edit-quantidade').value;
    const unidade = document.getElementById('edit-unidade').value;
    const observacoes = document.getElementById('edit-observacoes').value;
    const tipo_ocorrencia = document.getElementById('edit-tipo-ocorrencia').value;

    // Validações
    if (!data) {
      App.mostrarToast('Informe a data do lançamento.', 'erro');
      App.campoInvalido(document.getElementById('edit-data'), true);
      return;
    }
    if (!hora) {
      App.mostrarToast('Informe a hora do lançamento.', 'erro');
      App.campoInvalido(document.getElementById('edit-hora'), true);
      return;
    }
    if (!turno_id) {
      App.mostrarToast('Selecione o turno.', 'erro');
      App.campoInvalido(document.getElementById('edit-turno-id'), true);
      return;
    }
    if (!operador_id) {
      App.mostrarToast('Selecione o operador.', 'erro');
      App.campoInvalido(document.getElementById('edit-operador-id'), true);
      return;
    }
    if (!material_id) {
      App.mostrarToast('Selecione o material.', 'erro');
      App.campoInvalido(document.getElementById('edit-material-id'), true);
      return;
    }
    if (!quantidade || parseFloat(quantidade) <= 0) {
      App.mostrarToast('Informe uma quantidade válida maior que zero.', 'erro');
      App.campoInvalido(document.getElementById('edit-quantidade'), true);
      return;
    }
    App.campoInvalido(document.getElementById('edit-quantidade'), false);

    try {
      await API.producao.atualizar(id, {
        data,
        hora,
        turno_id,
        operador_id,
        material_id,
        quantidade: parseFloat(quantidade),
        unidade,
        observacoes,
        tipo_ocorrencia
      });

      App.mostrarToast('Registro atualizado com sucesso!', 'sucesso');
      document.getElementById('modal-edicao').classList.add('hidden');
      await this.carregarHistorico();
      await OperatorModule.carregarUltimosLancamentos();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao atualizar registro.', 'erro');
    }
  },

  // Excluir Lançamento
  async excluirLancamento(id) {
    const ok = await App.confirmar({
      titulo: 'Excluir Lançamento',
      mensagem: 'Deseja excluir permanentemente este lançamento? Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      tipo: 'perigo'
    });
    if (!ok) return;
    try {
      await API.producao.excluir(id);
      App.mostrarToast('Lançamento excluído com sucesso.', 'sucesso');
      await this.carregarHistorico();
      await OperatorModule.carregarUltimosLancamentos();
    } catch (error) {
      App.mostrarToast('Erro ao excluir lançamento.', 'erro');
    }
  },

  // Exportar registros do período selecionado para Excel (.xlsx)
  async exportarExcel() {
    try {
      App.mostrarToast('Gerando planilha Excel...', 'info');

      // Garantir intervalo definido (por padrão: últimos 30 dias)
      if (this.dataInicio === undefined || this.dataFim === undefined) {
        this.calcularRangoPeriodo('30');
      }

      const params = {
        data_inicio: this.dataInicio || '',
        data_fim: this.dataFim || '',
        limit: 5000,
        offset: 0
      };

      const res = await API.producao.listar(params);
      const registros = res.dados || [];

      if (registros.length === 0) {
        App.mostrarToast('Não há registros para exportar.', 'aviso');
        return;
      }

      // Montar linhas para o Excel
      const excelData = registros.map((r) => ({
        'ID': r.id,
        'Data': r.data,
        'Hora': r.hora,
        'Turno': r.turno_nome,
        'Operador': r.operador_nome,
        'Material': r.material_nome,
        'Quantidade': r.quantidade,
        'Unidade': r.unidade,
        'Tipo Ocorrência': r.tipo_ocorrencia,
        'Observações': r.observacoes || ''
      }));

      // Usar SheetJS
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produção Diária');

      const dataHoje = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Grafica_EPA_Producao_${dataHoje}.xlsx`);
      App.mostrarToast('Planilha Excel baixada com sucesso!', 'sucesso');
    } catch (error) {
      console.error('Erro na exportação Excel:', error);
      App.mostrarToast('Erro ao exportar para Excel.', 'erro');
    }
  },

  // Imprimir / Salvar em PDF
  imprimirRelatorioPDF() {
    window.print();
  }
};
