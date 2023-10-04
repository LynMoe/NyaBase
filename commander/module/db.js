const { MongoClient, ServerApiVersion } = require('mongodb')
const config = require('./../config')

const uri = config.db.uri

const _client = new MongoClient(uri,  {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    }
  }
)

let client

async function initClient() {
  await _client.connect()

  client = _client.db(config.db.name)
  
  await initIndexes()

  setInterval(() => {
    client.command({ ping: 1 })
  }, 10000)
}

async function initIndexes() {
  const coll = client.collection('systemInformation')
  await coll.createIndex({
    agentName: 1, 
    time: 1
  })
}

module.exports = {
  getClient: () => client,
  initClient,
}
