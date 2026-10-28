#!/usr/bin/env python3
"""Compile and execute the exact native signature verifiers against shared vectors.

Node creates ephemeral in-memory test keys. Only temporary public vectors are
written. Kotlin uses the already cached project compiler; Swift uses macOS
Foundation/Security. No Android/iOS app, emulator, Gradle build or network runs.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'android': ROOT / 'android/app/src/main/java/com/jacodrivertest/codepush/CodePushManifestVerifier.kt',
    'ios': ROOT / 'ios/jacoDriverTest/CodePushManifestVerifier.swift',
}

KOTLIN_MAIN = r'''
import com.jacodrivertest.codepush.CodePushManifestVerifier
import java.io.File
import java.util.Base64
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    val decoder = Base64.getDecoder()
    var checked = 0
    var failed = 0
    File(args.single()).forEachLine { line ->
        val fields = line.split('\t')
        val name = String(decoder.decode(fields[0]), Charsets.UTF_8)
        val envelope = decoder.decode(fields[1])
        val expected = fields[2].takeUnless { it == "-" }?.let { decoder.decode(it) }
        val errors = fields[3].split(',').filter { it.isNotEmpty() }
        val keys = if (fields[4] == "-") emptyMap() else fields[4].split(',').associate { entry ->
            val separator = entry.indexOf(':')
            entry.substring(0, separator) to String(decoder.decode(entry.substring(separator + 1)), Charsets.UTF_8)
        }
        val result = CodePushManifestVerifier.verify(envelope, keys)
        val passed = if (expected != null) {
            result.isVerified && result.errorCode == null && result.payloadBytes?.contentEquals(expected) == true
        } else {
            !result.isVerified && result.payloadBytes == null && result.errorCode in errors
        }
        checked++
        if (!passed) {
            failed++
            println("FAIL Android: $name; expected ${if (expected != null) "verified exact bytes" else errors}; got ${result.errorCode ?: "verified"}")
        }
    }
    println("Android native signature verification: ${checked - failed}/$checked vectors passed")
    if (failed > 0) exitProcess(1)
}
'''

SWIFT_MAIN = r'''
import Foundation

let input = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
var checked = 0
var failed = 0
for line in input.split(separator: "\n", omittingEmptySubsequences: true) {
  let fields = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
  let name = String(data: Data(base64Encoded: fields[0])!, encoding: .utf8)!
  let envelope = Data(base64Encoded: fields[1])!
  let expected = fields[2] == "-" ? nil : Data(base64Encoded: fields[2])
  let errors = fields[3].split(separator: ",").map(String.init)
  var keys: [String: String] = [:]
  if fields[4] != "-" {
    for entry in fields[4].split(separator: ",") {
      let separator = entry.firstIndex(of: ":")!
      let encoded = String(entry[entry.index(after: separator)...])
      keys[String(entry[..<separator])] = String(data: Data(base64Encoded: encoded)!, encoding: .utf8)!
    }
  }
  let result = CodePushManifestVerifier.verify(envelope, trustedKeys: keys)
  let passed: Bool
  let received: String
  switch result {
  case .success(let payload):
    passed = expected != nil && payload == expected!
    received = "verified"
  case .failure(let error):
    passed = expected == nil && errors.contains(error.rawValue)
    received = error.rawValue
  }
  checked += 1
  if !passed {
    failed += 1
    let wanted = expected == nil ? errors.joined(separator: ",") : "verified exact bytes"
    print("FAIL iOS: \(name); expected \(wanted); got \(received)")
  }
}
print("iOS native signature verification: \(checked - failed)/\(checked) vectors passed")
exit(failed == 0 ? 0 : 1)
'''


def run(command, *, timeout=180):
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        sys.stderr.write(result.stdout + result.stderr)
        raise RuntimeError(f'Native verifier command failed with exit status {result.returncode}.')
    return result.stdout


def cached_jar(cache, group, artifact, version=None):
    base = cache / group / artifact
    jars = [file for file in (base / version if version else base).glob('**/*.jar')
            if not file.name.endswith(('-sources.jar', '-javadoc.jar'))]
    if not jars:
        raise RuntimeError(f'Missing cached {group}:{artifact}:{version or "*"}; run the normal Android build once.')
    return sorted(jars)[-1]


def run_android(directory, source, vectors):
    version = re.search(r'kotlinVersion\s*=\s*"([^"]+)"',
                        (ROOT / 'android/build.gradle').read_text()).group(1)
    cache = Path(os.environ.get('GRADLE_USER_HOME', Path.home() / '.gradle')) / 'caches/modules-2/files-2.1'
    stdlib = cached_jar(cache, 'org.jetbrains.kotlin', 'kotlin-stdlib', version)
    compiler = [cached_jar(cache, 'org.jetbrains.kotlin', name, version) for name in (
        'kotlin-compiler-embeddable', 'kotlin-stdlib', 'kotlin-script-runtime', 'kotlin-daemon-embeddable',
    )] + [cached_jar(cache, 'org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'),
          cached_jar(cache, 'org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0'),
          cached_jar(cache, 'org.jetbrains', 'annotations')]
    candidates = []
    if os.environ.get('JAVA_HOME'):
        candidates.append(Path(os.environ['JAVA_HOME']) / 'bin/java')
    candidates.append(Path('/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java'))
    java = next((str(candidate) for candidate in candidates if candidate.is_file()), shutil.which('java'))
    if not java:
        raise RuntimeError('Java 17+ is required for the native verifier test.')
    java_version = subprocess.run([java, '-version'], capture_output=True, text=True, timeout=15)
    match = re.search(r'version "(\d+)', java_version.stderr + java_version.stdout)
    if java_version.returncode or not match or int(match.group(1)) < 17:
        raise RuntimeError('Java 17+ is required for the native verifier test.')
    main = directory / 'NativeVerifierTest.kt'
    main.write_text(KOTLIN_MAIN)
    classes = directory / 'classes'
    run([java, '-cp', os.pathsep.join(map(str, compiler)), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
         '-no-stdlib', '-no-reflect', '-jvm-target', '17', '-classpath', str(stdlib),
         '-d', str(classes), str(source), str(main)])
    return run([java, '-cp', os.pathsep.join((str(classes), str(stdlib))), 'NativeVerifierTestKt', str(vectors)])


def run_ios(directory, source, vectors):
    compiler = shutil.which('swiftc')
    if not compiler:
        raise RuntimeError('The installed macOS Swift compiler is required for the native verifier test.')
    main = directory / 'main.swift'
    main.write_text(SWIFT_MAIN)
    binary = directory / 'native-verifier-test'
    run([compiler, '-swift-version', '5', '-module-cache-path', str(directory / 'module-cache'),
         '-framework', 'Foundation', '-framework', 'Security', str(source), str(main), '-o', str(binary)])
    return run([str(binary), str(vectors)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', choices=('android', 'ios', 'all'), default='all')
    arguments = parser.parse_args()
    platforms = ('android', 'ios') if arguments.platform == 'all' else (arguments.platform,)
    node = shutil.which('node')
    if not node:
        raise RuntimeError('The project Node.js runtime is required for native test vectors.')
    with tempfile.TemporaryDirectory(prefix='jaco-codepush-native-') as temporary:
        directory = Path(temporary)
        vector_json = directory / 'vectors.json'
        print(run([node, str(ROOT / 'scripts/codepush-native-vectors.cjs'), '--out', str(vector_json)]), end='', flush=True)
        document = json.loads(vector_json.read_text())
        if document['schemaVersion'] != 1 or not document['vectors']:
            raise RuntimeError('Invalid native test vector file.')
        vector_rows = []
        for vector in document['vectors']:
            # A tiny data transport keeps Kotlin independent of Android JSON APIs.
            # The actual envelope parser and all crypto remain the production code.
            vector_rows.append('\t'.join((
                base64.b64encode(vector['name'].encode()).decode(),
                vector['envelopeBase64'], vector['expectedPayloadBase64'] or '-',
                ','.join(vector['expectedErrorCodes']),
                ','.join(f'{key}:{base64.b64encode(value.encode()).decode()}'
                         for key, value in sorted(vector['trustedKeys'].items())) or '-',
            )))
        vectors = directory / 'vectors.tsv'
        vectors.write_text('\n'.join(vector_rows) + '\n')
        for platform in platforms:
            source_bytes = SOURCES[platform].read_bytes()
            platform_directory = directory / platform
            platform_directory.mkdir()
            copied_source = platform_directory / SOURCES[platform].name
            copied_source.write_bytes(source_bytes)
            output = (run_android if platform == 'android' else run_ios)(platform_directory, copied_source, vectors)
            if SOURCES[platform].read_bytes() != source_bytes:
                raise RuntimeError(f'{platform} verifier source changed during testing; rerun the checks.')
            print(output, end='', flush=True)
            print(f'{platform} exact source SHA-256: {hashlib.sha256(source_bytes).hexdigest()}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        sys.stderr.write(f'CodePush native test: {error}\n')
        sys.exit(1)
