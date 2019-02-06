const CompilationEngine = require('./CompilationEngine');
const fs = require('fs');

const path = process.argv[2];
const compiler = new CompilationEngine(path);

async function main() {
  await compiler.init();
}

main();
