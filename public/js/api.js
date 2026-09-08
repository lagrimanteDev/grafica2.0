// Cliente API para o Sistema Gráfica EPA
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro na requisição (${response.status})`);
      }
      return data;
    } catch (error) {
      console.error(`Erro na chamada API ${endpoint}:`, error);
      throw error;
    }
  },

  // Produção
  producao: {
    listar: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/producao?${query}`);
    },
    ultimos: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/producao/ultimos?${query}`);
    },
    obter: (id) => API.request(`/producao/${id}`),
    salvar: (dados) => API.request('/producao', { method: 'POST', body: JSON.stringify(dados) }),
    atualizar: (id, dados) => API.request(`/producao/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    excluir: (id) => API.request(`/producao/${id}`, { method: 'DELETE' })
  },

  // Materiais
  materiais: {
    listar: (todos = false) => API.request(`/materiais?todos=${todos}`),
    criar: (dados) => API.request('/materiais', { method: 'POST', body: JSON.stringify(dados) }),
    atualizar: (id, dados) => API.request(`/materiais/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    excluir: (id) => API.request(`/materiais/${id}`, { method: 'DELETE' })
  },

  // Operadores e Turnos
  operadores: {
    listar: (todos = false) => API.request(`/operadores?todos=${todos}`),
    criar: (dados) => API.request('/operadores', { method: 'POST', body: JSON.stringify(dados) }),
    atualizar: (id, dados) => API.request(`/operadores/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    excluir: (id) => API.request(`/operadores/${id}`, { method: 'DELETE' }),
    listarTurnos: () => API.request('/operadores/turnos/lista')
  },

  // Dashboard & Métricas
  dashboard: {
    obterMetricas: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/dashboard/metricas?${query}`);
    }
  },

  // Backups
  backup: {
    listar: () => API.request('/backup'),
    criar: () => API.request('/backup/criar', { method: 'POST' }),
    downloadUrl: (arquivo) => `/api/backup/download/${arquivo}`,
    exportarJsonUrl: () => '/api/backup/exportar-json',
    restaurar: async (file) => {
      const formData = new FormData();
      formData.append('backup_file', file);
      const res = await fetch('/api/backup/restaurar', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na restauração');
      return data;
    }
  },

  // ==========================================
  // NOVAS ROTAS - ERP DE PRODUÇÃO GRÁFICA
  // ==========================================

  // Pedidos / Ordens de Serviço
  pedidos: {
    listar: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/pedidos?${query}`);
    },
    kanban: () => API.request('/pedidos/kanban'),
    etapas: () => API.request('/pedidos/etapas'),
    obter: (id) => API.request(`/pedidos/${id}`),
    criar: async (formData) => {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar pedido');
      return data;
    },
    atualizar: (id, dados) => API.request(`/pedidos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    mover: (id, dados) => API.request(`/pedidos/${id}/mover`, { method: 'POST', body: JSON.stringify(dados) }),
    excluir: (id, dados = {}) => API.request(`/pedidos/${id}`, { method: 'DELETE', body: JSON.stringify(dados) }),
    etiqueta: (id) => API.request(`/pedidos/${id}/etiqueta`)
  },

  // Clientes
  clientes: {
    listar: (todos = false) => API.request(`/clientes?todos=${todos}`),
    obter: (id) => API.request(`/clientes/${id}`),
    criar: (dados) => API.request('/clientes', { method: 'POST', body: JSON.stringify(dados) }),
    atualizar: (id, dados) => API.request(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    excluir: (id) => API.request(`/clientes/${id}`, { method: 'DELETE' })
  },

  // Usuários
  usuarios: {
    listar: (todos = false) => API.request(`/usuarios?todos=${todos}`),
    criar: (dados) => API.request('/usuarios', { method: 'POST', body: JSON.stringify(dados) }),
    atualizar: (id, dados) => API.request(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    excluir: (id) => API.request(`/usuarios/${id}`, { method: 'DELETE' }),
    login: (dados) => API.request('/usuarios/login', { method: 'POST', body: JSON.stringify(dados) })
  },

  // Auditoria
  auditoria: {
    listar: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/auditoria?${query}`);
    },
    acoes: () => API.request('/auditoria/acoes')
  },

  // Serviços / Produtos
  servicos: {
    listar: (todos = false) => API.request(`/servicos?todos=${todos}`),
    criar: (dados) => API.request('/servicos', { method: 'POST', body: JSON.stringify(dados) }),
    atualizar: (id, dados) => API.request(`/servicos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    excluir: (id) => API.request(`/servicos/${id}`, { method: 'DELETE' })
  },

  // Acabamentos
  acabamentos: {
    listar: (todos = false) => API.request(`/acabamentos?todos=${todos}`),
    criar: (dados) => API.request('/acabamentos', { method: 'POST', body: JSON.stringify(dados) }),
    atualizar: (id, dados) => API.request(`/acabamentos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    excluir: (id) => API.request(`/acabamentos/${id}`, { method: 'DELETE' })
  }
};