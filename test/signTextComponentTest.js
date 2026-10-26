/* eslint-env mocha */
const assert = require('assert')
const { createDeserializer, states } = require('../src/index')

const proto = createDeserializer({ state: states.PLAY, isServer: false, version: '26.3' }).proto

// Four empty messages (anonymous NBT empty strings), then the optional filtered messages.
const EMPTY_MESSAGES = '080000'.repeat(4)
// SignText as a Spigot 26.3 server writes it on a sign item: no filtered messages, black, not glowing.
const SIGN_TEXT = EMPTY_MESSAGES + '00' + '0f' + '00'
// One oak sign (item 1102) with sign_text_front (118) and sign_text_back (119), from a captured
// window_items packet.
const OAK_SIGN_SLOT = '01' + 'ce08' + '02' + '00' + '76' + SIGN_TEXT + '77' + SIGN_TEXT

describe('26.3 sign text item components', () => {
  it('reads a sign item without filtered messages to its end', () => {
    const buffer = Buffer.from(OAK_SIGN_SLOT, 'hex')
    const { value, size } = proto.read(buffer, 0, 'Slot', {})
    assert.strictEqual(size, buffer.length)
    assert.deepStrictEqual(value.components.map(c => c.type), ['sign_text_front', 'sign_text_back'])
    for (const { data } of value.components) {
      assert.strictEqual(data.messages.length, 4)
      assert.strictEqual(data.filteredMessages, undefined)
      assert.strictEqual(data.color, 15)
      assert.strictEqual(data.hasGlowingText, false)
    }
  })

  it('reads filtered messages when they are present', () => {
    const text = EMPTY_MESSAGES + '01' + EMPTY_MESSAGES + '0e' + '01'
    const buffer = Buffer.from('01ce080100' + '76' + text, 'hex')
    const { value, size } = proto.read(buffer, 0, 'Slot', {})
    assert.strictEqual(size, buffer.length)
    const data = value.components[0].data
    assert.strictEqual(data.filteredMessages.length, 4)
    assert.strictEqual(data.color, 14)
    assert.strictEqual(data.hasGlowingText, true)
  })
})
