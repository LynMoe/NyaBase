const si = require('systeminformation')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const config = require('../config')

async function getNvidiaSmiOutput() {
  try {
    const { stdout, stderr } = await exec('nvidia-smi -q -d PIDS')
    if (stderr) {
      console.error(`Error: ${stderr}`)
      return
    }
    return stdout
  } catch (error) {
    console.error(`Execution error: ${error}`)
  }
}

function matchGpu(text) {
  let regex = /GPU\s([0-9A-Fa-f:]+\.\d+)([\s\S]+?)(?=GPU\s[0-9A-Fa-f:]+|$)/g

  let match
  let gpus = {}
  while ((match = regex.exec(text)) !== null) {
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
  const data = await si.get({
    graphics: '*',
    currentLoad: 'currentLoadSystem',
    disksIO: 'rIO,wIO,tIO,rWaitTime,wWaitTime,tWaitTime',
    fsSize: '*',
    fsStats: '*',
    mem: 'total,free,used',
  })

  data.networkStats = await si.networkStats(config.netIface.join(','))

  data.graphics = [...data.graphics.controllers.filter(i => i.vendor.indexOf('NVIDIA') != -1)]
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
          cpuPercent: i.cpuPercent,
          memUsage: i.memUsage,
          memLimit: i.memLimit,
          memMaxUsage: i.memoryStats.max_usage,
          pids: i.pids,
          netIO: i.netIO,
          blockIO: i.blockIO,
          restartCount: i.restartCount,
          processesId: processes.map(i => i.pidHost),
          processes,
          networks: i.networks,
        }
      })
    }))

  let nvsmi = await getNvidiaSmiOutput()
  nvsmi = matchGpu(nvsmi)

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
