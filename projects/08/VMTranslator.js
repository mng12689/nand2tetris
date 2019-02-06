const fs = require('fs');
const reader = require('readline');

const memseg = {
  argument: 'ARG',
  local: 'LCL',
  this: 'THIS',
  that: 'THAT',
  temp: '5'
};

const types = {
  PUSH: 'PUSH',
  POP: 'POP',
  LABEL: 'LABEL',
  BRANCH: 'BRANCH',
  CALL: 'CALL',
  FN: 'FN',
  RETURN: 'RETURN',
  ARITHMETIC: 'ARITHMETIC'
};

const frameOrder = ['LCL','ARG','THIS','THAT'];

let n = 0;
let retN = 0;

async function main() {
  const path = process.argv[2];
  const pathDesc = fs.lstatSync(path);
  let files = [ path ];
  if ( pathDesc.isDirectory() ) {
    files = fs.readdirSync(path).filter((f) => {
      return f.endsWith('.vm');
    }).map((f) => {
      return path + '/' + f;
    });
  }

  let outpath = path.replace('.vm', '.asm');
  if ( pathDesc.isDirectory() ) {
    const pathComp = path.split('/').filter((x) => x.length > 0);
    const dirName = pathComp[pathComp.length-1];
    pathComp.push(dirName + '.asm');
    outpath = pathComp.join('/');
  }
  
  const stream = fs.createWriteStream(outpath);
  
  bootstrap(stream);
  files.forEach(async (f) => {
    console.log('processing file: ',f);
    await processFile(f, stream);
  });
}

function bootstrap(stream) {
  const cmds = [
    '@256',  // for some reason, the test scripts expect it to finish on 261. change to @261 to pass tests
    'D=A',
    '@SP',
    'M=D',
    '@Sys.init',
    '0;JMP'
  ];
  stream.write(cmds.join('\n')+'\n');

  //const line = 'call Sys.init 0';
  //const descriptor = parse(line);
  //stream.write(toASM(descriptor, 'Bootstrap'));
}

async function processFile(fPath, stream) {
  return new Promise((res, rej) => {
    
    const pathCom = fPath.split('/');
    const fname = pathCom[pathCom.length-1].split('.')[0];
    
    const lineReader = reader.createInterface({
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
      console.log(`Done processing ${fPath}`);
      res();
    });

    lineReader.on('error', () => {
      console.error('Error');
      rej();
    });
  });
}
                     
function parse(raw) {
  function toType(op) {  
    if ( op === 'push' ) {
      return types.PUSH;
    } else if ( op === 'pop' ) {
      return types.POP;
    } else if ( op === 'label' ) {
      return types.LABEL;
    } else if ( op === 'if-goto' || op === 'goto' ) {
      return types.BRANCH;
    } else if ( op === 'call' ) {
      return types.CALL;
    } else if ( op === 'function' ) {
      return types.FN;
    } else if ( op === 'return' ) {
      return types.RETURN;
    } else {
      return types.ARITHMETIC;
    }
  }
  
  const components = raw.split(' ');
  console.log(components);
  const op = components[0];
  const type = toType(op);
  const loc = ( type === types.PUSH || type === types.POP) && components[1];
  const val = ( type === types.PUSH || type === types.POP) && components[2];
  const label = ( type === types.LABEL || type === types.BRANCH) && components[1];
  const fname = ( type === types.CALL || type === types.FN ) && components[1];
  const nArgs = type === types.CALL && components[2];
  const nLocals = type === types.FN && components[2];
  return {
    type,
    fn: op,
    loc,
    val,
    label,
    fname,
    nArgs,
    nLocals
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
  if ( cmd.type === types.PUSH ) {
    const addr = addrVal(cmd.loc, cmd.val);
    cmds = [
      addr,
      '@SP',
      'A=M',
      'M=D',
      '@SP',
      'M=M+1'
    ];
  } else if ( cmd.type === types.POP ) {
    // new
//    let val = cmd.val;
//    if ( cmd.loc === 'argument' && parseInt(cmd.val,10) === 0 ) {
//     val = 1;
//    }
    const addr = addrVal(cmd.loc, cmd.val);
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
  } else if ( cmd.type === types.LABEL ) {
    cmds = [
      `(${cmd.label})`
    ];
  } else if ( cmd.type === types.BRANCH ) {
    if ( cmd.fn === 'if-goto' ) {
      cmds = [
        '@SP',
        'A=M-1',
        'D=M',
        '@SP',
        'M=M-1',
        `@${cmd.label}`,
        '!D;JEQ'
      ];
    } else {
      // goto
      cmds = [
        `@${cmd.label}`,
        '0;JMP'
      ];
    }
  } else if ( cmd.type === types.CALL ) {
    
    cmds = [];

    // if no args, make space for return val
    if ( parseInt(cmd.nArgs,10) === 0 ) {
      cmds = cmds.concat([
        '@SP',
        'A=M',
        'M=0',
        '@SP',
        'M=M+1'
      ]);
    }

    // set return address on stack
    const retAddr = `${cmd.fname}$ret.${retN}`;
    console.log(`CALL: ${retAddr}`),
    cmds = cmds.concat([
      `@${retAddr}`,
      'D=A',
      '@SP',
      'A=M',
      'M=D',
      '@SP',
      'M=M+1'
    ]);

    // set frame pointers on stack
    for ( let i = 0; i < frameOrder.length; i++ ) {
      cmds = cmds.concat([
        `@${frameOrder[i]}`,
        'D=M',
        '@SP',
        'A=M',
        'M=D',
        '@SP',
        'M=M+1',
      ]);
    }
    cmds = cmds.concat([
      //set ARG pointer
      `@${Math.max(parseInt(cmd.nArgs,10),1)}`,
      'D=A',
      '@SP',
      'D=M-D',
      '@5',
      'D=D-A',
      '@ARG',
      'M=D',
      // set LCL pointer
      '@SP',
      'D=M',
      '@LCL',
      'M=D',
      // goto called fn
      `#goto ${cmd.fname}`,
      // insert label for return addr
      `(${retAddr})`
    ]);
    retN++;
  } else if ( cmd.type === types.FN ) {
    // new
    cmds = [
      `(${cmd.fname})`,
      `@${cmd.nLocals}`,
      'D=A',
      '@SP',
      'M=D+M'
    ].concat(
      new Array(parseInt(cmd.nLocals,10)).fill('#push constant 0'),
      new Array(parseInt(cmd.nLocals,10)).fill(0).map((_, i) => `#pop local ${i}`)
    );
  } else if ( cmd.type === types.RETURN ) {
    cmds = [
      '#pop argument 0',
      '@LCL',
      'D=M',
      '@cur_lcl',
      'M=D',
      '@ARG',
      'D=M+1',
      '@SP',
      'M=D',
    ];
    const frameReverseOrder = frameOrder.slice().reverse();
    for ( let i = 1; i < 5; i++ ) {
      cmds = cmds.concat([
        `@${i}`,
        'D=A',
        '@cur_lcl',
        'A=M-D',
        'D=M',
        `@${frameReverseOrder[i-1]}`,
        'M=D'
      ]);
    }
    cmds = cmds.concat([
      '@5',
      'D=A',
      '@cur_lcl',
      'A=M-D',
      'A=M',
      '0;JMP'
    ]);
  } else if ( cmd.type === types.ARITHMETIC ) {
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
    }  else {
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
  let expanded = [];
  for ( let i = 0; i < cmds.length; i++ ) {
    if ( cmds[i].startsWith('#') ) {
      const descriptor = parse(cmds[i].slice(1));
      expanded = expanded.concat(toASM(descriptor, fname));
    } else {
      expanded.push(cmds[i]);
    }
  }
  
  console.log(expanded.join('\n') + '\n');
  return expanded.join('\n') + '\n';
}

main();
