/* eslint-env mocha */
const assert = require('assert')
const { createDeserializer, states } = require('../src/index')

// A water bottle as 1.20.6 and 1.21.1 servers send it (captured from set_slot): one potion (item
// 998) with potion_contents (31) holding the water potion (0), no custom colour, no effects. The
// custom name that follows from 1.21.2 is not there.
const WATER_BOTTLE = '01' + 'e607' + '01' + '00' + '1f' + '01' + '00' + '00' + '00'

describe('1.20.5-1.21.1 potion_contents item component', () => {
  for (const version of ['1.20.6', '1.21.1']) {
    it(`reads a ${version} water bottle to its end`, () => {
      const proto = createDeserializer({ state: states.PLAY, isServer: false, version }).proto
      // A second slot after it shows that the read stops where the server's component ends.
      const buffer = Buffer.from(WATER_BOTTLE + WATER_BOTTLE, 'hex')
      const { value, size } = proto.read(buffer, 0, 'Slot', {})
      assert.strictEqual(size, buffer.length / 2)
      assert.strictEqual(value.itemId, 998)
      assert.deepStrictEqual(value.components, [{ type: 'potion_contents', data: { potionId: 0, customColor: undefined, customEffects: [] } }])
    })
  }
})
