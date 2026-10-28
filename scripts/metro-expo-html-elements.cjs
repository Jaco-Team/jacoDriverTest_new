/**
 * NativeWind 4 must process the library's JSX to preserve className styles.
 * Use the public source export only for HTML Elements, leaving other packages
 * and Metro's existing resolver conditions unchanged.
 */
function resolveExpoHtmlElements(context, moduleName, platform) {
  const isHtmlElements =
    moduleName === '@expo/html-elements' ||
    moduleName.startsWith('@expo/html-elements/primitives/');

  if (!isHtmlElements) {
    return context.resolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(
    {
      ...context,
      unstable_conditionNames: [
        ...new Set([...(context.unstable_conditionNames ?? []), 'expo-source']),
      ],
    },
    moduleName,
    platform,
  );
}

module.exports = { resolveExpoHtmlElements };
