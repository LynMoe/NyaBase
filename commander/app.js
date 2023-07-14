const db = require('./module/db')

;(async () => {
  await db.initClient()
  
  require('./api')
})()
