const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Build tools use the application's validators without registering a global TS hook
// or maintaining a second copy of the protocol. Only these local modules can load.
const cache = new Map();
function load(name) {
  if (!['types', 'json', 'validation'].includes(name)) {
    throw new Error('Unsupported CodePush contract module');
  }
  if (cache.has(name)) return cache.get(name);
  const file = path.resolve(__dirname, '../src/codePush', `${name}.ts`);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  cache.set(name, exports);
  const localRequire = specifier => {
    if (!['./types', './json'].includes(specifier)) {
      throw new Error('Unsupported CodePush contract dependency');
    }
    return load(specifier.slice(2));
  };
  new Function('exports', 'require', compiled.outputText)(
    exports,
    localRequire,
  );
  return exports;
}

module.exports = {...load('types'), ...load('json'), ...load('validation')};
