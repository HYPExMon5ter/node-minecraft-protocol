/* eslint-env mocha */
const assert = require('assert')
const { createSerializer, createDeserializer } = require('../src/transforms/serializer')
const Client = require('../src/client')

describe('custom protocol isolation', () => {
  for (const compiled of [false, true]) {
    it(`keeps custom packet schemas separate (compiled=${compiled})`, () => {
      const make = (customPackets) => createSerializer({ version: '1.20.4', state: 'play', compiled, customPackets })
      const packet = { name: 'teleport_confirm', params: { teleportId: 1, extra: 123 } }
      const base = make().createPacketBuffer(packet)
      const custom = type => ({
        '1.20': {
          play: {
            toServer: {
              types: {
                packet_teleport_confirm: ['container', [{ name: 'teleportId', type: 'varint' }, { name: 'extra', type }]]
              }
            }
          }
        }
      })
      assert.strictEqual(make(custom('i32')).createPacketBuffer(packet).length, base.length + 4)
      assert.strictEqual(make(custom('i16')).createPacketBuffer(packet).length, base.length + 2)
      assert.deepStrictEqual(make().createPacketBuffer(packet), base)
      const fields = require('minecraft-data')('1.20.4').protocol.play.toServer.types.packet_teleport_confirm[1]
      assert.deepStrictEqual(fields.map(field => field.name), ['teleportId'])
    })

    it(`compiles a custom packet object once per state and direction (compiled=${compiled})`, () => {
      const customPackets = { '1.20': {} }
      const make = (options) => createSerializer({ version: '1.20.4', compiled, customPackets, ...options })
      const play = make({ state: 'play' })
      assert.strictEqual(make({ state: 'play' }).proto, play.proto)
      assert.notStrictEqual(make({ state: 'configuration' }).proto, play.proto)
      assert.notStrictEqual(make({ state: 'play', isServer: true }).proto, play.proto)
      assert.notStrictEqual(createSerializer({ version: '1.20.4', state: 'play', compiled }).proto, play.proto)
      assert.notStrictEqual(make({ state: 'play', customPackets: { '1.20': {} } }).proto, play.proto)
      const parser = createDeserializer({ version: '1.20.4', state: 'play', compiled, customPackets, isServer: true })
      assert.strictEqual(parser.proto, play.proto)
    })
  }

  it('reuses the custom protocols across client state changes and clients', () => {
    const customPackets = { '1.20': {} }
    const first = new Client(false, '1.20.4', customPackets)
    first.state = 'play'
    const play = first.serializer.proto
    const parsePlay = first.deserializer.proto
    first.state = 'configuration'
    assert.notStrictEqual(first.serializer.proto, play)
    first.state = 'play'
    assert.strictEqual(first.serializer.proto, play)
    assert.strictEqual(first.deserializer.proto, parsePlay)
    const second = new Client(false, '1.20.4', customPackets)
    second.state = 'play'
    assert.strictEqual(second.serializer.proto, play)
  })
})
