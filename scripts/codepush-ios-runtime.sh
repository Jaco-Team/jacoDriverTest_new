#!/bin/bash
set -e
REACT_NATIVE_PATH="${PROJECT_DIR}/../node_modules/react-native"
export REACT_NATIVE_PATH
. "${REACT_NATIVE_PATH}/scripts/xcode/with-environment.sh"
"${NODE_BINARY}" "${PROJECT_DIR}/../scripts/codepush-ios-runtime.cjs"
