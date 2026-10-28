#!/usr/bin/env python3
"""Compile and test the production native downloader without apps or emulators."""

import argparse
import hashlib
import importlib.util
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT / 'android/app/src/main/java/com/jacodrivertest/codepush'
IOS = ROOT / 'ios/jacoDriverTest'


def signature_helpers():
    spec = importlib.util.spec_from_file_location(
        'codepush_native_test_helpers', ROOT / 'scripts/test-codepush-native.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def android_sources():
    return sorted(set([
        ANDROID / 'CodePushManifestVerifier.kt',
        ANDROID / 'CodePushJson.kt',
        ANDROID / 'CodePushManifestValidator.kt',
        *ANDROID.glob('CodePushDownload*.kt'),
    ]))


def ios_sources():
    return [IOS / name for name in (
        'CodePushManifestVerifier.swift', 'CodePushNativeEnvironment.swift',
        'CodePushManifestValidator.swift', 'CodePushDownloadManager.swift',
        'CodePushURLSessionTransport.swift',
    )]


def java_command():
    candidates = []
    if os.environ.get('JAVA_HOME'):
        candidates.append(Path(os.environ['JAVA_HOME']) / 'bin/java')
    candidates.append(Path('/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java'))
    java = next((str(file) for file in candidates if file.is_file()), shutil.which('java'))
    if not java:
        raise RuntimeError('Java 17+ is required.')
    result = subprocess.run([java, '-version'], capture_output=True, text=True, timeout=15)
    version = re.search(r'version "(\d+)', result.stderr + result.stdout)
    if result.returncode or not version or int(version.group(1)) < 17:
        raise RuntimeError('Java 17+ is required.')
    return java


def run_android(directory, sources, harness, vectors, helpers,
                main_class='com.jacodrivertest.codepush.CodePushDownloadAndroidTest',
                additional_main_classes=()):
    version = re.search(r'kotlinVersion\s*=\s*"([^"]+)"',
                        (ROOT / 'android/build.gradle').read_text()).group(1)
    cache = Path(os.environ.get('GRADLE_USER_HOME', Path.home() / '.gradle')) / 'caches/modules-2/files-2.1'
    jar = helpers.cached_jar
    stdlib = jar(cache, 'org.jetbrains.kotlin', 'kotlin-stdlib', version)
    compiler = [jar(cache, 'org.jetbrains.kotlin', name, version) for name in (
        'kotlin-compiler-embeddable', 'kotlin-stdlib', 'kotlin-script-runtime', 'kotlin-daemon-embeddable',
    )] + [jar(cache, 'org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'),
          jar(cache, 'org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0'),
          jar(cache, 'org.jetbrains', 'annotations')]
    java = java_command()
    classes = directory / 'classes'
    helpers.run([java, '-cp', os.pathsep.join(map(str, compiler)),
                 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect',
                 '-jvm-target', '17', '-classpath', str(stdlib), '-d', str(classes),
                 *map(str, sources), str(harness)], timeout=300)
    return ''.join(helpers.run([
        java, '-cp', os.pathsep.join((str(classes), str(stdlib))), selected_main,
        str(vectors), str(directory / 'storage')], timeout=300)
        for selected_main in (main_class, *additional_main_classes))


def run_ios(directory, sources, harness, vectors, helpers):
    swift = shutil.which('swiftc')
    if not swift:
        raise RuntimeError('The installed macOS Swift compiler is required.')
    binary = directory / 'native-download-test'
    helpers.run([swift, '-swift-version', '5', '-module-cache-path', str(directory / 'module-cache'),
                 '-framework', 'Foundation', '-framework', 'Security',
                 *map(str, sources), str(harness), '-o', str(binary)], timeout=300)
    return helpers.run([str(binary), str(vectors), str(directory / 'storage')], timeout=300)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', choices=('all', 'android', 'ios'), default='all')
    args = parser.parse_args()
    platforms = ('android', 'ios') if args.platform == 'all' else (args.platform,)
    helpers = signature_helpers()
    node = shutil.which('node')
    if not node:
        raise RuntimeError('The project Node.js runtime is required.')
    with tempfile.TemporaryDirectory(prefix='jaco-codepush-download-') as temporary:
        directory = Path(temporary)
        vectors = directory / 'vectors.tsv'
        print(helpers.run([node, str(ROOT / 'scripts/codepush-download-vectors.cjs'),
                           '--out', str(directory / 'vectors.json'), '--tsv', str(vectors)]),
              end='', flush=True)
        for platform in platforms:
            selected = android_sources() if platform == 'android' else ios_sources()
            original_harness = ROOT / '__tests__/native' / (
                'CodePushDownloadAndroidTest.kt' if platform == 'android' else 'codepush-download-ios.swift')
            snapshots = {file: file.read_bytes() for file in [*selected, original_harness]}
            target = directory / platform
            target.mkdir()
            copied = []
            for source in selected:
                destination = target / source.name
                destination.write_bytes(snapshots[source])
                copied.append(destination)
            harness = target / (original_harness.name if platform == 'android' else 'main.swift')
            harness.write_bytes(snapshots[original_harness])
            print((run_android if platform == 'android' else run_ios)(
                target, copied, harness, vectors, helpers), end='', flush=True)
            if any(file.read_bytes() != content for file, content in snapshots.items()):
                raise RuntimeError(f'{platform} sources changed during testing; rerun the checks.')
            fingerprint = hashlib.sha256(b''.join(
                str(file.relative_to(ROOT)).encode() + b'\0' + content + b'\0'
                for file, content in sorted(snapshots.items()))).hexdigest()
            print(f'{platform} downloader exact sources SHA-256: {fingerprint}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        sys.stderr.write(f'CodePush downloader test: {error}\n')
        sys.exit(1)
