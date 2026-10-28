export const CODE_PUSH_APP_ID = 'jaco-driver' as const;
export const CODE_PUSH_STORAGE_ORIGIN = 'https://storage.yandexcloud.net';
export const CODE_PUSH_BUCKET = 'jaco-driver-codepush';
export const CODE_PUSH_SIGNATURE_CONTEXT = 'jaco-driver-codepush-manifest-v1\n';

// Protocol limits, not measurements of the final native downloader.
export const CODE_PUSH_LIMITS = Object.freeze({
  payloadBytes: 512 * 1024,
  envelopeBytes: 704 * 1024,
  packageBytes: 128 * 1024 * 1024,
  urlCharacters: 8192,
  jsonDepth: 32,
});

export type CodePushPlatform = 'android' | 'ios';

export interface StorageContractV1 {
  readonly driverOfflineCache: 1;
  readonly offlineMaps: 1;
}

// A single JavaScript file. Local images and fonts remain in the native binary.
export interface UpdatePackageV1 {
  readonly format: 'bundle';
  readonly url: string;
  readonly size: number;
  readonly sha256: string;
  readonly entrypoint: 'index.android.bundle' | 'main.jsbundle';
}

// These types describe data, never proof of signature verification or installability.
export interface ManifestPayloadV1 {
  readonly schemaVersion: 1;
  readonly appId: typeof CODE_PUSH_APP_ID;
  readonly applicationIdentifier: string;
  readonly platform: CodePushPlatform;
  readonly nativeRuntimeId: string;
  readonly minNativeBuild: string;
  readonly maxNativeBuild: string;
  readonly rnVersion: string;
  readonly hermesVersion: string;
  readonly bundleFormat: 'js';
  readonly manifestSequence: number;
  readonly releaseId: string;
  readonly version: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly enabled: boolean;
  readonly rolloutBasisPoints: number;
  readonly rolloutSeed: string;
  readonly package: UpdatePackageV1;
  readonly storageContract: StorageContractV1;
}

export interface ManifestEnvelopeV1 {
  readonly keyId: string;
  readonly payloadBase64: string;
  readonly signatureBase64: string;
}

// Must eventually come from the installed native binary, never the remote manifest.
export interface NativeRuntimeContext {
  readonly appId: typeof CODE_PUSH_APP_ID;
  readonly applicationIdentifier: string;
  readonly platform: CodePushPlatform;
  readonly nativeRuntimeId: string;
  readonly nativeBuild: string;
  readonly rnVersion: string;
  readonly hermesVersion: string;
  readonly bundleFormat: 'js';
  readonly storageContract: StorageContractV1;
}

export type CodePushValidationCode =
  | 'json_invalid'
  | 'json_duplicate_key'
  | 'json_too_deep'
  | 'input_too_large'
  | 'utf8_invalid'
  | 'field_invalid'
  | 'fields_invalid'
  | 'schema_unsupported'
  | 'app_mismatch'
  | 'format_unsupported'
  | 'package_invalid'
  | 'url_invalid'
  | 'url_source_mismatch'
  | 'runtime_invalid'
  | 'runtime_mismatch'
  | 'clock_invalid'
  | 'manifest_not_yet_valid'
  | 'manifest_expired'
  | 'sequence_invalid'
  | 'manifest_replayed'
  | 'manifest_sequence_conflict';

export type FormatCheck<T> =
  | {readonly ok: true; readonly value: T}
  | {
      readonly ok: false;
      readonly error: {
        readonly code: CodePushValidationCode;
        readonly field: string;
      };
    };

export interface ManifestIdentity {
  readonly manifestSequence: number;
  readonly payloadSha256: string;
}
