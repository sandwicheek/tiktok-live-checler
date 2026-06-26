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

// --- НАЛАШТУВАННЯ ПРОКСІ ---
// Заміни тут IP та ПОРТ на свої. Якщо є логін/пароль, формат: "http://user:pass@ip:port"
const PROXY_URL = "http://91.185.20.162:8080"; 
// ---------------------------

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
  console.log(`Перевірка трансляції для @${TIKTOK_USERNAME}...`);

  try {
    const { data: statusData } = await supabase.from('bot_status').select('is_live').eq('id', 1).single();
    const lastStatus = statusData ? statusData.is_live : "false";

    let isLiveNow = "false";

    if (!WebcastPushConnection) {
      console.error("[КРИТИЧНО]: Коннектор TikTok не ініціалізовано!");
      return;
    }

    try {
      const cleanProxy = PROXY_URL ? PROXY_URL.trim() : "";
      const connectOptions = {};
      
      if (cleanProxy) {
        // Переконуємося, що проксі має правильний формат для бібліотеки
        console.log(`[СПРОБА]: Робимо запит через проксі: ${cleanProxy}`);
        connectOptions.requestOptions = {
          proxy: cleanProxy,
          timeout: 10000 // додаємо таймаут 10 секунд, щоб не виснути
        };
      }

      const tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME, connectOptions);

      // Викликаємо внутрішній метод підключення
      const state = await tiktokConnection.connect();
      
      if (state && state.roomId) {
        isLiveNow = "true";
      } else {
        isLiveNow = "false";
      }
    }
      
      tiktokConnection.disconnect();
    } catch (tiktokError) {
      isLiveNow = "false";
      // Тепер ми точно побачимо, де саме і яка помилка сталася
      console.log(`[ТІКТОК API ПОМИЛКА]: ${tiktokError.message}`);
    }

    if (isLiveNow === "true") {
      console.log(`[СТАТУС]: @${TIKTOK_USERNAME} зараз в ЕФІРІ! 🔴`);
    } else {
      console.log(`[СТАТУС]: @${TIKTOK_USERNAME} зараз офлайн. 💤`);
    }

    if (isLiveNow === "true" && lastStatus === "false") {
      await sendTelegramAlert(`🔴 **Почався ефір!**\n\nАкаунт: @${TIKTOK_USERNAME}\nПосилання: https://www.tiktok.com/@${TIKTOK_USERNAME}/live`);
      await supabase.from('bot_status').update({ is_live: 'true' }).eq('id', 1);
    } 
    else if (isLiveNow === "false" && lastStatus === "true") {
      await sendTelegramAlert(`🟢 Трансляція акаунта @${TIKTOK_USERNAME} завершилась.`);
      await supabase.from('bot_status').update({ is_live: 'false' }).eq('id', 1);
    }
  } catch (globalError) {
    console.error("Помилка в циклі перевірки:", globalError.message);
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
