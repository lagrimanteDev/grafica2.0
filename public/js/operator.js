// Módulo do Operador (Chão de Fábrica) - Gráfica EPA
const OperatorModule = {
  selectedMaterialId: null,
  selectedMaterialUnit: 'un',
  turnosCache: [],
  operadoresCache: [],
  materiaisCache: [],

  // Inicializar tela do operador
  async init() {
    this.setupDateAndTime();
    await this.carregarListas();
    this.detectarTurnoAtual();
    this.setupEventListeners();
    await this.carregarPedidosRecentes();
  },

  // Configurar data e hora atual
  setupDateAndTime() {
    const dataInput = document.getElementById('op-data');
    const horaInput = document.getElementById('op-hora');
    const now = new Date();

    if (dataInput) {
      dataInput.value = now.toISOString().slice(0, 10);
    }
    if (horaInput) {
      const pad = (n) => String(n).padStart(2, '0');
      horaInput.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
  },

  // Detectar automaticamente o turno pelo horário atual
  detectarTurnoAtual() {
    const now = new Date();
    const hora = now.getHours();
    let turnoId = 1; // Padrão Manhã (06h às 14h)

    if (hora >= 14 && hora < 22) {
      turnoId = 2; // Tarde (14h às 22h)
    } else if (hora >= 22 || hora < 6) {
      turnoId = 3; // Noite (22h às 06h)
    }

    this.selecionarTurno(turnoId);
  },

  // Selecionar turno no formulário
  selecionarTurno(turnoId) {
    const buttons = document.querySelectorAll('.btn-turno-select');
    buttons.forEach((btn) => {
      if (Number(btn.dataset.turnoId) === Number(turnoId)) {
        btn.classList.add('ring-4', 'ring-blue-500', 'border-blue-600', 'bg-blue-50');
      } else {
        btn.classList.remove('ring-4', 'ring-blue-500', 'border-blue-600', 'bg-blue-50');
      }
    });

    const hiddenTurnoInput = document.getElementById('op-turno-id');
    if (hiddenTurnoInput) {
      hiddenTurnoInput.value = turnoId;
    }

    // Auto-sugerir operador do turno se não selecionado
    const opSelect = document.getElementById('op-operador-id');
    if (opSelect && (!opSelect.value || opSelect.value === '')) {
      const opPadrao = this.operadoresCache.find((o) => o.turno_padrao === Number(turnoId));
      if (opPadrao) {
        opSelect.value = opPadrao.id;
      }
    }
  },

  // Carregar listas auxiliares do banco
  async carregarListas() {
    try {
      const [turnos, operadores, materiais] = await Promise.all([
        API.operadores.listarTurnos(),
        API.operadores.listar(),
        API.materiais.listar()
      ]);

      this.turnosCache = turnos;
      this.operadoresCache = operadores;
      this.materiaisCache = materiais;

      // Renderizar Operadores no Select
      const opSelect = document.getElementById('op-operador-id');
      if (opSelect) {
        opSelect.innerHTML = '<option value="">Selecione o operador...</option>';
        operadores.forEach((op) => {
          opSelect.innerHTML += `<option value="${op.id}">${op.nome} (${op.cargo})</option>`;
        });
        // Carlos Henrique como padrão se disponível
        const carlos = operadores.find((o) => o.nome.includes('Carlos Henrique'));
        if (carlos) {
          opSelect.value = carlos.id;
        }
      }

      // Renderizar Grid de Materiais
      this.renderizarGridMateriais(materiais);
    } catch (error) {
      console.error('Erro ao carregar listas do operador:', error);
      App.mostrarToast('Erro ao carregar dados do sistema.', 'erro');
    }
  },

  // Renderizar botões visuais de materiais
  renderizarGridMateriais(materiais) {
    const container = document.getElementById('op-materiais-grid');
    if (!container) return;

    container.innerHTML = '';
    const iconMap = {
      image: '🖼️',
      'file-text': '📄',
      'credit-card': '💳',
      tag: '🏷️',
      'book-open': '📑',
      mail: '✉️',
      flag: '🚩',
      layers: '📦',
      printer: '🖨️'
    };

    materiais.forEach((mat, idx) => {
      const icon = iconMap[mat.icone] || '🖨️';
      const btn = document.createElement('div');
      btn.className = `btn-material bg-white border-2 border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-sm hover:border-blue-400 hover:shadow-md ${idx === 0 ? 'selected' : ''}`;
      btn.dataset.materialId = mat.id;
      btn.dataset.unidade = mat.unidade;
      btn.innerHTML = `
        <span class="text-3xl mb-1">${icon}</span>
        <span class="font-bold text-slate-800 text-sm leading-tight">${mat.nome}</span>
        <span class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1">Unid: ${mat.unidade}</span>
      `;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-material').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selecionarMaterial(mat.id, mat.unidade);
      });

      container.appendChild(btn);

      // Pré-selecionar o primeiro material
      if (idx === 0) {
        this.selecionarMaterial(mat.id, mat.unidade);
      }
    });
  },

  // Selecionar material
  selecionarMaterial(materialId, unidade) {
    this.selectedMaterialId = materialId;
    this.selectedMaterialUnit = unidade;

    // Remover destaque de material não selecionado
    App.campoInvalido(document.getElementById('op-materiais-grid'), false);

    const unidadeBadge = document.getElementById('op-unidade-badge');
    if (unidadeBadge) {
      unidadeBadge.textContent = unidade;
    }

    const inputQtd = document.getElementById('op-quantidade');
    if (inputQtd) {
      inputQtd.focus();
    }
  },

  // Ajustar quantidade (+10, +50, +100, +500)
  incrementarQuantidade(valor) {
    const input = document.getElementById('op-quantidade');
    if (!input) return;
    const atual = parseFloat(input.value) || 0;
    input.value = Math.max(0, atual + valor);
  },

  // Configurar Event Listeners
  setupEventListeners() {
    // Botões de turno
    document.querySelectorAll('.btn-turno-select').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selecionarTurno(btn.dataset.turnoId);
      });
    });

    // Botões de incremento rápido
    document.querySelectorAll('.btn-incremento').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.incremento, 10);
        this.incrementarQuantidade(val);
      });
    });

    // Tags de ocorrência rápida
    document.querySelectorAll('.btn-tag-ocorrencia').forEach((tag) => {
      tag.addEventListener('click', () => {
        const obsInput = document.getElementById('op-observacoes');
        const tipoInput = document.getElementById('op-tipo-ocorrencia');
        const texto = tag.dataset.texto;
        const tipo = tag.dataset.tipo || 'NORMAL';

        if (obsInput) {
          obsInput.value = obsInput.value ? `${obsInput.value} | ${texto}` : texto;
        }
        if (tipoInput) {
          tipoInput.value = tipo;
        }
        App.mostrarToast(`Ocorrência aplicada: "${texto}"`, 'info');
      });
    });

    // Submissão do formulário
    const form = document.getElementById('form-operador-producao');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.salvarLancamento();
      });
    }

    // Atalho de teclado Enter na quantidade
    const inputQtd = document.getElementById('op-quantidade');
    if (inputQtd) {
      inputQtd.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.salvarLancamento();
        }
      });

      // Impedir que scroll do mouse altere o valor (campo texto)
      inputQtd.addEventListener('wheel', (e) => {
        e.preventDefault();
      });

      // Remover o destaque vermelho assim que a quantidade for corrigida
      inputQtd.addEventListener('input', () => {
        const valido = !!(inputQtd.value && parseFloat(inputQtd.value) > 0);
        App.campoInvalido(inputQtd, !valido);
      });
    }

    // Limpar destaque dos demais campos obrigatórios assim que forem corrigidos
    const limparCampoOperador = (idElemento) => {
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
    ['op-operador-id', 'op-data', 'op-hora'].forEach(limparCampoOperador);
  },

  // Tocar sinal sonoro suave de confirmação (Web Audio API)
  tocarSinalSucesso() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      // Ignora se o navegador bloquear autoplay de áudio
    }
  },

  // Salvar Lançamento
  async salvarLancamento() {
    const turnoId = document.getElementById('op-turno-id').value;
    const operadorId = document.getElementById('op-operador-id').value;
    const materialId = this.selectedMaterialId;
    const quantidade = document.getElementById('op-quantidade').value;
    const observacoes = document.getElementById('op-observacoes').value;
    const tipoOcorrencia = document.getElementById('op-tipo-ocorrencia').value || 'NORMAL';
    const data = document.getElementById('op-data').value;
    const hora = document.getElementById('op-hora').value;

    if (!turnoId) {
      App.mostrarToast('Por favor, selecione o turno.', 'erro');
      return;
    }
    if (!operadorId) {
      App.mostrarToast('Por favor, selecione o operador responsável.', 'erro');
      App.campoInvalido(document.getElementById('op-operador-id'), true);
      return;
    }
    if (!materialId) {
      App.mostrarToast('Por favor, selecione o tipo de material produzido.', 'erro');
      App.campoInvalido(document.getElementById('op-materiais-grid'), true);
      return;
    }
    if (!quantidade || parseFloat(quantidade) <= 0) {
      App.mostrarToast('Informe uma quantidade válida maior que zero.', 'erro');
      App.campoInvalido(document.getElementById('op-quantidade'), true);
      return;
    }
    if (!data) {
      App.mostrarToast('Selecione a data do lançamento.', 'erro');
      App.campoInvalido(document.getElementById('op-data'), true);
      return;
    }
    if (!hora) {
      App.mostrarToast('Selecione a hora do lançamento.', 'erro');
      App.campoInvalido(document.getElementById('op-hora'), true);
      return;
    }

    try {
      const btnSubmit = document.getElementById('btn-op-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = 'Gravando produção...';
      }

      const res = await API.producao.salvar({
        data,
        hora,
        turno_id: turnoId,
        operador_id: operadorId,
        material_id: materialId,
        quantidade: parseFloat(quantidade),
        unidade: this.selectedMaterialUnit,
        observacoes,
        tipo_ocorrencia: tipoOcorrencia
      });

      this.tocarSinalSucesso();
      App.mostrarToast(`✅ Produção de ${quantidade} ${this.selectedMaterialUnit} registrada com sucesso!`, 'sucesso');

      // Limpar campos de entrada mantendo operador e turno
      ['op-quantidade', 'op-observacoes', 'op-tipo-ocorrencia', 'op-operador-id', 'op-data', 'op-hora'].forEach((id) => {
        App.campoInvalido(document.getElementById(id), false);
      });
      App.campoInvalido(document.getElementById('op-materiais-grid'), false);
      document.getElementById('op-quantidade').value = '';
      document.getElementById('op-observacoes').value = '';
      document.getElementById('op-tipo-ocorrencia').value = 'NORMAL';
      this.setupDateAndTime();

      // Atualizar lista de pedidos recentes
      await this.carregarPedidosRecentes();

      // Focar no campo de quantidade para o próximo registro
      document.getElementById('op-quantidade').focus();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao registrar produção.', 'erro');
    } finally {
      const btnSubmit = document.getElementById('btn-op-submit');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `
          <span class="text-2xl mr-2">✅</span>
          <span class="font-bold text-lg">REGISTRAR PRODUÇÃO</span>
          <span class="text-xs bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded ml-2 hidden sm:inline">Enter</span>
        `;
      }
    }
  },

  // Carregar pedidos recentes na tela do operador
  async carregarPedidosRecentes() {
    const container = document.getElementById('op-pedidos-recentes');
    if (!container) return;

    try {
      const res = await API.pedidos.listar({ limit: 8, status: 'ATIVO' });
      const pedidos = res.dados || [];

      if (pedidos.length === 0) {
        container.innerHTML = `
          <div class="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p class="text-3xl mb-1">📦</p>
            <p class="font-medium text-slate-600">Nenhum pedido em produção.</p>
            <p class="text-xs text-slate-400 mt-1">Os pedidos ativos aparecerão aqui.</p>
          </div>
        `;
        return;
      }

      let html = '<div class="space-y-3">';
      pedidos.forEach((ped) => {
        const [ano, mes, dia] = (ped.data_prometida || '').split('-');
        const dataFormatada = ped.data_prometida ? `${dia}/${mes}` : 'Sem data';

        let prioridadeBadge = '';
        if (ped.prioridade === 'URGENTE') {
          prioridadeBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">🔴 Urgente</span>';
        } else if (ped.prioridade === 'ALTA') {
          prioridadeBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">🟡 Alta</span>';
        }

        html += `
          <div class="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 transition-all">
            <div class="flex items-center justify-between mb-1.5">
              <span class="font-black text-blue-700 text-sm">${ped.numero_os}</span>
              <div class="flex items-center space-x-1">
                ${prioridadeBadge}
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${ped.etapa_nome}</span>
              </div>
            </div>
            <div class="text-xs text-slate-600 font-semibold">${ped.cliente_nome}</div>
            <div class="text-xs text-slate-500 mt-0.5">${ped.servico_nome} • ${ped.quantidade} ${ped.unidade}</div>
            <div class="flex items-center justify-between mt-2">
              <span class="text-[10px] text-slate-400">📅 Entrega: ${dataFormatada}</span>
              <div class="flex items-center space-x-1">
                <button onclick="KanbanModule.abrirDetalhes(${ped.id})" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Ver detalhes">
                  👁️
                </button>
                <button onclick="KanbanModule.abrirEtiqueta(${ped.id})" class="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition" title="Etiqueta de Produção">
                  🏷️
                </button>
              </div>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (error) {
      console.error('Erro ao carregar pedidos recentes:', error);
    }
  },

  // Abrir Modal de Correção Rápida
  async abrirModalCorrecao(id) {
    try {
      const reg = await API.producao.obter(id);
      if (!reg) return;

      document.getElementById('edit-id').value = reg.id;
      document.getElementById('edit-data').value = reg.data;
      document.getElementById('edit-hora').value = reg.hora;
      document.getElementById('edit-turno-id').value = reg.turno_id;
      document.getElementById('edit-operador-id').value = reg.operador_id;
      document.getElementById('edit-material-id').value = reg.material_id;
      document.getElementById('edit-quantidade').value = reg.quantidade;
      App.campoInvalido(document.getElementById('edit-quantidade'), false);
      document.getElementById('edit-unidade').value = reg.unidade;
      document.getElementById('edit-observacoes').value = reg.observacoes || '';
      document.getElementById('edit-tipo-ocorrencia').value = reg.tipo_ocorrencia || 'NORMAL';

      // Limpar destaques de campos inválidos ao reabrir o modal
      ['edit-data', 'edit-hora', 'edit-turno-id', 'edit-operador-id', 'edit-material-id'].forEach((id) => {
        App.campoInvalido(document.getElementById(id), false);
      });

      document.getElementById('modal-edicao').classList.remove('hidden');
    } catch (error) {
      App.mostrarToast('Erro ao carregar dados para correção.', 'erro');
    }
  },

  // Excluir Lançamento
  async excluirLancamento(id) {
    if (!confirm('Deseja realmente excluir este lançamento de produção?')) {
      return;
    }
    try {
      await API.producao.excluir(id);
      App.mostrarToast('Lançamento excluído com sucesso.', 'sucesso');
      await this.carregarPedidosRecentes();
    } catch (error) {
      App.mostrarToast('Erro ao excluir lançamento.', 'erro');
    }
  }
};