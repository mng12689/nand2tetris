const Symbols = [ '(',')','{','}','[',']','.',',',';','+','-','*','/','&','|','<','>','=','~'];

const Keywords = [
  'class', 'constructor', 'function', 'method', 'field',
  'static', 'var', 'int', 'char', 'boolean', 'void', 'true',
  'false', 'null', 'this', 'let', 'do', 'if', 'else', 'while',
  'return'
];

const Types = {
  SYMBOL: 'symbol',
  STR: 'stringConstant',
  INT: 'integerConstant',
  KEYWORD: 'keyword',
  IDENTIFIER: 'identifier'
};

const fs = require('fs');
const reader = require('readline');

class Tokenizer {
  
  constructor(path) {
    this.raw = [];
    this._currentToken = null;
    this.path = path;
  }

  async init() {
    const _this = this;
    return new Promise((res, rej) => {
      
      const lineReader = reader.createInterface({
        input: fs.createReadStream(_this.path)
      });

      let inBlock = false;
      lineReader.on('line', function (line) {
        if ( !inBlock && line.includes('/**') ) {
          inBlock = true;
        }

        if ( inBlock ) {
          const idx = line.indexOf('*/');
          if ( idx !== -1 ) {
            line = line.slice(idx+2);
            inBlock = false;
          } else {
            return;
          }
        }
        
        const code = line.split('//')[0].replace(/ +(?= )/g,'').trim();
        if ( !code.length ) { return; }
        
        _this.raw = _this.raw.concat(code.split(' '));
      });
      
      lineReader.on('close', () => {
        console.log(`Ready for tokenizing ${_this.path}`);
        res();
      });
      
      lineReader.on('error', (err) => {
        console.error('Fuckis', err);
        rej(err);
      });
    });
  }               

  advance() {
    let str = this.raw.shift();
    let token = str.charAt(0);

    if ( Symbols.includes(token) ) {
      if ( str.length > 1 ) {
        this.raw.unshift( str.slice(1) );
      }
      this._currentToken = { type: Types.SYMBOL, token };
    }

    else if ( token === '"' ) {
      str = str.slice(1);
      let idx = str.indexOf('"');
      while ( idx === -1 ) {
        str += ' ' + this.raw.shift();
        idx = str.indexOf('"');
      }
      this._currentToken = { type: Types.STR, token: str.slice(0,idx) };
      if ( idx+1 < str.length ) {
        this.raw.unshift( str.slice(idx+1) );
      }
    }
    
    else if ( token.match("\\d+") ) {
      const integer = str.match("\\d+")[0];
      this._currentToken = { type: Types.INT, token: integer };
      if ( integer.length < str.length ) {
        this.raw.unshift( str.slice(integer.length) );
      }
    } else {

      if ( !token.match("^[a-zA-Z_]*$") ) {
        throw new Error('Invalid keyword/identifier');
      }
      
      for (var i = 1; i < str.length; i++) {
        const c = str.charAt(i);
        if ( !c.match("^[a-zA-Z0-9_]*$") ) {
          this.raw.unshift( str.slice(token.length) );
          break;
        }
        token += c;
      };
      
      if ( Keywords.includes(token) ) {
        this._currentToken = { type: Types.KEYWORD, token };
      } else {
        this._currentToken = { type: Types.IDENTIFIER, token };
      }
    }
  }

  hasMoreTokens() {
    return this.raw.length > 0;
  }

  currentToken() {
    return this._currentToken;
  }
}

module.exports = Tokenizer;
