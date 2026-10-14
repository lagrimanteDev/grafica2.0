// Módulo da Equipe (Operadores do Chão de Fábrica) - Gráfica EPA
const EquipeModule = {
  operadoresCache: [],
  editandoId: null,

  turnoInfo: {
    1: { nome: '1º Turno', icone: '☀️' },
    2: { nome: '2º Turno', icone: '⛅' },
    3: { nome: '3º Turno', icone: '🌙' }
  },

  async init() {
    this.setupEventListeners();
    await this.carregarEquipe();
  },

  setupEventListeners() {
    // Submit do formulário (cadastrar / editar)
    const form = document.getElementById('form-equipe');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.salvar();
      });
    }

    // Limpar destaque do nome ao digitar
    const nome = document.getElementById('equipe-nome');
    if (nome) {
      nome.addEventListener('input', () => App.campoInvalido(nome, false));
    }
  },

  // Carregar operadores e montar tabela + resumo
  async carregarEquipe() {
    try {
      // todos=true para incluir também os inativos
      const operadores = await API.operadores.listar(true);
      this.operadoresCache = operadores;
      this.renderizarResumoTurnos(operadores);
      this.renderizarTabela(operadores);
    } catch (error) {
      console.error('Erro ao carregar equipe:', error);
      App.mostrarToast('Erro ao carregar a equipe.', 'erro');
    }
  },

  // Cards de resumo: total de operadores ativos por turno
  renderizarResumoTurnos(operadores) {
    const container = document.getElementById('equipe-resumo-turnos');
    if (!container) return;

    const ativos = operadores.filter((o) => o.ativo);
    const porTurno = { 1: 0, 2: 0, 3: 0 };
    ativos.forEach((o) => {
      const t = Number(o.turno_padrao) || 1;
      if (porTurno[t] !== undefined) porTurno[t] += 1;
    });

    const cards = Object.keys(this.turnoInfo).map((id) => {
      const info = this.turnoInfo[id];
      const qtd = porTurno[id];
      return `
        <div class="card-grafica p-5 bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <p class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">${info.icone} ${info.nome}</p>
            <p class="text-2xl font-black text-slate-900 mt-1">${qtd}</p>
            <p class="text-xs text-slate-500 font-semibold">${qtd === 1 ? 'operador ativo' : 'operadores ativos'}</p>
          </div>
          <span class="text-3xl">${info.icone}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = cards;
  },

  // Tabela de operadores
  renderizarTabela(operadores) {
    const tbody = document.getElementById('equipe-tabela-corpo');
    if (!tbody) return;

    if (!operadores || operadores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400 font-medium">Nenhum operador cadastrado ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = operadores.map((op) => {
      const turno = this.turnoInfo[Number(op.turno_padrao) || 1] || this.turnoInfo[1];
      const statusBadge = op.ativo
        ? '<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">Ativo</span>'
        : '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">Inativo</span>';
      const btnStatus = op.ativo
        ? `<button onclick="EquipeModule.alterarStatus(${op.id}, false)" class="text-red-500 hover:text-red-700 text-xs font-bold">Desativar</button>`
        : `<button onclick="EquipeModule.alterarStatus(${op.id}, true)" class="text-emerald-600 hover:text-emerald-800 text-xs font-bold">Ativar</button>`;

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="py-2.5 px-3 font-bold text-slate-800 truncate" title="${op.nome}">${op.nome}</td>
          <td class="py-2.5 px-3 text-slate-600 text-xs truncate" title="${op.cargo || 'Operador'}">${op.cargo || 'Operador'}</td>
          <td class="py-2.5 px-3 text-slate-700 text-xs font-semibold">${turno.icone} ${turno.nome}</td>
          <td class="py-2.5 px-3 text-center">${statusBadge}</td>
          <td class="py-2.5 px-3 text-center">
            <div class="flex items-center justify-center gap-3">
              <button onclick="EquipeModule.abrirModal(${op.id})" class="text-blue-600 hover:text-blue-800 text-xs font-bold">Editar</button>
              ${btnStatus}
              <button onclick="EquipeModule.excluir(${op.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Abrir modal (cadastro ou edição)
  abrirModal(id = null) {
    this.editandoId = id;

    const titulo = document.getElementById('modal-equipe-titulo');
    const statusWrap = document.getElementById('equipe-status-wrap');
    const nome = document.getElementById('equipe-nome');
    const cargo = document.getElementById('equipe-cargo');
    const turno = document.getElementById('equipe-turno');
    const ativo = document.getElementById('equipe-ativo');

    if (nome) nome.value = '';
    if (cargo) cargo.value = '';
    if (turno) turno.value = '1';
    if (ativo) ativo.checked = true;
    App.campoInvalido(nome, false);

    if (id != null) {
      const op = this.operadoresCache.find((o) => o.id === id);
      if (op) {
        if (titulo) titulo.textContent = 'Editar Operador';
        if (nome) nome.value = op.nome || '';
        if (cargo) cargo.value = op.cargo || '';
        if (turno) turno.value = String(Number(op.turno_padrao) || 1);
        if (ativo) ativo.checked = !!op.ativo;
        if (statusWrap) statusWrap.classList.remove('hidden');
      }
    } else {
      if (titulo) titulo.textContent = 'Adicionar Operador';
      if (statusWrap) statusWrap.classList.add('hidden');
    }

    document.getElementById('modal-equipe')?.classList.remove('hidden');
    setTimeout(() => nome?.focus(), 50);
  },

  // Salvar (criar ou atualizar)
  async salvar() {
    const nome = document.getElementById('equipe-nome').value.trim();
    const cargo = document.getElementById('equipe-cargo').value.trim();
    const turno = document.getElementById('equipe-turno').value;
    const ativo = document.getElementById('equipe-ativo').checked;

    if (!nome) {
      App.mostrarToast('Informe o nome do operador.', 'erro');
      App.campoInvalido(document.getElementById('equipe-nome'), true);
      return;
    }

    try {
      const btn = document.querySelector('#form-equipe button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
      }

      if (this.editandoId != null) {
        await API.operadores.atualizar(this.editandoId, {
          nome,
          cargo: cargo || 'Operador de Produção',
          turno_padrao: Number(turno),
          ativo: ativo ? 1 : 0
        });
        App.mostrarToast('✅ Operador atualizado com sucesso!', 'sucesso');
      } else {
        await API.operadores.criar({
          nome,
          cargo: cargo || 'Operador de Produção',
          turno_padrao: Number(turno)
        });
        App.mostrarToast(`✅ Operador "${nome}" cadastrado com sucesso!`, 'sucesso');
      }

      document.getElementById('modal-equipe')?.classList.add('hidden');

      // Recarrega a aba Equipe e as listas que dependem de operadores
      await this.carregarEquipe();
      if (typeof OperatorModule !== 'undefined') await OperatorModule.carregarListas();
      if (typeof HistoryModule !== 'undefined') HistoryModule.carregarFiltrosSelects();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao salvar operador.', 'erro');
    } finally {
      const btn = document.querySelector('#form-equipe button[type="submit"]');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salvar';
      }
    }
  },

  // Ativar / Desativar
  async alterarStatus(id, ativar) {
    try {
      await API.operadores.status(id, ativar ? 1 : 0);
      App.mostrarToast(ativar ? 'Operador ativado.' : 'Operador desativado.', 'sucesso');
      await this.carregarEquipe();
    } catch (error) {
      App.mostrarToast('Erro ao alterar status do operador.', 'erro');
    }
  },

  // Excluir
  async excluir(id) {
    const op = this.operadoresCache.find((o) => o.id === id);
    const ok = await App.confirmar({
      titulo: 'Excluir Operador',
      mensagem: `Deseja realmente excluir "${op ? op.nome : 'este operador'}"? Se houver produção registrada, ele será apenas desativado para preservar o histórico.`,
      textoConfirmar: 'Excluir',
      tipo: 'perigo'
    });
    if (!ok) return;

    try {
      const res = await API.operadores.excluir(id);
      App.mostrarToast(res.message || 'Operador excluído.', 'sucesso');
      await this.carregarEquipe();
    } catch (error) {
      App.mostrarToast('Erro ao excluir operador.', 'erro');
    }
  }
};
