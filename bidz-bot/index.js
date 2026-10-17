const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
const P = require('pino')
const { Boom } = require('@hapi/boom')
const Jimp = require('jimp')
const webp = require('node-webpmux')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const OWNER_NUMBER = '6282173472942'
const BOT_NAME = 'BIDZ BOT'

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}

async function bufferToSticker(buffer) {
  const tmpDir = path.join(__dirname, 'tmp')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

  const id = Date.now()
  const pngPath = path.join(tmpDir, id + '.png')
  const webpPath = path.join(tmpDir, id + '.webp')

  const img = await Jimp.read(buffer)
  img.resize(512, 512, Jimp.RESIZE_BEZIER).cover(512, 512)
  await img.writeAsync(pngPath)

  await execPromise('cwebp -q 80 "' + pngPath + '" -o "' + webpPath + '"')

  const image = new webp.Image()
  await image.load(webpPath)

  const json = {
    'sticker-pack-id': 'bidzbot-' + id,
    'sticker-pack-name': 'BIDZ BOT',
    'sticker-pack-publisher': 'Abid Studio',
    'emojis': ['😀']
  }
  const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8')
  const exif = Buffer.concat([exifAttr, jsonBuffer])
  exif.writeUIntLE(jsonBuffer.length, 14, 4)
  image.exif = exif

  const finalBuffer = await image.save(null)

  fs.unlinkSync(pngPath)
  fs.unlinkSync(webpPath)

  return finalBuffer
}

function menuText() {
  return '╭─❍「 ' + BOT_NAME + ' MENU 」\n' +
    '╰───────────────\n' +
    '│  `Command`\n' +
    '❍─────────────\n' +
    '│  .bidzmenu - list command \n' +
    '│  .ai - chat AI\n' +
    '│  .sticker - buat stiker\n' +
    '│ .jam - waktu sekarang\n' +
    '❍─────────────\n' +
    '│ `AI`\n' +
    '❍────────────\n' +
    '│   .ai (pertanyaan)\n' +
    '❍────────────\n' +
    '│ `GROUP`\n' +
    '❍────────────\n' +
    '│.tagall\n' +
    '│.kick\n' +
    '│.ban\n' +
    '│.mute\n' +
    '│.promote\n' +
    '│.add\n' +
    '❍────────────\n' +
    '│ `GENERATE`\n' +
    '❍────────────\n' +
    '│.brat\n' +
    '│.bratvid\n' +
    '│.qc\n' +
    '❍────────────\n' +
    '│ `LINK`\n' +
    '❍────────────\n' +
    '│.videy\n' +
    '│.mediafire\n' +
    '│.tiktok\n' +
    '│.youtube\n' +
    '│.ig\n' +
    '│.telegram\n' +
    '╰─────────────'
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
  })

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(OWNER_NUMBER)
        console.log('Pairing Code:', code)
      } catch (e) {
        console.log('Gagal minta pairing code:', e)
      }
    }, 3000)
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) start()
      else console.log('Logged out, hapus folder auth lalu scan ulang.')
    }
    if (connection === 'open') console.log(BOT_NAME + ' connected!')
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const sender = msg.key.participant || msg.key.remoteJid
    const body = (msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || (msg.message.imageMessage && msg.message.imageMessage.caption) || '').trim()
    const lower = body.toLowerCase()
    const args = body.split(' ').slice(1)

    if (lower.indexOf('.') !== 0) return

    const processing = await sock.sendMessage(from, { text: '⏳ Memproses...' }, { quoted: msg })

    const reply = (t) => sock.sendMessage(from, { text: t, edit: processing.key })
    const replyMedia = async (content) => {
      await sock.sendMessage(from, { delete: processing.key })
      await sock.sendMessage(from, content, { quoted: msg })
    }

    async function isSenderAdmin() {
      if (!isGroup) return false
      const meta = await sock.groupMetadata(from)
      const p = meta.participants.find(function (x) { return x.id === sender })
      return p && (p.admin === 'admin' || p.admin === 'superadmin')
    }
    function getMentioned() {
      return (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.mentionedJid) || []
    }

    if (lower === '.bidzmenu') {
      await reply(menuText())

    } else if (lower === '.jam') {
      await reply('Waktu sekarang: ' + new Date().toLocaleString('id-ID'))

    } else if (lower.indexOf('.ai ') === 0) {
      const question = body.slice(4)
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer GANTI_DENGAN_GROQ_API_KEY'
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: question }]
          })
        })
        const data = await res.json()
        await reply((data.choices && data.choices[0] && data.choices[0].message.content) || 'Gagal dapat respon AI.')
      } catch (e) {
        await reply('Error AI: ' + e.message)
      }

    } else if (lower === '.tagall') {
      if (!isGroup) { await reply('Command ini cuma buat grup.') } else {
        const meta = await sock.groupMetadata(from)
        let teks = '⚡TAGALL⚡\n\n'
        for (const p of meta.participants) teks += '⚡@' + p.id.split('@')[0] + '\n'
        await sock.sendMessage(from, { delete: processing.key })
        await sock.sendMessage(from, { text: teks, mentions: meta.participants.map(function (p) { return p.id }) })
      }

    } else if (lower.indexOf('.kick') === 0) {
      if (!(await isSenderAdmin())) { await reply('Khusus admin.') } else {
        const target = getMentioned()
        if (!target.length) { await reply('Tag orang yang mau dikick.') } else {
          await sock.groupParticipantsUpdate(from, target, 'remove')
          await reply('Berhasil dikick.')
        }
      }

    } else if (lower.indexOf('.ban') === 0) {
      if (!(await isSenderAdmin())) { await reply('Khusus admin.') } else {
        const target = getMentioned()
        if (!target.length) { await reply('Tag orang yang mau diban.') } else {
          await sock.groupParticipantsUpdate(from, target, 'remove')
          await reply('Berhasil diban.')
        }
      }

    } else if (lower.indexOf('.unmute') === 0) {
      if (!(await isSenderAdmin())) { await reply('Khusus admin.') } else {
        await sock.groupSettingUpdate(from, 'not_announcement')
        await reply('Grup dibuka lagi.')
      }

    } else if (lower.indexOf('.mute') === 0) {
      if (!(await isSenderAdmin())) { await reply('Khusus admin.') } else {
        await sock.groupSettingUpdate(from, 'announcement')
        await reply('Grup dikunci, cuma admin yang bisa chat.')
      }

    } else if (lower.indexOf('.promote') === 0) {
      if (!(await isSenderAdmin())) { await reply('Khusus admin.') } else {
        const target = getMentioned()
        if (!target.length) { await reply('Tag orang yang mau dijadiin admin.') } else {
          await sock.groupParticipantsUpdate(from, target, 'promote')
          await reply('Berhasil dipromote.')
        }
      }

    } else if (lower.indexOf('.add') === 0) {
      if (!(await isSenderAdmin())) { await reply('Khusus admin.') } else {
        const number = args[0]
        if (!number) { await reply('Format: .add 628xxxx') } else {
          await sock.groupParticipantsUpdate(from, [number + '@s.whatsapp.net'], 'add')
          await reply('Berhasil ditambahkan.')
        }
      }

    } else if (lower.indexOf('.brat ') === 0) {
      const teksBrat = body.slice(6)
      try {
        const res = await fetch('https://api.siputzx.my.id/api/m/brat?text=' + encodeURIComponent(teksBrat))
        const buffer = Buffer.from(await res.arrayBuffer())
        await replyMedia({ image: buffer, caption: 'Brat sticker' })
      } catch (e) {
        await reply('Gagal generate brat: ' + e.message)
      }

    } else if (lower.indexOf('.qc') === 0) {
      await reply('Fitur QC (quote card) belum aktif, minta gua bikinin kalau perlu.')

    } else if (lower.indexOf('.tiktok ') === 0) {
      const url = args[0]
      try {
        const res = await fetch('https://api.siputzx.my.id/api/d/tiktok?url=' + encodeURIComponent(url))
        const data = await res.json()
        const videoUrl = (data.data && data.data.url) || (data.result && data.result.video)
        if (!videoUrl) { await reply('Gagal ambil video.') } else {
          await replyMedia({ video: { url: videoUrl }, caption: 'Tiktok Downloader' })
        }
      } catch (e) {
        await reply('Error: ' + e.message)
      }

    } else if (lower.indexOf('.youtube ') === 0) {
      await reply('Fitur Youtube downloader belum aktif, minta gua setupin kalau perlu.')

    } else if (lower.indexOf('.ig ') === 0) {
      const url = args[0]
      try {
        const res = await fetch('https://api.siputzx.my.id/api/d/igdl?url=' + encodeURIComponent(url))
        const data = await res.json()
        const link = data.data && data.data[0] && data.data[0].url
        if (!link) { await reply('Gagal ambil media IG.') } else {
          await replyMedia({ video: { url: link } })
        }
      } catch (e) {
        await reply('Error: ' + e.message)
      }

    } else if (lower.indexOf('.mediafire ') === 0) {
      const url = args[0]
      await reply('Link Mediafire kamu: ' + url + '\n(Fitur auto-download belum aktif.)')

    } else if (lower.indexOf('.videy ') === 0) {
      await reply('Fitur Videy downloader belum aktif.')

    } else if (lower.indexOf('.telegram ') === 0) {
      await reply('Fitur Telegram downloader belum aktif.')

    } else if (lower === '.sticker') {
      const quoted = msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.quotedMessage
      const targetMsg = msg.message.imageMessage ? msg : (quoted && quoted.imageMessage ? { message: quoted } : null)

      if (!targetMsg) {
        await reply('Kirim/reply gambar dengan caption .sticker')
      } else {
        try {
          const buffer = await downloadMediaMessage(targetMsg, 'buffer', {})
          const stickerBuffer = await bufferToSticker(buffer)
          await replyMedia({ sticker: stickerBuffer })
        } catch (e) {
          await reply('Gagal bikin stiker: ' + e.message)
        }
      }

    } else {
      await sock.sendMessage(from, { delete: processing.key })
    }
  })
}

start()
