/* eslint-env mocha */
const assert = require('assert')
const { createSerializer } = require('../src/transforms/serializer')

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
  }
})
