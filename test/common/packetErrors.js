// minecraft-protocol (protodef) only logs a packet it cannot decode, or decodes only in part, and
// then drops or truncates it. A schema that disagrees with a real server would otherwise go
// unnoticed: collect those reports so a test can fail on them.
const reports = [
  /^PartialReadError\b/,
  /^Chunk size is \d+ but only \d+ was read/
]

function watchPacketErrors () {
  const seen = []
  const log = console.log
  console.log = (...args) => {
    const text = String(args[0] ?? '')
    if (reports.some(pattern => pattern.test(text))) seen.push(text.split('\n')[0].slice(0, 300))
    log(...args)
  }
  return {
    // Reports since the previous call
    take: () => seen.splice(0),
    restore: () => { console.log = log }
  }
}

module.exports = { watchPacketErrors }
