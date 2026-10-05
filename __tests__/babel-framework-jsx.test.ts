import {execFileSync} from 'node:child_process';

it('сохраняет React JSX и callback-стили LogBox, а NativeWind использует только вне React Native', () => {
  // Use the development Babel config: Jest intentionally disables NativeWind.
  const result = JSON.parse(execFileSync(process.execPath, ['-e', `
    const babel = require('@babel/core');
    const files = [
      'node_modules/react-native/Libraries/LogBox/UI/LogBoxButton.js',
      'node_modules/react-native/Libraries/LogBox/UI/LogBoxMessage.js',
      'src/features/orders-map/ui/OrderMarker.tsx',
    ];
    process.stdout.write(JSON.stringify(files.map(filename =>
      babel.transformFileSync(filename, {envName: 'development'}).code
    )));
  `], {cwd: process.cwd(), encoding: 'utf8', env: {...process.env, YAMAP_API_KEY: 'test-mapkit-api-key'}})) as string[];

  for (const code of result.slice(0, 2)) {
    expect(code).toContain('require("react/jsx-runtime")');
    expect(code).not.toContain('react-native-css-interop/jsx-runtime');
  }
  expect(result[0]).toMatch(/style:\s*\(\{pressed\}\)\s*=>/);
  expect(result[1]).toContain('cleanContent(content)');
  expect(result[2]).toContain('react-native-css-interop/jsx-runtime');
});
