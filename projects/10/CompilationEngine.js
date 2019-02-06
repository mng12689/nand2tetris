const Tokenizer = require('./Tokenizer');
const fs = require('fs');

const Ops = ['+','-','*','/','&','|','<','>','='];

class CompilationEngine {
  constructor(path) {
    this.tokenizer = new Tokenizer(path);
    const outpath = path.split('.')[0] + '-test.xml';
    this.stream = fs.createWriteStream(outpath);
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

    this.write(`<${token.type}> ${this.browserify(token.token)} </${token.type}>`);
    if ( this.tokenizer.hasMoreTokens() ) {
      this.tokenizer.advance();
    }
  }

  
  browserify(token) {
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

  compileClass() {
    this.write('<class>');
    this.eat('class');
    this.compileClassName();
    this.eat('{');
    this.compileClassVarDecs();
    this.compileSubroutineDecs();
    this.eat('}');
    this.write('</class>');
  }
  
  compileClassVarDecs() {
    this._compileVarDecs(['static','field'], 'classVarDec');
  }

  compileSubroutineDecs() {
    let t = this.tokenizer.currentToken().token;
    while ( t === 'constructor' || t === 'function' || t === 'method' ) {
      this.compileSubroutineDec();
      t = this.tokenizer.currentToken().token;
    }
  }

  compileSubroutineDec() {
    this.write('<subroutineDec>');
    this.eat([ 'constructor', 'function', 'method' ]);
    if ( this.tokenizer.currentToken().token === 'void' ) {
      this.eat('void');
    } else {
      this.compileType();
    }
    this.compileSubroutineName();
    this.eat('(');
    this.compileParams();
    this.eat(')');
    this.compileSubroutineBody();
    this.write('</subroutineDec>');
  }

  compileParams() {
    this.write('<parameterList>');
    while ( this.tokenizer.currentToken().token !== ')' ) {
      this.compileParam();
      if ( this.tokenizer.currentToken().token == ',' ) {
        this.eat(',');
      }
    }
    this.write('</parameterList>');
  }

  compileParam() {
    this.compileType();
    this.compileVarName();
  }

  compileSubroutineBody() {
    this.write('<subroutineBody>');
    this.eat('{');
    this.compileLocalVarDecs();
    this.compileStatements();
    this.eat('}');
    this.write('</subroutineBody>');
  }

  compileLocalVarDecs() {
      this._compileVarDecs(['var'], 'varDec');
    }
  
  compileStatements() {
    this.write('<statements>');
    const statements = ['do','while','if','return','let'];
    while ( statements.includes( this.tokenizer.currentToken().token ) ) {
      this.compileStatement();
    }
    this.write('</statements>');
  }

  compileStatement(st) {
    const t = this.tokenizer.currentToken().token;
    if ( t === 'do' ) {
      this.compileDoStatement();
    } else if ( t === 'while' ) {
      this.compileWhileStatement();
    } else if ( t === 'if' ) {
      this.compileIfStatement();
    } else if ( t === 'return' ) {
      this.compileReturnStatement();
    } else if ( t === 'let' ) {
      this.compileLetStatement();
    }
  };

  compileDoStatement() {
    this.write('<doStatement>');
    this.eat('do');
    this.compileSubroutineCall();
    this.eat(';');
    this.write('</doStatement>');
  }

  compileWhileStatement() {
    this.write('<whileStatement>');
    this.eat('while');
    this.eat('(');
    this.compileExpression();
    this.eat(')');
    this.eat('{');
    this.compileStatements();
    this.eat('}');
    this.write('</whileStatement>');
  }

  compileIfStatement() {
    this.write('<ifStatement>');
    this.eat('if');
    this.eat('(');
    this.compileExpression();
    this.eat(')');
    this.eat('{');
    this.compileStatements();
    this.eat('}');
    if ( this.tokenizer.currentToken().token === 'else' ) {
      this.eat('else');
      this.eat('{');
      this.compileStatements();
      this.eat('}');
    }
    this.write('</ifStatement>');
  }

  compileReturnStatement() {
    this.write('<returnStatement>');
    this.eat('return');
    if ( this.tokenizer.currentToken().token !== ';') {
      this.compileExpression();
    }
    this.eat(';');
    this.write('</returnStatement>');
  }

  compileLetStatement() {
    this.write('<letStatement>');
    this.eat('let');
    this.compileVarName();
    if ( this.tokenizer.currentToken().token === '[' ) {
      this.eat('[');
      this.compileExpression();
      this.eat(']');
    }
    this.eat('=');
    this.compileExpression();
    this.eat(';');
    this.write('</letStatement>');
  }

  compileExpression() {
    this.write('<expression>');
    this.compileTerm();
    const t = this.tokenizer.currentToken().token;
    if ( Ops.includes( t )) {
      this.eat(t);
      this.compileTerm();
    }
    this.write('</expression>');
  }

  compileTerm() {
    this.write('<term>');
    const t = this.tokenizer.currentToken();
    if ( t.type === 'keyword' ||
         t.type === 'stringConstant' ||
         t.type === 'integerConstant'
       ) {
      if ( t.type === 'keyword' ) {
        this.eat(['true','false','null','this']);
      } else {
        this.eat(t.token);
      }
    } else if ( t.token === '(' ) {
      this.eat('(');
      this.compileExpression();
      this.eat(')');
    } else if ( t.token === '-' || t.token === '~' ) {
      this.eat(t.token);
      this.compileTerm();
    } else {
      // we have an identifier
      const lastToken = t.token;
      this.eat(lastToken);
      const newToken = this.tokenizer.currentToken().token;
      if ( newToken === '[') {
        this.eat('[');
        this.compileExpression();
        this.eat(']');
      } else if ( newToken === '(' ) {
        this.eat('(');
        this.compileExpressionList();
        this.eat(')');
      } else if ( newToken === '.' ) {
        this.eat('.');
        this.compileSubroutineName();
        this.eat('(');
        this.compileExpressionList();
        this.eat(')');
      }
    }
    this.write('</term>');
  }

  //this isnt used in term compilation, we should figure out a way to encapsulate for use in term
  compileSubroutineCall() {
    this.eat(null, 'identifier');

    const t = this.tokenizer.currentToken().token;
    if ( t === '(' ) {
      this.eat('(');
      this.compileExpressionList();
      this.eat(')');
    } else if ( t === '.' ) {
      this.eat('.');
      this.compileSubroutineName();
      this.eat('(');
      this.compileExpressionList();
      this.eat(')');
    }
  }

  compileExpressionList() {
    this.write('<expressionList>');
    while ( this.tokenizer.currentToken().token !== ')' ) {
      this.compileExpression();
      if ( this.tokenizer.currentToken().token === ',') {
        this.eat(',');
      }
    }
    this.write('</expressionList>');
  }
  
  _compileVarDecs(keywords, tag) {
    let t = this.tokenizer.currentToken().token;
    while ( keywords.includes(t) ) {
      this._compileVarDec(keywords, tag);
      t = this.tokenizer.currentToken().token;
    }
  }

  _compileVarDec(keywords, tag) {
    this.write(`<${tag}>`);
    this.eat(keywords);
    this.compileType();
    this.compileVarName();
    while ( this.tokenizer.currentToken().token === ',') {
      this.eat(',');
      this.compileVarName();
    }
    this.eat(';');
    this.write(`</${tag}>`);
  }

  compileIdentifier() {
    this.eat(null, 'identifier');
  }

  compileType() {
    this.eat(['int','char','boolean'], 'identifier', 1);
  }
  
  compileClassName() { this.compileIdentifier(); }
  compileSubroutineName() { this.compileIdentifier(); }
  compileVarName() { this.compileIdentifier(); }
}

module.exports = CompilationEngine;
