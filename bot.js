let WebcastPushConnection;
try {
  const tkl = require('tiktok-live-connector');
  if (tkl.WebcastPushConnection) {
    WebcastPushConnection = tkl.WebcastPushConnection;
  } else if (typeof tkl === 'function') {
    WebcastPushConnection = tkl;
  } else {
    WebcastPushConnection = tkl.default || tkl;
  }
} catch (importError) {
  console.error("Помилка імпорту коннектора:", importError.message);
}

const { createClient } = require('@supabase/supabase-js');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || "_sasha__shu_";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RENDER_APP_URL = process.env.RENDER_APP_URL;
const PROXY_URL = process.env.PROXY_URL || "socks5://199.247.29.193:50000";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  } catch (tgError) {
    console.error("Помилка відправки в TG:", tgError.message);
  }
}

async function checkTikTokLive() {
  console.log(`Перевірка трансляції для @${TIKTOK_USERNAME} через RapidAPI (Check Alive)...`);

  try {
    // 1. Беремо попередній статус із бази Supabase
    const { data: statusData } = await supabase.from('bot_status').select('is_live').eq('id', 1).single();
    const lastStatus = statusData ? statusData.is_live : "false";

    let isLiveNow = "false";

    // 2. Налаштування запиту до RapidAPI
    const options = {
      method: 'GET',
      url: 'https://tiktok-api23.p.rapidapi.com/api/live/check-alive',
      params: { uniqueId: TIKTOK_USERNAME }, // Сюди автоматично підставиться нікнейм, який ти тестуєш
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.request(options);
    
    // 3. Перевірка відповіді
    // Ми перевіряємо і поле 'alive', і поле 'isLive' про всяк випадок, щоб точно вгадати структуру API
    if (response.data && (response.data.alive === true || response.data.isLive === true)) { 
      isLiveNow = "true";
    }

    if (isLiveNow === "true") {
      console.log(`[СТАТУС]: @${TIKTOK_USERNAME} зараз в ЕФІРІ! 🔴`);
    } else {
      console.log(`[СТАТУС]: @${TIKTOK_USERNAME} зараз офлайн. 💤`);
    }

    // 4. Твоя стандартна логіка сповіщень у Телеграм
    if (isLiveNow === "true" && lastStatus === "false") {
      await sendTelegramAlert(`🔴 **Почався ефір!**\n\nАкаунт: @${TIKTOK_USERNAME}\nПосилання: https://www.tiktok.com/@${TIKTOK_USERNAME}/live`);
      await supabase.from('bot_status').update({ is_live: 'true' }).eq('id', 1);
    } 
    else if (isLiveNow === "false" && lastStatus === "true") {
      await sendTelegramAlert(`🟢 Трансляція акаунта @${TIKTOK_USERNAME} завершилась.`);
      await supabase.from('bot_status').update({ is_live: 'false' }).eq('id', 1);
    }
  } catch (error) {
    console.error("Помилка RapidAPI Check Alive:", error.message);
  }
}

setInterval(checkTikTokLive, 240000);
checkTikTokLive();

setInterval(() => {
  if (RENDER_APP_URL) {
    axios.get(`${RENDER_APP_URL}/ping`)
      .then(() => console.log('Самопінг успішний, бот не спить!'))
      .catch(pingError => console.error('Помилка самопінгу:', pingError.message));
  }
}, 600000);
