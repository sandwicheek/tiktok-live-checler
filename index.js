const express = require("express");
const puppeteer = require("puppeteer");

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
      headless: true,
      executablePath:
        "/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    const content = await page.content();

    // Тимчасова перевірка
    const isLive =
      content.includes("LIVE") &&
      content.includes("live");

    res.json({
      success: true,
      user,
      isLive
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
