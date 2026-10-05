#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# macOS ships Ruby 2.6. Prefer the user's Ruby, then an existing Homebrew Ruby.
ruby_supports_project() {
  "$1" -e 'exit(Gem::Version.new(RUBY_VERSION) >= Gem::Version.new("3.2") && Gem::Version.new(RUBY_VERSION) < Gem::Version.new("4.0") ? 0 : 1)'
}

if ! ruby_supports_project "$(command -v ruby)"; then
  for ruby_bin in /opt/homebrew/opt/ruby/bin/ruby /usr/local/opt/ruby/bin/ruby; do
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
