// Módulo de Cadastros, Configurações, Auditoria e Backups - Gráfica EPA
const SettingsModule = {
  // Caches dos cadastros (necessários para edição e alteração de status)
  servicosCache: [],
  acabamentosCache: [],
  usuariosCache: [],
  materiaisCache: [],
  operadoresCache: [],

  // Tipo e id do registro em edição no modal de cadastro (null = novo)
  cadastroTipo: null,
  cadastroId: null,

  // Configuração declarativa dos formulários exibidos no modal de cadastro
  configCadastro: {
    servico: {
      titulo: 'Serviço / Produto',
      campos: [
        { id: 'nome', label: 'Nome do Serviço', tipo: 'text', placeholder: 'ex: Placas em PS', required: true },
        { id: 'unidade', label: 'Unidade', tipo: 'text', placeholder: 'ex: m², Milheiros, un', required: true },
        { id: 'categoria', label: 'Categoria', tipo: 'text', placeholder: 'Opcional' }
      ]
    },
    acabamento: {
      titulo: 'Acabamento',
      campos: [
        { id: 'nome', label: 'Nome do Acabamento', tipo: 'text', placeholder: 'ex: Ilhós', required: true }
      ]
    },
    usuario: {
      titulo: 'Usuário',
      campos: [
        { id: 'nome', label: 'Nome Completo', tipo: 'text', required: true },
        { id: 'email', label: 'E-mail', tipo: 'email', required: true },
        { id: 'senha', label: 'Senha', tipo: 'password', ajuda: 'Ao editar, deixe em branco para manter a senha atual.' },
        { id: 'perfil', label: 'Perfil de Acesso', tipo: 'select', opcoes: [
          { valor: 'ATENDIMENTO', texto: 'Atendimento' },
          { valor: 'OPERADOR', texto: 'Operador' },
          { valor: 'ADMIN', texto: 'Administrador' }
        ] }
      ]
    },
    material: {
      titulo: 'Material',
      campos: [
        { id: 'nome', label: 'Nome do Material', tipo: 'text', placeholder: 'ex: Banner', required: true },
        { id: 'unidade', label: 'Unidade', tipo: 'text', placeholder: 'ex: m², Milheiros, un', required: true },
        { id: 'categoria', label: 'Categoria', tipo: 'text', placeholder: 'Opcional' }
      ]
    },
    operador: {
      titulo: 'Operador',
      campos: [
        { id: 'nome', label: 'Nome Completo', tipo: 'text', required: true },
        { id: 'cargo', label: 'Cargo / Função', tipo: 'text', placeholder: 'ex: Operador de Produção' },
        { id: 'turno_padrao', label: 'Turno Padrão', tipo: 'select', opcoes: [
          { valor: '1', texto: '1º Turno (Manhã)' },
          { valor: '2', texto: '2º Turno (Tarde)' },
          { valor: '3', texto: '3º Turno (Noite)' }
        ] }
      ]
    }
  },

  async init() {
    this.setupEventListeners();
    await Promise.all([
      this.carregarServicos(),
      this.carregarAcabamentos(),
      this.carregarUsuarios(),
      this.carregarMateriais(),
      this.carregarOperadores(),
      this.carregarListaBackups(),
      this.carregarAuditoria()
    ]);
  },

  setupEventListeners() {
    // Formulário único de cadastro (modal) - usado por todos os cadastros
    document.getElementById('form-cadastro')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarCadastro();
    });

    // Botão de Criar Backup Imediato
    document.getElementById('btn-criar-backup-agora')?.addEventListener('click', async () => {
      await this.criarBackupManual();
    });

    // Botão de Restaurar Backup
    document.getElementById('form-restaurar-backup')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.restaurarBackup();
    });
  },

// ==========================================
  // MODAL DE CADASTRO (INCLUIR E EDITAR)
  // ==========================================
  cacheDoTipo(tipo) {
    switch (tipo) {
      case 'servico': return this.servicosCache;
      case 'acabamento': return this.acabamentosCache;
      case 'usuario': return this.usuariosCache;
      case 'material': return this.materiaisCache;
      case 'operador': return this.operadoresCache;
      default: return [];
    }
  },

  abrirCadastro(tipo, id = null) {
    const cfg = this.configCadastro[tipo];
    if (!cfg) return;

    this.cadastroTipo = tipo;
    this.cadastroId = id;

    const titulo = document.getElementById('modal-cadastro-titulo');
    if (titulo) titulo.textContent = (id != null ? 'Editar ' : 'Novo ') + cfg.titulo;

    const container = document.getElementById('modal-cadastro-campos');
    if (container) {
      container.innerHTML = cfg.campos.map((campo) => this.htmlCampo(campo)).join('');
    }

    // Preencher os campos quando estiver editando
    const registro = id != null ? this.cacheDoTipo(tipo).find((r) => r.id === id) : null;
    if (registro) {
      cfg.campos.forEach((campo) => {
        const el = document.getElementById(`cad-${campo.id}`);
        if (!el) return;
        if (campo.id === 'senha') {
          el.value = '';
        } else if (registro[campo.id] !== undefined && registro[campo.id] !== null) {
          el.value = registro[campo.id];
        }
      });
    }

    cfg.campos.forEach((campo) => App.campoInvalido(document.getElementById(`cad-${campo.id}`), false));

    const modal = document.getElementById('modal-cadastro');
    if (modal) modal.classList.remove('hidden');
  },

  htmlCampo(campo) {
    const base = 'w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800';
    let controle = '';
    if (campo.tipo === 'select') {
      controle = `<select id="cad-${campo.id}" class="${base}">` +
        (campo.opcoes || []).map((o) => `<option value="${o.valor}">${o.texto}</option>`).join('') +
        '</select>';
    } else {
      controle = `<input type="${campo.tipo}" id="cad-${campo.id}"${campo.placeholder ? ` placeholder="${campo.placeholder}"` : ''} class="${base}" />`;
    }
    return `
      <div>
        <label class="block font-bold text-slate-600 mb-1">${campo.label}:</label>
        ${controle}
        ${campo.ajuda ? `<p class="text-[10px] text-slate-400 mt-1">${campo.ajuda}</p>` : ''}
      </div>
    `;
  },

  async salvarCadastro() {
    const tipo = this.cadastroTipo;
    const cfg = this.configCadastro[tipo];
    if (!cfg) return;
    const id = this.cadastroId;

    const valores = {};
    const invalidos = [];
    cfg.campos.forEach((campo) => {
      const el = document.getElementById(`cad-${campo.id}`);
      valores[campo.id] = el ? el.value.trim() : '';
      if (campo.required && valores[campo.id] === '') invalidos.push(campo.id);
    });

    if (invalidos.length > 0) {
      App.mostrarToast('Preencha todos os campos obrigatórios.', 'erro');
      invalidos.forEach((campoId) => App.campoInvalido(document.getElementById(`cad-${campoId}`), true));
      return;
    }

    if (tipo === 'usuario') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email)) {
        App.mostrarToast('Informe um e-mail válido.', 'erro');
        App.campoInvalido(document.getElementById('cad-email'), true);
        return;
      }
      if (id == null && !valores.senha) {
        App.mostrarToast('Informe a senha do usuário.', 'erro');
        App.campoInvalido(document.getElementById('cad-senha'), true);
        return;
      }
    }

    try {
      if (id == null) {
        await this.criarRegistro(tipo, valores);
        App.mostrarToast('Cadastro realizado com sucesso.', 'sucesso');
      } else {
        await this.atualizarRegistro(tipo, id, valores);
        App.mostrarToast('Registro atualizado com sucesso.', 'sucesso');
      }
      document.getElementById('modal-cadastro')?.classList.add('hidden');
      await this.recarregarTipo(tipo);
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao salvar cadastro.', 'erro');
    }
  },

  async criarRegistro(tipo, v) {
    switch (tipo) {
      case 'servico':
        return API.servicos.criar({ nome: v.nome, unidade: v.unidade, categoria: v.categoria });
      case 'acabamento':
        return API.acabamentos.criar({ nome: v.nome });
      case 'usuario':
        return API.usuarios.criar({ nome: v.nome, email: v.email, senha: v.senha, perfil: v.perfil });
      case 'material':
        return API.materiais.criar({ nome: v.nome, unidade: v.unidade, categoria: v.categoria });
      case 'operador':
        return API.operadores.criar({ nome: v.nome, cargo: v.cargo, turno_padrao: v.turno_padrao });
    }
  },

  async atualizarRegistro(tipo, id, v) {
    const reg = this.cacheDoTipo(tipo).find((r) => r.id === id) || {};
    const ativo = reg.ativo ? 1 : 0;
    switch (tipo) {
      case 'servico':
        return API.servicos.atualizar(id, { nome: v.nome, unidade: v.unidade, categoria: v.categoria, icone: reg.icone || 'printer', cor: reg.cor || '#2563eb', ativo });
      case 'acabamento':
        return API.acabamentos.atualizar(id, { nome: v.nome, ativo });
      case 'usuario': {
        const payload = { nome: v.nome, email: v.email, perfil: v.perfil, ativo };
        if (v.senha) payload.senha = v.senha;
        return API.usuarios.atualizar(id, payload);
      }
      case 'material':
        return API.materiais.atualizar(id, { nome: v.nome, unidade: v.unidade, categoria: v.categoria, meta_hora: reg.meta_hora || 0, icone: reg.icone || 'printer', cor: reg.cor || '#2563eb', ativo });
      case 'operador':
        return API.operadores.atualizar(id, { nome: v.nome, cargo: v.cargo, turno_padrao: v.turno_padrao, ativo });
    }
  },

  async recarregarTipo(tipo) {
    switch (tipo) {
      case 'servico':
        await this.carregarServicos();
        await AtendimentoModule.carregarListas();
        break;
      case 'acabamento':
        await this.carregarAcabamentos();
        await AtendimentoModule.carregarListas();
        break;
      case 'usuario':
        await this.carregarUsuarios();
        break;
      case 'material':
        await this.carregarMateriais();
        await OperatorModule.carregarListas();
        HistoryModule.carregarFiltrosSelects();
        break;
      case 'operador':
        await this.carregarOperadores();
        await OperatorModule.carregarListas();
        HistoryModule.carregarFiltrosSelects();
        break;
    }
  },

  // ==========================================
  // ATIVAR / DESATIVAR (TOGGLE DE STATUS)
  // ==========================================
  apiStatus(tipo) {
    switch (tipo) {
      case 'servico': return API.servicos;
      case 'acabamento': return API.acabamentos;
      case 'usuario': return API.usuarios;
      case 'material': return API.materiais;
      case 'operador': return API.operadores;
    }
  },

  // Botão de ação conforme o estado do registro (Ativar x Desativar)
  htmlBotaoStatus(tipo, registro) {
    if (registro.ativo) {
      return `<button onclick="SettingsModule.desativarRegistro('${tipo}', ${registro.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">Desativar</button>`;
    }
    return `<button onclick="SettingsModule.ativarRegistro('${tipo}', ${registro.id})" class="text-emerald-600 hover:text-emerald-800 text-xs font-bold">Ativar</button>`;
  },

  async alterarStatus(tipo, id, ativar) {
    const cfg = this.configCadastro[tipo];
    const registro = id != null ? this.cacheDoTipo(tipo).find((r) => r.id === id) : null;
    if (!cfg || !registro) return;

    // Validação: só é possível desativar algo que está ativo (e ativar algo inativo)
    if (ativar && registro.ativo) {
      App.mostrarToast('Este registro já está ativo.', 'aviso');
      return;
    }
    if (!ativar && !registro.ativo) {
      App.mostrarToast('Este registro já está desativado.', 'aviso');
      return;
    }

    // Confirmação via modal apenas para a ação de desativar (destrutiva)
    if (!ativar) {
      const ok = await App.confirmar({
        titulo: 'Desativar Registro',
        mensagem: `Deseja desativar <strong>${registro.nome}</strong>? O registro será mantido no histórico.`,
        textoConfirmar: 'Desativar',
        tipo: 'perigo'
      });
      if (!ok) return;
    }

    try {
      await this.apiStatus(tipo).status(id, ativar ? 1 : 0);
      App.mostrarToast(ativar ? 'Registro ativado com sucesso.' : 'Registro desativado com sucesso.', 'sucesso');
      await this.recarregarTipo(tipo);
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao alterar status.', 'erro');
    }
  },

  ativarRegistro(tipo, id) {
    return this.alterarStatus(tipo, id, true);
  },

  desativarRegistro(tipo, id) {
    return this.alterarStatus(tipo, id, false);
  },
  // ==========================================
  // 1. GESTÃO DE SERVIÇOS / PRODUTOS
  // ==========================================
  async carregarServicos() {
    const container = document.getElementById('lista-servicos-tabela');
    if (!container) return;

    try {
      const servicos = await API.servicos.listar(true);
      this.servicosCache = servicos;
      if (servicos.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum serviço cadastrado.</td></tr>';
        return;
      }

      container.innerHTML = servicos.map((s) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="py-2.5 px-3 font-bold text-slate-800 truncate" title="${s.nome}">${s.nome}</td>
          <td class="py-2.5 px-3 font-semibold text-blue-600 truncate">${s.unidade}</td>
          <td class="py-2.5 px-3 text-slate-600 text-xs truncate">${s.categoria || 'Geral'}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="px-2 py-0.5 rounded text-xs font-bold ${s.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${s.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td class="py-2.5 px-3 text-center">
            <div class="flex items-center justify-center gap-3">
              <button onclick="SettingsModule.abrirCadastro('servico', ${s.id})" class="text-blue-600 hover:text-blue-800 text-xs font-bold">Editar</button>
              ${this.htmlBotaoStatus('servico', s)}
            </div>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Erro ao listar serviços:', error);
    }
  },

  // ==========================================
  // 2. GESTÃO DE ACABAMENTOS
  // ==========================================
  async carregarAcabamentos() {
    const container = document.getElementById('lista-acabamentos-tabela');
    if (!container) return;

    try {
      const acabamentos = await API.acabamentos.listar(true);
      this.acabamentosCache = acabamentos;
      if (acabamentos.length === 0) {
        container.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-slate-400">Nenhum acabamento cadastrado.</td></tr>';
        return;
      }

      container.innerHTML = acabamentos.map((a) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="py-2.5 px-3 font-bold text-slate-800 truncate" title="${a.nome}">${a.nome}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="px-2 py-0.5 rounded text-xs font-bold ${a.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${a.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td class="py-2.5 px-3 text-center">
            <div class="flex items-center justify-center gap-3">
              <button onclick="SettingsModule.abrirCadastro('acabamento', ${a.id})" class="text-blue-600 hover:text-blue-800 text-xs font-bold">Editar</button>
              ${this.htmlBotaoStatus('acabamento', a)}
            </div>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Erro ao listar acabamentos:', error);
    }
  },

  // ==========================================
  // 3. GESTÃO DE USUÁRIOS
  // ==========================================
  async carregarUsuarios() {
    const container = document.getElementById('lista-usuarios-tabela');
    if (!container) return;

    try {
      const usuarios = await API.usuarios.listar(true);
      this.usuariosCache = usuarios;
      if (usuarios.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum usuário cadastrado.</td></tr>';
        return;
      }

      container.innerHTML = usuarios.map((u) => {
        let perfilBadge = 'bg-slate-100 text-slate-700';
        if (u.perfil === 'ADMIN') perfilBadge = 'bg-purple-100 text-purple-800';
        if (u.perfil === 'ATENDIMENTO') perfilBadge = 'bg-blue-100 text-blue-800';
        if (u.perfil === 'OPERADOR') perfilBadge = 'bg-emerald-100 text-emerald-800';
        if (u.perfil === 'VENDEDOR') perfilBadge = 'bg-amber-100 text-amber-800';

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2.5 px-3 font-bold text-slate-800 truncate" title="${u.nome}">${u.nome}</td>
            <td class="py-2.5 px-3 text-slate-600 text-xs truncate" title="${u.email}">${u.email}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${perfilBadge}">${u.perfil}</span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${u.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                ${u.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <div class="flex items-center justify-center gap-3">
                <button onclick="SettingsModule.abrirCadastro('usuario', ${u.id})" class="text-blue-600 hover:text-blue-800 text-xs font-bold">Editar</button>
                ${this.htmlBotaoStatus('usuario', u)}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
    }
  },

  // ==========================================
  // 4. GESTÃO DE MATERIAIS
  // ==========================================
  async carregarMateriais() {
    const container = document.getElementById('lista-materiais-tabela');
    if (!container) return;

    try {
      const materiais = await API.materiais.listar(true);
      this.materiaisCache = materiais;
      if (materiais.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum material cadastrado.</td></tr>';
        return;
      }

      container.innerHTML = materiais.map((mat) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="py-2.5 px-3 font-bold text-slate-800 truncate" title="${mat.nome}">${mat.nome}</td>
          <td class="py-2.5 px-3 font-semibold text-blue-600 truncate">${mat.unidade}</td>
          <td class="py-2.5 px-3 text-slate-600 text-xs truncate">${mat.categoria || 'Geral'}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="px-2 py-0.5 rounded text-xs font-bold ${mat.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${mat.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td class="py-2.5 px-3 text-center">
            <div class="flex items-center justify-center gap-3">
              <button onclick="SettingsModule.abrirCadastro('material', ${mat.id})" class="text-blue-600 hover:text-blue-800 text-xs font-bold">Editar</button>
              ${this.htmlBotaoStatus('material', mat)}
            </div>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Erro ao listar materiais:', error);
    }
  },

  // ==========================================
  // 5. GESTÃO DE OPERADORES
  // ==========================================
  async carregarOperadores() {
    const container = document.getElementById('lista-operadores-tabela');
    if (!container) return;

    try {
      const operadores = await API.operadores.listar(true);
      this.operadoresCache = operadores;
      if (operadores.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum operador cadastrado.</td></tr>';
        return;
      }

      container.innerHTML = operadores.map((op) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="py-2.5 px-3 font-bold text-slate-800 truncate" title="${op.nome}">${op.nome}</td>
          <td class="py-2.5 px-3 text-slate-600 text-xs truncate" title="${op.cargo || 'Operador'}">${op.cargo || 'Operador'}</td>
          <td class="py-2.5 px-3 text-slate-700 text-xs font-semibold truncate">${op.turno_nome || '1º Turno'}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="px-2 py-0.5 rounded text-xs font-bold ${op.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${op.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td class="py-2.5 px-3 text-center">
            <div class="flex items-center justify-center gap-3">
              <button onclick="SettingsModule.abrirCadastro('operador', ${op.id})" class="text-blue-600 hover:text-blue-800 text-xs font-bold">Editar</button>
              ${this.htmlBotaoStatus('operador', op)}
            </div>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Erro ao listar operadores:', error);
    }
  },

  // ==========================================
  // 6. LOG DE AUDITORIA
  // ==========================================
  async carregarAuditoria() {
    const container = document.getElementById('lista-auditoria-container');
    if (!container) return;

    try {
      const dataInicio = document.getElementById('audit-data-inicio')?.value || '';
      const dataFim = document.getElementById('audit-data-fim')?.value || '';

      const params = { limit: 50 };
      if (dataInicio) params.data_inicio = dataInicio;
      if (dataFim) params.data_fim = dataFim;

      const res = await API.auditoria.listar(params);
      const registros = res.dados || [];

      if (registros.length === 0) {
        container.innerHTML = `
          <div class="text-center py-6 text-slate-400">
            <p>Nenhum registro de auditoria encontrado.</p>
          </div>
        `;
        return;
      }

      let html = '<div class="space-y-2">';
      registros.forEach((reg) => {
        const dataFormatada = new Date(reg.data_hora).toLocaleString('pt-BR');
        let acaoBadge = 'bg-slate-100 text-slate-700';
        if (reg.acao.includes('CRIACAO')) acaoBadge = 'bg-emerald-100 text-emerald-800';
        if (reg.acao.includes('EDICAO')) acaoBadge = 'bg-blue-100 text-blue-800';
        if (reg.acao.includes('MOVIMENTACAO')) acaoBadge = 'bg-amber-100 text-amber-800';
        if (reg.acao.includes('CANCELAMENTO')) acaoBadge = 'bg-red-100 text-red-800';

        html += `
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div class="flex items-center justify-between">
              <span class="font-bold px-2 py-0.5 rounded ${acaoBadge}">${reg.acao}</span>
              <span class="text-[10px] text-slate-400">${dataFormatada}</span>
            </div>
            <p class="text-slate-700 mt-1.5 font-medium">${reg.detalhes || reg.acao}</p>
            <p class="text-[10px] text-slate-400 mt-1">👤 ${reg.usuario_nome || reg.usuario_nome_ref || 'Sistema'} • ${reg.entidade || ''} ${reg.entidade_id ? `#${reg.entidade_id}` : ''}</p>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (error) {
      console.error('Erro ao carregar auditoria:', error);
      container.innerHTML = `
        <div class="text-center py-6 text-red-500 font-medium">
          Erro ao carregar auditoria.
        </div>
      `;
    }
  },

  // ==========================================
  // 7. MÓDULO DE BACKUPS
  // ==========================================
  async carregarListaBackups() {
    const container = document.getElementById('lista-backups-container');
    if (!container) return;

    try {
      const backups = await API.backup.listar();
      if (!backups || backups.length === 0) {
        container.innerHTML = `
          <div class="text-center py-6 text-slate-400">
            <p>Nenhum arquivo de backup gerado ainda.</p>
          </div>
        `;
        return;
      }

      let html = '<div class="space-y-2">';
      backups.forEach((b) => {
        const dataFormatada = new Date(b.dataCriacao).toLocaleString('pt-BR');
        html += `
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <span class="text-2xl">💾</span>
              <div>
                <p class="font-bold text-slate-800 text-xs sm:text-sm font-mono">${b.arquivo}</p>
                <p class="text-xs text-slate-500">${dataFormatada} • <strong class="text-slate-700">${b.tamanhoFormatado}</strong></p>
              </div>
            </div>
            <div>
              <a href="${API.backup.downloadUrl(b.arquivo)}" download class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 shadow-sm">
                <span>⬇️</span>
                <span>Baixar</span>
              </a>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (error) {
      console.error('Erro ao listar backups:', error);
    }
  },

  async criarBackupManual() {
    const btn = document.getElementById('btn-criar-backup-agora');
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Gerando backup...';
      }
      const res = await API.backup.criar();
      App.mostrarToast('✅ Cópia de segurança criada com sucesso!', 'sucesso');
      await this.carregarListaBackups();
    } catch (error) {
      App.mostrarToast('Erro ao gerar backup.', 'erro');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Criar Cópia de Segurança Agora';
      }
    }
  },

  async restaurarBackup() {
    const fileInput = document.getElementById('input-arquivo-restauracao');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      App.mostrarToast('Selecione um arquivo de backup (.sqlite).', 'erro');
      return;
    }

    const ok = await App.confirmar({
      titulo: 'Restaurar Backup',
      mensagem: 'Atenção: restaurar um backup substituirá a base de dados atual. Uma cópia de segurança preventiva será salva automaticamente. Deseja continuar?',
      textoConfirmar: 'Restaurar',
      tipo: 'perigo'
    });
    if (!ok) return;

    try {
      App.mostrarToast('Restaurando banco de dados...', 'info');
      const res = await API.backup.restaurar(fileInput.files[0]);
      App.mostrarToast('✅ Banco restaurado com sucesso! Atualizando sistema...', 'sucesso');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao restaurar banco.', 'erro');
    }
  }
};