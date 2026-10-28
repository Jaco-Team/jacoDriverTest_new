#!/usr/bin/env python3
"""Test native version selection with private fixtures, without apps or emulators."""

import argparse
import hashlib
import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', choices=('all', 'android', 'ios'), default='all')
    args = parser.parse_args()
    platforms = ('android', 'ios') if args.platform == 'all' else (args.platform,)
    spec = importlib.util.spec_from_file_location(
        'codepush_download_test_helpers', ROOT / 'scripts/test-codepush-download.py')
    download = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(download)
    helpers = download.signature_helpers()
    node = shutil.which('node')
    if not node:
        raise RuntimeError('The project Node.js runtime is required.')
    with tempfile.TemporaryDirectory(prefix='jaco-codepush-versions-') as temporary:
        directory = Path(temporary)
        vectors = directory / 'vectors.tsv'
        print(helpers.run([node, str(ROOT / 'scripts/codepush-download-vectors.cjs'),
                           '--out', str(directory / 'vectors.json'), '--tsv', str(vectors)]),
              end='', flush=True)
        for platform in platforms:
            selected = (download.android_sources() + [download.ANDROID / 'CodePushVersionStore.kt',
                            ROOT / '__tests__/native/CodePushLifecycleAndroidTest.kt',
                            ROOT / '__tests__/native/CodePushDiagnosticsAndroidTest.kt']
                        if platform == 'android' else download.ios_sources() + [
                            download.IOS / 'CodePushVersionStore.swift',
                            download.IOS / 'CodePushStartup.swift'])
            original_harness = ROOT / '__tests__/native' / (
                'CodePushVersionsAndroidTest.kt' if platform == 'android' else 'codepush-versions-ios.swift')
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
            if platform == 'android':
                output = download.run_android(target, copied, harness, vectors, helpers,
                    main_class='com.jacodrivertest.codepush.CodePushVersionsAndroidTest',
                    additional_main_classes=('com.jacodrivertest.codepush.CodePushLifecycleAndroidTest',
                        'com.jacodrivertest.codepush.CodePushDiagnosticsAndroidTest'))
            else:
                output = download.run_ios(target, copied, harness, vectors, helpers)
            print(output, end='', flush=True)
            if any(file.read_bytes() != content for file, content in snapshots.items()):
                raise RuntimeError(f'{platform} sources changed during testing; rerun the checks.')
            fingerprint = hashlib.sha256(b''.join(
                str(file.relative_to(ROOT)).encode() + b'\0' + content + b'\0'
                for file, content in sorted(snapshots.items()))).hexdigest()
            print(f'{platform} versions exact sources SHA-256: {fingerprint}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        sys.stderr.write(f'CodePush versions test: {error}\n')
        sys.exit(1)
