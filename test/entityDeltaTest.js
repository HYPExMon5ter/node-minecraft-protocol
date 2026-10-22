/* eslint-env mocha */
const assert = require('assert')
const [read, write, sizeOf] = require('../src/datatypes/minecraft').entityDelta

describe('26.3 entity deltas', () => {
  for (const onGround of [false, true]) {
    for (const steps of [
      [{ dX: 4096, dY: -4096, dZ: 0, ticks: 0 }],
      [{ dX: 1, dY: -2, dZ: 3, ticks: 2 }, { dX: -32768, dY: 32767, dZ: 0, ticks: 300 }]
    ]) {
      it(`round trips ${steps.length} steps with onGround=${onGround}`, () => {
        const value = { onGround, steps }
        const buffer = Buffer.alloc(sizeOf(value))
        assert.strictEqual(write(value, buffer, 0), buffer.length)
        assert.deepStrictEqual(read(buffer, 0), { value, size: buffer.length })
        for (let end = 0; end < buffer.length; end++) {
          assert.throws(() => read(buffer.subarray(0, end), 0))
        }
      })
    }
  }
  it('rejects an empty path instead of emitting a truncated linear packet', () => {
    assert.throws(() => sizeOf({ onGround: false, steps: [] }), /at least one/)
    assert.throws(() => write({ onGround: false, steps: [] }, Buffer.alloc(16), 0), /at least one/)
  })
})
