import type { Asset } from 'react-native-image-picker'

export const FEEDBACK_IMAGES_ONLY_MESSAGE = 'Можно загружать только изображения.'

const IMAGE_FILE_EXTENSION = /\.(?:gif|jpe?g|png|webp)(?:[?#].*)?$/i

export function isFeedbackImageAsset(
  asset: Pick<Asset, 'fileName' | 'type' | 'uri'>,
): boolean {
  const mimeType = asset.type?.trim().toLowerCase()

  if (mimeType) return mimeType.startsWith('image/')

  return IMAGE_FILE_EXTENSION.test(asset.fileName ?? asset.uri ?? '')
}

export function assertFeedbackImages(images: Asset[]): void {
  if (images.some(image => !isFeedbackImageAsset(image))) {
    throw new Error(FEEDBACK_IMAGES_ONLY_MESSAGE)
  }
}
