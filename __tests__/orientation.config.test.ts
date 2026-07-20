import fs from 'node:fs';
import path from 'node:path';

describe('Нативная конфигурация ориентации', () => {
  const projectRoot = path.resolve(__dirname, '..');

  it('фиксирует Android-приложение в портретном режиме', () => {
    const manifest = fs.readFileSync(
      path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml'),
      'utf8'
    );

    expect(manifest).toMatch(/android:screenOrientation="portrait"/);
  });

  it('разрешает на iOS только портретный режим', () => {
    const infoPlist = fs.readFileSync(
      path.join(projectRoot, 'ios/jacoDriverTest/Info.plist'),
      'utf8'
    );
    const supportedOrientations = infoPlist.match(
      /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/
    );

    expect(supportedOrientations?.[1]).toContain(
      '<string>UIInterfaceOrientationPortrait</string>'
    );
    expect(supportedOrientations?.[1]).not.toContain(
      'UIInterfaceOrientationLandscape'
    );
  });
});
