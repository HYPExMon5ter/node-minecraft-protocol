/* eslint-env mocha */
const assert = require('assert')
const crypto = require('crypto')
const { EventEmitter } = require('events')
const { createSerializer } = require('../')

const PLAYER_UUID = 'df9c0a00-cf82-4c12-800c-eee83fb68fe3'

// A client with the play and chat plugins that records the packets it writes, each checked to
// serialize for its version. With keys it signs chat like a client signed in with Microsoft.
function playClient (version, { keys = true } = {}) {
  const client = new EventEmitter()
  client.version = version
  client.state = 'login'
  client.written = []
  const serializer = createSerializer({ state: 'play', isServer: false, version })
  client.write = (name, params) => {
    if (client.state === 'play') serializer.createPacketBuffer({ name, params })
    client.written.push({ name, params })
  }
  if (keys) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 })
    client.profileKeys = { public: publicKey, private: privateKey, expiresOn: new Date(Date.now() + 3600000), signatureV2: Buffer.alloc(512) }
    client.cipher = {}
    client.session = { selectedProfile: { id: PLAYER_UUID.replace(/-/g, '') } }
  }
  require('../src/client/play')(client, {})
  client.emit('success', { uuid: PLAYER_UUID, username: 'player' })
  if (client.state !== 'play') client.emit('finish_configuration', {})
  client.written.length = 0
  client.emit('login', {})
  return client
}

const names = (client) => client.written.map(packet => packet.name)
const settle = () => new Promise(resolve => setImmediate(resolve))

describe('chat session', () => {
  for (const version of ['1.19.3', '1.20.1', '1.21.4', '26.3']) {
    it(`holds chat until the server has applied the session (${version})`, async () => {
      const client = playClient(version)
      client.chat('first')
      client.chat('/say second')
      client.chat('third')
      await settle()
      assert.deepStrictEqual(names(client), ['chat_session_update', 'client_command'])

      client.emit('statistics', { entries: [] })
      await settle()
      const command = version === '1.19.3' || version === '1.20.1' ? 'chat_command' : 'chat_command_signed'
      assert.deepStrictEqual(names(client), ['chat_session_update', 'client_command', 'chat_message', command, 'chat_message'])
      assert.deepStrictEqual(client.written.filter(packet => packet.name === 'chat_message').map(packet => packet.params.message), ['first', 'third'])
      assert(client.written.filter(packet => packet.name === 'chat_message').every(packet => packet.params.signature?.length === 128))

      client.chat('fourth')
      assert.strictEqual(names(client).at(-1), 'chat_message')
    })

    it(`sends chat at once without a chat session (${version})`, () => {
      const client = playClient(version, { keys: false })
      client.chat('hello')
      assert.deepStrictEqual(names(client), ['chat_message'])
    })
  }

  it('matches statistics answers to requests in order', async () => {
    const client = playClient('26.3', { keys: false })
    const answers = []
    client.requestStatistics().then(packet => answers.push(['first', packet.entries.length]))
    client.requestStatistics().then(packet => answers.push(['second', packet.entries.length]))
    client.emit('statistics', { entries: [] })
    client.emit('statistics', { entries: [{ categoryId: 0, statisticId: 0, value: 1 }] })
    await settle()
    assert.deepStrictEqual(answers, [['first', 0], ['second', 1]])
    assert.deepStrictEqual(client.written.map(packet => packet.params), [{ actionId: 'request_stats' }, { actionId: 'request_stats' }])
  })

  for (const [version, params] of [['1.8.8', { payload: 1 }], ['1.12.2', { actionId: 1 }], ['1.21.11', { actionId: 1 }], ['26.1', { actionId: 'request_stats' }]]) {
    it(`requests statistics with the ${version} packet layout`, () => {
      const client = playClient(version, { keys: false })
      client.requestStatistics()
      assert.deepStrictEqual(client.written, [{ name: 'client_command', params }])
    })
  }
})
