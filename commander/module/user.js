const client = require('./db').getClient()
const ObjectId = require('mongodb').ObjectId
const { findGroup } = require('./group')
const crypto = require('./crypto')
const config = require('./../config')

const _cacheSigns = new Map()
setInterval(() => _cacheSigns.clear(), 1000 * 600)

async function checkToken(username, loginTime, salt, sign) {
  if (_cacheSigns.has(sign)) return true
  if ((new Date()).getTime() - parseInt(loginTime) > 1000 * 60 * 24 * 30) return false
  const user = await findUser(username)
  if (!user) return false

  if (user.group.name === 'BLOCKED') return false

  const ordered = [username, loginTime, salt]

  const calSign = crypto.hash(JSON.stringify(ordered), config.key)
  if (sign === calSign) {
    _cacheSigns.set(sign, 1)
    return true
  }
}

async function getUsers() {
  const users = client.collection('users')
  let allUsers = await users.find().toArray()

  allUsers = await Promise.all(allUsers.map(async (user) => {
    user.created = (new ObjectId(user._id)).getTimestamp() * 1000
    const group = await findGroup(user.group)
    user.group = group
    delete user.password
    delete user.salt

    return user
  }))

  return allUsers
}

async function createUser(username, password, groupName, comment = '', createBy = '') {
  const users = client.collection('users')
  const group = await findGroup(groupName)

  if (!group) {
    throw new Error(`Group ${groupName} does not exist.`)
  }

  const user = await findUser(username)
  if (user) {
    throw new Error(`Username ${username} exists.`)
  }

  const maxUserId = await users.find().sort({userId: -1}).limit(1).toArray()
  const userId = maxUserId.length > 0 ? maxUserId[0].userId + 1 : 1

  const salt = crypto.generateRandomString(16)
  const enPass = crypto.hash(password + salt, config.key)

  const result = await users.insertOne({ userId, username, password: enPass, salt, group: groupName, comment, createBy })
  return result
}

async function updateUser(username, fields) {
  const users = client.collection('users')

  if (fields.group) {
    const group = await findGroup(fields.group)

    if (!group) {
      throw new Error(`Group ${fields.group} does not exist.`)
    }
  }

  let salt
  if (fields.password) {
    salt = crypto.generateRandomString(16)
    const enPass = crypto.hash(fields.password + salt, config.key)
    fields.password = enPass
    fields.salt = salt
  }

  const result = await users.updateOne({ username }, { $set: fields })
  return result
}

async function removeUser(username) {
  const users = client.collection('users')
  const result = await users.deleteOne({ username })
  return result
}

async function findUser(username) {
  const users = client.collection('users')
  const user = await users.findOne({ username })
  if (!user) return
  user.created = (new ObjectId(user._id)).getTimestamp() * 1000

  const group = await findGroup(user.group)
  user.group = group

  delete user.password
  delete user.salt

  return user
}

async function checkUsernamePassword(username, password) {
  const users = client.collection('users')
  const user = await users.findOne({ username })
  if (!user) return false
  if (crypto.hash(password + user.salt, config.key) === user.password) return true
  else return false
}

module.exports = {
  checkToken,
  getUsers,
  createUser,
  updateUser,
  removeUser,
  findUser,
  checkUsernamePassword,
}
