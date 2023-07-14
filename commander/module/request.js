const axios = require('axios')
const { encrypt, decrypt, hash } = require('./crypto')
const logger = require('./logger').child({ module: 'Request' })

async function req(host, uri, key, payload) {
  logger.info({
    message: 'Request',
    host, uri, payload,
  })
  const url = new URL(host + uri)
  payload.timestamp = (new Date()).getTime()

  url.searchParams.append('payload', encrypt(JSON.stringify(payload), key))

  let sign = hash(url.pathname + url.search, key)

  const result = await axios({
    url: url.toString(),
    headers: {
      'x-sign': sign,
    },
    responseType: 'text',
  })
  let body = result.data
  sign = result.headers['x-sign'] || ''

  if (hash(body, key) !== sign) {
    logger.error({
      message: 'Hash not match',
      sign, agent,
    })
    return
  }

  body = JSON.parse(decrypt(body, key))

  return body
}

module.exports = req
