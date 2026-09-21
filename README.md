# 🖨️ Sistema de Controle Diário de Produção - Gráfica EPA

Sistema web local e acessível para controle diário de tiragens, indicadores de produtividade por turno, identificação de gargalos de produção e backup automatizado de segurança.

Projetado especificamente para o operador de chão de fábrica **Carlos Henrique** (foco em simplicidade extrema, botões visuais grandes e feedback instantâneo) e para a **Gestão da Gráfica EPA** (gráficos, comparativos de turno, relatórios em Excel/PDF).

---

## 🚀 Como Iniciar o Sistema (1 Clique)

### No Windows:
1. Dê um duplo-clique no arquivo **`iniciar_sistema.bat`**.
2. O sistema inicializará o servidor local e abrirá automaticamente no seu navegador em `http://localhost:3000`.

### Via Linha de Comando:
```bash
npm install
npm start
```

> **Acesso:** O sistema abre em `http://localhost:3300` (a porta padrão é a **3300**, configurável pela variável de ambiente `PORT`).

---

## 🔐 Credenciais de Acesso (Login)

Ao abrir o sistema, a **primeira tela é a página de login**, com os **3 perfis de acesso**. Selecione o perfil, ou digite o e-mail e a senha abaixo:

| Perfil | E-mail | Senha |
| --- | --- | --- |
| 🛡️ **ADMINISTRADOR** | `admin@graficaepa.com` | `admin123` |
| 🏭 **OPERADOR** | `operador@graficaepa.com` | `oper123` |
| 💼 **VENDEDOR** | `vendedor@graficaepa.com` | `vendedor123` |

> **Perfis adicionais no banco (seed):** `atendimento@graficaepa.com` / `atend123` (perfil **ATENDIMENTO**).

### Permissões por Perfil:
- 🛡️ **ADMINISTRADOR**: acesso total a todos os módulos (Atendimento, Kanban, Lançamento, Histórico, Painel de Gestão e Configurações).
- 🏭 **OPERADOR**: acesso restrito ao **Chão de Fábrica (Kanban)** e **Lançamento Rápido**.
- 💼 **VENDEDOR**: acesso restrito ao módulo de **Atendimento** (criação de pedidos/OS).
- 🛎️ **ATENDIMENTO**: acesso a **Atendimento**, **Kanban** e **Histórico**.

---

## 🎯 Módulos do Sistema

### 1. 📝 Módulo do Operador (Chão de Fábrica)
- **Seleção Automática de Turno**: O sistema identifica pelo relógio se é 1º Turno (06h às 14h), 2º Turno (14h às 22h) ou 3º Turno (22h às 06h).
- **Seleção Visual de Materiais**: Botões grandes com ícones para Banners, Panfletos, Cartões de Visita, Adesivos, Folders, Envelopes, Faixas e Rótulos.
- **Teclado Numérico & Incrementos Rápidos**: Botões de `+10`, `+50`, `+100`, `+500` e atalho de tecla **Enter** para registrar.
- **Feedback Imediato**: Alerta visual verde com confirmação do volume registrado e bipe sonoro suave.
- **Conferência & Correção Rápida**: Lista dos últimos lançamentos na mesma tela, permitindo retificar digitações em 2 cliques (`✏️ Corrigir`).

### 2. 📋 Histórico & Consultas Avançadas
- Filtros por **Período** (Hoje, Ontem, Últimos 7 dias, Este Mês, Intervalo Personalizado), **Turno**, **Operador**, **Material** e **Busca Textual**.
- **Totais do Filtro**: Somatório automático em tempo real de cada material filtrado.
- **Exportação Excel (.xlsx)**: Gera planilha formatada com 1 clique para auditoria e reuniões.
- **Relatório PDF / Impressão**: Layout limpo e profissional pronto para impressão.

### 3. 📊 Painel de Gestão (Dashboard & Gargalos)
- **KPIs em Tempo Real**: Total de jobs finalizados, dias trabalhados, material líder e total de ocorrências.
- **Gráficos Interativos (Chart.js)**:
  - *Evolução Diária da Produção* (Volume x Lotes).
  - *Distribuição por Tipo de Material* (Pizza / Rosca).
  - *Comparativo de Desempenho por Turno* (1º vs 2º vs 3º).
  - *Rendimento por Operador / Equipe*.
- **Identificação de Gargalos**: Módulo que lista os motivos de parada de máquina (limpeza, manutenção, calibração, troca de bobina) e turnos com rendimento abaixo da média.

### 4. ⚙️ Cadastros & Central de Backups
- Cadastro e manutenção de **Materiais Gráficos** e **Operadores / Turnos**.
- **Rotina Automatizada de Backup**: Salva snapshots diários do banco SQLite na pasta `/backups`.
- **Cópia Manual & JSON**: Botões para download do arquivo `.sqlite` e exportação completa em formato `.json`.
- **Restauração Segura**: Upload de arquivo de backup com salvamento preventivo automático.

---

## ⏱️ Treinamento Rápido de 15 Minutos (Para o Operador)

1. **Passo 1 (Abrir)**: Dê duplo-clique no ícone `iniciar_sistema.bat`. O sistema já abre no navegador.
2. **Passo 2 (Verificar Turno e Operador)**: O turno já vem selecionado automaticamente pelo horário atual. Verifique seu nome no campo *Operador*.
3. **Passo 3 (Escolher o Material)**: Clique no botão do material que acabou de produzir (ex: *Banners em Lona* ou *Adesivos*).
4. **Passo 4 (Digitar a Quantidade)**: Digite a quantidade e pressione a tecla **Enter** (ou clique no botão verde *REGISTRAR PRODUÇÃO*).
5. **Passo 5 (Conferir ou Corrigir)**: O registro aparecerá na coluna da direita. Se digitou algum número errado, clique no botão **✏️ (Lápis)** para corrigir na hora.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5 Semântico, Tailwind CSS, JavaScript Moderno, Chart.js, SheetJS (XLSX).
- **Backend**: Node.js, Express, SQLite3 embutido (sem necessidade de banco externo).
- **Armazenamento**: SQLite local (`/data/grafica_epa.sqlite`) e rotina rotativa de 30 backups diários (`/backups`).
# Sistema_Grafica_EPA
