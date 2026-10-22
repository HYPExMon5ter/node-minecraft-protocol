/* eslint-env mocha */
const assert = require('assert')
const { once } = require('events')
const mc = require('../')

describe('login compatibility', function () {
  this.timeout(10000)
  for (const version of ['1.8.8', '26.1', '26.2', '26.3']) {
    it(`completes offline login on ${version}`, async () => {
      const server = mc.createServer({ version, 'online-mode': false, port: 0 })
      let client
      try {
        await once(server, 'listening')
        client = mc.createClient({ version, username: 'audit', host: '127.0.0.1', port: server.socketServer.address().port, auth: 'offline' })
        const [packet] = await once(client, 'success')
        assert.strictEqual(packet.username, 'audit')
        assert.match(packet.uuid, /^[0-9a-f-]{36}$/i)
        if (require('minecraft-data')(version).version['>=']('26.2')) {
          assert.match(packet.sessionId, /^[0-9a-f-]{36}$/i)
        }
      } finally {
        client?.end()
        server.close()
      }
    })
  }
})
