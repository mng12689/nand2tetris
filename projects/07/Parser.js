class Parser {
  parse = (raw) => {
    const components = raw.split(' ');
    console.log(components);
    return {
      fn: components[0],
      loc: components.length > 1 && components[1],
      val: components.length > 1 && components[2]
    };
  };
}

module.exports = Parser;
