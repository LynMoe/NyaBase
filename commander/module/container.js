const req = require('./request')
const config = require('./../config')
const si = require('./systemInformation')
const crypto = require('./crypto')
const logger = require('./logger').child({ module: 'Container' })

function getAllContainerByUsername() {
  const containers = {}
  
  for (const agentName in si._lastData) {
    const agentData = si._lastData[agentName]

    for (let cont of agentData.dockerContainerStats) {
      const contNameSplit = `${cont.name}`.split('_')
      if (contNameSplit.length < 5 || contNameSplit[0] !== 'NYATAINER') continue
      const username = contNameSplit[2]

      cont = {
        agentName,
        username,
        userId: parseInt(contNameSplit[3]),
        basePort: parseInt(contNameSplit[4]),
        password: crypto.hash(agentName + username + contNameSplit[5], config.key).substring(0, 8),
        ...cont
      }

      if (!containers[username]) containers[username] = []
      containers[username].push(cont)
    }
  }

  return containers
}

async function createContainer(agent, imageName, envs) {
  logger.info({
    message: 'Create container',
    agent, imageName, envs,
  })
  let image = config.images[imageName]
  if (!image) throw new Error('Image not exist')
  image = JSON.parse(JSON.stringify(image));

  for (const i in image.cmd) {
    let cmd = image.cmd[i]
    let prefix = ''
    if (cmd.startsWith('|')) {
      cmd = cmd.split('|')
      prefix = cmd[1]
      cmd = cmd.slice(2).join('|')

      if (!envs[prefix]) {
        image.cmd[i] = ''
        continue
      }
    }

    for (const key in envs) {
      const env = envs[key]
      cmd = cmd.replace(new RegExp(`${key}`, 'gmi'), env)
    }
    image.cmd[i] = cmd
  }

  logger.info({
    message: 'Replaced cmd',
    agent, imageName, image,
  })

  const cmd = image.cmd.join(' ')
  
  return await req(agent.url, '/docker/run', agent.key, {
    command: cmd
  })
}

async function removeContainer(agent, containerId) {
  logger.info({
    message: 'Remove container',
    agent, containerId
  })
  return await req(agent.url, '/docker/stopAndRemove', agent.key, {
    containerId: containerId
  })
}

async function restartContainer(agent, containerId) {
  logger.info({
    message: 'Restart container',
    agent, containerId
  })
  return await req(agent.url, '/docker/restart', agent.key, {
    containerId: containerId
  })
}

module.exports = {
  createContainer,
  removeContainer,
  restartContainer,
  getAllContainerByUsername,
}
