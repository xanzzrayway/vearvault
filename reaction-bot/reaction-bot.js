/**
 * Reaction Bot - Auto react pesan channel dengan banyak emoji
 * Jalan pakai: node reaction-bot.js
 * Install dulu: npm i telegraf
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');

// Token diambil dari file .env (BOT_TOKEN=xxxx)
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN belum diisi di file .env!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// List emoji reaction yang valid di Telegram Bot API
// (harus dari daftar resmi, gak bisa emoji sembarangan)
const REACTIONS = [
  '👍', '❤️', '🔥', '🎉', '😁', '🤩', '😍', '👏',
  '🙏', '💯', '⚡', '🥳', '😂', '🤯', '😱', '🤔',
  '👀', '🎊', '🙌', '😎'
];

// Berapa banyak reaction yang dipasang per pesan
const JUMLAH_REACTION = 3;

function acakReaction(count = JUMLAH_REACTION) {
  const shuffled = [...REACTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map((emoji) => ({ type: 'emoji', emoji }));
}

async function reactPesan(ctx, chatId, messageId) {
  try {
    await ctx.telegram.callApi('setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction: acakReaction(),
      is_big: false,
    });
    console.log(`Reacted -> chat ${chatId}, msg ${messageId}`);
  } catch (err) {
    console.error('Gagal react:', err.description || err.message);
  }
}

// Pesan yang diposting langsung di channel
bot.on('channel_post', (ctx) => {
  reactPesan(ctx, ctx.chat.id, ctx.channelPost.message_id);
});

// Pesan di grup diskusi (kalo channel-nya linked ke grup komentar)
bot.on('message', (ctx) => {
  reactPesan(ctx, ctx.chat.id, ctx.message.message_id);
});

bot.launch();
console.log('Reaction bot jalan, nunggu pesan masuk...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

