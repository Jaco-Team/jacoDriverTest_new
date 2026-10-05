#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Use an installed JDK; macOS may otherwise select the obsolete Java 8 runtime.
jdk_supports_project() {
  [ -x "$1/bin/javac" ] || return 1
  local major
  major=$("$1/bin/java" -XshowSettings:properties -version 2>&1 |
    sed -n 's/^[[:space:]]*java.specification.version = //p')
  [[ "$major" =~ ^[0-9]+$ ]] && [ "$major" -ge 17 ]
}

if ! jdk_supports_project "${JAVA_HOME:-}"; then
  for jdk_home in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home; do
    if jdk_supports_project "$jdk_home"; then
      export JAVA_HOME="$jdk_home"
      break
    fi
  done
fi

if ! jdk_supports_project "${JAVA_HOME:-}"; then
  echo 'Для Android нужен JDK >=17. Укажите JAVA_HOME и повторите команду.' >&2
  exit 1
fi
export PATH="$JAVA_HOME/bin:$PATH"

if [ "${1:-}" = '--build' ] || [ "${1:-}" = '--build-local-release' ]; then
  gradle_task=':app:assembleDebug'
  if [ "$1" = '--build-local-release' ]; then
    gradle_task=':app:assembleLocalRelease'
  fi
  shift
  cd android
  exec ./gradlew "$gradle_task" "$@"
fi

exec npx --no-install react-native run-android "$@"
