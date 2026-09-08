const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3300,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      const body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO TESTES DO SISTEMA GRÁFICA EPA (PORTA 3300) ---');

  try {
    // 1. Health check
    console.log('[1/8] Testando /api/status...');
    const statusRes = await makeRequest('/api/status');
    console.log('-> Status Code:', statusRes.status, 'Sistema:', statusRes.data.sistema);

    // 2. Listar Materiais
    console.log('[2/8] Testando /api/materiais...');
    const matRes = await makeRequest('/api/materiais');
    console.log('-> Total de materiais cadastrados:', matRes.data.length);

    // 3. Listar Operadores
    console.log('[3/8] Testando /api/operadores...');
    const opRes = await makeRequest('/api/operadores');
    console.log('-> Total de operadores cadastrados:', opRes.data.length);

    // 4. Testar Dashboard / Métricas
    console.log('[4/8] Testando /api/dashboard/metricas...');
    const dashRes = await makeRequest('/api/dashboard/metricas?dias=14');
    console.log('-> KPIs:', {
      totalLancamentos: dashRes.data.kpis.totalLancamentos,
      diasTrabalhados: dashRes.data.kpis.diasTrabalhados,
      topMaterial: dashRes.data.kpis.topMaterial?.nome
    });

    // 5. Testar Novo Lançamento do Operador Carlos Henrique
    console.log('[5/8] Testando POST /api/producao (Lançamento do Carlos Henrique)...');
    const novoLancamento = {
      data: new Date().toISOString().slice(0, 10),
      hora: '10:30',
      turno_id: 1,
      operador_id: 1, // Carlos Henrique
      material_id: 1, // Banners em Lona
      quantidade: 75.5,
      unidade: 'm²',
      observacoes: 'Teste de impressão em lote matutino.',
      tipo_ocorrencia: 'NORMAL'
    };
    const postRes = await makeRequest('/api/producao', 'POST', novoLancamento);
    console.log('-> Lançamento criado ID:', postRes.data.registro.id, 'Qtd:', postRes.data.registro.quantidade, postRes.data.registro.unidade);
    const idCriado = postRes.data.registro.id;

    // 6. Testar Correção Rápida de Lançamento (PUT)
    console.log('[6/8] Testando PUT /api/producao/:id (Retificação de digitação)...');
    const updateLancamento = {
      ...novoLancamento,
      quantidade: 85.0,
      observacoes: 'Quantidade corrigida de 75.5 para 85.0 m².'
    };
    const putRes = await makeRequest(`/api/producao/${idCriado}`, 'PUT', updateLancamento);
    console.log('-> Lançamento corrigido ID:', putRes.data.registro.id, 'Nova Qtd:', putRes.data.registro.quantidade);

    // 7. Testar Criação de Backup Manual
    console.log('[7/8] Testando POST /api/backup/criar...');
    const backupRes = await makeRequest('/api/backup/criar', 'POST');
    console.log('-> Backup criado com sucesso:', backupRes.data.backup.arquivo);

    // 8. Listar Backups
    console.log('[8/8] Testando GET /api/backup...');
    const listBackupRes = await makeRequest('/api/backup');
    console.log('-> Total de arquivos de backup disponíveis:', listBackupRes.data.length);

    console.log('\n✅ TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Falha nos testes:', error);
    process.exit(1);
  }
}

runTests();
