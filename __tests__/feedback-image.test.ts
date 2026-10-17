import {
  assertFeedbackImages,
  FEEDBACK_IMAGES_ONLY_MESSAGE,
  isFeedbackImageAsset,
} from '@/shared/lib/feedbackImage';

describe('feedback image validation', () => {
  it.each([
    {type: 'image/jpeg', uri: 'file://photo.jpg'},
    {type: ' IMAGE/PNG ', fileName: 'photo.png'},
    {type: 'image/heic', uri: 'content://photos/1'},
    {fileName: 'PHOTO.JPEG', uri: 'content://photos/2'},
    {fileName: 'photo.webp'},
    {uri: 'file://photo.PNG?download=1#preview'},
    {type: '   ', fileName: 'photo.gif'},
  ])('accepts an image with supported metadata: %j', asset => {
    expect(isFeedbackImageAsset(asset)).toBe(true);
  });

  it.each([
    {type: 'video/mp4', fileName: 'photo.jpg'},
    {type: ' VIDEO/MP4 ', uri: 'file://photo.jpg'},
    {type: 'application/pdf', fileName: 'photo.png'},
    {fileName: 'clip.mp4'},
    {uri: 'file://unknown.bin'},
    {uri: 'content://photos/3'},
    {},
  ])('rejects non-image or unknown metadata: %j', asset => {
    expect(isFeedbackImageAsset(asset)).toBe(false);
  });

  it('accepts an empty list and images without mutating the selected assets', () => {
    const images = [
      {uri: 'file://first.jpg', type: 'image/jpeg'},
      {uri: 'file://second.png?preview=1'},
    ];
    const before = images.map(image => ({...image}));

    expect(() => assertFeedbackImages([])).not.toThrow();
    expect(() => assertFeedbackImages(images)).not.toThrow();
    expect(images).toEqual(before);
  });

  it('rejects the whole API image list if even one asset is a video', () => {
    const images = [
      {uri: 'file://first.jpg', type: 'image/jpeg'},
      {uri: 'file://clip.mp4', type: 'video/mp4'},
    ];

    expect(() => assertFeedbackImages(images)).toThrow(
      FEEDBACK_IMAGES_ONLY_MESSAGE,
    );
    expect(images).toHaveLength(2);
  });
});
