const Tokenizer = require('./Tokenizer');
const fs = require('fs');

const path = process.argv[2];
const tokenizer = new Tokenizer(path);

async function main() {

  await tokenizer.init();
  const outpath = path.split('.')[0] + 'T-test.xml';
  const stream = fs.createWriteStream(outpath);
  stream.write('<tokens>\n');
  
  while ( tokenizer.hasMoreTokens() ) {
    tokenizer.advance();

    const token = tokenizer.currentToken();
    console.log(`<${token.type}> ${token.token} </${token.type}>`);
    stream.write(`<${token.type}> ${browserify(token.token)} </${token.type}>\n`);
  }
  
  stream.write('</tokens>');
}

main();

function browserify(token) {
  if ( token === '<' ) {
    return '&lt;';
  } else if ( token === '>' ) {
    return '&gt;';
  } else if ( token === '"' ) {
    return '&quot;';
  } else if ( token === '&' ) {
    return '&amp;';
  }
  return token;
}
