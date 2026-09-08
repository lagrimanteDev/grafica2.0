const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./database');
const { seedDatabase } = require('./seed');
const { startAutoBackupScheduler } = require('./backup');

const producaoRoutes = require('./routes/producao');
const materiaisRoutes = require('./routes/materiais');
const operadoresRoutes = require('./routes/operadores');
const dashboardRoutes = require('./routes/dashboard');
const backupRoutes = require('./routes/backup');
const pedidosRoutes = require('./routes/pedidos');
const clientesRoutes = require('./routes/clientes');
const usuariosRoutes = require('./routes/usuarios');
const auditoriaRoutes = require('./routes/auditoria');
const servicosRoutes = require('./routes/servicos');
const acabamentosRoutes = require('./routes/acabamentos');

const app = express();
const PORT = process.env.PORT || 3300;

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos da interface web
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Servir arquivos de upload (artes finais)
const uploadsDir = path.join(__dirname, 'temp_uploads');
app.use('/uploads', express.static(uploadsDir));

// Rotas da API
app.use('/api/producao', producaoRoutes);
app.use('/api/materiais', materiaisRoutes);
app.use('/api/operadores', operadoresRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/servicos', servicosRoutes);
app.use('/api/acabamentos', acabamentosRoutes);

// Health check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    sistema: 'ERP & Dashboard de Produção Gráfica - Gráfica EPA',
    versao: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Fallback para SPA no navegador
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Gráfica EPA - Servidor ativo. Aguardando arquivos da interface...');
  }
});

// Inicialização do Servidor
async function startServer() {
  try {
    console.log('--- ERP & DASHBOARD DE PRODUÇÃO GRÁFICA | GRÁFICA EPA ---');
    console.log('Inicializando banco de dados...');
    await initDatabase();

    console.log('Verificando dados iniciais (seed)...');
    await seedDatabase(false);

    console.log('Ativando rotina de backup automatizada...');
    startAutoBackupScheduler();

    const server = app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`✅ ERP DA GRÁFICA EPA PRONTO E OPERACIONAL!`);
      console.log(`👉 Acesso Local: http://localhost:${PORT}`);
      console.log(`👉 Acesso na Rede Local (Computadores da Gráfica): http://<IP_DO_COMPUTADOR>:${PORT}`);
      console.log(`======================================================\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const altPort = Number(PORT) + 1;
        console.warn(`Porta ${PORT} em uso. Tentando porta alternativa ${altPort}...`);
        app.listen(altPort, () => {
          console.log(`✅ Sistema ativo na porta alternativa: http://localhost:${altPort}`);
        });
      } else {
        console.error('Erro ao iniciar servidor:', err);
      }
    });
  } catch (error) {
    console.error('Erro crítico na inicialização do servidor:', error);
    process.exit(1);
  }
}

startServer();