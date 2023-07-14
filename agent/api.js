const http = require('http')
const url = require('url')

const config = require('./config')
const si = require('./module/systemInformation')
const docker = require('./module/docker')
const logger = require('./module/logger').child({ module: 'API' })

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

  console.log(decrypted)
  return decrypted
}

function hash(text) {
  text = Buffer.from(text + config.key, 'utf-8').toString('base64')

  let sha = crypto.createHash('sha512')
  sha.update(text)
  return sha.digest('hex')
}

function validateSign(url, sign) {
  return hash(url) === sign
}

function preProcess(req, res, next) {
  logger.info({
    message: 'Processing request',
    method: req.method,
    addr: req.socket.remoteAddress,
    url: req.url,
    headers: req.headers,
  })

  const sign = req.headers['x-sign']

  if (!validateSign(req.url, sign)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Invalid sign.\n')
    return
  }

  const query = url.parse(req.url, true).query
  const payload = JSON.parse(query.payload ? decrypt(query.payload, config.key) : '{}')
  req.payload = payload

  logger.info({
    message: 'Req payload',
    payload,
  })

  if ((new Date()).getTime() - payload.timestamp > 1000 * 10) {
    logger.warning({
      message: 'Expired sign',
      query,
      payload,
      sign,
    })
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Expired.\n')
    return
  }

  return next()
}

async function handleRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname

  const payload = req.payload

  let status = 200
  let data

  switch (pathname) {
    case '/systemInformation':
      data = await si.getSystemInformation()
      break

    case '/docker/run':
      if (payload.command) {
        const result = await docker.dockerRun(payload.command)
        if (result) {
          data = {
            id: result
          }
          break
        }
      }

      status = 500
      break

    case '/docker/stopAndRemove':
      if (payload.containerId) {
        const result = await docker.dockerStopAndRemove(payload.containerId)
        if (result) break
      }

      status = 500
      break

    case '/docker/restart':
      if (payload.containerId) {
        const result = await docker.dockerRestart(payload.containerId)
        if (result) break
      }

      status = 500
      break

    default:
      status = 404
      break
  }

  const dataStr = encrypt(JSON.stringify({
    status,
    data,
    date: (new Date()).getTime(),
  }), config.key)

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'x-sign': hash(dataStr),
  })

  res.end(dataStr)
}

// 错误处理
function errorHandler(err, req, res) {
  console.error(err)
  res.writeHead(500, { 'Content-Type': 'text/plain' })
  res.end('Server error.\n')
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    preProcess(req, res, () => {
      return handleRoutes(req, res)
    }).catch((err) => {
      errorHandler(err, req, res)
    })
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method not allowed.\n')
  }
})

server.listen(3001, () => {
  console.log('Server is listening on port 3001')
})
