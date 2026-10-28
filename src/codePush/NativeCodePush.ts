import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type NativeDownloadResult = {
  status: string;
  errorCode: string;
  packageId: string;
  version: string;
  nativeRuntimeId: string;
  packageSha256: string;
};

export type NativeLaunchResult = {
  status: string;
  errorCode: string;
  packageId: string;
  version: string;
  nativeRuntimeId: string;
  attemptId: string;
  source: string;
};

export type NativeCodePushConstants = {
  embeddedBundleUrl: string;
};

export type NativeDiagnosticsResult = {
  status: string;
  errorCode: string;
  applicationIdentifier: string;
  nativeBuild: string;
  nativeRuntimeId: string;
  source: string;
  launchStatus: string;
  launchReason: string;
  launchedPackageId: string;
  launchedVersion: string;
  currentPackageId: string;
  currentVersion: string;
  previousPackageId: string;
  previousVersion: string;
  candidatePackageId: string;
  candidateVersion: string;
  candidateStatus: string;
  lastEvent: string;
  lastEventPackageSha256: string;
  downloadStatus: string;
  downloadErrorCode: string;
  downloadPackageId: string;
  downloadVersion: string;
  storageStatus: string;
};

export interface Spec extends TurboModule {
  getConstants(): NativeCodePushConstants;
  checkAndDownload(): Promise<NativeDownloadResult>;
  getLaunchState(): Promise<NativeLaunchResult>;
  confirmLaunch(attemptId: string): Promise<NativeLaunchResult>;
  markFatal(): Promise<boolean>;
  getDiagnostics(): Promise<NativeDiagnosticsResult>;
}

export default TurboModuleRegistry.get<Spec>('JacoCodePush');
