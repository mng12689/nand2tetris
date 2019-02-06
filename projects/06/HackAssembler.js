const fs = require('fs');

const cmdTable = {
  ['0']: '0101010',
  ['1']: '0111111',
  ['-1']: '0111010',
  ['D']: '0001100',
  ['A']: '0110000',
  ['M']: '1110000',
  ['!D']: '0001101',
  ['!A']: '0110001',
  ['!M']: '1110001',
  ['-D']: '0001111',
  ['-A']: '0110011',
  ['-M']: '1110011',
  ['D+1']: '0011111',
  ['A+1']: '0110111',
  ['M+1']: '1110111',
  ['D-1']: '0001110',
  ['A-1']: '0110010',
  ['M-1']: '1110010',
  ['D+A']: '0000010',
  ['D+M']: '1000010',
  ['D-A']: '0010011',
  ['D-M']: '1010011',
  ['A-D']: '0000111',
  ['M-D']: '1000111',
  ['D&A']: '0000000',
  ['D&M']: '1000000',
  ['D|A']: '0010101',
  ['D|M']: '1010101'
};

const destTable = {
  ['null']: '000',
  ['M']: '001',
  ['D']: '010',
  ['MD']: '011',
  ['A']: '100',
  ['AM']: '101',
  ['AD']: '110',
  ['AMD']: '111'
};

const jmpTable = {
  ['null']: '000',
  ['JGT']: '001',
  ['JEQ']: '010',
  ['JGE']: '011',
  ['JLT']: '100',
  ['JNE']: '101',
  ['JLE']: '110',
  ['JMP']: '111'
};

const sym = {
  ['R0']: '0',
  ['R1']: '1',
  ['R2']: '2',
  ['R3']: '3',
  ['R4']: '4',
  ['R5']: '5',
  ['R6']: '6',
  ['R7']: '7',
  ['R8']: '8',
  ['R9']: '9',
  ['R10']: '10',
  ['R11']: '11',
  ['R12']: '12',
  ['R13']: '13',
  ['R14']: '14',
  ['R15']: '15',
  ['SCREEN']: '16384',
  ['KBD']: '24576',
  ['SP']: '0',
  ['LCL']: '1',
  ['ARG']: '2',
  ['THIS']: '3',
  ['THAT']: '4'
};

function main() {
  const fPath = process.argv[2];
  symbolizeLabels(fPath);
}

function parse(line) {
  const isA = line.charAt(0) === '@';
  if ( isA ) {
    return {
      type: 'A',
      addr: line.slice(1)
    };
  }

  const sp1 = line.split('=');
  let rest = sp1[0];
  let dest = null;
  if ( sp1.length > 2 ) {
    throw Error('Parse error: multiple equal signs');
  } else if ( sp1.length === 2 ) {
    dest = sp1[0];
    rest = sp1[1];
  }

  const sp2 = rest.split(';');
  let cmd = sp2[0];
  let jmp = null;
  if ( sp2.length === 2 ) {
    jmp = sp2[1];
  }
  
  return {
    type: 'C',
    dest: dest,
    cmd,
    jmp
  };
}

function transform(cmd) {
  function command(cmd) {
    const bin = cmdTable[cmd.cmd];
    if ( !bin ) { throw Error('cmd not found in cmd table'); }
    return bin;
  }

  function dest(cmd) {
    let dest = cmd.dest;
    if (!cmd.dest) {
      dest = 'null';
    }
    const bin =  destTable[dest];
    if ( !bin ) { throw Error('dest not found in dest table'); }
    return bin;
  }

  function jmp(cmd) {
    let jmp = cmd.jmp;
    if (!cmd.jmp) {
      jmp = 'null';
    }
    const bin = jmpTable[jmp];
    if ( !bin ) { throw Error('jmp not found in jmp table'); }
    return bin;
  }
  
  let bin = '';
  if ( cmd.type === 'A' ) {
    const addrBin = parseInt(cmd.addr,10).toString(2);
    const n = 15-addrBin.length;
    const filler = n ? Array(n).fill('0').join('') : '';
    const addr = filler + addrBin;
    bin += '0' + addr;
  } else {
    bin += '111' + command(cmd) + dest(cmd) + jmp(cmd);
  }
  console.log('binary: ',bin);
  if ( bin.length !== 16 ) {
    throw Error('wrong length binary instr:', bin.length);
  }
  
  return bin;
}

function symbolizeLabels(fPath) {
  const lineReader = require('readline').createInterface({
    input: fs.createReadStream(fPath)
  });
  
  let n = 0;
  
  lineReader.on('line', function (line) {
    const code = line.split('//')[0];
    const stripped = code.replace(/\s+/g, '');
    if ( !stripped.length ) {
      return;
    }

    if ( stripped.startsWith('(') && stripped.endsWith(')') ) {
      const label = stripped.slice(1,stripped.length-1);
      sym[label] = n;
      return;
    }
    n++;
  });
  lineReader.on('close', assemble.bind(null, fPath));
}

function assemble(fPath) {
  const p = fPath.split('.');
  if ( p[p.length-1] !== 'asm' ) {
    throw Error('Can only assember .asm files');
  }
  const outpathArr = p.slice();
  outpathArr[p.length-1] = 'hack';
  const outpath = outpathArr.join('.');
  const stream = fs.createWriteStream(outpath);
  
  const lineReader = require('readline').createInterface({
    input: fs.createReadStream(fPath)
  });

  let n = 16;
  
  lineReader.on('line', function (line) {
    const code = line.split('//')[0];
    const stripped = code.replace(/\s+/g, '');
    if ( !stripped.length || stripped.startsWith('(') ) {
      return;
    }
    
    let transformed = stripped;
    console.log(transformed);
    if ( stripped.charAt(0) === '@' ) {
      const addr = stripped.slice(1);
      if ( !/^\d+$/.test(addr) ) {
        const rawAddr = sym[addr];
        if ( !rawAddr ) {
          const nStr = n + '';
          sym[addr] = nStr;
          n++;
        }
        transformed = '@' + sym[addr];
      }
    }

    console.log(transformed);
    const command = parse(transformed);
    const binary = transform(command);
    stream.write(binary + '\n');
  });
}

main();
