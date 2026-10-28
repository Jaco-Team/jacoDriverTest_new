import {Image, Platform} from 'react-native';
import NativeCodePush from './NativeCodePush';
import {createEmbeddedAssetTransformer, type AssetTransformer} from './assets';

function install(): boolean {
  if (__DEV__) return true;
  try {
    const resolve =
      Image.resolveAssetSource as typeof Image.resolveAssetSource & {
        addCustomSourceTransformer?: (transformer: AssetTransformer) => void;
      };
    if (
      !NativeCodePush ||
      typeof resolve.addCustomSourceTransformer !== 'function'
    )
      return false;
    const constants = NativeCodePush.getConstants();
    if (typeof constants?.embeddedBundleUrl !== 'string') return false;
    const transformer = createEmbeddedAssetTransformer(
      Platform.OS,
      constants.embeddedBundleUrl,
    );
    if (!transformer) return false;
    resolve.addCustomSourceTransformer(transformer);
    return true;
  } catch {
    // Keep the regular binary usable; a trial cannot be acknowledged without its asset resolver.
    return false;
  }
}

const installed = install();

export function areCodePushAssetsReady(): boolean {
  return installed;
}
