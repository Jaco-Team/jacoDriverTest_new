#!/bin/sh
set -eu

# with-environment.sh has already loaded NODE_BINARY from .xcode.env.local.
# Generate the native key before bundling, including Debug simulator builds.
"$NODE_BINARY" "$PROJECT_DIR/../scripts/mapkit-env.cjs"
exec /bin/sh "$REACT_NATIVE_PATH/../@sentry/react-native/scripts/sentry-xcode.sh"
