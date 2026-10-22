/* eslint-env mocha */
const assert = require('assert')
const { createSerializer, createDeserializer } = require('../src/transforms/serializer')

// entity_equipment marks every entry but the last with the top bit of its slot byte.
describe('top-bit terminated arrays', () => {
  for (const version of ['1.16.5', '1.20.4', '26.3']) {
    for (const compiled of [false, true]) {
      it(`parses entity_equipment without changing the packet buffer (${version}, compiled=${compiled})`, () => {
        const options = { version, state: 'play', compiled }
        const air = createDeserializer({ ...options, isServer: false })
          .parsePacketBuffer(createSerializer({ ...options, isServer: true }).createPacketBuffer({
            name: 'entity_equipment', params: { entityId: 7, equipments: [{ slot: 0, item: { present: false, itemCount: 0 } }] }
          })).data.params.equipments[0].item
        const equipments = [0, 1, 5].map(slot => ({ slot, item: air }))
        const buffer = createSerializer({ ...options, isServer: true })
          .createPacketBuffer({ name: 'entity_equipment', params: { entityId: 7, equipments } })
        const original = Buffer.from(buffer)

        const parsed = createDeserializer({ ...options, isServer: false }).parsePacketBuffer(buffer)

        assert.deepStrictEqual(parsed.data.params.equipments, equipments)
        assert.strictEqual(parsed.metadata.size, buffer.length)
        // The same buffer is emitted as `raw` and may be forwarded by proxies.
        assert.deepStrictEqual(buffer, original)
      })
    }
  }
})
