const fs = require('node:fs');
const path = require('node:path');
const {parseEnv} = require('node:util');

function readMapKitApiKey({root = path.resolve(__dirname, '..'), env = process.env} = {}) {
  const envFile = path.join(root, '.env');
  const values = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
  // An explicitly supplied CI/build variable takes precedence over the file.
  const apiKey = (env.YAMAP_API_KEY ?? values.YAMAP_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new Error('Задайте YAMAP_API_KEY в корневом .env или окружении сборки.');
  }
  return apiKey;
}

function writeIosMapKitConfig(env = process.env) {
  if (!env.TARGET_BUILD_DIR || !env.UNLOCALIZED_RESOURCES_FOLDER_PATH) {
    throw new Error('Конфигурация MapKit для iOS создаётся только в build phase Xcode.');
  }
  const apiKey = readMapKitApiKey({env});
  const directory = path.join(env.TARGET_BUILD_DIR, env.UNLOCALIZED_RESOURCES_FOLDER_PATH);
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'MapKitConfig.json'), JSON.stringify({apiKey}));
}

module.exports = {readMapKitApiKey, writeIosMapKitConfig};

if (require.main === module) {
  try {
    writeIosMapKitConfig();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
