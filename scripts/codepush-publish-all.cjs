const path = require('node:path');
const {parseArguments, publishPrepared} = require('./codepush-publish.cjs');
const {PreparedError, readPrepared, requireCondition} = require('./codepush-prepared.cjs');

const PLATFORMS = ['android', 'ios'];
const RELEASE_FIELDS = [
  'releaseId', 'version', 'manifestSequence', 'issuedAt', 'expiresAt',
  'enabled', 'rolloutBasisPoints', 'rolloutSeed',
];

class PublishAllError extends Error {
  constructor(code, platform, completed) {
    super(code);
    this.code = code;
    this.platform = platform;
    this.completed = completed;
  }
}

/** Validate the complete pair before any network access; publish reviewed bytes as-is. */
async function publishAll(options) {
  const directories = PLATFORMS.map(platform => path.resolve(options.prepared, platform));
  const items = directories.map(directory => readPrepared(directory, {fresh: true}));
  for (let index = 0; index < items.length; index++) {
    requireCondition(items[index].payload.platform === PLATFORMS[index], 'platform_mismatch');
    requireCondition(RELEASE_FIELDS.every(field =>
      items[index].payload[field] === items[0].payload[field]), 'release_mismatch');
  }

  const completed = [];
  for (let index = 0; index < directories.length; index++) {
    try {
      completed.push(await publishPrepared({...options, prepared: directories[index]}));
    } catch (error) {
      throw new PublishAllError(error instanceof PreparedError ? error.code : 'publication_failed',
        PLATFORMS[index], completed);
    }
  }
  return {status: options.execute ? 'published' : 'prepared',
    version: items[0].payload.version, platforms: completed};
}

module.exports = {publishAll};

if (require.main === module) {
  Promise.resolve().then(() => publishAll(parseArguments(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      const code = error instanceof PreparedError || error instanceof PublishAllError
        ? error.code : 'publication_failed';
      console.error(`CodePush publication: ${code}`);
      if (error instanceof PublishAllError) {
        console.error(JSON.stringify({failedPlatform: error.platform, completed: error.completed}));
        if (error.completed.length > 0)
          console.error('Часть платформ уже обработана. После устранения ошибки повторите ту же команду.');
      }
      process.exitCode = 1;
    });
}
