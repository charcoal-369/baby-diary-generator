// add-codes.js
//
// Small CLI helper to add single-use access codes to codes.json.
// Run this locally or via `railway run` against your deployed environment.
//
// Usage:
//   node add-codes.js CODE1 CODE2 CODE3
//   node add-codes.js --random 10        Generates 10 random codes
//
// Codes are stored uppercase/trimmed. Existing codes are left untouched
// (so re-running this with the same code is safe and won't reset its
// "used" status).

const crypto = require('crypto');
const { addCodes } = require('./codes');

function randomCode(){
  // Format: XXXX-XXXX, easy to read/type, ~1.6 million combos per block
  const part = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${part()}-${part()}`;
}

async function main(){
  const args = process.argv.slice(2);
  let codesToAdd = [];

  if(args[0] === '--random'){
    const count = parseInt(args[1], 10) || 1;
    for(let i = 0; i < count; i++){
      codesToAdd.push(randomCode());
    }
  }else if(args.length > 0){
    codesToAdd = args;
  }else{
    console.log('Usage:');
    console.log('  node add-codes.js CODE1 CODE2 CODE3');
    console.log('  node add-codes.js --random 10');
    process.exit(1);
  }

  const added = await addCodes(codesToAdd);

  console.log(`Added ${added} new code(s):`);
  codesToAdd.forEach(c => console.log('  ' + c.trim().toUpperCase()));
}

main().catch(err => {
  console.error('Failed to add codes:', err);
  process.exit(1);
});
