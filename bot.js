const { WebcastPushConnection } = require('tiktok-live-connector');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || "_sasha__shu_";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RENDER_APP_URL = process.env.RENDER_APP_URL; // Посилання на твій сервіс (додамо в кінці)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Створюємо просту вебсторінку, щоб Render бачив, що сервіс живий
app.get('/', (req, res) => res.send('Бот працює!'));
app.get('/ping', (req, res) => res.send('Понг!'));
app.listen(PORT, () => console.log(`Вебсервер запущено на порту ${PORT}`));

async function sendTelegramAlert(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("Помилка відправки в TG:", err.message);
  }
}

// Головна функція перевірки
async function checkTikTokLive() {
  console.log(`Перевірка трансляції для @${TIKTOK_USERNAME}...`);

  try {
    const { data: statusData } = await supabase.from('bot_status').select('is_live').eq('id', 1).single();
    const lastStatus = statusData ? statusData.is_live : "false";

    const tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME);
    let isLiveNow = "false";

    try {
      const state = await tiktokConnection.connect();
      if (state.roomId) isLiveNow = "true";
      tiktokConnection.disconnect();
    } catch (err) {
      isLiveNow = "false";
    }

    if (isLiveNow === "true") console.log(`[СТАТУС] @${TIKTOK_USERNAME} зараз в ЕФІРІ! 🔴`);
    else console.log(`[СТАТУС] @${TIKTOK_USERNAME} зараз офлайн. 💤`);

    if (isLiveNow === "true" && lastStatus === "false") {
      await sendTelegramAlert(`🔴 **Почався ефір!**\n\nАкаунт: @${TIKTOK_USERNAME}\nПосилання: https://www.tiktok.com/@${TIKTOK_USERNAME}/live`);
      await supabase.from('bot_status').update({ is_live: 'true' }).eq('id', 1);
    } 
    else if (isLiveNow === "false" && lastStatus === "true") {
      await sendTelegramAlert(`🟢 Трансляцію акаунта @${TIKTOK_USERNAME} завершилась.`);
      await supabase.from('bot_status').update({ is_live: 'false' }).eq('id', 1);
    }
  } catch (globalErr) {
    console.error("Помилка в циклі:", globalErr.message);
  }
}

// Запускаємо перевірку кожні 4 хвилини (240 000 мілісекунд)
setInterval(checkTikTokLive, 240000);
checkTikTokLive(); // Перший запуск одразу

// Функція «самопінгу» — кожні 10 хвилин бот смикає сам себе, щоб Render не заснув
setInterval(() => {
  if (RENDER_APP_URL) {
    axios.get(`${RENDER_APP_URL}/ping`)
      .then(() => console.log('Самопінг успішний, бот не спить!'))
      .catch(err => console.error('Помилка самопінгу:', err.message));
  }
}, 600000);
