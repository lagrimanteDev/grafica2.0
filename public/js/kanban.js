// Módulo do Chão de Fábrica & Kanban - Gráfica EPA
const KanbanModule = {
  etapasCache: [],
  pedidosCache: [],
  etiquetaAtual: null,
  dragPedidoId: null,

  async init() {
    this.setupEventListeners();
    await this.carregarKanban();
  },

  setupEventListeners() {
    // Busca no Kanban
    const buscaInput = document.getElementById('kanban-busca');
    if (buscaInput) {
      buscaInput.addEventListener('input', () => {
        this.filtrarKanban(buscaInput.value);
      });
    }
  },

  // Carregar dados do Kanban
  async carregarKanban() {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    board.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
        <p>Carregando quadro de produção...</p>
      </div>
    `;

    try {
      const etapas = await API.pedidos.kanban();
      this.etapasCache = etapas;
      this.pedidosCache = etapas.flatMap((e) => e.pedidos || []);
      this.renderizarKanban(etapas);
    } catch (error) {
      console.error('Erro ao carregar Kanban:', error);
      board.innerHTML = `
        <div class="col-span-full py-12 text-center text-red-500 font-medium">
          Erro ao carregar o quadro Kanban. Verifique a conexão com o servidor.
        </div>
      `;
    }
  },

  // Renderizar quadro Kanban
  renderizarKanban(etapas) {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    board.innerHTML = '';

    etapas.forEach((etapa) => {
      const pedidos = etapa.pedidos || [];
      const coluna = document.createElement('div');
      coluna.className = 'bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col min-h-[300px]';
      coluna.dataset.etapaId = etapa.id;

      // Cabeçalho da coluna
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between mb-3 pb-2 border-b border-slate-200';
      header.innerHTML = `
        <div class="flex items-center space-x-2">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style="background-color: ${etapa.cor}">
            ${etapa.icone}
          </span>
          <div>
            <h3 class="font-extrabold text-slate-800 text-xs leading-tight">${etapa.nome}</h3>
            <span class="text-[10px] font-bold text-slate-400">${pedidos.length} pedido(s)</span>
          </div>
        </div>
      `;
      coluna.appendChild(header);

      // Área de cards
      const cardsArea = document.createElement('div');
      cardsArea.className = 'space-y-2 flex-1 overflow-y-auto max-h-[70vh] pr-1';
      cardsArea.dataset.dropZone = 'true';

      if (pedidos.length === 0) {
        cardsArea.innerHTML = `
          <div class="text-center py-6 text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
            <p class="text-2xl mb-1">📭</p>
            <p class="text-xs font-medium">Nenhum pedido</p>
          </div>
        `;
      } else {
        pedidos.forEach((ped) => {
          cardsArea.appendChild(this.criarCardPedido(ped));
        });
      }

      coluna.appendChild(cardsArea);
      board.appendChild(coluna);
    });

    this.setupDragAndDrop();
  },

  // Criar card de pedido
  criarCardPedido(ped) {
    const card = document.createElement('div');
    card.className = 'bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-grab select-none';
    card.dataset.pedidoId = ped.id;
    card.draggable = true;

    // Calcular prioridade visual
    const hoje = new Date();
    const dataPrometida = new Date(ped.data_prometida + 'T23:59:59');
    const diffDias = Math.ceil((dataPrometida - hoje) / (1000 * 60 * 60 * 24));

    let prioridadeClass = 'border-l-4 border-l-emerald-500';
    let prioridadeLabel = '';
    if (ped.prioridade === 'URGENTE' || diffDias < 0) {
      prioridadeClass = 'border-l-4 border-l-red-500';
      prioridadeLabel = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">🔴 Atrasado</span>';
    } else if (ped.prioridade === 'ALTA' || diffDias === 0) {
      prioridadeClass = 'border-l-4 border-l-amber-500';
      prioridadeLabel = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">🟡 Hoje</span>';
    }

    const [ano, mes, dia] = (ped.data_prometida || '').split('-');
    const dataFormatada = ped.data_prometida ? `${dia}/${mes}` : 'Sem data';

    card.innerHTML = `
      <div class="flex items-start justify-between mb-1.5 ${prioridadeClass} -m-3 p-3 rounded-t-xl">
        <div>
          <div class="font-black text-blue-700 text-xs">${ped.numero_os}</div>
          <div class="text-xs font-bold text-slate-800 mt-0.5">${ped.cliente_nome}</div>
        </div>
        ${prioridadeLabel}
      </div>
      <div class="text-[11px] text-slate-600 font-medium">${ped.servico_nome}</div>
      <div class="text-[11px] text-slate-500 mt-0.5">📦 ${ped.quantidade} ${ped.unidade}</div>
      <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <span class="text-[10px] font-bold text-slate-400">📅 ${dataFormatada}</span>
        <div class="flex items-center space-x-1">
          <button onclick="KanbanModule.abrirDetalhes(${ped.id})" class="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Detalhes">
            👁️
          </button>
          <button onclick="KanbanModule.abrirEtiqueta(${ped.id})" class="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition" title="Etiqueta QR Code">
            🏷️
          </button>
          <button onclick="KanbanModule.moverPedido(${ped.id}, ${ped.etapa_atual}, 'avancar')" class="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition" title="Avançar etapa">
            ➡️
          </button>
        </div>
      </div>
    `;

    return card;
  },

  // Configurar Drag & Drop
  setupDragAndDrop() {
    const cards = document.querySelectorAll('[data-pedido-id]');
    const dropZones = document.querySelectorAll('[data-drop-zone]');

    cards.forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        this.dragPedidoId = card.dataset.pedidoId;
        card.classList.add('opacity-50');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('opacity-50');
        this.dragPedidoId = null;
      });
    });

    dropZones.forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('bg-blue-50', 'border-blue-300');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('bg-blue-50', 'border-blue-300');
      });

      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('bg-blue-50', 'border-blue-300');

        if (!this.dragPedidoId) return;

        const coluna = zone.closest('[data-etapa-id]');
        const novaEtapa = coluna ? coluna.dataset.etapaId : null;
        if (!novaEtapa) return;

        await this.moverPedido(Number(this.dragPedidoId), null, null, Number(novaEtapa));
      });
    });
  },

  // Mover pedido entre etapas
  async moverPedido(pedidoId, etapaAtual, direcao, etapaEspecifica) {
    try {
      let novaEtapa = etapaEspecifica;

      if (!novaEtapa) {
        const pedido = this.pedidosCache.find((p) => p.id === pedidoId);
        if (!pedido) return;

        if (direcao === 'avancar') {
          novaEtapa = Math.min(Number(pedido.etapa_atual) + 1, 5);
        } else if (direcao === 'voltar') {
          novaEtapa = Math.max(Number(pedido.etapa_atual) - 1, 1);
        } else {
          return;
        }
      }

      const res = await API.pedidos.mover(pedidoId, {
        nova_etapa: novaEtapa,
        usuario_id: 3,
        usuario_nome: 'Operador'
      });

      App.mostrarToast(`✅ ${res.message}`, 'sucesso');

      // Se movido para "Pronto para Retirada", notificar
      if (Number(novaEtapa) === 5) {
        App.mostrarToast('📱 Notificação de prontidão enviada ao cliente!', 'info');
      }

      await this.carregarKanban();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao mover pedido.', 'erro');
    }
  },

  // Filtrar Kanban por busca
  filtrarKanban(termo) {
    if (!termo || termo.trim() === '') {
      this.renderizarKanban(this.etapasCache);
      return;
    }

    const termoLower = termo.toLowerCase();
    const etapasFiltradas = this.etapasCache.map((etapa) => ({
      ...etapa,
      pedidos: (etapa.pedidos || []).filter((p) =>
        p.numero_os.toLowerCase().includes(termoLower) ||
        p.cliente_nome.toLowerCase().includes(termoLower) ||
        p.servico_nome.toLowerCase().includes(termoLower)
      )
    }));

    this.renderizarKanban(etapasFiltradas);
  },

  // Abrir detalhes do pedido
  async abrirDetalhes(pedidoId) {
    try {
      const pedido = await API.pedidos.obter(pedidoId);
      if (!pedido) return;

      const modal = document.getElementById('modal-pedido-detalhes');
      const titulo = document.getElementById('modal-pedido-titulo');
      const conteudo = document.getElementById('modal-pedido-conteudo');

      if (titulo) {
        titulo.textContent = `Detalhes - ${pedido.numero_os}`;
      }

      const [ano, mes, dia] = (pedido.data_prometida || '').split('-');
      const dataFormatada = pedido.data_prometida ? `${dia}/${mes}/${ano}` : 'Sem data';

      let statusPagamentoBadge = '';
      if (pedido.status_pagamento === 'PAGO') {
        statusPagamentoBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">✅ Pago</span>';
      } else if (pedido.status_pagamento === 'SINAL_50') {
        statusPagamentoBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">💰 Sinal 50%</span>';
      } else {
        statusPagamentoBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">⏳ Pendente</span>';
      }

      let prioridadeBadge = '';
      if (pedido.prioridade === 'URGENTE') {
        prioridadeBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">🔴 Urgente</span>';
      } else if (pedido.prioridade === 'ALTA') {
        prioridadeBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">🟡 Alta</span>';
      } else {
        prioridadeBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">🟢 Normal</span>';
      }

      let arquivoHtml = '';
      if (pedido.arquivo_arte) {
        arquivoHtml = `
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-xl">📎</span>
              <div>
                <p class="text-xs font-bold text-blue-800">Arte Final Anexada</p>
                <p class="text-[11px] text-blue-600">${pedido.arquivo_original || 'Arquivo'}</p>
              </div>
            </div>
            <a href="${pedido.arquivo_arte}" download class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">
              ⬇️ Baixar
            </a>
          </div>
        `;
      }

      let historicoHtml = '';
      if (pedido.historico && pedido.historico.length > 0) {
        historicoHtml = `
          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-slate-700 uppercase tracking-wider">📜 Histórico do Pedido</h4>
            ${pedido.historico.map((h) => `
              <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-700">${h.acao}</span>
                  <span class="text-[10px] text-slate-400">${new Date(h.data_hora).toLocaleString('pt-BR')}</span>
                </div>
                <p class="text-slate-600 mt-0.5">${h.descricao}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Por: ${h.usuario_nome || 'Sistema'}</p>
              </div>
            `).join('')}
          </div>
        `;
      }

      conteudo.innerHTML = `
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-slate-50 rounded-xl">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Cliente</p>
            <p class="text-sm font-bold text-slate-800">${pedido.cliente_nome}</p>
            <p class="text-xs text-slate-500">${pedido.cliente_telefone || 'Sem telefone'}</p>
            <p class="text-xs text-slate-500">${pedido.cliente_email || 'Sem e-mail'}</p>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Serviço</p>
            <p class="text-sm font-bold text-slate-800">${pedido.servico_nome}</p>
            <p class="text-xs text-slate-500">${pedido.quantidade} ${pedido.unidade}</p>
            ${pedido.dimensao_largura ? `<p class="text-xs text-slate-500">Dimensões: ${pedido.dimensao_largura} x ${pedido.dimensao_altura} cm</p>` : ''}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-slate-50 rounded-xl">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Material</p>
            <p class="text-sm font-semibold text-slate-800">${pedido.material || 'Não especificado'}</p>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Acabamento</p>
            <p class="text-sm font-semibold text-slate-800">${pedido.acabamento_nome || 'Nenhum'}</p>
          </div>
        </div>

        <div class="p-3 bg-slate-50 rounded-xl">
          <p class="text-[10px] font-bold text-slate-500 uppercase">Observações Técnicas</p>
          <p class="text-sm text-slate-700">${pedido.observacoes_tecnicas || 'Sem observações'}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-slate-50 rounded-xl">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Entrega Prometida</p>
            <p class="text-sm font-bold text-slate-800">📅 ${dataFormatada} ${pedido.hora_prometida ? `às ${pedido.hora_prometida}` : ''}</p>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Etapa Atual</p>
            <p class="text-sm font-bold text-slate-800">${pedido.etapa_icone} ${pedido.etapa_nome}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-slate-50 rounded-xl">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Valor Total</p>
            <p class="text-lg font-black text-blue-700">R$ ${Number(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Pagamento</p>
            <div class="flex items-center space-x-2 mt-1">
              ${statusPagamentoBadge}
              <span class="text-xs text-slate-500">${pedido.condicao_pagamento}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
          <p class="text-[10px] font-bold text-slate-500 uppercase">Prioridade</p>
          ${prioridadeBadge}
        </div>

        ${arquivoHtml}
        ${historicoHtml}

        <div class="flex items-center justify-end space-x-2 pt-2">
          <button onclick="KanbanModule.abrirEtiqueta(${pedido.id})" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow transition">
            🏷️ Etiqueta QR Code
          </button>
          <button type="button" class="modal-close-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">
            Fechar
          </button>
        </div>
      `;

      modal.classList.remove('hidden');
    } catch (error) {
      console.error('Erro ao abrir detalhes:', error);
      App.mostrarToast('Erro ao carregar detalhes do pedido.', 'erro');
    }
  },

  // Abrir modal de etiqueta com QR Code
  async abrirEtiqueta(pedidoId) {
    try {
      const etiqueta = await API.pedidos.etiqueta(pedidoId);
      if (!etiqueta) return;

      this.etiquetaAtual = etiqueta;

      const modal = document.getElementById('modal-etiqueta');
      const conteudo = document.getElementById('etiqueta-conteudo');

      const [ano, mes, dia] = (etiqueta.data_prometida || '').split('-');
      const dataFormatada = etiqueta.data_prometida ? `${dia}/${mes}/${ano}` : 'Sem data';

      conteudo.innerHTML = `
        <div class="bg-white border-2 border-slate-300 rounded-xl p-4 text-center">
          <div class="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Gráfica EPA</div>
          <div class="text-2xl font-black text-blue-700 mb-2">${etiqueta.numero_os}</div>
          <div class="text-sm font-bold text-slate-800">${etiqueta.cliente_nome}</div>
          <div class="text-xs text-slate-600 mt-0.5">${etiqueta.servico_nome} • ${etiqueta.quantidade} ${etiqueta.unidade}</div>
          <div class="text-xs text-slate-500 mt-0.5">📅 Entrega: ${dataFormatada}</div>
          <div class="text-xs font-bold text-slate-600 mt-1">Etapa: ${etiqueta.etapa_icone} ${etiqueta.etapa_nome}</div>
          <div id="qr-code-container" class="mt-3 flex justify-center"></div>
          <p class="text-[10px] text-slate-400 mt-2">Aponte a câmera para abrir o pedido no sistema</p>
        </div>
      `;

      // Gerar QR Code
      const qrContainer = document.getElementById('qr-code-container');
      if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        QRCode.toCanvas(qrContainer, etiqueta.url_qr, {
          width: 180,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff'
          }
        }, (err) => {
          if (err) console.error('Erro ao gerar QR Code:', err);
        });
      }

      modal.classList.remove('hidden');
    } catch (error) {
      console.error('Erro ao abrir etiqueta:', error);
      App.mostrarToast('Erro ao gerar etiqueta.', 'erro');
    }
  },

  // Imprimir etiqueta
  imprimirEtiqueta() {
    if (!this.etiquetaAtual) return;

    const etiqueta = this.etiquetaAtual;
    const [ano, mes, dia] = (etiqueta.data_prometida || '').split('-');
    const dataFormatada = etiqueta.data_prometida ? `${dia}/${mes}/${ano}` : 'Sem data';

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      App.mostrarToast('Permita pop-ups para imprimir a etiqueta.', 'erro');
      return;
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>Etiqueta ${etiqueta.numero_os}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .etiqueta {
            border: 2px solid #000;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            max-width: 300px;
            margin: 0 auto;
          }
          .titulo { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          .os { font-size: 24px; font-weight: 900; color: #1d4ed8; margin: 8px 0; }
          .cliente { font-size: 14px; font-weight: bold; }
          .info { font-size: 12px; color: #333; margin-top: 4px; }
          .etapa { font-size: 12px; font-weight: bold; margin-top: 8px; }
          .qr { margin-top: 12px; }
          .rodape { font-size: 9px; color: #666; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="etiqueta">
          <div class="titulo">Gráfica EPA</div>
          <div class="os">${etiqueta.numero_os}</div>
          <div class="cliente">${etiqueta.cliente_nome}</div>
          <div class="info">${etiqueta.servico_nome} • ${etiqueta.quantidade} ${etiqueta.unidade}</div>
          <div class="info">📅 Entrega: ${dataFormatada}</div>
          <div class="etapa">${etiqueta.etapa_icone} ${etiqueta.etapa_nome}</div>
          <div class="qr">
            <img src="${etiqueta.url_qr}" alt="QR Code" style="width: 150px; height: 150px;" />
          </div>
          <div class="rodape">Aponte a câmera para abrir o pedido no sistema</div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }
};