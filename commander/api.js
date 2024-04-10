const http = require('http')
const url = require('url')
const fs = require('fs')
const path = require('path')

const logger = require('./module/logger').child({ module: 'API' })
const config = require('./config')
const si = require('./module/systemInformation')
const user = require('./module/user')
const crypto = require('./module/crypto')
const container = require('./module/container')
const group = require('./module/group')

async function preProcess(req, res, next) {
  logger.info({
    message: 'Processing request',
    method: req.method,
    addr: req.socket.remoteAddress,
    url: req.url,
    'x-auth': req.headers['x-auth'],
  })

  const query = url.parse(req.url, true).query
  req.query = query || {}

  const [username, loginTime, salt, sign] = `${(req.headers['x-auth'] || '')}`.split('|')
  if (await user.checkToken(username, loginTime, salt, sign) === true) req.query.username = username
  else req.query.username = undefined

  logger.info({
    message: 'User auth',
    username: req.query.username,
  })

  return next()
}

const __cacheSi = {}

function checkLock(username, state = 'prelock') {
  if (si._userLock[username] && state === 'prelock') return false

  switch (state) {
    case 'prelock':
      si._userLock[username] = {
        time: (new Date()).getTime(),
        ready: false,
        callback: [],
      }
      return true
    case 'lock':
      si._userLock[username] = {
        time: (new Date()).getTime(),
        ready: true,
        callback: [],
      }
      return true
    case 'wait':
      return new Promise((resolve) => {
        si._userLock[username].callback.push(() => {
          resolve()
        })
      })
    case 'clear':
      delete si._userLock[username]
      break
  }
}

function getAgentNameByContainerId(containerId) {
  const containerList = container.getAllContainerByUsername()
  for (const user in containerList) {
    if (containerList[user].map(i => i.id).includes(containerId)) {
      return containerList[user].filter(i => i.id === containerId)[0].agentName
    }
  }
}

const routes = {
  '/user/login': async (query) => {
    let status, data
    const { loginUsername, password } = query
    if (!loginUsername || !password) return {
      data: {
        msg: 'Missing field'
      },
      status: 400,
    }
    logger.info(`Login request - ${loginUsername} - ${password.length}`)

    const result = await user.checkUsernamePassword(loginUsername, password)
    if (result) {
      if ((await user.findUser(loginUsername)).group.name === 'BLOCKED') {
        return {
          status: 403,
          data: {
            msg: 'User blocked'
          }
        }
      }

      const ordered = [loginUsername, (new Date()).getTime().toString(), crypto.generateRandomString(16),]
      const sign = crypto.hash(JSON.stringify(ordered), config.key)
      ordered.push(sign)

      data = {
        token: ordered.join('|'),
      }
    } else {
      data = {
        msg: 'Wrong username or password'
      }
      status = 401
    }

    return {
      status,
      data,
    }
  },
  '/user/changePassword': async (query) => {
    let status, data
    const { username, password } = query
    if (!username || !password) {
      data = {
        msg: 'Missing field'
      }
      status = 400
    }

    await user.updateUser(username, {
      password: `${password}`.trim(),
    })

    return {
      status,
      data,
    }
  },
  '/container/getMeta': async (query) => {
    let status, data

    const userInfo = await user.findUser(query.username)
    const group = userInfo.group
    delete group._id

    const userContainerList = await container.getAllContainerByUsername()[userInfo.username] || []
    for (const item of userContainerList) {
      const agentName = item.agentName
      item.ip = config.agent[agentName].shownIp
    }

    const images = config.images

    data = {
      images,
      group,
      containerList: userContainerList || [],
    }

    return {
      status,
      data,
    }
  },
  '/container/create': async (query) => {
    let status, data

    let { username, server, image } = query
    server = `${server}`.toUpperCase()

    if (!checkLock(username, 'prelock')) {
      data = {
        msg: 'Wait',
      }
      status = 400
      return { data, status }
    }

    const userInfo = await user.findUser(username)
    const group = userInfo.group.data
    if (!group.server.includes(server) || !config.images[image] || userInfo.group.name === 'BLOCKED') {
      data = {
        msg: 'Forbidden',
      }
      status = 403
      checkLock(username, 'clear')
      return { data, status }
    }

    let containerList = container.getAllContainerByUsername()[username]
    if (containerList && containerList.filter(i => i.agentName === server).length > 0) {
      data = {
        msg: 'Limit reached',
      }
      status = 400
      checkLock(username, 'clear')
      return { data, status }
    }

    const randomStr = `${Math.floor((new Date()).getTime() / 1000)}-${crypto.generateRandomString(8)}`
    const serverBasePort = config.agent[server].basePort
    const containerBasePort = serverBasePort + userInfo.userId * 10

    let envs = {
      '%USERNAME%': username,
      '%USERID%': userInfo.userId,
      '%PASSWORD%': crypto.hash(server + username + randomStr, config.key).substring(0, 8),
      '%AGENT_NAME%': server,

      '%UID%': config.user.uidStarts + userInfo.userId,
      '%BASEPORT%': containerBasePort,
      '%PORTRANGE%': `${containerBasePort + 1}-${containerBasePort + 9}`,
      '%CONTAINER_NAME%': `NYATAINER_${server}_${username}_${userInfo.userId}_${containerBasePort}_${randomStr}_${image}`,
      ...config.envs,
      ...config.agent[server].envs,
      ...group.envs,
    }
    try {
      await container.createContainer(config.agent[server], image, envs)
      data = {
        msg: 'Success'
      }
    } catch (e) {
      logger.error({
        message: 'Create container error',
        error: e,
      })
      
      status = 500
      data = {
        msg: 'Internal service error',
      }
    }

    checkLock(username, 'lock')

    return {
      status,
      data,
    }
  },
  '/container/stopAndRemove': async (query) => {
    let status, data

    const { username, containerId } = query

    if (!checkLock(username, 'prelock')) {
      data = {
        msg: 'Wait',
      }
      status = 400
      return { data, status }
    }

    let containerList = container.getAllContainerByUsername()[username]
    let agentName
    if ((containerList && containerList.map(i => {
      if (`${i.id}`.startsWith(containerId)) {
        agentName = i.agentName
        return true
      } else return false
    }).includes(true)) || (await user.findUser(username)).group.name === 'ADMIN') {
      if (!agentName) {
        agentName = getAgentNameByContainerId(containerId)
      }

      const agent = config.agent[agentName]
      try {
        await container.removeContainer(agent, containerId)
        data = {
          msg: 'Success'
        }
      } catch (e) {
        data = {
          msg: 'Internal service error'
        }
        status = 500
      }

    } else {
      status = 404
      data = {
        msg: 'Container not found'
      }
    }

    checkLock(username, 'lock')

    return {
      status,
      data,
    }
  },
  '/container/restart': async (query) => {
    let status, data

    const { username, containerId } = query

    if (!checkLock(username, 'prelock')) {
      data = {
        msg: 'Wait',
      }
      status = 400
      return { data, status }
    }

    const userInfo = await user.findUser(username)

    if (userInfo.group.name === 'BLOCKED') {
      return {
        status: 403,
        data: {
          msg: 'User blocked'
        }
      }
    }

    let containerList = container.getAllContainerByUsername()[username]
    let agentName
    if ((containerList && containerList.map(i => {
      if (`${i.id}`.startsWith(containerId)) {
        agentName = i.agentName
        return true
      } else return false
    }).includes(true)) || userInfo.group.name === 'ADMIN') {
      if (!agentName) {
        agentName = getAgentNameByContainerId(containerId)
      }
      
      const agent = config.agent[agentName]
      await container.restartContainer(agent, containerId)

      data = {
        msg: 'Success'
      }
    } else {
      status = 404
      data = {
        msg: 'Container not found'
      }
    }

    checkLock(username, 'lock')

    return {
      status,
      data,
    }
  },
  '/container/listContainers': async (query) => {
    let status, data
    const { username } = query

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    let containerList = Object.values(container.getAllContainerByUsername())
    let list = []
    for (const con of containerList) list = list.concat(con)
    data = {
      msg: 'Success',
      data: {
        containerList: list,
      }
    }

    return {
      status,
      data,
    }
  },
  '/container/wait': async (query) => {
    const { username } = query

    if (si._userLock[username]) {
      return checkLock(username, 'wait').then(() => {
        return {
          status: 200,
          data: {}
        }
      })
    } else {
      return {
        status: 200,
        data: {}
      }
    }
  },
  '/admin/listUsers': async (query) => {
    let status, data
    const { username } = query

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    const userList = await user.getUsers()
    data = {
      msg: 'Success',
      data: {
        userList,
      }
    }

    return {
      status,
      data,
    }
  },
  '/admin/createUser': async (query) => {
    let status, data
    let { username, createUsername, createPassword, createGroupName, createComment } = query
    createUsername = `${createUsername}`.trim()
    createPassword = `${createPassword}`.trim()
    createGroupName = `${createGroupName}`.trim()
    createComment = `${createComment}`.trim()

    if (!createUsername || !createPassword || !createGroupName) {
      data = {
        msg: 'Missing field'
      }
      status = 400
    }

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    await user.createUser(createUsername, createPassword, createGroupName, createComment, username)
    data = {
      msg: 'Success',
    }

    return {
      status,
      data,
    }
  },
  '/admin/updateUser': async (query) => {
    let status, data
    let { username, createUsername, createPassword, createGroupName, createComment } = query
    createUsername = `${createUsername}`.trim()
    createPassword = `${createPassword}`.trim()
    createGroupName = `${createGroupName}`.trim()
    createComment = `${createComment}`.trim()

    if (!createUsername || (!createPassword && !createGroupName && !createComment)) {
      data = {
        msg: 'Missing field'
      }
      status = 400
    }

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    const needChange = {}
    if (createPassword) needChange.password = createPassword
    if (createGroupName) needChange.group = createGroupName
    if (createComment) needChange.comment = createComment

    await user.updateUser(createUsername, needChange)
    data = {
      msg: 'Success',
    }

    return {
      status,
      data,
    }
  },
  '/admin/removeUser': async (query) => {
    let status, data
    const { username, createUsername } = query
    if (!createUsername) {
      data = {
        msg: 'Missing field'
      }
      status = 400
    }

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    await user.removeUser(createUsername)
    data = {
      msg: 'Success',
    }

    return {
      status,
      data,
    }
  },
  '/admin/createGroup': async (query) => {
    let status, data
    const { username, groupName, groupNote, groupData } = query
    if (!groupName || !groupNote || !groupData) {
      data = {
        msg: 'Missing field'
      }
      status = 400
    }

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    await group.createGroup(groupName, groupNote, JSON.parse(groupData))
    data = {
      msg: 'Success',
    }

    return {
      status,
      data,
    }
  },
  '/admin/updateGroup': async (query) => {
    let status, data
    const { username, groupName, groupNote, groupData } = query
    if (!groupName || !groupNote || !groupData) {
      data = {
        msg: 'Missing field'
      }
      status = 400
    }

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    await group.updateGroup(groupName, {
      note: groupNote,
      data: JSON.parse(groupData),
    })
    data = {
      msg: 'Success',
    }

    return {
      status,
      data,
    }
  },
  '/admin/removeGroup': async (query) => {
    let status, data
    const { username, groupName } = query
    if (!groupName) {
      data = {
        msg: 'Missing field'
      }
      status = 400
    }

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    await group.removeGroup(groupName)
    data = {
      msg: 'Success',
    }

    return {
      status,
      data,
    }
  },
  '/admin/listGroups': async (query) => {
    let status, data
    const { username } = query

    const userInfo = await user.findUser(username)
    if (userInfo.group.name !== 'ADMIN') {
      data = {
        msg: 'What\'s wrong with you?'
      }
      status = 401
      return { data, status }
    }

    const groupList = await group.getGroups()
    data = {
      msg: 'Success',
      data: {
        groupList,
      }
    }

    return {
      status,
      data,
    }
  },
  '/home/getServer': async (query) => {
    return {
      data: {
        serverList: Object.values(config.agent).map(i => {
          return i.name
        })
      },
    }
  },
  '/home/systemInformation': async (query) => {
    let status, data

    const serverName = query.serverName
    if (!config.agent[serverName]) return {
      data: {
        msg: 'Server not fount',
      },
    }
    let period = parseInt(query.period)
    if (![3600, 3600 * 6, 3600 * 24, 3600 * 24 * 7, 3600 * 24 * 30].includes(period)) period = 3600

    const cacheName = serverName + period
    if (!__cacheSi[cacheName]) __cacheSi[cacheName] = {
      time: 0,
      data: {},
    }
    const cacheObj = __cacheSi[cacheName]

    const nowTime = (new Date()).getTime()
    if (nowTime - cacheObj.time > (period / 360) * 1000) {
      const siData = await si.getSystemInfomation(serverName, period, 200)
      let result = siData

      cacheObj.data = result
      cacheObj.time = nowTime

      data = {
        data: result,
      }
    } else {
      data = {
        data: cacheObj.data,
      }
    }

    return {
      data,
      status,
    }
  },
}

async function handleRoutes(req, res) {
  const parsedUrl = url.parse(req.url, true)
  let pathname = parsedUrl.pathname

  console.log(pathname)
  if (!pathname.startsWith('/api')) {
    pathname = decodeURIComponent(pathname)

    const webPath = path.resolve(__dirname, '../dashboard/dist')
    const normalizedSafePath = path.normalize('/' + pathname)
    const safePath = path.join(webPath, normalizedSafePath)

    if (!safePath.startsWith(webPath)) {
      res.writeHead(403)
      res.end()
      return
    }

    if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
      try {
        res.writeHead(200, {
          'Content-Type': 'text/html',
        })
        res.end(fs.readFileSync(path.resolve(webPath, 'index.html')))
      } catch (e) {
        res.writeHead(404)
        res.end()
      }
    } else {
      const ext = path.extname(safePath)
      const exts = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      }
      res.writeHead(200, {
        'Content-Type': exts[ext] || 'text/plain',
      })
      res.end(fs.readFileSync(safePath))
    }
    return
  }

  pathname = pathname.replace('/api', '')

  if (!req.query.username && pathname !== '/user/login') {
    res.writeHead(401, {
      'Content-Type': 'application/json',
    })

    res.end(JSON.stringify({
      msg: 'Unauthorized'
    }))
    return
  }

  logger.info({
    message: 'Request query',
    query: req.query,
  })

  let status = 404
  let data = {}

  const routeNames = Object.keys(routes)

  if (routeNames.includes(pathname)) {
    const result = await routes[pathname](req.query)
    status = result.status || 200
    data = result.data || {}
  }

  const dataStr = JSON.stringify({
    status,
    data,
    date: (new Date()).getTime(),
  })

  res.writeHead(status || 200, {
    'Content-Type': 'application/json',
  })

  res.end(dataStr)
}

function errorHandler(err, req, res) {
  logger.error(err)
  res.writeHead(500, { 'Content-Type': 'text/plain' })
  res.end('Server error.\n')
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'x-auth')

  if (req.method === 'GET') {
    return preProcess(req, res, () => {
      return handleRoutes(req, res)
    }).catch((err) => {
      errorHandler(err, req, res)
    })
  } else if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method not allowed.')
  }
})

server.listen(3000, () => {
  console.log('Server is listening on port 3000')
})
