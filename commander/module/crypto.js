const crypto = require('crypto')

function encrypt(text, key) {
  key = Buffer.from(key, 'hex')
  let cipher = crypto.createCipheriv('aes-128-cbc', key, Buffer.alloc(16))
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

function decrypt(encrypted, key) {
  key = Buffer.from(key, 'hex')
  let decipher = crypto.createDecipheriv('aes-128-cbc', key, Buffer.alloc(16))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

function hash(text, key) {
  text = Buffer.from(text + key, 'utf-8').toString('base64')

  let sha = crypto.createHash('sha512')
  sha.update(text)
  return sha.digest('hex')
}

function generateRandomString(length) {
  var result = ''
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  var charactersLength = characters.length
  for ( var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }

  return result
}


module.exports = {
  encrypt,
  decrypt,
  hash,
  generateRandomString,
}
