#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║              INTERCOM-DROP v1.0.0                       ║
 * ║   Decentralized Ephemeral Clipboard & Status Beacon     ║
 * ║   Built for the Intercom Vibe Competition               ║
 * ║   Trac Network | Hyperswarm P2P | Termux-Ready          ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Author: [INSERT_YOUR_TRAC_ADDRESS_HERE]
 * License: MIT
 */

import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import crypto from 'crypto'
import readline from 'readline'
import { createRequire } from 'module'

// ─── Config ────────────────────────────────────────────────────────────────

const APP_NAME    = 'INTERCOM-DROP'
const APP_VERSION = '1.0.0'

// Channel is derived from a well-known topic string so all drop peers share it.
// A custom channel can be passed as: node index.js --channel my-secret-room
const DEFAULT_CHANNEL = 'intercom-drop-v1-global'

// Max length for clipboard payloads (protects peers from spam)
const MAX_PAYLOAD_BYTES = 4096

// Message types used in the framed protocol
const MSG = {
  CLIP  : 'CLIP',    // clipboard broadcast
  STATUS: 'STATUS',  // status beacon (online/away/custom)
  ACK   : 'ACK',     // optional receipt acknowledgement
  INFO  : 'INFO',    // peer announces itself
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function topicFromString (str) {
  return crypto.createHash('sha256').update(str).digest()
}

function shortKey (buf) {
  const hex = b4a.toString(buf, 'hex')
  return hex.slice(0, 8) + '…' + hex.slice(-4)
}

function ts () {
  return new Date().toLocaleTimeString()
}

// ANSI colours – safe for Termux terminals
const C = {
  reset  : '\x1b[0m',
  bold   : '\x1b[1m',
  dim    : '\x1b[2m',
  cyan   : '\x1b[36m',
  green  : '\x1b[32m',
  yellow : '\x1b[33m',
  red    : '\x1b[31m',
  magenta: '\x1b[35m',
  blue   : '\x1b[34m',
}

function log (prefix, color, msg) {
  process.stdout.write(`\r${C[color] ?? ''}[${ts()}] ${prefix}${C.reset} ${msg}\n> `)
}

// Frame / parse newline-delimited JSON messages
function encode (obj) {
  return Buffer.from(JSON.stringify(obj) + '\n')
}

function decode (buf) {
  try {
    return JSON.parse(buf.toString().trim())
  } catch {
    return null
  }
}

// ─── Peer State ────────────────────────────────────────────────────────────

const peers      = new Map()   // publicKey hex → { conn, alias, status }
let myAlias      = ''
let myStatus     = 'online'
let peerId       = ''          // set after swarm init
let clipHistory  = []          // last 10 received clips

// ─── Connection Handler ─────────────────────────────────────────────────────

function handleConnection (conn, info) {
  const remote = b4a.toString(info.publicKey, 'hex')
  const short  = shortKey(info.publicKey)

  peers.set(remote, { conn, alias: short, status: 'online' })
  log('⟳ PEER', 'green', `${short} connected  (${peers.size} total)`)

  // Announce ourselves immediately
  try {
    conn.write(encode({
      type   : MSG.INFO,
      alias  : myAlias,
      status : myStatus,
      version: APP_VERSION,
    }))
  } catch { /* conn may close instantly */ }

  // Accumulate incoming data (peers can send chunked)
  let buf = ''

  conn.on('data', (data) => {
    buf += data.toString()
    const lines = buf.split('\n')
    buf = lines.pop() // keep incomplete tail

    for (const line of lines) {
      if (!line.trim()) continue
      const msg = decode(line)
      if (!msg) continue
      handleMessage(remote, short, msg, conn)
    }
  })

  conn.on('close', () => {
    peers.delete(remote)
    log('✕ PEER', 'dim', `${short} disconnected  (${peers.size} remaining)`)
  })

  conn.on('error', (err) => {
    if (err.code !== 'ECONNRESET') {
      log('✕ ERR', 'red', `${short} → ${err.message}`)
    }
    peers.delete(remote)
  })
}

// ─── Message Handler ───────────────────────────────────────────────────────

function handleMessage (remote, short, msg, conn) {
  const peer = peers.get(remote)

  switch (msg.type) {

    case MSG.INFO:
      if (peer) {
        peer.alias  = msg.alias  || short
        peer.status = msg.status || 'online'
      }
      log('ℹ INFO', 'blue', `${msg.alias || short} is ${msg.status} (v${msg.version || '?'})`)
      break

    case MSG.CLIP: {
      const sender  = (peer && peer.alias) || short
      const payload = (msg.payload || '').slice(0, MAX_PAYLOAD_BYTES)
      const label   = msg.label ? ` [${msg.label}]` : ''
      log('📋 CLIP', 'cyan', `${sender}${label}:\n   ${payload}`)
      clipHistory.unshift({ from: sender, payload, label: msg.label || '', ts: ts() })
      if (clipHistory.length > 10) clipHistory.pop()

      // Send ACK back
      try {
        conn.write(encode({ type: MSG.ACK, ref: msg.id }))
      } catch { /* ignore */ }
      break
    }

    case MSG.STATUS: {
      const sender = (peer && peer.alias) || short
      if (peer) peer.status = msg.status || 'online'
      log('◉ STATUS', 'magenta', `${sender} → ${msg.status}`)
      break
    }

    case MSG.ACK:
      // Silently swallow ACKs; could surface to UI later
      break

    default:
      // Unknown message type – ignore safely
      break
  }
}

// ─── Broadcast Helpers ─────────────────────────────────────────────────────

function broadcastClip (payload, label = '') {
  if (!payload || !payload.trim()) {
    log('✕', 'red', 'Payload is empty. Nothing broadcast.')
    return
  }
  if (Buffer.byteLength(payload) > MAX_PAYLOAD_BYTES) {
    log('✕', 'red', `Payload too large (max ${MAX_PAYLOAD_BYTES} bytes).`)
    return
  }

  const id  = crypto.randomBytes(4).toString('hex')
  const msg = encode({ type: MSG.CLIP, id, payload, label, alias: myAlias })
  let sent  = 0

  for (const [, peer] of peers) {
    try {
      peer.conn.write(msg)
      sent++
    } catch { /* peer may have closed */ }
  }

  log('📤 SENT', 'green', `Clip broadcast to ${sent} peer(s)${label ? ' [' + label + ']' : ''}: ${payload.slice(0, 80)}${payload.length > 80 ? '…' : ''}`)
}

function broadcastStatus (status) {
  myStatus = status
  const msg = encode({ type: MSG.STATUS, status, alias: myAlias })
  let sent  = 0

  for (const [, peer] of peers) {
    try {
      peer.conn.write(msg)
      sent++
    } catch { /* ignore */ }
  }
  log('◉ STATUS', 'magenta', `Your status set to "${status}" – notified ${sent} peer(s)`)
}

// ─── CLI ───────────────────────────────────────────────────────────────────

function printHelp () {
  const h = `
${C.bold}${C.cyan}╔═══════════════════════════════════════════╗
║       INTERCOM-DROP  COMMANDS             ║
╚═══════════════════════════════════════════╝${C.reset}
  ${C.yellow}/clip <text>${C.reset}         Broadcast clipboard text to all peers
  ${C.yellow}/clip -l <label> <text>${C.reset} Broadcast with a label tag
  ${C.yellow}/status <text>${C.reset}       Set & broadcast your status
  ${C.yellow}/alias <name>${C.reset}        Set your display name
  ${C.yellow}/peers${C.reset}               List connected peers
  ${C.yellow}/history${C.reset}             Show last 10 received clips
  ${C.yellow}/ping${C.reset}               Re-announce your INFO to all peers
  ${C.yellow}/help${C.reset}               Show this menu
  ${C.yellow}/exit${C.reset}               Gracefully quit

  ${C.dim}Anything without a / prefix is also treated as a quick clip.${C.reset}
`
  process.stdout.write(h + '\n> ')
}

function printPeers () {
  if (peers.size === 0) {
    log('ℹ', 'yellow', 'No peers connected yet.')
    return
  }
  process.stdout.write(`\r${C.bold}Connected peers:${C.reset}\n`)
  for (const [hex, peer] of peers) {
    process.stdout.write(`  ${C.cyan}${shortKey(Buffer.from(hex, 'hex'))}${C.reset}  alias=${peer.alias}  status=${peer.status}\n`)
  }
  process.stdout.write('> ')
}

function printHistory () {
  if (clipHistory.length === 0) {
    log('ℹ', 'yellow', 'No clips received yet.')
    return
  }
  process.stdout.write(`\r${C.bold}Clip history (newest first):${C.reset}\n`)
  for (const [i, c] of clipHistory.entries()) {
    process.stdout.write(`  ${C.dim}${i + 1}.${C.reset} [${c.ts}] ${C.cyan}${c.from}${c.label ? ' (' + c.label + ')' : ''}${C.reset}: ${c.payload.slice(0, 120)}\n`)
  }
  process.stdout.write('> ')
}

function handleCommand (line) {
  const raw    = line.trim()
  if (!raw) return

  // Quick clip: anything without a / prefix
  if (!raw.startsWith('/')) {
    broadcastClip(raw)
    return
  }

  const parts   = raw.slice(1).split(' ')
  const cmd     = parts[0].toLowerCase()
  const rest    = parts.slice(1).join(' ')

  switch (cmd) {
    case 'clip': {
      if (rest.startsWith('-l ')) {
        const after = rest.slice(3)
        const spIdx = after.indexOf(' ')
        if (spIdx === -1) {
          log('✕', 'red', 'Usage: /clip -l <label> <text>')
          break
        }
        const label   = after.slice(0, spIdx)
        const payload = after.slice(spIdx + 1)
        broadcastClip(payload, label)
      } else {
        broadcastClip(rest)
      }
      break
    }
    case 'status':
      if (!rest) { log('✕', 'red', 'Usage: /status <text>'); break }
      broadcastStatus(rest)
      break
    case 'alias':
      if (!rest) { log('✕', 'red', 'Usage: /alias <name>'); break }
      myAlias = rest.slice(0, 24)
      log('✓', 'green', `Alias set to "${myAlias}"`)
      break
    case 'peers':
      printPeers()
      break
    case 'history':
      printHistory()
      break
    case 'ping': {
      const msg = encode({ type: MSG.INFO, alias: myAlias, status: myStatus, version: APP_VERSION })
      let sent = 0
      for (const [, peer] of peers) {
        try { peer.conn.write(msg); sent++ } catch { /* ignore */ }
      }
      log('⟳ PING', 'blue', `Re-announced to ${sent} peer(s)`)
      break
    }
    case 'help':
      printHelp()
      break
    case 'exit':
    case 'quit':
      log('✓', 'green', 'Shutting down…')
      process.exit(0)
      break
    default:
      log('✕', 'yellow', `Unknown command: /${cmd}. Type /help for options.`)
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main () {
  // Parse CLI args
  const args    = process.argv.slice(2)
  let channel   = DEFAULT_CHANNEL
  let alias     = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' && args[i + 1]) channel = args[++i]
    if (args[i] === '--alias'   && args[i + 1]) alias   = args[++i]
  }

  myAlias = alias || `peer-${crypto.randomBytes(2).toString('hex')}`

  // Print banner
  process.stdout.write(`
${C.bold}${C.cyan}
  ██████╗ ██████╗  ██████╗ ██████╗
  ██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
  ██║  ██║██████╔╝██║   ██║██████╔╝
  ██║  ██║██╔══██╗██║   ██║██╔═══╝
  ██████╔╝██║  ██║╚██████╔╝██║
  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ${C.reset}${C.dim}intercom-drop v${APP_VERSION}${C.reset}
${C.cyan}  Decentralized Ephemeral Clipboard & Status Beacon${C.reset}
${C.dim}  Built for the Intercom Vibe Competition • Trac Network${C.reset}

`)

  // Start Hyperswarm
  const swarm = new Hyperswarm()
  const topic = topicFromString(channel)
  peerId      = b4a.toString(swarm.keyPair.publicKey, 'hex')

  log('⚡ INIT', 'green', `My peer ID : ${shortKey(swarm.keyPair.publicKey)}`)
  log('⚡ INIT', 'green', `Alias      : ${myAlias}`)
  log('⚡ INIT', 'green', `Channel    : ${channel}`)
  log('⚡ INIT', 'green', `Topic hash : ${topic.toString('hex').slice(0, 16)}…`)

  swarm.on('connection', handleConnection)

  swarm.on('update', () => {
    // Emitted when peer counts change – keep prompt clean
  })

  const discovery = swarm.join(topic, { server: true, client: true })
  await discovery.flushed()

  log('✓ READY', 'green', `Joined DHT – waiting for peers. Type /help for commands.\n`)

  // Graceful shutdown
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
      log('⟳', 'yellow', 'Leaving swarm…')
      await swarm.destroy()
      process.exit(0)
    })
  }

  // CLI input loop
  const rl = readline.createInterface({
    input : process.stdin,
    output: process.stdout,
    prompt: '> ',
    terminal: true,
  })

  rl.prompt()

  rl.on('line', (line) => {
    handleCommand(line)
    rl.prompt()
  })

  rl.on('close', async () => {
    log('⟳', 'yellow', 'Input closed – leaving swarm…')
    await swarm.destroy()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
