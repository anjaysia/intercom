# intercom-drop

> **Decentralized Ephemeral Clipboard & Status Beacon**  
> A submission for the **Intercom Vibe Competition** — built on Trac Network / Hyperswarm

[![Node ≥ 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Pear Runtime](https://img.shields.io/badge/pear-compatible-blue)](https://pears.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

---

## What Is intercom-drop?

**intercom-drop** solves a real, everyday pain: moving text between devices without a cloud middleman.

Send a URL from your phone to your desktop. Share a one-time password with a teammate. Broadcast a short command to a fleet of bots. All peer-to-peer, all encrypted, no accounts, no servers, no databases.

```
┌──────────────────┐            DHT Swarm             ┌──────────────────┐
│  Mobile / Termux │  ──────── Hyperswarm ──────────  │  Desktop / Linux │
│  node index.js   │  Noise-encrypted P2P connections  │  node index.js   │
└──────────────────┘                                   └──────────────────┘
         │                                                      │
         └──────────────── shared channel topic ────────────────┘
```

### Key Features

- **Zero-server clipboard sharing** — drop text to all online peers instantly
- **Status beacons** — broadcast your presence/state to the swarm
- **Labeled clips** — tag clips as `url`, `cmd`, `pass`, or any custom label
- **Clip history** — last 10 received clips stored in memory
- **Termux-native** — runs on Android with no extra dependencies
- **Pear Runtime compatible** — first-class support for the Holepunch ecosystem
- **Agent-friendly** — pipe-friendly stdin/stdout protocol for automation

---

## Installation

### Standard (Node.js)

```bash
git clone 
cd intercom-drop
npm install
node index.js
```

### With Pear Runtime (Recommended)

```bash
npm install -g pear
cd intercom-drop
npm install
pear run . drop1
```

---

## Termux (Android) — Quick Start

Open Termux and run the following commands exactly:

```bash
# 1. Update packages
pkg update && pkg upgrade -y

# 2. Install Node.js and git
pkg install nodejs git -y

# 3. Clone the repository
git clone https://github.com/YOUR_USERNAME/intercom-drop.git
cd intercom-drop

# 4. Install npm dependencies
npm install

# 5. Run the app
node index.js
```

> **Tip:** For a persistent session on mobile, install `tmux` and run inside a tmux pane:
> ```bash
> pkg install tmux -y
> tmux new -s drop
> node index.js
> ```
> Detach with `Ctrl+B` then `D`. Re-attach with `tmux attach -t drop`.

---

## Usage

Once running, you'll see a `>` prompt. Type commands or plain text.

### Quick Examples

```
# Broadcast a URL to all peers
> https://example.com/my-link

# Same, explicitly:
> /clip https://example.com/my-link

# Broadcast with a label
> /clip -l url https://example.com/my-link

# Share a one-time token
> /clip -l pass s3cr3t-t0k3n-xyz

# Set your status
> /status away – grabbing coffee

# See who's connected
> /peers

# See last 10 received clips
> /history

# Change your display name
> /alias my-phone

# Exit cleanly
> /exit
```

### Joining a Private Channel

Both peers must use the same channel name. The name is hashed — it never travels over the network.

```bash
# Peer A (desktop)
node index.js --channel team-alpha-2024 --alias alice

# Peer B (mobile/Termux)
node index.js --channel team-alpha-2024 --alias bob
```

---

## Command Reference

| Command | Description |
|---|---|
| `/clip <text>` | Broadcast clipboard text |
| `/clip -l <label> <text>` | Broadcast with category label |
| `/status <text>` | Update and broadcast your status |
| `/alias <n>` | Set your display alias |
| `/peers` | List connected peers |
| `/history` | Show last 10 received clips |
| `/ping` | Re-announce your presence |
| `/help` | Show command menu |
| `/exit` | Graceful shutdown |
| `<plain text>` | Shortcut for `/clip <text>` |

---

## Automation / Agent Mode

intercom-drop is designed to be pipe-friendly:

```bash
# One-shot clip send (no interactive prompt)
echo "/clip $(hostname): build passed at $(date)" | node index.js --alias ci-bot --channel my-ci

# Pipe a file's contents as a clip
cat result.json | xargs -I{} node index.js --alias scraper --channel data-drop <<< "/clip {}"
```

Stdout log lines follow this pattern:

```
[HH:MM:SS] ICON PREFIX  message
```

Filter for received clips with `grep '📋 CLIP'`.

---

## Architecture

```
index.js
├── Hyperswarm (DHT peer discovery + Noise encryption)
├── Topic derivation (SHA-256 of channel string → 32-byte key)
├── Connection handler (per-peer stream management)
├── Message handler (CLIP / STATUS / INFO / ACK)
├── Broadcast helpers (broadcastClip, broadcastStatus)
└── CLI (readline-based interactive prompt)
```

### Wire Protocol (NDJSON)

All messages are newline-delimited JSON over encrypted streams:

```jsonc
// Clipboard broadcast
{"type":"CLIP","id":"a1b2c3d4","payload":"your text here","label":"url","alias":"alice"}

// Status beacon
{"type":"STATUS","status":"online","alias":"alice"}

// Peer announcement
{"type":"INFO","alias":"alice","status":"online","version":"1.0.0"}

// Receipt ACK
{"type":"ACK","ref":"a1b2c3d4"}
```

---

## Security

- All traffic is end-to-end encrypted (Noise protocol via Hyperswarm / HyperDHT).
- The DHT topic is derived from `SHA-256(channelName)` — your channel name is never broadcast.
- Clips are **ephemeral** — stored in memory only, lost on restart.
- Maximum payload: **4 096 bytes** per message.
- Alias names are self-declared and not authenticated. Use a private channel for trust.

---

## Contributing / Forking

This repo is a competition entry and intentionally minimal. Suggested extensions:

- Persistent clip log via `hypercore`
- End-to-end payload encryption with recipient's public key
- HTTP endpoint for browser access
- QR code display of your peer ID for easy mobile pairing

---

## License

MIT — see [LICENSE](LICENSE)

---

## Trac Address

trac1j8fl9j8ndjetm09gfrhyvvn98a5ac5p005g3hglqn9fvclpxe56qkpuj5u

---

*Built with ♥ for the Intercom Vibe Competition — Trac Network*
