// Módulo de Histórico, Filtros e Relatórios - Gráfica EPA
const HistoryModule = {
  paginaAtual: 1,
  limitePorPagina: 25,
  totalRegistros: 0,
  dadosAtuais: [],

  async init() {
    this.carregarFiltrosSelects();
    this.setupEventListeners();
    this.definirPeriodoRapido('este_mes');
    await this.carregarHistorico();
  },

  // Carregar opções nos selects de filtro
  carregarFiltrosSelects() {
    // Operadores
    const opSelect = document.getElementById('filtro-operador');
    if (opSelect && OperatorModule.operadoresCache.length > 0) {
      opSelect.innerHTML = '<option value="">Todos os Operadores</option>';
      OperatorModule.operadoresCache.forEach((op) => {
        opSelect.innerHTML += `<option value="${op.id}">${op.nome}</option>`;
      });
    }

    // Materiais
    const matSelect = document.getElementById('filtro-material');
    if (matSelect && OperatorModule.materiaisCache.length > 0) {
      matSelect.innerHTML = '<option value="">Todos os Materiais</option>';
      OperatorModule.materiaisCache.forEach((mat) => {
        matSelect.innerHTML += `<option value="${mat.id}">${mat.nome}</option>`;
      });
    }

    // Turnos
    const turnoSelect = document.getElementById('filtro-turno');
    if (turnoSelect && OperatorModule.turnosCache.length > 0) {
      turnoSelect.innerHTML = '<option value="">Todos os Turnos</option>';
      OperatorModule.turnosCache.forEach((t) => {
        turnoSelect.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
      });
    }
  },

  // Configurar listeners de filtro e busca
  setupEventListeners() {
    // Botões de período rápido
    document.querySelectorAll('.btn-periodo-rapido').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-periodo-rapido').forEach((b) => b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600'));
        btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        this.definirPeriodoRapido(btn.dataset.periodo);
      });
    });

    // Inputs de filtro com debounce na busca
    const aplicarFiltros = () => {
      this.paginaAtual = 1;
      this.carregarHistorico();
    };

    document.getElementById('filtro-data-inicio')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-data-fim')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-turno')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-operador')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-material')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-ocorrencia')?.addEventListener('change', aplicarFiltros);

    let searchTimeout = null;
    document.getElementById('filtro-busca')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.paginaAtual = 1;
        this.carregarHistorico();
      }, 350);
    });

    // Modal de Edição - Submissão
    const formEdicao = document.getElementById('form-modal-edicao');
    if (formEdicao) {
      formEdicao.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.salvarEdicaoModal();
      });
    }
  },

  // Períodos rápidos (Hoje, Ontem, 7 dias, Este Mês, Todos)
  definirPeriodoRapido(tipo) {
    const dataInicioInput = document.getElementById('filtro-data-inicio');
    const dataFimInput = document.getElementById('filtro-data-fim');
    const hoje = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

    if (tipo === 'hoje') {
      dataInicioInput.value = hojeStr;
      dataFimInput.value = hojeStr;
    } else if (tipo === 'ontem') {
      const ontem = new Date();
      ontem.setDate(hoje.getDate() - 1);
      const ontemStr = `${ontem.getFullYear()}-${pad(ontem.getMonth() + 1)}-${pad(ontem.getDate())}`;
      dataInicioInput.value = ontemStr;
      dataFimInput.value = ontemStr;
    } else if (tipo === '7dias') {
      const d7 = new Date();
      d7.setDate(hoje.getDate() - 7);
      dataInicioInput.value = `${d7.getFullYear()}-${pad(d7.getMonth() + 1)}-${pad(d7.getDate())}`;
      dataFimInput.value = hojeStr;
    } else if (tipo === 'este_mes') {
      const dInicio = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`;
      dataInicioInput.value = dInicio;
      dataFimInput.value = hojeStr;
    } else if (tipo === 'todos') {
      dataInicioInput.value = '';
      dataFimInput.value = '';
    }

    this.paginaAtual = 1;
    this.carregarHistorico();
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
        data_inicio: document.getElementById('filtro-data-inicio')?.value || '',
        data_fim: document.getElementById('filtro-data-fim')?.value || '',
        turno_id: document.getElementById('filtro-turno')?.value || '',
        operador_id: document.getElementById('filtro-operador')?.value || '',
        material_id: document.getElementById('filtro-material')?.value || '',
        tipo_ocorrencia: document.getElementById('filtro-ocorrencia')?.value || '',
        busca: document.getElementById('filtro-busca')?.value || '',
        limit: this.limitePorPagina,
        offset: (this.paginaAtual - 1) * this.limitePorPagina
      };

      const res = await API.producao.listar(params);
      this.dadosAtuais = res.dados || [];
      this.totalRegistros = res.total || 0;

      this.renderizarTabela(this.dadosAtuais);
      this.renderizarTotaisFiltro(this.dadosAtuais);
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
            <p class="text-3xl mb-1">🔍</p>
            <p class="text-slate-600 font-medium">Nenhum registro encontrado para os filtros selecionados.</p>
            <p class="text-xs text-slate-400 mt-1">Tente ajustar as datas ou limpar a busca.</p>
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
            ${dataFormatada} <span class="text-xs text-slate-400 font-normal ml-1">⏰ ${reg.hora}</span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${turnoBadgeClass}">
              ${reg.turno_nome}
            </span>
          </td>
          <td class="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
            👤 ${reg.operador_nome}
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-slate-800">${reg.material_nome}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <span class="text-base font-extrabold text-blue-700">${Number(reg.quantidade).toLocaleString('pt-BR')}</span>
            <span class="text-xs font-semibold text-slate-500 ml-1">${reg.unidade}</span>
          </td>
          <td class="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
            ${isOcorrencia ? `<span class="inline-block bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold mr-1">[${reg.tipo_ocorrencia}]</span>` : ''}
            ${reg.observacoes ? reg.observacoes : '<span class="text-slate-300">-</span>'}
          </td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            <div class="flex items-center justify-center space-x-2">
              <button onclick="OperatorModule.abrirModalCorrecao(${reg.id})" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Editar">
                ✏️
              </button>
              <button onclick="HistoryModule.excluirLancamento(${reg.id})" class="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition" title="Excluir">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // Renderizar resumo de totais na barra superior da tabela
  renderizarTotaisFiltro(dados) {
    const container = document.getElementById('resumo-totais-filtro');
    if (!container) return;

    if (!dados || dados.length === 0) {
      container.innerHTML = '<span class="text-xs text-slate-400">Nenhum dado para somar.</span>';
      return;
    }

    const totaisPorMaterial = {};
    dados.forEach((reg) => {
      const key = `${reg.material_nome} (${reg.unidade})`;
      totaisPorMaterial[key] = (totaisPorMaterial[key] || 0) + Number(reg.quantidade);
    });

    let html = `<div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">`;
    html += `<span class="text-slate-500">Totais no filtro:</span>`;

    for (const [material, total] of Object.entries(totaisPorMaterial)) {
      html += `
        <span class="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
          ${material}: <strong>${total.toLocaleString('pt-BR')}</strong>
        </span>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
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
          ◀ Anterior
        </button>
        <span class="text-xs font-bold text-slate-700 px-2">Pág. ${this.paginaAtual} de ${totalPaginas}</span>
        <button onclick="HistoryModule.mudarPagina(${this.paginaAtual + 1})" ${this.paginaAtual >= totalPaginas ? 'disabled' : ''} class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
          Próxima ▶
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
    if (!confirm('Tem certeza que deseja excluir permanentemente este lançamento?')) {
      return;
    }
    try {
      await API.producao.excluir(id);
      App.mostrarToast('Lançamento excluído com sucesso.', 'sucesso');
      await this.carregarHistorico();
      await OperatorModule.carregarUltimosLancamentos();
    } catch (error) {
      App.mostrarToast('Erro ao excluir lançamento.', 'erro');
    }
  },

  // Exportar para Excel (.xlsx)
  async exportarExcel() {
    try {
      App.mostrarToast('Gerando planilha Excel...', 'info');

      // Buscar todos os registros do filtro sem limite de paginação
      const params = {
        data_inicio: document.getElementById('filtro-data-inicio')?.value || '',
        data_fim: document.getElementById('filtro-data-fim')?.value || '',
        turno_id: document.getElementById('filtro-turno')?.value || '',
        operador_id: document.getElementById('filtro-operador')?.value || '',
        material_id: document.getElementById('filtro-material')?.value || '',
        tipo_ocorrencia: document.getElementById('filtro-ocorrencia')?.value || '',
        busca: document.getElementById('filtro-busca')?.value || '',
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
