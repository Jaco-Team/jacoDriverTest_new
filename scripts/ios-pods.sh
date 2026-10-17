#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# macOS ships Ruby 2.6. Prefer the user's Ruby, then an existing Homebrew Ruby.
ruby_supports_project() {
  "$1" -e 'exit(Gem::Version.new(RUBY_VERSION) >= Gem::Version.new("3.2") && Gem::Version.new(RUBY_VERSION) < Gem::Version.new("4.0") ? 0 : 1)'
}

if ! ruby_supports_project "$(command -v ruby)"; then
  for ruby_bin in \
    /opt/homebrew/opt/ruby@3.4/bin/ruby \
    /opt/homebrew/opt/ruby@3/bin/ruby \
    /opt/homebrew/opt/ruby/bin/ruby \
    /usr/local/opt/ruby@3.4/bin/ruby \
    /usr/local/opt/ruby/bin/ruby; do
    if [ -x "$ruby_bin" ] && ruby_supports_project "$ruby_bin"; then
      export PATH="$(dirname "$ruby_bin"):$PATH"
      break
    fi
  done
fi

if ! ruby_supports_project "$(command -v ruby)"; then
  echo 'Для iOS нужен Ruby >=3.2 <4.0. Настройте Ruby в PATH и повторите npm run ios:pods.' >&2
  exit 1
fi

bundle install
cd ios
bundle exec pod install "$@"

if ! node ../scripts/check-ios-rn-version.cjs; then
  # Deployment must stay read-only with respect to the committed lockfile.
  for argument in "$@"; do
    if [ "$argument" = '--deployment' ]; then
      echo 'Обновите iOS-зависимости без --deployment и сохраните исправленный Podfile.lock.' >&2
      exit 1
    fi
  done

  # CocoaPods caches external podspecs even when package.json changes. Refresh
  # only stale RN artifacts, once; never update every pod or delete Pods/data.
  stale_pods=$(node ../scripts/check-ios-rn-version.cjs --stale-pods)
  if [ -z "$stale_pods" ]; then exit 1; fi
  read -r -a pods_to_update <<< "$stale_pods"
  bundle exec pod update "${pods_to_update[@]}" --no-repo-update
  node ../scripts/check-ios-rn-version.cjs
fi
