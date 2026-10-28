#import "JacoCodePush.h"
#import <React-RCTAppDelegate/RCTAppDelegate.h>
#import "jacoDriverTest-Swift.h"

@implementation JacoCodePush {
  JacoCodePushBridge *_launchBridge;
}

RCT_EXPORT_MODULE(JacoCodePush)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if ((self = [super init])) {
    // A module instance belongs to one RN runtime; it never reads a later attempt.
    _launchBridge = [JacoCodePushBridge new];
  }
  return self;
}

- (facebook::react::ModuleConstants<JS::NativeCodePush::Constants>)getConstants
{
  return facebook::react::typedConstants<JS::NativeCodePush::Constants>({
      .embeddedBundleUrl = [NSBundle.mainBundle URLForResource:@"main" withExtension:@"jsbundle"].absoluteString ?: @"",
  });
}

- (facebook::react::ModuleConstants<JS::NativeCodePush::Constants>)constantsToExport
{
  return [self getConstants];
}

- (void)getLaunchState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_launchBridge getLaunchStateWithCompletion:^(NSDictionary<NSString *, NSString *> *result) {
    resolve(result);
  }];
}

- (void)getDiagnostics:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_launchBridge getDiagnosticsWithCompletion:^(NSDictionary<NSString *, NSString *> *result) {
    resolve(result);
  }];
}

- (void)confirmLaunch:(NSString *)attemptId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_launchBridge confirmLaunch:attemptId completion:^(NSDictionary<NSString *, NSString *> *result) {
    resolve(result);
  }];
}

- (void)markFatal:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [_launchBridge markFatalWithCompletion:^(BOOL recorded) { resolve(@(recorded)); }];
}

- (void)invalidate
{
  [_launchBridge invalidate];
}

- (void)checkAndDownload:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  // A check creates a candidate only. There is no reload or bundle selection here.
  [JacoCodePushBridge checkAndDownloadWithCompletion:^(NSDictionary<NSString *, NSString *> *result) {
    resolve(result);
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCodePushSpecJSI>(params);
}

@end
