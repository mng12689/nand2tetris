const fs = require('fs');

class CodeWriter {
  
  constructor(outpath) {
    this.stream = fs.createWriteStream(outpath);
    
    this.setFilename = (name) => {
      this._filename = name;
    };

    this.write = (descriptor) => {
      this.stream.write(toASM(descriptor, this._filename));
    };

    function toASM(cmd, fname) {
  
      let cmds;
      if ( cmd.fn === 'push' ||
           cmd.fn === 'pop' ) {
        
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

    // set A = calculated address
    // set D = address value
    function addrVal (loc, offset) {
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
  }
}
