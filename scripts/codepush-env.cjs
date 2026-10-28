const fs = require('node:fs');
const path = require('node:path');
const {parseEnv} = require('node:util');

const VARIABLES = [
  'CODEPUSH_TRUSTED_KEYS',
  'CODEPUSH_PRIVATE_KEY_FILE',
  'CODEPUSH_PUBLIC_KEY_FILE',
  'CODEPUSH_KEY_ID',
];

class EnvironmentError extends Error {
  constructor() {
    super('environment_invalid');
    this.code = 'environment_invalid';
  }
}

function readCodePushEnvironment({
  root = path.resolve(__dirname, '..'),
  env = process.env,
} = {}) {
  try {
    const file = path.join(root, '.env');
    let values = {};
    let descriptor;
    try {
      descriptor = fs.openSync(file, fs.constants.O_RDONLY);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (descriptor !== undefined) {
      try {
        if (!fs.fstatSync(descriptor).isFile()) throw new EnvironmentError();
        const text = new TextDecoder('utf-8', {fatal: true}).decode(
          fs.readFileSync(descriptor),
        );
        if (text.includes('\0')) throw new EnvironmentError();
        values = parseEnv(text);
      } finally {
        fs.closeSync(descriptor);
      }
    }

    return Object.fromEntries(
      VARIABLES.map(name => {
        const supplied = env[name];
        if (supplied !== undefined && typeof supplied !== 'string')
          throw new EnvironmentError();
        // Gradle may explicitly pass an empty value; it must still allow .env.
        const value = supplied?.trim() || values[name]?.trim() || undefined;
        return [name, value];
      }),
    );
  } catch {
    // Filesystem/parser errors may include paths or values from the local file.
    throw new EnvironmentError();
  }
}

module.exports = {readCodePushEnvironment, EnvironmentError};
