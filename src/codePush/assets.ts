export interface ResolvedAsset {
  uri: string;
  width?: number;
  height?: number;
  scale: number;
}

export interface AssetResolver {
  asset: unknown;
  constructor: unknown;
  isLoadedFromServer(): boolean;
  defaultAsset(): ResolvedAsset;
}

type ResolverConstructor = new (
  serverUrl: null,
  bundleDirectory: string | null,
  asset: unknown,
) => AssetResolver;

export type AssetTransformer = (
  resolver: AssetResolver,
) => ResolvedAsset | null;

/** Use RN's own resolver with the installed binary's asset base, retaining scale/type rules. */
export function createEmbeddedAssetTransformer(
  platform: string,
  embeddedBundleUrl: string,
): AssetTransformer | null {
  const android =
    platform === 'android' &&
    embeddedBundleUrl === 'assets://index.android.bundle';
  const ios =
    platform === 'ios' &&
    /^file:\/\/\/[^\u0000-\u0020?#]+\/main\.jsbundle$/.test(embeddedBundleUrl);
  if (!android && !ios) return null;
  const directory = android
    ? null
    : embeddedBundleUrl.slice(0, embeddedBundleUrl.lastIndexOf('/') + 1);
  return resolver => {
    // Metro keeps its normal URL. URL objects bypass RN's require-asset transformer altogether.
    if (resolver.isLoadedFromServer()) return null;
    const Resolver = resolver.constructor as ResolverConstructor;
    return new Resolver(null, directory, resolver.asset).defaultAsset();
  };
}
