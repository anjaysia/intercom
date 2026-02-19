# SKILL — intercom-drop

> Agent instructions for operating and interacting with the **intercom-drop** application.  
> This file follows the Intercom SKILL.md convention from Trac Systems.

---

## What Is This App?

**intercom-drop** is a **Decentralized Ephemeral Clipboard & Status Beacon** built on top of the Intercom / Trac Network stack.

It allows any number of peers (mobile, desktop, server, Termux) to:

- **Broadcast short text clips** (URLs, passwords, addresses, notes, commands) instantly across a serverless P2P channel.
- **Set a status beacon** (online, away, busy, or any custom string) that all connected peers see in real-time.
- **Receive clips** from other peers and review a local history of the last 10 clips.

No server, no database, no account. Connections are end-to-end encrypted via the Noise protocol (Hyperswarm).

---

## Runtime Requirements

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.0.0 |
| Pear Runtime (optional but recommended) | latest |
| Hyperswarm | ^4.7.x |
| OS | Linux, macOS, Windows, **Termux (Android)** |

---

## First-Run Checklist

1. Clone or copy the repository.
2. Run `npm install` in the project root.
3. Start with `node index.js` (plain Node) or `pear run . drop1` (Pear runtime).
4. On first start, a random alias like `peer-a3f2` is assigned. Customise with `--alias YourName`.
5. Share your **channel name** with peers you want to connect to. The default channel `intercom-drop-v1-global` is public.
6. Once peers appear, start dropping clips.

---

## CLI Reference

All commands are entered at the live `> ` prompt.

| Command | Effect |
|---|---|
| `/clip <text>` | Broadcast `<text>` as a clipboard entry to all connected peers |
| `/clip -l <label> <text>` | Broadcast with an optional category label (e.g. `url`, `cmd`, `pass`) |
| `/status <text>` | Update and broadcast your status string (max 64 chars) |
| `/alias <name>` | Change your display alias (max 24 chars, local session only) |
| `/peers` | Print a table of all currently connected peers and their statuses |
| `/history` | Print the last 10 clips received from peers |
| `/ping` | Re-broadcast your INFO frame to all peers |
| `/help` | Print the command reference |
| `/exit` | Gracefully leave the DHT swarm and quit |
| `<text>` | Any text without a `/` prefix is treated as a quick `/clip` |

---

## Launch Options

```
node index.js [--channel <name>] [--alias <name>]
```

| Flag | Default | Purpose |
|---|---|---|
| `--channel` | `intercom-drop-v1-global` | DHT topic channel name; peers must use the same string |
| `--alias` | `peer-<4 hex chars>` | Your display name shown to other peers |

### Examples

```bash
# Join the global public channel
node index.js

# Join a private channel with a custom alias
node index.js --channel my-team-secret --alias alice

# Pear runtime equivalent
pear run . drop1 --channel my-team-secret --alias bob
```

---

## Wire Protocol

All messages are newline-delimited JSON sent over Hyperswarm encrypted streams.

### Message Types

#### `INFO` — Peer Announcement
Sent automatically upon connection. Re-sent on `/ping`.

```json
{
  "type": "INFO",
  "alias": "alice",
  "status": "online",
  "version": "1.0.0"
}
```

#### `CLIP` — Clipboard Broadcast

```json
{
  "type": "CLIP",
  "id": "a1b2c3d4",
  "payload": "https://example.com/some-link",
  "label": "url",
  "alias": "alice"
}
```

- `id`: 4-byte random hex, used for ACK correlation.
- `payload`: The clipboard content (max 4096 bytes UTF-8).
- `label`: Optional freeform category tag.

#### `STATUS` — Status Beacon

```json
{
  "type": "STATUS",
  "status": "away – back in 10 min",
  "alias": "alice"
}
```

#### `ACK` — Receipt Acknowledgement

```json
{
  "type": "ACK",
  "ref": "a1b2c3d4"
}
```

Sent automatically by a receiver after processing a `CLIP`. No user action required.

---

## Agent Interaction Guide

If you are an AI agent or automated script integrating with intercom-drop:

1. **Spawn the process** with `node index.js --alias <agent-name>`.
2. **Write to stdin** to issue commands (e.g. `/clip https://my-result.com`).
3. **Read from stdout** – each log line follows the pattern:
   ```
   [HH:MM:SS] PREFIX  message
   ```
   Prefixes of interest:
   - `📋 CLIP` — a clip was received; payload follows the `:` separator.
   - `◉ STATUS` — a peer changed status.
   - `ℹ INFO` — a new peer connected.
   - `✕ ERR` — a non-fatal error.
4. Parse lines matching `📋 CLIP` to extract incoming clipboard content.
5. To **send a clip from an agent**, write `/clip <payload>\n` to the process stdin.

### Example (shell agent integration)

```bash
# Send a clip from a shell script
echo "/clip $(cat /tmp/result.txt)" | node index.js --alias ci-bot --channel my-team
```

---

## Security Notes

- All connections are end-to-end encrypted via the Noise protocol (provided by Hyperswarm / HyperDHT).
- The channel name is hashed with SHA-256 to form the 32-byte DHT topic key. Keep your channel name secret to restrict access.
- Clips are **ephemeral** — they are never persisted to disk by default.
- There is no authentication of alias names; any peer can claim any alias. Trust is established out-of-band (share peer IDs privately).
- Max payload is enforced at 4096 bytes per message to prevent abuse.

---

## Upgrading / Forking

This app is designed as a minimal template. Possible extensions:

- **Persistent history** – write received clips to a local append-only log with `hypercore`.
- **Encryption layer** – encrypt payloads with the recipient's public key before broadcasting.
- **Named rooms** – derive the DHT topic from a room name + shared password.
- **Web UI** – expose a local HTTP endpoint serving a minimal HTML clipboard viewer.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No peers appear | Firewall blocking UDP | Allow outbound UDP or use a VPN |
| `ERR_MODULE_NOT_FOUND` | `npm install` not run | Run `npm install` |
| Crashes on Termux | Node version too old | `pkg upgrade nodejs` |
| Clips arrive empty | Peer on older version | Ensure both sides use v1.0.0+ |
| Prompt garbles output | Non-TTY terminal | Use a proper terminal emulator |

---

*intercom-drop — Intercom Vibe Competition Submission*  
*Trac Address: [INSERT_YOUR_TRAC_ADDRESS_HERE]*
