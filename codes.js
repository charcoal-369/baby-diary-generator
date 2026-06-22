// codes.js
//
// Simple, file-based single-use access code store.
//
// This file lives and runs only on the server. It is never sent to the
// browser, so codes are never visible client-side. Storage is a JSON file
// on disk, which works fine on Railway as long as you attach a persistent
// volume (see README.md). If you don't need codes to survive a redeploy,
// the default project directory works too.
//
// Data shape (codes.json):
// {
//   "ABCD-1234": { "used": false, "usedAt": null },
//   "EFGH-5678": { "used": true,  "usedAt": "2026-06-22T10:15:00.000Z" }
// }

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.CODES_DATA_DIR || __dirname;
const CODES_FILE = path.join(DATA_DIR, 'codes.json');

// Very small in-process mutex so two near-simultaneous requests using the
// same code can't both pass validation before either one is marked used.
let writeQueue = Promise.resolve();
function withLock(fn){
  const result = writeQueue.then(fn, fn);
  writeQueue = result.catch(() => {});
  return result;
}

function ensureFile(){
  if(!fs.existsSync(DATA_DIR)){
    fs.mkdirSync(DATA_DIR, { recursive:true });
  }
  if(!fs.existsSync(CODES_FILE)){
    fs.writeFileSync(CODES_FILE, JSON.stringify({}, null, 2));
  }
}

function readCodes(){
  ensureFile();
  const raw = fs.readFileSync(CODES_FILE, 'utf8');
  try{
    return JSON.parse(raw || '{}');
  }catch(e){
    throw new Error('codes.json is not valid JSON: ' + e.message);
  }
}

function writeCodes(codes){
  ensureFile();
  // Write to a temp file then rename, so a crash mid-write can't corrupt
  // the codes file.
  const tmpFile = CODES_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(codes, null, 2));
  fs.renameSync(tmpFile, CODES_FILE);
}

function normalize(code){
  return String(code || '').trim().toUpperCase();
}

/**
 * Validates and consumes a code in one atomic step.
 * Returns { ok: true } if the code was valid and unused (it is now marked used),
 * or { ok: false, reason: 'not_found' | 'used' } otherwise.
 */
function redeemCode(code){
  return withLock(() => {
    const key = normalize(code);
    if(!key){
      return { ok:false, reason:'not_found' };
    }

    const codes = readCodes();
    const entry = codes[key];

    if(!entry){
      return { ok:false, reason:'not_found' };
    }

    if(entry.used){
      return { ok:false, reason:'used' };
    }

    entry.used = true;
    entry.usedAt = new Date().toISOString();
    codes[key] = entry;
    writeCodes(codes);

    return { ok:true };
  });
}

/**
 * Adds new unused codes. Existing codes are left untouched.
 * Useful for a small admin/seed script.
 */
function addCodes(newCodes){
  return withLock(() => {
    const codes = readCodes();
    let added = 0;

    for(const raw of newCodes){
      const key = normalize(raw);
      if(!key) continue;
      if(!codes[key]){
        codes[key] = { used:false, usedAt:null };
        added++;
      }
    }

    writeCodes(codes);
    return added;
  });
}

module.exports = { redeemCode, addCodes, CODES_FILE };
