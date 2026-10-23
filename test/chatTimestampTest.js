/* eslint-env mocha */
const assert = require('assert')
const { EventEmitter } = require('events')

// A client with only the chat plugin, recording what it writes and what it signs
function chatClient (version, { signs = false } = {}) {
  const client = new EventEmitter()
  client.version = version
  client.serverFeatures = {}
  client.written = []
  client.signed = []
  client.write = (name, params) => client.written.push({ name, timestamp: params.timestamp })
  require('../src/client/chat')(client, {})
  if (signs) {
    client.profileKeys = {}
    client._session = {}
    client.signMessage = (message, timestamp) => {
      client.signed.push(timestamp)
      return Buffer.alloc(256)
    }
  }
  return client
}

// Runs fn with Date.now() returning the given times in turn
function withClock (times, fn) {
  const now = Date.now
  Date.now = () => times.shift()
  try {
    fn()
  } finally {
    Date.now = now
  }
}

describe('chat timestamps', () => {
  for (const version of ['1.19.2', '1.20.1', '1.21.4', '26.3']) {
    it(`never go back on a connection when the clock does (${version})`, () => {
      const client = chatClient(version)
      withClock([2000, 1999, 2000, 2500], () => {
        client._signedChat('first')
        client._signedChat('second')
        client._signedChat('third')
        client._signedChat('fourth')
      })
      assert.deepStrictEqual(client.written.map(packet => packet.timestamp), [2000n, 2000n, 2000n, 2500n])
    })

    it(`order commands and messages together (${version})`, () => {
      const client = chatClient(version)
      withClock([2000, 1990, 1995, 2001], () => {
        client._signedChat('hello')
        client._signedChat('/fill 0 0 0 1 1 1 air')
        client._signedChat('/say hi')
        client._signedChat('bye')
      })
      assert.deepStrictEqual(client.written.map(packet => packet.timestamp), [2000n, 2000n, 2000n, 2001n])
    })
  }

  it('sign the timestamp they send', () => {
    const client = chatClient('1.20.1', { signs: true })
    withClock([2000, 1500], () => {
      client._signedChat('first')
      client._signedChat('second')
    })
    assert.deepStrictEqual(client.written.map(packet => packet.timestamp), [2000n, 2000n])
    assert.deepStrictEqual(client.signed, [2000n, 2000n])
  })

  it('send a timestamp given by the caller as is and do not go below it afterwards', () => {
    const client = chatClient('1.20.1')
    withClock([1000, 9000], () => {
      client._signedChat('given', { timestamp: 5000n })
      client._signedChat('earlier given', { timestamp: 4000n })
      client._signedChat('clock behind')
      client._signedChat('clock ahead')
    })
    assert.deepStrictEqual(client.written.map(packet => packet.timestamp), [5000n, 4000n, 5000n, 9000n])
  })
})
