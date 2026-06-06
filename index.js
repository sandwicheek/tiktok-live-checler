const express = require("express");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const app = express();

app.get("/check", async (req, res) => {
  const user = req.query.user;

  if (!user) {
    return res.json({
      error: "no user"
    });
  }

  const url = `https://www.tiktok.com/@${user}`;

  let browser;

  try {
    console.log("Checking user:", user);
    console.log("Opening URL:", url);

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    const content = await page.content();

    const markers = {
      roomId: content.includes("roomId"),
      liveRoom: content.includes("liveRoom"),
      isRoomLive: content.includes("isRoomLive"),
      webcast: content.includes("webcast"),
      liveStudio: content.includes("liveStudio"),
      room_id: content.includes("room_id")
    };

    const finalUrl = page.url();
    const title = await page.title();

    const textSample = await page.evaluate(() => {
      return document.body.innerText.substring(0, 1500);
    });

    res.json({
      success: true,
      user,
      finalUrl,
      title,
      markers,
      textSample
    });

  } catch (e) {
    console.error(e);

    res.json({
      success: false,
      error: e.toString()
    });

  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
