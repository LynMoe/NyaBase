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
    containerId,
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
    containerId,
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

    // set restart policy to always
    const { stdout: stdout2, stderr: stderr2 } = await exec(`docker update --restart=always ${containerId}`)
    if (stderr2) {
      logger.error({
        message: 'Error updating restart policy',
        stderr2,
      })
      return false
    }

    logger.info({
      message: 'Container restarted',
      stdout: stdout + stdout2,
    })
    
    return stdout.trim()
  } catch (e) {
    logger.error(e)
  }
}

async function dockerKill(containerId) {
  logger.info({
    message: 'Docker kill',
    containerId,
  })
  try {
    const { stdout, stderr } = await exec(`docker kill ${containerId}`)
    if (stderr) {
      logger.error({
        message: 'Error killing docker',
        stderr,
      })
      return false
    }

    // set restart policy to never
    const { stdout: stdout2, stderr: stderr2 } = await exec(`docker update --restart=no ${containerId}`)
    if (stderr2) {
      logger.error({
        message: 'Error updating restart policy',
        stderr2,
      })
      return false
    }

    logger.info({
      message: 'Container killed',
      stdout: stdout + stdout2,
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
  dockerKill,
}
