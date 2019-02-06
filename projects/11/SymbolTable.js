class SymbolTable {

  constructor(klass) {
    this.klass = klass;
    this.tail = { symbols: {}, next: null };
    this.counts = {
      field: 0,
      static: 0,
      var: 0,
      arg: 0
    };
    
    this.set = (symbol) => {
      let n = this.counts[symbol.kind];
      symbol.n = n;
      this.counts[symbol.kind] = n+1;

      if ( symbol.kind === 'field' || symbol.kind === 'static' ) {
        this.tail.symbols[symbol.name] = symbol;
      } else {
        this.head.symbols[symbol.name] = symbol;
      }

      console.log(`SET symbol ${symbol.name}, ${symbol.kind}, ${this.counts[symbol.kind]}`);
      console.log(`GET COUNT for kind: ${symbol.kind}, ${this.getCount(symbol.kind)}`);
    };

    this.get = (symbolName) => {
      let curr = this.head;
      while ( curr ) {
        if ( curr.symbols[symbolName] ) break;
        curr = curr.next;
      }
      if ( !curr || !curr.symbols[symbolName] ) {
        console.warn('Symbol not found: ', symbolName);
        return null;
      }
      return curr.symbols[symbolName];
    };

    this.getCount = (kind, l) => {
      if ( l ) {
        console.log(this.counts);
      }
      return this.counts[kind];
    };
    
    this.reset = () => {
      this.head = { symbols: {}, next: this.tail };
      this.counts = Object.assign(this.counts, {
        arg: 0,
        var: 0
      });
    };

    this.reset.call(this);
  }
}

module.exports = SymbolTable;
