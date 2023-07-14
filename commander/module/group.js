const client = require('./db').getClient()
const ObjectId = require('mongodb').ObjectId

async function createGroup(name, note, data) {
  const groups = client.collection('groups')
  const result = await groups.insertOne({ name, note, data })
  return result
}

async function updateGroup(name, fields) {
  const groups = client.collection('groups')
  const result = await groups.updateOne({ name }, { $set: fields })
  return result
}

async function removeGroup(name) {
  const groups = client.collection('groups')
  const result = await groups.deleteOne({ name })
  return result
}

async function findGroup(name) {
  const groups = client.collection('groups')
  const group = await groups.findOne({ name })
  return group
}

async function getGroups() {
  const groups = client.collection('groups')
  let allGroups = await groups.find().toArray()

  allGroups = await Promise.all(allGroups.map(async (group) => {
    group.created = (new ObjectId(group._id)).getTimestamp() * 1000

    return group
  }))

  return allGroups
}

module.exports = {
  createGroup,
  updateGroup,
  removeGroup,
  findGroup,
  getGroups,
}
