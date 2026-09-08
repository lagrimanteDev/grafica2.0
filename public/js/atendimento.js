// Módulo de Atendimento & Entrada de Pedidos - Gráfica EPA
const AtendimentoModule = {
  servicosCache: [],
  acabamentosCache: [],
  clientesCache: [],

  async init() {
    await this.carregarListas();
    this.setupEventListeners();
    await this.carregarUltimosPedidos();
  },

  // Carregar listas auxiliares
  async carregarListas() {
    try {
      const [servicos, acabamentos, clientes] = await Promise.all([
        API.servicos.listar(),
        API.acabamentos.listar(),
        API.clientes.listar()
      ]);

      this.servicosCache = servicos;
      this.acabamentosCache = acabamentos;
      this.clientesCache = clientes;

      // Renderizar serviços
      const servSelect = document.getElementById('ped-servico-id');
      if (servSelect) {
        servSelect.innerHTML = '<option value="">Selecione o serviço...</option>';
        servicos.forEach((s) => {
          servSelect.innerHTML += `<option value="${s.id}" data-unidade="${s.unidade}">${s.nome}</option>`;
        });
      }

      // Renderizar acabamentos
      const acabSelect = document.getElementById('ped-acabamento-id');
      if (acabSelect) {
        acabSelect.innerHTML = '<option value="">Nenhum</option>';
        acabamentos.forEach((a) => {
          acabSelect.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
        });
      }

      // Renderizar clientes existentes
      const clienteSelect = document.getElementById('ped-cliente-existente');
      if (clienteSelect) {
        clienteSelect.innerHTML = '<option value="">-- Novo Cliente --</option>';
        clientes.forEach((c) => {
          clienteSelect.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
        });
      }

      // Definir data prometida padrão (hoje + 3 dias)
      const dataPrometida = document.getElementById('ped-data-prometida');
      if (dataPrometida) {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        dataPrometida.value = d.toISOString().slice(0, 10);
      }
    } catch (error) {
      console.error('Erro ao carregar listas do atendimento:', error);
      App.mostrarToast('Erro ao carregar dados do atendimento.', 'erro');
    }
  },

  // Configurar Event Listeners
  setupEventListeners() {
    // Seleção de serviço atualiza unidade
    const servSelect = document.getElementById('ped-servico-id');
    if (servSelect) {
      servSelect.addEventListener('change', () => {
        const unidadeBadge = document.getElementById('ped-unidade-badge');
        const selected = servSelect.options[servSelect.selectedIndex];
        if (unidadeBadge && selected) {
          unidadeBadge.textContent = selected.dataset.unidade || 'un';
        }
      });
    }

    // Seleção de cliente existente preenche dados
    const clienteSelect = document.getElementById('ped-cliente-existente');
    if (clienteSelect) {
      clienteSelect.addEventListener('change', () => {
        const clienteId = clienteSelect.value;
        if (!clienteId) {
          document.getElementById('ped-cliente-nome').value = '';
          document.getElementById('ped-cliente-telefone').value = '';
          document.getElementById('ped-cliente-email').value = '';
          document.getElementById('ped-cliente-whatsapp').checked = true;
          return;
        }

        const cliente = this.clientesCache.find((c) => c.id === Number(clienteId));
        if (cliente) {
          document.getElementById('ped-cliente-nome').value = cliente.nome;
          document.getElementById('ped-cliente-telefone').value = cliente.telefone || '';
          document.getElementById('ped-cliente-email').value = cliente.email || '';
          document.getElementById('ped-cliente-whatsapp').checked = cliente.whatsapp === 1;
        }
      });
    }

    // Campo de quantidade: tirar o destaque vermelho assim que for corrigido
    const inputQtdPed = document.getElementById('ped-quantidade');
    if (inputQtdPed) {
      inputQtdPed.addEventListener('input', () => {
        const valido = !!(inputQtdPed.value && parseFloat(inputQtdPed.value) > 0);
        App.campoInvalido(inputQtdPed, !valido);
      });
    }

    // Limpar destaque dos demais campos obrigatórios assim que forem corrigidos
    const limparCampoPedido = (idElemento) => {
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
    ['ped-cliente-nome', 'ped-servico-id', 'ped-data-prometida'].forEach(limparCampoPedido);

    // Valor total e dimensões: não podem ser negativas
    const avaliarCampoNumeroPedido = (idElemento) => {
      const el = document.getElementById(idElemento);
      if (!el) return;
      el.addEventListener('input', () => {
        const valor = el.value.trim();
        const numero = Number(valor.replace(',', '.'));
        const valido = valor === '' || (!isNaN(numero) && numero >= 0);
        App.campoInvalido(el, !valido);
      });
    };
    ['ped-valor-total', 'ped-dimensao-largura', 'ped-dimensao-altura'].forEach(avaliarCampoNumeroPedido);

    // Material: mínimo de 3 caracteres (quando preenchido)
    const inputMaterialPedido = document.getElementById('ped-material');
    if (inputMaterialPedido) {
      inputMaterialPedido.addEventListener('input', () => {
        const texto = inputMaterialPedido.value.trim();
        const valido = texto === '' || texto.length >= 3;
        App.campoInvalido(inputMaterialPedido, !valido);
      });
    }

    // Submissão do formulário
    const form = document.getElementById('form-novo-pedido');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.salvarPedido();
      });
    }
  },

  // Salvar novo pedido
  async salvarPedido() {
    const clienteId = document.getElementById('ped-cliente-existente').value;
    const clienteNome = document.getElementById('ped-cliente-nome').value;
    const clienteTelefone = document.getElementById('ped-cliente-telefone').value;
    const clienteEmail = document.getElementById('ped-cliente-email').value;
    const clienteWhatsapp = document.getElementById('ped-cliente-whatsapp').checked;
    const servicoId = document.getElementById('ped-servico-id').value;
    const quantidade = document.getElementById('ped-quantidade').value;
    const dimensaoLargura = document.getElementById('ped-dimensao-largura').value;
    const dimensaoAltura = document.getElementById('ped-dimensao-altura').value;
    const material = document.getElementById('ped-material').value;
    const acabamentoId = document.getElementById('ped-acabamento-id').value;
    const observacoes = document.getElementById('ped-observacoes').value;
    const dataPrometida = document.getElementById('ped-data-prometida').value;
    const horaPrometida = document.getElementById('ped-hora-prometida').value;
    const valorTotal = document.getElementById('ped-valor-total').value;
    const condicaoPagamento = document.getElementById('ped-condicao-pagamento').value;
    const statusPagamento = document.getElementById('ped-status-pagamento').value;
    const prioridade = document.getElementById('ped-prioridade').value;
    const arquivoArte = document.getElementById('ped-arquivo-arte').files[0];
    const usuarioId = document.getElementById('ped-usuario-id').value;
    const usuarioNome = document.getElementById('ped-usuario-nome').value;

    // Validações
    if (!clienteNome) {
      App.mostrarToast('Informe o nome do cliente.', 'erro');
      App.campoInvalido(document.getElementById('ped-cliente-nome'), true);
      return;
    }
    if (!servicoId) {
      App.mostrarToast('Selecione o tipo de produto/serviço.', 'erro');
      App.campoInvalido(document.getElementById('ped-servico-id'), true);
      return;
    }
    if (!quantidade || parseFloat(quantidade) <= 0) {
      App.mostrarToast('Informe uma quantidade válida.', 'erro');
      App.campoInvalido(document.getElementById('ped-quantidade'), true);
      return;
    }
    if (!dataPrometida) {
      App.mostrarToast('Informe a data prometida de entrega.', 'erro');
      App.campoInvalido(document.getElementById('ped-data-prometida'), true);
      return;
    }

    // Material com mínimo de 3 caracteres (quando preenchido)
    if (material && material.trim().length < 3) {
      App.mostrarToast('O material deve ter pelo menos 3 caracteres.', 'erro');
      App.campoInvalido(document.getElementById('ped-material'), true);
      return;
    }

    // Valor total não pode ser negativo
    const valorTotalNumero = valorTotal ? Number(String(valorTotal).replace(',', '.')) : 0;
    if (isNaN(valorTotalNumero) || valorTotalNumero < 0) {
      App.mostrarToast('O valor total não pode ser negativo.', 'erro');
      App.campoInvalido(document.getElementById('ped-valor-total'), true);
      return;
    }

    // Dimensões não podem ser negativas
    const larguraNumero = dimensaoLargura ? Number(String(dimensaoLargura).replace(',', '.')) : 0;
    const alturaNumero = dimensaoAltura ? Number(String(dimensaoAltura).replace(',', '.')) : 0;
    if (dimensaoLargura && (isNaN(larguraNumero) || larguraNumero < 0)) {
      App.mostrarToast('As dimensões não podem ser negativas.', 'erro');
      App.campoInvalido(document.getElementById('ped-dimensao-largura'), true);
      return;
    }
    if (dimensaoAltura && (isNaN(alturaNumero) || alturaNumero < 0)) {
      App.mostrarToast('As dimensões não podem ser negativas.', 'erro');
      App.campoInvalido(document.getElementById('ped-dimensao-altura'), true);
      return;
    }

    try {
      const btnSubmit = document.getElementById('btn-ped-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = 'Gerando OS...';
      }

      // Montar FormData para upload de arquivo
      const formData = new FormData();
      formData.append('cliente_id', clienteId || '');
      formData.append('cliente_nome', clienteNome);
      formData.append('cliente_telefone', clienteTelefone);
      formData.append('cliente_email', clienteEmail);
      formData.append('cliente_whatsapp', clienteWhatsapp);
      formData.append('servico_id', servicoId);
      formData.append('quantidade', quantidade);
      formData.append('unidade', document.getElementById('ped-unidade-badge').textContent);
      formData.append('dimensao_largura', dimensaoLargura || '');
      formData.append('dimensao_altura', dimensaoAltura || '');
      formData.append('material', material);
      formData.append('acabamento_id', acabamentoId || '');
      formData.append('observacoes_tecnicas', observacoes);
      formData.append('data_prometida', dataPrometida);
      formData.append('hora_prometida', horaPrometida);
      formData.append('valor_total', valorTotal || '0');
      formData.append('condicao_pagamento', condicaoPagamento);
      formData.append('status_pagamento', statusPagamento);
      formData.append('prioridade', prioridade);
      formData.append('usuario_id', usuarioId);
      formData.append('usuario_nome', usuarioNome);
      if (arquivoArte) {
        formData.append('arquivo_arte', arquivoArte);
      }

      const res = await API.pedidos.criar(formData);

      App.mostrarToast(`✅ Pedido ${res.pedido.numero_os} criado com sucesso!`, 'sucesso');

      // Limpar formulário
      document.getElementById('form-novo-pedido').reset();
      document.getElementById('ped-cliente-existente').value = '';
      document.getElementById('ped-unidade-badge').textContent = 'un';
      document.getElementById('ped-arquivo-arte').value = '';
      ['ped-cliente-nome', 'ped-servico-id', 'ped-quantidade', 'ped-data-prometida', 'ped-material', 'ped-valor-total', 'ped-dimensao-largura', 'ped-dimensao-altura'].forEach((id) => {
        App.campoInvalido(document.getElementById(id), false);
      });

      // Definir nova data prometida padrão
      const d = new Date();
      d.setDate(d.getDate() + 3);
      document.getElementById('ped-data-prometida').value = d.toISOString().slice(0, 10);

      // Atualizar lista de últimos pedidos
      await this.carregarUltimosPedidos();
      await this.carregarListas();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao criar pedido.', 'erro');
    } finally {
      const btnSubmit = document.getElementById('btn-ped-submit');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `
          <span class="text-2xl mr-2">📦</span>
          <span>GERAR ORDEM DE SERVIÇO</span>
        `;
      }
    }
  },

  // Carregar últimos pedidos
  async carregarUltimosPedidos() {
    const container = document.getElementById('atend-ultimos-pedidos');
    if (!container) return;

    try {
      const res = await API.pedidos.listar({ limit: 8 });
      const pedidos = res.dados || [];

      if (pedidos.length === 0) {
        container.innerHTML = `
          <div class="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p class="text-3xl mb-1">📦</p>
            <p class="font-medium text-slate-600">Nenhum pedido registrado ainda.</p>
            <p class="text-xs text-slate-400 mt-1">Os pedidos criados aparecerão aqui.</p>
          </div>
        `;
        return;
      }

      let html = '<div class="space-y-3">';
      pedidos.forEach((ped) => {
        const [ano, mes, dia] = (ped.data_prometida || '').split('-');
        const dataFormatada = ped.data_prometida ? `${dia}/${mes}/${ano}` : 'Sem data';

        let prioridadeBadge = '';
        if (ped.prioridade === 'URGENTE') {
          prioridadeBadge = '<span class="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">🔴 Urgente</span>';
        } else if (ped.prioridade === 'ALTA') {
          prioridadeBadge = '<span class="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">🟡 Alta</span>';
        }

        html += `
          <div class="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 transition-all">
            <div class="flex items-center justify-between mb-1.5">
              <span class="font-black text-blue-700 text-sm">${ped.numero_os}</span>
              <div class="flex items-center space-x-1">
                ${prioridadeBadge}
                <span class="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">${ped.etapa_nome}</span>
              </div>
            </div>
            <div class="text-xs text-slate-600 font-semibold">${ped.cliente_nome}</div>
            <div class="text-xs text-slate-500 mt-0.5">${ped.servico_nome} • ${ped.quantidade} ${ped.unidade}</div>
            <div class="flex items-center justify-between mt-2">
              <span class="text-[11px] text-slate-400">📅 Entrega: ${dataFormatada}</span>
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
      console.error('Erro ao carregar últimos pedidos:', error);
    }
  }
};