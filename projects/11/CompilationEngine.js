const Tokenizer = require('./Tokenizer');
const fs = require('fs');
const SymbolTable = require('./SymbolTable');

const Ops = ['+','-','*','/','&','|','<','>','='];

// WARNING: must cp OS files into outpath for VM emulator to work
class CompilationEngine {
  constructor(path) {
    this.tokenizer = new Tokenizer(path);
    const outpath = path.split('.')[0] + '.vm';
    this.stream = fs.createWriteStream(outpath);
    
    this.wn = 0;
    this.ifn = 0;
  }

  async init() {
    await this.tokenizer.init();
    this.tokenizer.advance();
    this.compileClass();
  }

  write(text) {
    this.stream.write(text + '\n');
  }
  
  // should only be used for terminal rules
  eat(val, type, op) {
    let valErr = null;
    let typeErr = null;
    
    const token = this.tokenizer.currentToken();
    if ( val ) {
      if ( Array.isArray(val) ) {
        if ( !val.includes(token.token) ) {
          valErr = new Error(`Expected token is one of ${val}, got ${token.token}`);
        }
      } else {
        if ( token.token !== val ) {
          valErr = new Error(`Expected token ${val}, got ${token.token}`);
        }
      }
    }
    
    if ( type && token.type !== type ) {
      typeErr = new Error(`Expected token of type ${type}, got ${token.type}`);
    }

    // op === 1 means OR we need both errors to constitute an err
    if ( op ) {
      if ( valErr && typeErr ) {
        throw new Error(`Did not get any of ${val}, ${type}`);
      }
    } else {
      if ( valErr ) throw valErr;
      if ( typeErr ) throw typeErr;
    }

    if ( this.tokenizer.hasMoreTokens() ) {
      this.tokenizer.advance();
    }
    return token.token;
  }

  compileClass() {
    this.eat('class');
    const klass = this.compileClassName();
    this.eat('{');

    // NOTE: i believe there is a bug where creating a new SymbolTable sets all counts for variables (field, static, var, arg) to 0, but static should probably maintain a running count throughout the whole program compilation, since there is 1 global static segment. the "static test" (Pong) passes, but that is because there is only 1 static var in the entire program. may need to fix in the future.
    let symTable = new SymbolTable(klass);
    this.compileClassVarDecs(symTable);
    this.compileSubroutineDecs(symTable);
    this.eat('}');
  }
  
  compileClassVarDecs(symTable) {
    console.log('\nCompiling class variable declarations..');
    this._compileVarDecs(['static','field'], symTable);
  }

  compileSubroutineDecs(symTable) {
    console.log('\nCompiling class subroutine declarations..');
    let t = this.tokenizer.currentToken().token;
    while ( t === 'constructor' || t === 'function' || t === 'method' ) {
      this.compileSubroutineDec(symTable);
      t = this.tokenizer.currentToken().token;
    }
  }

  compileSubroutineDec(symTable) {
    symTable.reset();
    const subType = this.eat([ 'constructor', 'function', 'method' ]);
    if ( this.tokenizer.currentToken().token === 'void' ) {
      this.eat('void');
    } else {
      this.compileType();
    }
    
    const name = this.compileSubroutineName();
    console.log(`\nCompiling class subroutine ${name}..`);
    console.log(symTable.getCount('field', true));
    
    this.eat('(');
    this.compileParams(symTable, subType === 'method');
    this.eat(')');
    this.compileSubroutineBody(symTable, name, subType);
  }

  compileParams(symTable, passThis) {
    if ( passThis ) {
      symTable.set({
        name: 'this',
        type: symTable.klass,
        kind: 'arg'
      });
    }
    
    while ( this.tokenizer.currentToken().token !== ')' ) {
      this.compileParam(symTable);
      if ( this.tokenizer.currentToken().token == ',' ) {
        this.eat(',');
      }
    }
  }

  compileParam(symTable) {
    const type = this.compileType();
    const name = this.compileVarName();
    symTable.set({
      name,
      type,
      kind: 'arg'
    });
  }

  compileSubroutineBody(symTable, name, subType) {
    this.eat('{');
    this.compileLocalVarDecs(symTable);

    this.write(`function ${symTable.klass}.${name} ${symTable.getCount('var')}`);
    if ( subType === 'constructor' ) {
      this.write(`push constant ${symTable.getCount('field')}`);
      this.write('call Memory.alloc 1');
      this.write('pop pointer 0');
    } else if ( subType === 'method' ) {
      this.write('push argument 0');
      this.write('pop pointer 0');
    }
    
    this.compileStatements(symTable);
    this.eat('}');
  }

  compileLocalVarDecs(symTable) {
      this._compileVarDecs(['var'], symTable);
    }
  
  compileStatements(symTable) {
    const statements = ['do','while','if','return','let'];
    while ( statements.includes( this.tokenizer.currentToken().token ) ) {
      this.compileStatement(symTable);
    }
  }

  compileStatement(symTable) {
    const t = this.tokenizer.currentToken().token;
    if ( t === 'do' ) {
      this.compileDoStatement(symTable);
    } else if ( t === 'while' ) {
      this.compileWhileStatement(symTable);
    } else if ( t === 'if' ) {
      this.compileIfStatement(symTable);
    } else if ( t === 'return' ) {
      this.compileReturnStatement(symTable);
    } else if ( t === 'let' ) {
      this.compileLetStatement(symTable);
    }
  };

  compileDoStatement(symTable) {
    this.eat('do');
    const id = this.eat(null, 'identifier');
    this.compileSubroutineCall(symTable, id, true);
    this.eat(';');
  }

  compileWhileStatement(symTable) {
    const currN = this.wn;
    this.wn++;
    
    this.eat('while');
    this.eat('(');
    this.write(`label while${currN}`);
    this.compileExpression(symTable);
    this.write('not');
    this.write(`if-goto endw${currN}`);
    this.eat(')');
    this.eat('{');
    this.compileStatements(symTable);
    this.write(`goto while${currN}`);
    this.eat('}');
    this.write(`label endw${currN}`);
    this.wn++;
  }

  compileIfStatement(symTable) {
    const currN = this.ifn;
    this.ifn++;
    
    this.eat('if');
    this.eat('(');
    this.compileExpression(symTable);
    this.write('not');
    this.write(`if-goto notif${currN}`);
    this.eat(')');
    this.eat('{');
    this.compileStatements(symTable);
    this.eat('}');
    this.write(`goto endif${currN}`);
    this.write(`label notif${currN}`);

    if ( this.tokenizer.currentToken().token === 'else' ) {
      this.eat('else');
      this.eat('{');
      this.compileStatements(symTable);
      this.eat('}');
    }
    this.write(`label endif${currN}`);
  }

  compileReturnStatement(symTable) {
    this.eat('return');
    if ( this.tokenizer.currentToken().token !== ';') {
      this.compileExpression(symTable);
    } else {
      // void method
      this.write('push constant 0');
    }
    this.write('return');
    this.eat(';');
  }

  compileLetStatement(symTable) {
    this.eat('let');
    const varName = this.compileVarName();
    const sym = symTable.get(varName);
    const isArr = this.tokenizer.currentToken().token === '[';

    // TODO: this wont work for something like a[i] = b[j]
    if ( isArr  ) {
      this.write(`push ${toSeg(sym.kind)} ${sym.n}`);

      this.eat('[');
      this.compileExpression(symTable);
      this.eat(']');

      this.write('add');
    }
    this.eat('=');
    this.compileExpression(symTable);
    if ( isArr ) {
      this.write('pop temp 0');
      this.write('pop pointer 1');
      this.write('push temp 0');
    }
    this.eat(';');

    if ( isArr ) {
      this.write('pop that 0');
    } else {
      this.write(`pop ${toSeg(sym.kind)} ${sym.n}`);
    }
  }

  compileExpression(symTable) {
    this.compileTerm(symTable);
    const t = this.tokenizer.currentToken().token;
    if ( Ops.includes( t )) {
      this.eat(t);
      this.compileTerm(symTable);
      this.write(toOp(t));
    }
  }

  compileTerm(symTable) {
    const t = this.tokenizer.currentToken();
    if ( t.type === 'keyword' ||
         t.type === 'stringConstant' ||
         t.type === 'integerConstant'
       ) {
      if ( t.type === 'keyword' ) {
        const token = this.eat(['true','false','null','this']);
        this.write(`push ${constMap(token)}`);
      } else {
        this.eat(t.token);
        if ( t.type === 'integerConstant' ) {
          this.write(`push constant ${t.token}`);
        } else {
          // string constant
          this.write(`push constant ${t.token.length}`);
          this.write(`call String.new 1`);
          for ( let i = 0; i < t.token.length; i++ ) {
            this.write(`push constant ${t.token[i].charCodeAt(0)}`);
            this.write('call String.appendChar 2');
          }
        }
      }
    } else if ( t.token === '(' ) {
      this.eat('(');
      this.compileExpression(symTable);
      this.eat(')');
    } else if ( t.token === '-' || t.token === '~' ) {
      this.eat(t.token);
      this.compileTerm(symTable);
      this.write(toUnaryOp(t.token));
    } else {
      // we have an identifier
      const lastToken = t.token;
      this.eat(lastToken);
      
      const newToken = this.tokenizer.currentToken().token;
      if ( newToken === '[') {
        this.eat('[');
        this.compileExpression(symTable);
        this.eat(']');

        const sym = symTable.get(lastToken);
        this.write(`push ${toSeg(sym.kind)} ${sym.n}`);
        this.write('add');
        this.write('pop pointer 1');
        this.write('push that 0');
        
      } else if ( newToken === '(' || newToken === '.' ) {
        this.compileSubroutineCall(symTable, t.token, false);
      } else {
        const sym = symTable.get(lastToken);
        this.write(`push ${toSeg(sym.kind)} ${sym.n}`);
      }
    }
  }

  compileSubroutineCall(symTable, id, isVoid) {
    const t = this.tokenizer.currentToken().token;
    if ( t === '(' ) {
      // we can assume this is a method call on the current obj?
      this.eat('(');
      this.write('push pointer 0');
      const nParams = this.compileExpressionList(symTable);
      this.eat(')');
      this.write(`call ${symTable.klass}.${id} ${nParams+1}`);
    } else if ( t === '.' ) {
      this.eat('.');
      const subname = this.compileSubroutineName();
      this.eat('(');

      const sym = symTable.get(id);
      const isInstance = !!sym;
      if ( isInstance ) {
        // if theres a symbol, we know we are calling an instance method
        this.write(`push ${toSeg(sym.kind)} ${sym.n}`);
      }
      const nParams = this.compileExpressionList(symTable);
      this.eat(')');
      this.write(`call ${(sym && sym.type) || id}.${subname} ${nParams+isInstance}`);
    }
    if ( isVoid ) {
      this.write('pop temp 0');
    }
  }

  compileExpressionList(symTable) {
    let n = 0;
    while ( this.tokenizer.currentToken().token !== ')' ) {
      this.compileExpression(symTable);
      n++;
      if ( this.tokenizer.currentToken().token === ',') {
        this.eat(',');
      }
    }
    return n;
  }
  
  _compileVarDecs(keywords, symTable) {
    let t = this.tokenizer.currentToken().token;
    while ( keywords.includes(t) ) {
      this._compileVarDec(keywords, t, symTable);
      t = this.tokenizer.currentToken().token;
    }
  }

  _compileVarDec(keywords, kw, symTable) {
    this.eat(keywords);
    const type = this.compileType();
    const names = [];
    names.push(this.compileVarName());
    while ( this.tokenizer.currentToken().token === ',') {
      this.eat(',');
      names.push(this.compileVarName());
    }
    this.eat(';');
    
    names.forEach((n) => {
      symTable.set({
        name: n,
        type,
        kind: kw
      });
    });
  }

  compileIdentifier() {
    return this.eat(null, 'identifier');
  }

  compileType() {
    return this.eat(['int','char','boolean'], 'identifier', 1);
  }
  
  compileClassName() { return this.compileIdentifier(); }
  compileSubroutineName() { return this.compileIdentifier(); }
  compileVarName() { return this.compileIdentifier(); }
}

function constMap(t) {
  if ( t === 'null' || t === 'false' ) {
    return 'constant 0';
  } else if ( t === 'true' ) {
    return 'constant 1\nneg';
  } else {
    return 'pointer 0';
  }
}

function toOp(t) {
  if ( t === '+' ) {
    return 'add';
  } else if ( t === '-' ) {
    return 'sub';
  } else if ( t === '*' ) {
    return 'call Math.multiply 2';
  } else if ( t === '/' ) {
    return 'call Math.divide 2';
  } else if ( t === '&' ) {
    return 'and';
  } else if ( t === '|' ) {
    return 'or';
  } else if ( t === '<' ) {
    return 'lt';
  } else if ( t === '>' ) {
    return 'gt';
  } else if ( t === '=' ) {
    return 'eq';
  }
  return null;
}

function toUnaryOp(t) {
  if ( t === '-' ) {
    return 'neg';
  }
  return 'not';
}

function toSeg(kind) {
  if ( kind === 'field' ) {
    return 'this';
  } else if ( kind === 'var' ) {
    return 'local';
  } else if ( kind === 'arg' ) {
    return 'argument';
  }
  return kind;
}

module.exports = CompilationEngine;
