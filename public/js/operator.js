// Módulo do Operador (Chão de Fábrica) - Gráfica EPA
const OperatorModule = {
  selectedMaterialId: null,
  selectedMaterialUnit: 'un',
  turnosCache: [],
  operadoresCache: [],
  materiaisCache: [],

  // Quantos materiais aparecem como atalhos visuais no grid do Lançamento Rápido.
  // Os demais ficam acessíveis pela busca/rolagem do grid.
  MAX_GRID_MATERIAIS: 4,
  _relogioInterval: null,
  // Marca se o admin editou manualmente data/hora no Lançamento Rápido
  _editouDataHora: false,

  // Inicializar tela do operador
  async init() {
    this.setupDateAndTime();
    this.iniciarRelogio();
    await this.carregarListas();
    this.detectarTurnoAtual();
    this.setupEventListeners();
    await this.carregarPedidosRecentes();
  },

  // Relógio em tempo real (igual ao da barra superior do sistema)
  iniciarRelogio() {
    const clockElem = document.getElementById('op-relogio');
    const dataElem = document.getElementById('op-data-label');
    const badgeTurno = document.getElementById('op-badge-turno');

    const atualizar = () => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');

      if (clockElem) {
        clockElem.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      }

      if (dataElem) {
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        dataElem.textContent = `${diasSemana[now.getDay()]}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      }

      if (badgeTurno) {
        const hora = now.getHours();
        if (hora >= 6 && hora < 14) {
          badgeTurno.textContent = '☀️ 1º Turno (06h-14h)';
          badgeTurno.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300';
        } else if (hora >= 14 && hora < 22) {
          badgeTurno.textContent = '⛅ 2º Turno (14h-22h)';
          badgeTurno.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300';
        } else {
          badgeTurno.textContent = '🌙 3º Turno (22h-06h)';
          badgeTurno.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300';
        }
      }
    };

    atualizar();
    if (this._relogioInterval) clearInterval(this._relogioInterval);
    this._relogioInterval = setInterval(atualizar, 1000);
  },


  // Configurar data e hora atual (sempre preenche via JS, mesmo em campos desabilitados)
  setupDateAndTime() {
    const dataInput = document.getElementById('op-data');
    const horaInput = document.getElementById('op-hora');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    if (dataInput) {
      // Data local (evita o deslocamento de fuso do toISOString/UTC)
      dataInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }
    if (horaInput) {
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

  // Renderizar botões visuais de materiais (atalhos) + lista completa (select)
  renderizarGridMateriais(materiais) {
    const container = document.getElementById('op-materiais-grid');
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

    if (container) {
      container.innerHTML = '';

      // Aplica o filtro de busca (se houver). Sem busca, mostra só os atalhos.
      const termo = (document.getElementById('op-material-busca')?.value || '').trim().toLowerCase();
      let lista = materiais;
      if (termo) {
        lista = materiais.filter((m) => m.nome.toLowerCase().includes(termo));
      } else {
        lista = materiais.slice(0, this.MAX_GRID_MATERIAIS);
      }

      // Mostra/esconde o aviso de "nenhum resultado"
      const vazio = document.getElementById('op-material-vazio');
      if (vazio) {
        if (lista.length === 0) {
          vazio.classList.remove('hidden');
        } else {
          vazio.classList.add('hidden');
        }
      }

      lista.forEach((mat, idx) => {
        const icon = iconMap[mat.icone] || '🖨️';
        const btn = document.createElement('div');
        btn.className = `btn-material bg-white border-2 border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-sm hover:border-blue-400 hover:shadow-md ${idx === 0 && !termo ? 'selected' : ''}`;
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

        // Pré-selecionar o primeiro material (apenas quando não há busca ativa)
        if (idx === 0 && !termo) {
          this.selecionarMaterial(mat.id, mat.unidade);
        }
      });
    }
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

  // Configura a busca de materiais, o botão de cadastro (topo) e o cadastro rápido
  setupMaterialLivre() {
    // Botão do topo: abre/fecha o formulário de cadastro rápido
    const btnAdd = document.getElementById('op-material-add-btn');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const form = document.getElementById('op-material-novo-form');
        if (form) {
          form.classList.toggle('hidden');
          if (!form.classList.contains('hidden')) {
            document.getElementById('op-material-novo-nome')?.focus();
          }
        }
      });
    }

    // Campo de busca: re-renderiza o grid conforme o usuário digita
    const busca = document.getElementById('op-material-busca');
    if (busca) {
      busca.addEventListener('input', () => {
        this.renderizarGridMateriais(this.materiaisCache);
      });
    }

    // Botão salvar do cadastro rápido
    document.getElementById('op-material-novo-salvar')?.addEventListener('click', () => {
      this.cadastrarMaterialRapido();
    });

    // Botão cancelar do cadastro rápido
    document.getElementById('op-material-novo-cancelar')?.addEventListener('click', () => {
      document.getElementById('op-material-novo-form')?.classList.add('hidden');
      const nome = document.getElementById('op-material-novo-nome');
      const unid = document.getElementById('op-material-novo-unidade');
      if (nome) nome.value = '';
      if (unid) unid.value = '';
    });

    // Enter nos campos do cadastro rápido salva
    ['op-material-novo-nome', 'op-material-novo-unidade'].forEach((id) => {
      document.getElementById(id)?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.cadastrarMaterialRapido();
        }
      });
    });
  },

  // Cadastra um novo tipo de material direto na tela do operador e já o seleciona
  async cadastrarMaterialRapido() {
    const nomeInput = document.getElementById('op-material-novo-nome');
    const unidadeInput = document.getElementById('op-material-novo-unidade');
    const nome = nomeInput ? nomeInput.value.trim() : '';
    const unidade = unidadeInput ? unidadeInput.value.trim() : '';

    if (!nome) {
      App.mostrarToast('Informe o nome do novo material.', 'erro');
      App.campoInvalido(nomeInput, true);
      return;
    }
    if (!unidade) {
      App.mostrarToast('Informe a unidade do material (ex: m², un, Milheiros).', 'erro');
      App.campoInvalido(unidadeInput, true);
      return;
    }
    App.campoInvalido(nomeInput, false);
    App.campoInvalido(unidadeInput, false);

    try {
      const btn = document.getElementById('op-material-novo-salvar');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
      }

      const res = await API.materiais.criar({ nome, unidade, categoria: 'Geral' });
      const novo = res.material;

      App.mostrarToast(`✅ Material "${novo.nome}" cadastrado e selecionado!`, 'sucesso');

      // Atualiza o cache, limpa a busca e re-renderiza o grid (o novo entra nos atalhos)
      this.materiaisCache.push(novo);
      const busca = document.getElementById('op-material-busca');
      if (busca) busca.value = '';
      this.renderizarGridMateriais(this.materiaisCache);

      // Fecha o formulário, limpa os campos e seleciona o material recém-criado
      document.getElementById('op-material-novo-form')?.classList.add('hidden');
      if (nomeInput) nomeInput.value = '';
      if (unidadeInput) unidadeInput.value = '';
      this.selecionarMaterial(novo.id, novo.unidade);
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao cadastrar material.', 'erro');
    } finally {
      const btn = document.getElementById('op-material-novo-salvar');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salvar e Usar';
      }
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
    // Busca de materiais, botão de cadastro (topo) e cadastro rápido de novo tipo
    this.setupMaterialLivre();

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

    // Marca edição manual de data/hora (relevante para o administrador)
    ['op-data', 'op-hora'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        // Só considera "edição manual" se o campo estiver habilitado (admin)
        if (!el.disabled) {
          this._editouDataHora = true;
        }
      });
    });
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
    // Captura a data/hora atual apenas se o admin NÃO editou manualmente
    if (!this._editouDataHora) {
      this.setupDateAndTime();
    }

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
      // Volta ao auto-preenchimento de data/hora para o próximo lançamento
      this._editouDataHora = false;

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
          prioridadeBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">🔴 Urgente</span>';
        } else if (ped.prioridade === 'ALTA') {
          prioridadeBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">🟡 Alta</span>';
        }

        // Status do pedido
        let statusBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">Em Produção</span>';
        if (ped.status === 'CANCELADO') {
          statusBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">Cancelado</span>';
        } else if (ped.concluido_em) {
          statusBadge = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Concluído</span>';
        }

        html += `
          <div class="p-3.5 bg-white border border-[#DDE3EC] rounded-xl shadow-sm hover:border-[#3158D8] transition-all">
            <div class="flex items-center justify-between mb-1.5">
              <span class="font-black text-blue-700 text-sm">${ped.numero_os}</span>
              <div class="flex items-center space-x-1">
                ${statusBadge}
                ${prioridadeBadge}
              </div>
            </div>
            <div class="text-xs text-slate-600 font-semibold">${ped.cliente_nome}</div>
            <div class="text-xs text-slate-500 mt-0.5">${ped.servico_nome} • ${ped.quantidade} ${ped.unidade}</div>
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">${ped.etapa_nome}</span>
              <span class="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <span class="leading-none">📅</span>
                <span>Entrega: ${dataFormatada}</span>
              </span>
            </div>
            <div class="flex items-center justify-end gap-2 mt-2">
              <button onclick="KanbanModule.abrirDetalhes(${ped.id})" class="px-3 py-1.5 bg-white border border-[#D0D5DD] text-[#344054] hover:border-[#3158D8] hover:text-[#3158D8] rounded-lg text-xs font-bold transition">
                Visualizar
              </button>
              <button onclick="KanbanModule.imprimirPedido(${ped.id})" class="px-3 py-1.5 bg-[#3158D8] hover:bg-[#2446B8] text-white rounded-lg text-xs font-bold transition">
                Imprimir
              </button>
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
    const ok = await App.confirmar({
      titulo: 'Excluir Lançamento',
      mensagem: 'Deseja realmente excluir este lançamento de produção? Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      tipo: 'perigo'
    });
    if (!ok) return;
    try {
      await API.producao.excluir(id);
      App.mostrarToast('Lançamento excluído com sucesso.', 'sucesso');
      await this.carregarPedidosRecentes();
    } catch (error) {
      App.mostrarToast('Erro ao excluir lançamento.', 'erro');
    }
  }
};