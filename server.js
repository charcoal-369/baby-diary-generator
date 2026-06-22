const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function cleanFileName(value) {
  return String(value || 'Baby')
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'Baby';
}

app.post('/generate', async (req, res) => {
  const babyName = String(req.body.babyName || '').trim() || 'Baby';
  const babyDob = String(req.body.babyDob || '').trim();
  const dateFormat = String(req.body.dateFormat || 'DMY').trim();

  if (!babyDob) {
    return res.status(400).send('Please enter a date of birth.');
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 });

    await page.goto(`http://localhost:${PORT}/diary.html`, {
      waitUntil: 'networkidle0',
      timeout: 120000
    });

    await page.evaluate(({ babyName, babyDob, dateFormat }) => {
      document.getElementById('babyName').value = babyName;
      document.getElementById('babyDob').value = babyDob;
      document.getElementById('dateFormat').value = dateFormat;
      renderBook();
    }, { babyName, babyDob, dateFormat });

    // Wait until every image in the generated book has loaded.
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      }));
    });

    // Use the print CSS and undo screen preview scaling before PDF export.
    await page.emulateMediaType('print');
    await page.addStyleTag({ content: `
      .controls { display: none !important; }
      .page { transform: none !important; margin-bottom: 0 !important; box-shadow: none !important; }
      html, body { background: #fff !important; }
    `});

    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: '8.5in',
      height: '11in',
      margin: { top: '0in', right: '0in', bottom: '0in', left: '0in' },
      preferCSSPageSize: true,
      timeout: 120000
    });

    const fileName = `${cleanFileName(babyName)}-personalised-baby-diary.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', Buffer.byteLength(pdfBuffer));
    res.end(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error(error);
    res.status(500).send('Sorry, the PDF could not be generated. Check the terminal for details.');
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Baby Diary Generator running at http://localhost:${PORT}`);
});
