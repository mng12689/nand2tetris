const fs = require('fs');

const memseg = {
  argument: 'ARG',
  local: 'LCL',
  this: 'THIS',
  that: 'THAT',
  temp: '5'
};

let n = 0;

function main() {
  const fPath = process.argv[2];
  const pathCom = fPath.split('/');
  const fname = pathCom[pathCom.length-1].split('.')[0];
  const outpath = fPath.replace('.vm', '.asm');
  const stream = fs.createWriteStream(outpath);
  
  const lineReader = require('readline').createInterface({
    input: fs.createReadStream(fPath)
  });
  
  lineReader.on('line', function (line) {
    const code = line.split('//')[0];
    const stripped = code.replace(/\s+/g, '');
    if ( !stripped.length ) { return; }
    
    const descriptor = parse(code);
    stream.write(toASM(descriptor, fname));
  });
  lineReader.on('close', () => {
    console.log('done!');
  });
}

function parse(raw) {
  const components = raw.split(' ');
  console.log(components);
  return {
    fn: components[0],
    loc: components.length > 1 && components[1],
    val: components.length > 1 && components[2]
  };
}

function toASM(cmd, fname) {

  // set A = calculated address
  // set D = address value
  function addrVal(loc, offset) {
    if ( loc === 'constant' ) {
      return `@${offset}\nD=A`;
    } else if ( loc === 'static' ) {
      return `@${fname}.${offset}\nD=M`;
    } else if ( loc === 'pointer' ) {
      const addr = offset === '1' ? '@THAT' : '@THIS';
      return addr + '\nD=M';
    } else if ( loc === 'temp' ) {
      return  `@${5+parseInt(offset,10)}\nD=M`;
    } else {
      const abbr = memseg[loc];
      if ( !abbr) throw new Error('Invalid location: ', loc);
      
      return [
        `@${abbr}`,
        'D=M',
        `@${offset}`,
        'A=D+A',
        'D=M',
      ].join('\n');
    }
  }
  
  let cmds;
  if ( cmd.fn === 'push' || cmd.fn === 'pop' ) {
    const addr = addrVal(cmd.loc, cmd.val);
    if ( cmd.fn === 'push' ) {
      cmds = [
        addr,
        '@SP',
        'A=M',
        'M=D',
        '@SP',
        'M=M+1'
      ];
    } else if ( cmd.fn === 'pop' ) {
      cmds = [
        addr,
        'D=A',
        '@tmp',
        'M=D',
        '@SP',
        'AM=M-1',
        'D=M',
        '@tmp',
        'A=M',
        'M=D'
      ];
    }
  } else {
    // arithmetic

    //raw operations
    if ( cmd.fn === 'add' ||
         cmd.fn === 'sub' ||
         cmd.fn === 'and' ||
         cmd.fn === 'or' ) {
      
      const op = {
        add: '+',
        sub: '-',
        and: '&',
        or: '|'
      }[cmd.fn];
      cmds = [
        '@SP',
        'AM=M-1',
        'D=M',
        'A=A-1',
        `M=M${op}D`
      ];

      // comparisons
    } else if ( [ 'lt', 'gt', 'eq' ].includes(cmd.fn) ) {

      function toJmpDir(fn) {
        return {
          lt: 'JLT',
          gt: 'JGT',
          eq: 'JEQ'
        }[fn];
      }

      const jmp = toJmpDir(cmd.fn);
      cmds = [
        '@SP',
        'AM=M-1',
        'D=M',
        'A=A-1',
        'D=M-D',
        `@T_${n}`,
        `D;${jmp}`,
        '@SP',
        'A=M-1',
        'M=0',
        `@ENDBRANCH_${n}`,
        '0;JMP',
        `(T_${n})`,
        '@SP',
        'A=M-1',
        'M=-1',
        `(ENDBRANCH_${n})`
      ];
      n++;
    } else {
      // single operand ops
      
      if ( cmd.fn === 'neg' ) {
        cmds = [
          '@SP',
          'A=M-1',
          'D=0',
          'M=D-M'
        ];
      } else if ( cmd.fn === 'not' ) {
        cmds = [
          '@SP',
          'A=M-1',
          'M=!M'
        ];
      }
    }
  }
  
  if ( !cmds ) throw new Error('Invalid fn: ', cmd.fn);
  console.log(cmds.join('\n') + '\n');
  return cmds.join('\n') + '\n';
}

main();
