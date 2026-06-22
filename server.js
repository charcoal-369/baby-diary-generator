// server.js
//
// Express server for the Baby Diary Generator.
//
// - Serves the static frontend (index.html, page_*.png, fonts).
// - Exposes POST /generate, which launches headless Chromium (Puppeteer),
//   loads index.html with the submitted baby name / DOB / date format,
//   waits for the existing client-side renderBook() logic to build the book,
//   and prints it to a real PDF using the page's own print stylesheet.
//   Then streams the PDF back as a download.

const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/generate', async (req, res) => {
  try {
    const { babyName, babyDob, dateFormat } = req.body || {};

    if (!babyDob) {
      return res.status(400).json({ error: "Please enter a date of birth." });
    }

    const safeName = String(babyName || 'Baby').trim() || 'Baby';
    const safeDob = String(babyDob);
    const safeFormat = (dateFormat === 'MDY') ? 'MDY' : 'DMY';

    const host = req.get('host');
    const protocol = req.protocol;
    const renderUrl =
      `${protocol}://${host}/index.html?print=1` +
      `&babyName=${encodeURIComponent(safeName)}` +
      `&babyDob=${encodeURIComponent(safeDob)}` +
      `&dateFormat=${encodeURIComponent(safeFormat)}`;

    const pdfBuffer = await renderPdf(renderUrl);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName.replace(/[^a-z0-9]+/gi, '_')}_diary.pdf"`
    );
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Error in /generate:', err);
    res.status(500).json({
      error: "Something went wrong generating your PDF. Please try again, and contact support if it keeps happening."
    });
  }
});

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { default: puppeteer } = await import('puppeteer');
      return puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    })();
  }
  return browserPromise;
}

async function renderPdf(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 900, height: 1200 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    await page.waitForSelector('body[data-render-ready="true"]', { timeout: 30000 });

    const pdfBuffer = await page.pdf({
      width: '8.5in',
      height: '11in',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    return pdfBuffer;
  } finally {
    await page.close();
  }
}

app.listen(PORT, () => {
  console.log(`Baby Diary Generator running on port ${PORT}`);
});
