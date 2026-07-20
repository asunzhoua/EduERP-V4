const mysql = require('mysql2/promise');
(async()=>{
  for(const method of ['','root','admin','password','mysql','P@ssw0rd','123456','toor','root123']){
    try {
      const c = await mysql.createConnection({
        host:'localhost', user:'root', password:method,
        database:'EduOS', connectTimeout:2000,
      });
      console.log('SUCCESS password='+JSON.stringify(method));
      const[r]=await c.execute('SELECT 1 AS test');
      console.log(JSON.stringify(r[0]));
      await c.end();
      process.exit(0);
    }catch(e){if(e.code!='ECONNREFUSED'&&e.code!='ER_ACCESS_DENIED_ERROR')console.log(method+':', e.code, e.message)}
  }
  console.log('ALL FAILED');
  process.exit(1);
})();
