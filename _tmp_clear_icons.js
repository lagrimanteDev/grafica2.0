const { db, initDatabase } = require('./server/database');
const fs = require('fs');

(async () => {
  await initDatabase();
  await db.runAsync("UPDATE etapas_producao SET icone = ''");
  const r = await db.allAsync('SELECT id, nome, icone FROM etapas_producao ORDER BY ordem');
  fs.writeFileSync('_tmp_etapas2.json', JSON.stringify(r, null, 2));
  console.log('OK - icones limpos');
  process.exit(0);
})().catch((e) => {
  fs.writeFileSync('_tmp_etapas2.json', 'ERR: ' + e.message);
  console.error(e);
  process.exit(1);
});