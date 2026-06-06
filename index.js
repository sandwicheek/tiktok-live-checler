const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.get("/check", async (req, res) => {
  const user = req.query.user;

  if (!user) {
    return res.json({ error: "no user" });
  }

  const url = `https://www.tiktok.com/@${user}`;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    const content = await page.content();

    const isLive =
      content.includes("LIVE") &&
      content.includes("live");

    await browser.close();

    res.json({ isLive });

  } catch (e) {
    res.json({ error: e.toString() });
  }
});

app.listen(3000, () => {
  console.log("Server started");
});
