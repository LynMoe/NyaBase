const util = require('util')
const exec = util.promisify(require('child_process').exec)
const logger = require('./logger').child({ module: 'Docker' })

async function dockerRun(command) {
  logger.info({
    message: 'Docker run',
    command,
  })
  try {
    const { stdout, stderr } = await exec(`docker run ${command}`)
    if (stderr) {
      logger.error({
        message: 'Error running docker',
        stderr,
      })
      return false
    }

    logger.info({
      message: 'Container started',
      stdout,
    })
    return stdout.trim()
  } catch (e) {
    logger.error(e)
  }
}

async function dockerStopAndRemove(containerId) {
  logger.info({
    message: 'Docker stop',
    command,
  })
  try {
    const { stdout, stderr } = await exec(`docker stop ${containerId} && docker rm ${containerId}`)
    if (stderr) {
      logger.error({
        message: 'Error stopping docker',
        stderr,
      })
      return false
    }

    logger.info({
      message: 'Container removed',
      stdout,
    })
    return stdout.trim()
  } catch (e) {
    logger.error(e)
  }
}

async function dockerRestart(containerId) {
  logger.info({
    message: 'Docker restart',
    command,
  })
  try {
    const { stdout, stderr } = await exec(`docker restart ${containerId}`)
    if (stderr) {
      logger.error({
        message: 'Error restarting docker',
        stderr,
      })
      return false
    }

    logger.info({
      message: 'Container restarted',
      stdout,
    })
    return stdout.trim()
  } catch (e) {
    logger.error(e)
  }
}

module.exports = {
  dockerRun,
  dockerRestart,
  dockerStopAndRemove,
}