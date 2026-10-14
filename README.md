# 🖨️ Sistema de Controle Diário de Produção - Gráfica EPA

Sistema web local (ERP de chão de fábrica) para controle diário de tiragens, gestão de pedidos/Ordens de Serviço (OS), indicadores de produtividade por turno, identificação de gargalos e backup automatizado de segurança.

Reúne, em um só lugar, o **Atendimento** (abertura de pedidos), a **Produção** (Kanban de etapas), o **Lançamento Rápido** de produção pelo operador, o **Histórico** com filtros e exportações, o **Painel de Gestão** (dashboard com gráficos), a **Equipe** (cadastro de operadores) e as **Configurações** (cadastros e backups).

---

## 🚀 Como Iniciar o Sistema (1 Clique)

### No Windows:
1. Dê um duplo-clique no arquivo **`iniciar_sistema.bat`**.
2. Na primeira execução, o script instala automaticamente as dependências.
3. O sistema inicializa o servidor local e abre o navegador em `http://localhost:3300`.

### Via Linha de Comando:
```bash
npm install
npm start       # produção
npm run dev     # desenvolvimento (reinicia ao salvar)
npm run seed    # (re)cria os dados de exemplo no banco
```

> **Acesso:** O sistema abre em `http://localhost:3300` (porta padrão **3300**, configurável pela variável de ambiente `PORT`). Se a porta estiver ocupada, o servidor tenta automaticamente a porta seguinte (3301).

---

## 🔐 Credenciais de Acesso (Login)

Ao abrir, a **primeira tela é o login**, com os perfis de acesso. Selecione o perfil ou digite e‑mail e senha:

| Perfil | E-mail | Senha |
| --- | --- | --- |
| 🛡️ **ADMINISTRADOR** | `admin@graficaepa.com` | `admin123` |
| 🏭 **OPERADOR** | `operador@graficaepa.com` | `oper123` |
| 💼 **VENDEDOR** | `vendedor@graficaepa.com` | `vendedor123` |
| 🛎️ **ATENDIMENTO** | `atendimento@graficaepa.com` | `atend123` |

### Permissões por Perfil:
- 🛡️ **ADMINISTRADOR**: acesso total a todos os módulos (Atendimento, Produção, Lançamento, Histórico, Painel de Gestão, Equipe e Configurações).
- 🛎️ **ATENDIMENTO**: **Atendimento**, **Produção (Kanban)**, **Histórico** e **Equipe**.
- 💼 **VENDEDOR**: **Atendimento** (criação de pedidos/OS).
- 🏭 **OPERADOR**: **Produção (Kanban)** e **Lançamento Rápido**.

---

## 🎯 Módulos do Sistema

### 1. 🛎️ Atendimento & Entrada de Pedidos (OS)
- Cadastro completo de pedido/OS: **cliente** (existente ou novo, com WhatsApp), **serviço/produto**, quantidade, dimensões, material/substrato, acabamento e observações técnicas.
- **Upload da arte final** (PDF, CDR, AI, PNG, JPG, TIFF, PSD, EPS).
- Dados financeiros e prazo (valor total, condição/status de pagamento, prioridade, data/hora prometida).
- O **número da OS é gerado automaticamente** e o pedido entra na etapa *"Aguardando Pré‑Impressão"*.

### 2. 🏭 Produção (Kanban)
- Quadro visual com as etapas de produção. É possível **mover os pedidos entre etapas** (botões ou arrastar) e **buscar** por OS, cliente ou serviço.
- Detalhes do pedido e **impressão** da OS.

### 3. ⚡ Lançamento Rápido (Operador)
- **Seleção automática de turno** pelo horário (1º 06h–14h, 2º 14h–22h, 3º 22h–06h).
- **Atalhos visuais de material** (botões grandes com ícones para os itens mais usados).
- **Lista completa de materiais**: além dos atalhos, o operador pode escolher **qualquer material já cadastrado** ou **cadastrar um novo tipo de material na hora** (nome + unidade), sem ficar preso apenas aos atalhos do quadro.
- **Incrementos rápidos** `+10`, `+50`, `+100`, `+500` e atalho da tecla **Enter** para registrar.
- **Tags de ocorrência** rápida (normal, manutenção, material, ajuste, urgência).
- **Feedback imediato** com confirmação visual e bipe sonoro suave.
- **Conferência & correção rápida** dos últimos lançamentos na mesma tela (`✏️ Corrigir` / Excluir).

### 4. 🕓 Histórico & Consultas Avançadas
- Filtros por **período** (Hoje, Ontem, Últimos 7 dias, Este Mês, Personalizado), **turno**, **operador**, **material** e **busca textual**.
- **Totais do filtro** em tempo real e **edição/exclusão** de lançamentos.
- **Exportação Excel (.xlsx)** e **Relatório PDF / Impressão**.

### 5. 📊 Painel de Gestão (Dashboard & Gargalos)
- **KPIs em tempo real**: total de lançamentos, dias trabalhados, material líder e total de ocorrências.
- **Gráficos interativos (Chart.js)**: evolução diária da produção, distribuição por material, comparativo por turno e rendimento por operador.
- **Indicadores comerciais** (pedidos, faturamento, ticket médio) e **identificação de gargalos** (motivos de parada e turnos abaixo da média).

### 6. 👷 Equipe (Operadores do Chão de Fábrica)
- Aba dedicada para **cadastrar, editar, ativar/desativar e excluir operadores** do chão de fábrica.
- **Resumo por turno**: cards com a quantidade de operadores ativos em cada turno (1º, 2º e 3º).
- Definição de **cargo/função** e **turno padrão** de cada colaborador.
- Disponível para os perfis **ADMINISTRADOR** e **ATENDIMENTO**.

### 7. ⚙️ Configurações & Central de Backups
- Cadastro e manutenção de **Materiais**, **Serviços/Produtos**, **Acabamentos** e **Usuários** (ativar/desativar sem perder histórico).
- **Rotina automatizada de backup**: snapshots diários do banco SQLite na pasta `/backups`.
- **Cópia manual & exportação JSON**, além de **restauração segura** (com salvamento preventivo automático).
- Trilha de **auditoria** das ações realizadas no sistema.

---

## 🗂️ Estrutura do Projeto

```
grafica2.0/
├── iniciar_sistema.bat      # Inicializa tudo com duplo-clique (Windows)
├── package.json
├── server/
│   ├── index.js             # Sobe o Express, inicializa DB, seed e backups
│   ├── database.js          # Conexão e criação das tabelas SQLite
│   ├── seed.js              # Dados de exemplo (materiais, operadores, pedidos)
│   ├── backup.js            # Agendador de backups automáticos
│   └── routes/              # API REST (producao, pedidos, clientes, materiais, ...)
├── public/                  # Frontend (HTML + Tailwind + JS modular)
│   ├── index.html
│   ├── js/                  # app, atendimento, kanban, operator, history, ...
│   └── css/
├── data/                    # Banco SQLite (grafica_epa.sqlite)
└── backups/                 # Cópias de segurança automáticas
```

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5 semântico, Tailwind CSS, JavaScript moderno (modular), Chart.js, SheetJS (XLSX).
- **Backend**: Node.js, Express, SQLite3 embutido (sem banco externo).
- **Validação**: Zod (nas requisições de pedidos).
- **Uploads**: Multer (artes finais e arquivos de backup).
- **Armazenamento**: SQLite local (`/data/grafica_epa.sqlite`) e rotina de backups diários (`/backups`).
