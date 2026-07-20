const mysql = require('mysql2/promise');
(async()=>{
  // Try AUTH_SOCKET style - connecting without password through localhost
  // with auth_plugin specified
  const configs = [
    {host:'localhost', user:'root', password:'', database:'EduOS'},
    {host:'127.0.0.1', user:'root', password:'', database:'EduOS'},
    {host:'localhost', user:'root', password:'root', database:'EduOS'},
  ];
  for (const cfg of configs) {
    try {
      const c = await mysql.createConnection({...cfg, connectTimeout:2000});
      console.log('GOT: conn ok', cfg.host, cfg.password);
      const[r]=await c.execute('SELECT 1 AS test');
      console.log(JSON.stringify(r[0]));
      await c.end();
      process.exit(0);
    } catch(e) {
      console.log(cfg.host, 'pw='+JSON.stringify(cfg.password), ':', e.code, e.message.split('\n')[0]);
    }
  }
  console.log('ALL FAILED');
  process.exit(1);
})();
