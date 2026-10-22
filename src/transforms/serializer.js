'use strict'

const { ProtoDef, Serializer, FullPacketParser } = require('protodef')
const { ProtoDefCompiler } = require('protodef').Compiler

const nbt = require('prismarine-nbt')
const minecraft = require('../datatypes/minecraft')
const states = require('../states')
const merge = require('lodash.merge')

const minecraftData = require('minecraft-data')
const protocols = {}
// Protocols built with a customPackets object are cached per object identity, so every client
// and state change sharing one object (e.g. all clients of a server) compiles it once, while
// distinct objects never see each other's schemas. The object is read when first used:
// later mutations require passing a new object.
const customProtocols = new WeakMap()

function createProtocol (state, direction, version, customPackets, compiled = true) {
  const key = `${state};${direction};${version}${compiled ? ';c' : ''}`
  let cache = protocols
  if (customPackets) {
    cache = customProtocols.get(customPackets)
    if (!cache) customProtocols.set(customPackets, cache = {})
  }
  if (cache[key]) { return cache[key] }

  const mcData = minecraftData(version)
  const versionInfo = minecraftData.versionsByMinecraftVersion.pc[version]
  if (mcData === null) {
    throw new Error(`No data available for version ${version}`)
  } else if (versionInfo && versionInfo.version !== mcData.version.version) {
    // The protocol version returned by node-minecraft-data constructor does not match the data in minecraft-data's protocolVersions.json
    throw new Error(`Unsupported protocol version '${versionInfo.version}' (attempted to use '${mcData.version.version}' data); try updating your packages with 'npm update'`)
  }

  // A custom extension must not mutate the shared minecraft-data registry.
  const mergedProtocol = customPackets
    ? merge({}, mcData.protocol, customPackets[mcData.version.majorVersion] ?? {})
    : mcData.protocol

  if (compiled) {
    const compiler = new ProtoDefCompiler()
    compiler.addTypes(require('../datatypes/compiler-minecraft'))
    compiler.addProtocol(mergedProtocol, [state, direction])
    nbt.addTypesToCompiler('big', compiler)
    const proto = compiler.compileProtoDefSync()
    cache[key] = proto
    return proto
  }

  const proto = new ProtoDef(false)
  proto.addTypes(minecraft)
  proto.addProtocol(mergedProtocol, [state, direction])
  nbt.addTypesToInterpreter('big', proto)
  cache[key] = proto
  return proto
}

function createSerializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = true } = {}) {
  return new Serializer(createProtocol(state, !isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet')
}

function createDeserializer ({ state = states.HANDSHAKING, isServer = false, version, customPackets, compiled = true, noErrorLogging = false } = {}) {
  return new FullPacketParser(createProtocol(state, isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet', noErrorLogging)
}

module.exports = {
  createSerializer,
  createDeserializer
}
