const si = require('systeminformation')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const logger = require('./logger').child({ module: 'SI' })

const config = require('../config')

async function getNvidiaSmiOutput() {
  try {
    const result = await exec('nvidia-smi -q -d PIDS', {
      timeout: 1000 * 3,
    })

    const { stdout, stderr } = result
    if (stderr) {
      logger.error({
        message: 'nvidia-smi stderr',
        stderr,
      })
      return ''
    }

    return stdout
  } catch (error) {
    console.error(`Execution error: ${error}`)
    logger.error({
      message: 'nvidia-smi error',
      error,
    })
    return ''
  }
}

function matchGpu(text) {
  let regex = /GPU\s([0-9A-Fa-f:]+\.\d+)([\s\S]+?)(?=GPU\s[0-9A-Fa-f:]+|$)/g

  let match
  let gpus = {}
  while ((match = regex.exec(text)) !== null) {
    if (match.length < 3) {
      logger.warn({
        message: 'nvidia-smi regex match length < 3',
        match,
      })
      continue
    }
    let gpu = match[1]
    let processes = []

    if (!match[2].includes('Processes                             : None')) {
      let processRegex = /Process ID\s+:\s+(\d+)[\s\S]+?Used GPU Memory\s+:\s+(\d+)\s+MiB/g
      let processMatch
      while ((processMatch = processRegex.exec(match[0])) !== null) {
        processes.push({
          pid: processMatch[1],
          memory: processMatch[2]
        })
      }
    }

    gpus[gpu] = processes
  }

  return gpus
}

async function getSystemInformation() {
  let nvsmi = await getNvidiaSmiOutput()
  nvsmi = matchGpu(nvsmi)

  const siOpt = {
    // graphics: '*',
    currentLoad: 'currentLoadSystem',
    processes: '*',
    disksIO: 'rIO,wIO,tIO,rWaitTime,wWaitTime,tWaitTime',
    fsSize: '*',
    fsStats: '*',
    mem: 'total,free,used',
  }

  if (Object.keys(nvsmi).length) siOpt.graphics = '*'

  const data = await si.get(siOpt)

  data.networkStats = await si.networkStats(config.netIface.join(','))

  data.currentLoadSystem = data.currentLoad.currentLoadSystem
  data.fsSize = data.fsSize.filter(i => config.diskPath.includes(i.fs))

  data.dockerContainers = await si.dockerContainers(true)
  const dockerIdNameMap = {}
  data.dockerContainers.forEach(i => dockerIdNameMap[i.id] = {
    id: i.id,
    name: i.name,
    image: i.image,
    state: i.state,
  })
  const ids = data.dockerContainers.map(i => i.id)

  delete data.dockerContainers

  data.dockerContainerStats = await si.dockerContainerStats(ids.join(','))

  data.dockerContainerStats = await Promise.all(data.dockerContainerStats
    .filter(i => dockerIdNameMap[i.id].name.startsWith('NYATAINER_'))
    .map(i => {
      return si.dockerContainerProcesses(i.id).then(processes => {
        return {
          ...dockerIdNameMap[i.id],
          imageID: i.imageID,
          cpuPercent: i.cpuPercent,
          cpuStats: i.cpuStats,
          memUsage: i.memUsage,
          memLimit: i.memLimit,
          memoryStats: i.memoryStats,
          memMaxUsage: i.memoryStats.max_usage,
          pids: i.pids,
          netIO: i.netIO,
          blockIO: i.blockIO,
          restartCount: i.restartCount,
          createdAt: i.createdAt,
          processesId: processes.map(i => i.pidHost),
          ports: i.ports,
          mounts: i.mounts,
          processes,
          networks: i.networks,
        }
      })
    }))

  if (Object.keys(nvsmi).length) {

    for (const index in nvsmi) {
      const item = nvsmi[index]
      for (const i of item) {
        for (const container of data.dockerContainerStats) {
          if (container.processesId.includes(i.pid)) {
            i.containerName = container.name
          }
        }
      }
    }
    
    data.graphics = [...data.graphics.controllers.filter(i => i.vendor.indexOf('NVIDIA') != -1)]
    data.gpu = data.graphics.map(i => {
      return {
        memoryTotal: i.memoryTotal,
        temperatureGpu: i.temperatureGpu,
        powerDraw: i.powerDraw,
        pciBus: i.pciBus,
        vendor: i.vendor,
        name: i.name,
        processes: nvsmi[i.pciBus] || [],
      }
    })

    delete data.graphics
  }

  data.cpu = [{
    user: 'system',
    value: data.currentLoadSystem,
  }]
  delete data.currentLoadSystem

  data.memory = [{
    user: 'all',
    value: data.mem.used,
    total: data.mem.total,
  }]
  delete data.mem

  data.pids = []

  for (const container of data.dockerContainerStats) {
    data.cpu.push({
      user: container.name,
      value: container.cpuPercent,
    })

    data.memory.push({
      user: container.name,
      value: container.memUsage,
    })

    data.pids.push({
      user: container.name,
      value: container.pids,
    })
  }

  return data
}

module.exports = {
  getSystemInformation,
}
