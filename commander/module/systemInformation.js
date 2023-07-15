
const config = require('./../config')
const client = require('./db').getClient()
const req = require('./request')
const logger = require('./logger').child({ module: 'SI' })

const _lastData = {}
const _userLock = {}

async function storeSystemInformation(data) {
  const toBeInsert = {
    time: new Date(),
    ...data,
  }

  const coll = client.collection('systemInformation')
  await coll.insertOne(toBeInsert)
}

async function processAgent(agent) {
  logger.info({
    message: 'Processing agent',
    agent,
  })
  const path = '/systemInformation'
  const body = (await req(agent.url, path, agent.key, '{}')).data
  body.agentName = agent.name

  _lastData[agent.name] = body

  await storeSystemInformation(body)
}

async function retrievalSystemInformation() {
  const agents = config.agent

  await Promise.all(Object.values(agents).map(a => processAgent(a)))

  for (const username in _userLock) {
    const lock = _userLock[username]
    // timeout
    if (lock.time && ((new Date()).getTime() - lock.time > 1000 * 45)) {
      try {
        lock.callback.map(i => i())
      } catch (e) {
        logger.error(e)
      }
      delete _userLock[username]
      continue
    }

    if (lock.ready && (new Date()).getTime() - lock.time > 1000 * 6) {
      lock.callback.map(i => i())
      delete _userLock[username]
    }
  }
}

async function getSystemInfomation(agentName, timePeriod, pointNum = 100) {
  const coll = client.collection('systemInformation')

  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - timePeriod * 1000)

  // 计算出每个数据点之间的时间间隔（以毫秒为单位）
  const interval = Math.floor(timePeriod * 1000 / pointNum)

  // 使用 MongoDB 的 aggregation 框架来聚合数据
  const data = await coll.aggregate([
    {
      $match: {
        agentName,
        time: {
          $gte: startTime,
          $lte: endTime,
        },
      },
    },
    {
      $sort: {
        time: 1,
      },
    },
    {
      $group: {
        _id: {
          // 将 time 转换为毫秒，然后除以时间间隔并向下取整，以此来分组
          interval: {
            $floor: {
              $divide: [
                {
                  $toLong: "$time",
                },
                interval
              ],
            },
          },
        },
        doc: {
          $first: "$$ROOT",
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: "$doc",
      },
    },
    {
      $sort: {
        time: 1,
      },
    },
  ]).toArray()

  const list = {
    load: {},
    cpu: {},
    mem: {},
    disk: {},
    network: {},
    gpu: {},
  }
  for (const item of data) {
    const pidUserMap = {}
    for (const i of item.dockerContainerStats) {
      const username = i.name.split('_')[2]
      for (const pid of i.processesId) pidUserMap[pid] = username
    }

    const x = (new Date(item.time)).getTime()

    for (let i of item.cpu) {
      let { user, value } = i
      if (user === 'system') continue
      user = user.split('_')[2]
      if (!list.cpu[user]) list.cpu[user] = []
      list.cpu[user].push({
        x,
        y: value,
      })
    }

    for (const i of item.memory) {
      let { user, value } = i
      if (user === 'all') continue
      user = user.split('_')[2]
      if (!list.mem[user]) list.mem[user] = []
      list.mem[user].push({
        x,
        y: value,
      })
    }

    const networkIfName = Object.values(item.networkStats)[0].iface
    if (!list.network[networkIfName]) list.network[networkIfName] = []
    list.network[networkIfName].push({
      x,
      y: item.networkStats[0].rx_sec + item.networkStats[0].tx_sec,
    })

    for (const value of item.gpu) {
      const gpuId = value.name + ' ' + value.pciBus
      if (!list.gpu[gpuId]) list.gpu[gpuId] = {}
      for (const u of value.processes) {
        if (pidUserMap[u.pid]) u.pid = pidUserMap[u.pid]
        if (!list.gpu[gpuId][u.pid]) list.gpu[gpuId][u.pid] = []
        list.gpu[gpuId][u.pid].push({
          x,
          y: parseInt(u.memory),
        })
      }
    }
  }

  return list
}

setInterval(retrievalSystemInformation, 1000 * 10)
retrievalSystemInformation()

module.exports = {
  _lastData,
  _userLock,
  getSystemInfomation,
}
