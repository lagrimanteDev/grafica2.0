// Controlador Principal da Aplicação - Gráfica EPA
const App = {
  tabAtiva: 'atendimento',
  usuarioAtual: null,

  async init() {
    this.setupClock();
    this.setupNavigation();
    this.setupModals();
    this.setupAccessibility();
    this.setupLogin();

    // Inicializar módulos
    await AtendimentoModule.init();
    await KanbanModule.init();
    await OperatorModule.init();

    // Health check periódico
    this.checkHealth();
    setInterval(() => this.checkHealth(), 30000);

    // Verificar se veio com ?pedido= na URL (QR Code)
    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get('pedido');
    if (pedidoId) {
      setTimeout(() => {
        KanbanModule.abrirDetalhes(Number(pedidoId));
      }, 500);
    }
  },

  // ==========================================
  // SISTEMA DE LOGIN E PERFIS
  // ==========================================
  setupLogin() {
    const btnLogin = document.getElementById('btn-login-usuario');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        if (this.usuarioAtual) {
          this.logout();
        } else {
          this.abrirModalLogin();
        }
      });
    }

    // Seleção de perfil no modal
    document.querySelectorAll('.btn-perfil-login').forEach((btn) => {
      btn.addEventListener('click', () => {
        const perfil = btn.dataset.perfil;
        document.getElementById('login-perfil').value = perfil;
        document.querySelectorAll('.btn-perfil-login').forEach((b) => {
          b.classList.remove('border-blue-600', 'bg-blue-50', 'ring-2', 'ring-blue-500');
        });
        btn.classList.add('border-blue-600', 'bg-blue-50', 'ring-2', 'ring-blue-500');

        // Preencher credenciais de demonstração
        const emailInput = document.getElementById('login-email');
        const senhaInput = document.getElementById('login-senha');
        if (perfil === 'ADMIN') {
          emailInput.value = 'admin@graficaepa.com';
          senhaInput.value = 'admin123';
        } else if (perfil === 'OPERADOR') {
          emailInput.value = 'operador@graficaepa.com';
          senhaInput.value = 'oper123';
        } else if (perfil === 'CLIENTE') {
          emailInput.value = 'cliente@graficaepa.com';
          senhaInput.value = 'cliente123';
        }
      });
    });

    // Submissão do login
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.fazerLogin();
      });
    }
  },

  abrirModalLogin() {
    const modal = document.getElementById('modal-login');
    if (modal) {
      modal.classList.remove('hidden');
      // Pré-selecionar ADMIN por padrão
      const btnAdmin = document.querySelector('.btn-perfil-login[data-perfil="ADMIN"]');
      if (btnAdmin) btnAdmin.click();
    }
  },

  async fazerLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const perfil = document.getElementById('login-perfil').value;

    try {
      const res = await API.usuarios.login({ email, senha });

      // Verificar se o perfil selecionado corresponde ao perfil do usuário
      if (res.usuario.perfil !== perfil) {
        App.mostrarToast(`Este usuário pertence ao perfil ${res.usuario.perfil}. Selecione o perfil correto.`, 'erro');
        return;
      }

      this.usuarioAtual = res.usuario;
      localStorage.setItem('grafica_epa_usuario', JSON.stringify(res.usuario));

      // Atualizar interface
      const btnLogin = document.getElementById('btn-login-usuario');
      const loginIcon = document.getElementById('login-icon');
      const loginText = document.getElementById('login-text');

      if (btnLogin) {
        btnLogin.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'border-blue-500');
        btnLogin.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'border-emerald-500');
      }
      if (loginIcon) loginIcon.textContent = '✅';
      if (loginText) loginText.textContent = res.usuario.nome.split(' ')[0];

      // Fechar modal
      document.getElementById('modal-login').classList.add('hidden');

      // Aplicar permissões de acesso
      this.aplicarPermissoes();

      App.mostrarToast(`Bem-vindo, ${res.usuario.nome}!`, 'sucesso');
    } catch (error) {
      App.mostrarToast(error.message || 'Erro ao fazer login.', 'erro');
    }
  },

  logout() {
    this.usuarioAtual = null;
    localStorage.removeItem('grafica_epa_usuario');

    const btnLogin = document.getElementById('btn-login-usuario');
    const loginIcon = document.getElementById('login-icon');
    const loginText = document.getElementById('login-text');

    if (btnLogin) {
      btnLogin.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'border-emerald-500');
      btnLogin.classList.add('bg-blue-600', 'hover:bg-blue-700', 'border-blue-500');
    }
    if (loginIcon) loginIcon.textContent = '👤';
    if (loginText) loginText.textContent = 'Entrar';

    // Restaurar todas as abas visíveis
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.classList.remove('hidden');
    });

    App.mostrarToast('Você saiu do sistema.', 'info');
    this.navegarPara('atendimento');
  },

  aplicarPermissoes() {
    if (!this.usuarioAtual) return;

    const perfil = this.usuarioAtual.perfil;
    const tabs = document.querySelectorAll('.nav-tab-btn');

    tabs.forEach((tab) => {
      const tabId = tab.dataset.tab;
      tab.classList.remove('hidden');

      if (perfil === 'CLIENTE') {
        // Cliente: apenas Atendimento (pedidos)
        if (tabId !== 'atendimento') {
          tab.classList.add('hidden');
        }
      } else if (perfil === 'OPERADOR') {
        // Operador: apenas produção (Kanban, Lançamento Rápido)
        if (tabId !== 'kanban' && tabId !== 'operador') {
          tab.classList.add('hidden');
        }
      } else if (perfil === 'ADMIN') {
        // Admin: acesso a tudo
        // Nada a ocultar
      } else if (perfil === 'ATENDIMENTO') {
        // Atendimento: Atendimento, Kanban, Histórico
        if (tabId !== 'atendimento' && tabId !== 'kanban' && tabId !== 'historico') {
          tab.classList.add('hidden');
        }
      }
    });

    // Navegar para a aba inicial do perfil
    if (perfil === 'CLIENTE') {
      this.navegarPara('atendimento');
    } else if (perfil === 'OPERADOR') {
      this.navegarPara('kanban');
    } else if (perfil === 'ADMIN') {
      this.navegarPara('dashboard');
    } else if (perfil === 'ATENDIMENTO') {
      this.navegarPara('atendimento');
    }
  },

  // Verificar login ao iniciar (restaurar sessão)
  verificarSessao() {
    const saved = localStorage.getItem('grafica_epa_usuario');
    if (saved) {
    }
  },

  // Relógio e Turno em Tempo Real
  setupClock() {
    const clockElem = document.getElementById('relogio-topo');
    const dataElem = document.getElementById('data-topo');
    const badgeTurno = document.getElementById('badge-turno-ativo');

    const atualizar = () => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');

      if (clockElem) {
        clockElem.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      }

      if (dataElem) {
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const diaSemana = diasSemana[now.getDay()];
        dataElem.textContent = `${diaSemana}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      }

      if (badgeTurno) {
        const hora = now.getHours();
        if (hora >= 6 && hora < 14) {
          badgeTurno.textContent = '☀️ 1º Turno (06h-14h)';
          badgeTurno.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300';
        } else if (hora >= 14 && hora < 22) {
          badgeTurno.textContent = '⛅ 2º Turno (14h-22h)';
          badgeTurno.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300';
        } else {
          badgeTurno.textContent = '🌙 3º Turno (22h-06h)';
          badgeTurno.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300';
        }
      }
    };

    atualizar();
    setInterval(atualizar, 1000);
  },

  // Navegação entre Tabs
  setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        this.navegarPara(targetTab);
      });
    });
  },

  navegarPara(tabId) {
    this.tabAtiva = tabId;

    // Atualizar botões visuais do menu
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    });

    // Ocultar todas as seções e exibir a ativa
    document.querySelectorAll('.tab-content-section').forEach((sec) => {
      sec.classList.add('hidden');
    });

    const activeSec = document.getElementById(`section-${tabId}`);
    if (activeSec) {
      activeSec.classList.remove('hidden');
      activeSec.classList.add('fade-in');
    }

    // Inicializar ou recarregar dados do módulo chamado
    if (tabId === 'atendimento') {
      AtendimentoModule.carregarUltimosPedidos();
    } else if (tabId === 'kanban') {
      KanbanModule.carregarKanban();
    } else if (tabId === 'operador') {
      OperatorModule.carregarUltimosLancamentos();
    } else if (tabId === 'historico') {
      HistoryModule.init();
    } else if (tabId === 'dashboard') {
      DashboardModule.init();
    } else if (tabId === 'configuracoes') {
      SettingsModule.init();
    }
  },

  // Sistema de Modais
  setupModals() {
    // Fechar ao clicar no botão X ou overlay
    document.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-container');
        if (modal) modal.classList.add('hidden');
      });
    });

    document.querySelectorAll('.modal-container').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });
  },

  // Acessibilidade (Modo Chão de Fábrica com Botões Maiores)
  setupAccessibility() {
    const btnToggle = document.getElementById('btn-toggle-modo-fabrica');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        document.body.classList.toggle('modo-chao-fabrica');
        const isAtivo = document.body.classList.contains('modo-chao-fabrica');
        btnToggle.classList.toggle('bg-amber-100', isAtivo);
        btnToggle.classList.toggle('text-amber-900', isAtivo);
        this.mostrarToast(isAtivo ? 'Modo Chão de Fábrica ativado (botões ampliados)' : 'Modo Padrão ativado', 'info');
      });
    }
  },

  // Health check com backend
  async checkHealth() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      const dot = document.getElementById('status-indicator-dot');
      const text = document.getElementById('status-indicator-text');
      if (dot && text && data.status === 'ONLINE') {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
        text.textContent = 'Sistema Online';
      }
    } catch (e) {
      const dot = document.getElementById('status-indicator-dot');
      const text = document.getElementById('status-indicator-text');
      if (dot && text) {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500';
        text.textContent = 'Sem Conexão';
      }
    }
  },

  // Toast Notifications
  mostrarToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    let bg = 'bg-slate-900 text-white border-slate-700';
    let icon = 'ℹ️';

    if (tipo === 'sucesso') {
      bg = 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-200';
      icon = '✅';
    } else if (tipo === 'erro') {
      bg = 'bg-red-600 text-white border-red-500 shadow-red-200';
      icon = '❌';
    } else if (tipo === 'aviso') {
      bg = 'bg-amber-600 text-white border-amber-500 shadow-amber-200';
      icon = '⚠️';
    }

    toast.className = `p-4 rounded-xl shadow-lg border flex items-center space-x-3 text-sm font-semibold transform transition-all duration-300 translate-y-2 opacity-0 ${bg}`;
    toast.innerHTML = `
      <span class="text-xl">${icon}</span>
      <span>${mensagem}</span>
    `;

    container.appendChild(toast);

    // Animar entrada
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 20);

    // Remover após 3.5 segundos
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

// Inicialização automática ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});