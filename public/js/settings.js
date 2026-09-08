// Módulo de Cadastros, Configurações, Auditoria e Backups - Gráfica EPA
const SettingsModule = {
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
    // Formulário de Novo Serviço
    document.getElementById('form-novo-servico')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarNovoServico();
    });

    // Formulário de Novo Acabamento
    document.getElementById('form-novo-acabamento')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarNovoAcabamento();
    });

    // Formulário de Novo Usuário
    document.getElementById('form-novo-usuario')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarNovoUsuario();
    });

    // Formulário de Novo Material
    document.getElementById('form-novo-material')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarNovoMaterial();
    });

    // Formulário de Novo Operador
    document.getElementById('form-novo-operador')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarNovoOperador();
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

    // Limpar destaque dos campos de cadastro assim que forem corrigidos
    const limparCampoConfig = (idElemento) => {
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
    [
      'serv-nome', 'serv-unidade',
      'acab-nome',
      'user-nome', 'user-email', 'user-senha',
      'mat-nome', 'mat-unidade',
      'op-novo-nome'
    ].forEach(limparCampoConfig);
  },

  // ==========================================
  // 1. GESTÃO DE SERVIÇOS / PRODUTOS
  // ==========================================
  async carregarServicos() {
    const container = document.getElementById('lista-servicos-tabela');
    if (!container) return;

    try {
      const servicos = await API.servicos.listar(true);
      if (servicos.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum serviço cadastrado.</td></tr>';
        return;
      }

      let html = '';
      servicos.forEach((s) => {
        html += `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2.5 px-3 font-bold text-slate-800">${s.nome}</td>
            <td class="py-2.5 px-3 font-semibold text-blue-600">${s.unidade}</td>
            <td class="py-2.5 px-3 text-slate-600 text-xs">${s.categoria || 'Geral'}</td>
            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${s.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                ${s.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <button onclick="SettingsModule.excluirServico(${s.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">
                Excluir/Desativar
              </button>
            </td>
          </tr>
        `;
      });
      container.innerHTML = html;
    } catch (error) {
      console.error('Erro ao listar serviços:', error);
    }
  },

  async salvarNovoServico() {
    const nome = document.getElementById('serv-nome').value;
    const unidade = document.getElementById('serv-unidade').value;
    const categoria = document.getElementById('serv-categoria').value;

    if (!nome) {
      App.mostrarToast('Informe o nome do serviço.', 'erro');
      App.campoInvalido(document.getElementById('serv-nome'), true);
      return;
    }
    if (!unidade) {
      App.mostrarToast('Informe a unidade do serviço.', 'erro');
      App.campoInvalido(document.getElementById('serv-unidade'), true);
      return;
    }

    try {
      await API.servicos.criar({ nome, unidade, categoria });
      App.mostrarToast(`Serviço "${nome}" cadastrado com sucesso!`, 'sucesso');
      document.getElementById('form-novo-servico').reset();
      App.campoInvalido(document.getElementById('serv-nome'), false);
      App.campoInvalido(document.getElementById('serv-unidade'), false);
      await this.carregarServicos();
      await AtendimentoModule.carregarListas();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao cadastrar serviço.', 'erro');
    }
  },

  async excluirServico(id) {
    if (!confirm('Deseja desativar este serviço?')) return;
    try {
      await API.servicos.excluir(id);
      App.mostrarToast('Serviço desativado com sucesso.', 'sucesso');
      await this.carregarServicos();
      await AtendimentoModule.carregarListas();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao desativar serviço.', 'erro');
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
      if (acabamentos.length === 0) {
        container.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-slate-400">Nenhum acabamento cadastrado.</td></tr>';
        return;
      }

      let html = '';
      acabamentos.forEach((a) => {
        html += `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2.5 px-3 font-bold text-slate-800">${a.nome}</td>
            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${a.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                ${a.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <button onclick="SettingsModule.excluirAcabamento(${a.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">
                Excluir/Desativar
              </button>
            </td>
          </tr>
        `;
      });
      container.innerHTML = html;
    } catch (error) {
      console.error('Erro ao listar acabamentos:', error);
    }
  },

  async salvarNovoAcabamento() {
    const nome = document.getElementById('acab-nome').value;

    if (!nome) {
      App.mostrarToast('Informe o nome do acabamento.', 'erro');
      App.campoInvalido(document.getElementById('acab-nome'), true);
      return;
    }

    try {
      await API.acabamentos.criar({ nome });
      App.mostrarToast(`Acabamento "${nome}" cadastrado com sucesso!`, 'sucesso');
      document.getElementById('form-novo-acabamento').reset();
      App.campoInvalido(document.getElementById('acab-nome'), false);
      await this.carregarAcabamentos();
      await AtendimentoModule.carregarListas();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao cadastrar acabamento.', 'erro');
    }
  },

  async excluirAcabamento(id) {
    if (!confirm('Deseja desativar este acabamento?')) return;
    try {
      await API.acabamentos.excluir(id);
      App.mostrarToast('Acabamento desativado com sucesso.', 'sucesso');
      await this.carregarAcabamentos();
      await AtendimentoModule.carregarListas();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao desativar acabamento.', 'erro');
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
      if (usuarios.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum usuário cadastrado.</td></tr>';
        return;
      }

      let html = '';
      usuarios.forEach((u) => {
        let perfilBadge = 'bg-slate-100 text-slate-700';
        if (u.perfil === 'ADMIN') perfilBadge = 'bg-purple-100 text-purple-800';
        if (u.perfil === 'ATENDIMENTO') perfilBadge = 'bg-blue-100 text-blue-800';
        if (u.perfil === 'OPERADOR') perfilBadge = 'bg-emerald-100 text-emerald-800';
        if (u.perfil === 'VENDEDOR') perfilBadge = 'bg-amber-100 text-amber-800';

        html += `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2.5 px-3 font-bold text-slate-800">${u.nome}</td>
            <td class="py-2.5 px-3 text-slate-600 text-xs">${u.email}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${perfilBadge}">${u.perfil}</span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${u.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                ${u.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <button onclick="SettingsModule.excluirUsuario(${u.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">
                Desativar
              </button>
            </td>
          </tr>
        `;
      });
      container.innerHTML = html;
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
    }
  },

  async salvarNovoUsuario() {
    const nome = document.getElementById('user-nome').value;
    const email = document.getElementById('user-email').value;
    const senha = document.getElementById('user-senha').value;
    const perfil = document.getElementById('user-perfil').value;

    if (!nome) {
      App.mostrarToast('Informe o nome do usuário.', 'erro');
      App.campoInvalido(document.getElementById('user-nome'), true);
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      App.mostrarToast('Informe um e-mail válido.', 'erro');
      App.campoInvalido(document.getElementById('user-email'), true);
      return;
    }
    if (!senha) {
      App.mostrarToast('Informe a senha do usuário.', 'erro');
      App.campoInvalido(document.getElementById('user-senha'), true);
      return;
    }

    try {
      await API.usuarios.criar({ nome, email, senha, perfil });
      App.mostrarToast(`Usuário "${nome}" cadastrado com sucesso!`, 'sucesso');
      document.getElementById('form-novo-usuario').reset();
      ['user-nome', 'user-email', 'user-senha'].forEach((id) => {
        App.campoInvalido(document.getElementById(id), false);
      });
      await this.carregarUsuarios();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao cadastrar usuário.', 'erro');
    }
  },

  async excluirUsuario(id) {
    if (!confirm('Deseja desativar este usuário?')) return;
    try {
      await API.usuarios.excluir(id);
      App.mostrarToast('Usuário desativado com sucesso.', 'sucesso');
      await this.carregarUsuarios();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao desativar usuário.', 'erro');
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
      if (materiais.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum material cadastrado.</td></tr>';
        return;
      }

      let html = '';
      materiais.forEach((mat) => {
        html += `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2.5 px-3 font-bold text-slate-800">${mat.nome}</td>
            <td class="py-2.5 px-3 font-semibold text-blue-600">${mat.unidade}</td>
            <td class="py-2.5 px-3 text-slate-600 text-xs">${mat.categoria || 'Geral'}</td>
            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${mat.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                ${mat.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <button onclick="SettingsModule.excluirMaterial(${mat.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">
                Excluir/Desativar
              </button>
            </td>
          </tr>
        `;
      });
      container.innerHTML = html;
    } catch (error) {
      console.error('Erro ao listar materiais:', error);
    }
  },

  async salvarNovoMaterial() {
    const nome = document.getElementById('mat-nome').value;
    const unidade = document.getElementById('mat-unidade').value;
    const categoria = document.getElementById('mat-categoria').value;
    const meta_hora = document.getElementById('mat-meta').value;

    if (!nome) {
      App.mostrarToast('Informe o nome do material.', 'erro');
      App.campoInvalido(document.getElementById('mat-nome'), true);
      return;
    }
    if (!unidade) {
      App.mostrarToast('Informe a unidade do material.', 'erro');
      App.campoInvalido(document.getElementById('mat-unidade'), true);
      return;
    }

    try {
      await API.materiais.criar({ nome, unidade, categoria, meta_hora });
      App.mostrarToast(`Material "${nome}" cadastrado com sucesso!`, 'sucesso');
      document.getElementById('form-novo-material').reset();
      App.campoInvalido(document.getElementById('mat-nome'), false);
      App.campoInvalido(document.getElementById('mat-unidade'), false);
      await this.carregarMateriais();
      await OperatorModule.carregarListas();
      HistoryModule.carregarFiltrosSelects();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao cadastrar material.', 'erro');
    }
  },

  async excluirMaterial(id) {
    if (!confirm('Deseja desativar este material?')) return;
    try {
      await API.materiais.excluir(id);
      App.mostrarToast('Material desativado com sucesso.', 'sucesso');
      await this.carregarMateriais();
      await OperatorModule.carregarListas();
      HistoryModule.carregarFiltrosSelects();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao desativar material.', 'erro');
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
      if (operadores.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum operador cadastrado.</td></tr>';
        return;
      }

      let html = '';
      operadores.forEach((op) => {
        html += `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2.5 px-3 font-bold text-slate-800">${op.nome}</td>
            <td class="py-2.5 px-3 text-slate-600 text-xs">${op.cargo || 'Operador'}</td>
            <td class="py-2.5 px-3 text-slate-700 text-xs font-semibold">${op.turno_nome || '1º Turno'}</td>
            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${op.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                ${op.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <button onclick="SettingsModule.excluirOperador(${op.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">
                Desativar
              </button>
            </td>
          </tr>
        `;
      });
      container.innerHTML = html;
    } catch (error) {
      console.error('Erro ao listar operadores:', error);
    }
  },

  async salvarNovoOperador() {
    const nome = document.getElementById('op-novo-nome').value;
    const cargo = document.getElementById('op-novo-cargo').value;
    const turno_padrao = document.getElementById('op-novo-turno').value;

    if (!nome) {
      App.mostrarToast('Informe o nome do operador.', 'erro');
      App.campoInvalido(document.getElementById('op-novo-nome'), true);
      return;
    }

    try {
      await API.operadores.criar({ nome, cargo, turno_padrao });
      App.mostrarToast(`Operador "${nome}" cadastrado com sucesso!`, 'sucesso');
      document.getElementById('form-novo-operador').reset();
      App.campoInvalido(document.getElementById('op-novo-nome'), false);
      await this.carregarOperadores();
      await OperatorModule.carregarListas();
      HistoryModule.carregarFiltrosSelects();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao cadastrar operador.', 'erro');
    }
  },

  async excluirOperador(id) {
    if (!confirm('Deseja desativar este operador?')) return;
    try {
      await API.operadores.excluir(id);
      App.mostrarToast('Operador desativado com sucesso.', 'sucesso');
      await this.carregarOperadores();
      await OperatorModule.carregarListas();
      HistoryModule.carregarFiltrosSelects();
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao desativar operador.', 'erro');
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

    if (!confirm('⚠️ ATENÇÃO: Restaurar um backup substituirá a base de dados atual. Uma cópia de segurança preventiva será salva automaticamente. Deseja continuar?')) {
      return;
    }

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