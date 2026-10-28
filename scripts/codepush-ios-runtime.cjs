const fs = require('node:fs');
const path = require('node:path');
const {inspectIOSReactNative} = require('./check-ios-rn-version.cjs');
const {readCodePushEnvironment} = require('./codepush-env.cjs');
const {
  RuntimeError,
  canonical,
  nativeVersions,
  readTrustedKeys,
  generateDescriptor,
} = require('./codepush-runtime.cjs');

function generateIosRuntime({
  root = path.resolve(__dirname, '..'),
  env = process.env,
} = {}) {
  if (
    !env.TARGET_BUILD_DIR ||
    !env.UNLOCALIZED_RESOURCES_FOLDER_PATH ||
    !['iphoneos', 'iphonesimulator'].includes(env.PLATFORM_NAME)
  )
    throw new RuntimeError('xcode_environment_required');
  const rn = inspectIOSReactNative({root});
  if (rn.issues.length) throw new RuntimeError('native_version_mismatch');
  const versions = nativeVersions(root);
  const lock = fs.readFileSync(path.join(root, 'ios/Podfile.lock'), 'utf8');
  if (!lock.includes(`hermes-engine (${versions.hermesVersion})`))
    throw new RuntimeError('native_version_mismatch');
  const pins = JSON.parse(
    fs.readFileSync(
      path.join(
        root,
        'ios/jacoDriverTest.xcworkspace/xcshareddata/swiftpm/Package.resolved',
      ),
      'utf8',
    ),
  );
  const facts = {
    platform: 'ios',
    applicationIdentifier: env.PRODUCT_BUNDLE_IDENTIFIER,
    nativeBuild: env.CURRENT_PROJECT_VERSION,
    ...versions,
    variant: env.CONFIGURATION,
    architecture: 'new',
    abis: (env.ARCHS ?? '').split(/\s+/).filter(Boolean).sort(),
    sdk: env.SDK_NAME,
    platformName: env.PLATFORM_NAME,
    deploymentTarget: env.IPHONEOS_DEPLOYMENT_TARGET,
    dependencies: lock
      .split('\n')
      .filter(line => /^ {2}- [^ ]+ \(/.test(line))
      .map(line => line.trim())
      .sort(),
    swiftPackages: pins.pins
      .map(pin => ({
        identity: pin.identity,
        revision: pin.state.revision,
        version: pin.state.version ?? null,
      }))
      .sort((a, b) =>
        a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0,
      ),
  };
  if (
    !facts.abis.length ||
    !facts.variant ||
    !facts.sdk ||
    !facts.deploymentTarget
  )
    throw new RuntimeError('xcode_environment_required');
  const settings = readCodePushEnvironment({root, env});
  const trustedKeys = readTrustedKeys(settings.CODEPUSH_TRUSTED_KEYS, root);
  const result = generateDescriptor({root, facts, trustedKeys});
  const directory = path.join(
    env.TARGET_BUILD_DIR,
    env.UNLOCALIZED_RESOURCES_FOLDER_PATH,
  );
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(
    path.join(directory, 'codepush-runtime.json'),
    canonical(result.descriptor) + '\n',
  );
  return result;
}
module.exports = {generateIosRuntime};
if (require.main === module) {
  try {
    const result = generateIosRuntime();
    console.log(
      `CodePush runtime: ios, ${result.fileCount} native inputs, ${Object.keys(result.descriptor.trustedKeys).length} trusted keys.`,
    );
  } catch (error) {
    console.error(
      `CodePush runtime: ${error instanceof RuntimeError ? error.code : 'runtime_invalid'}`,
    );
    process.exitCode = 1;
  }
}
