#!/usr/bin/env python3
"""Execute installed ObjC++ marker image requests with controlled cache callbacks.

The actual init/updateProps/updateMarker/recycle/detach/setMapObject methods are
extracted verbatim. Only Fabric, MapKit and image-cache dependencies are doubles;
Foundation and CoreGraphics execute on macOS without an iOS simulator or network.
An optional .mm path checks a saved pre-fix MarkerView against the same scenarios.
"""
from pathlib import Path
import hashlib
import subprocess
import sys
import tempfile

argument = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
source_path = argument if argument.suffix == '.mm' else argument / 'node_modules/react-native-yamap-plus/ios/View/MarkerView.mm'
source = source_path.read_text()


def method(signature):
    start = source.index(signature)
    opening = source.index('{', start)
    depth, quoted, comment = 0, None, None
    i = opening
    while i < len(source):
        c, nxt = source[i], source[i:i + 2]
        if comment == '//':
            if c == '\n':
                comment = None
        elif comment == '/*':
            if nxt == '*/':
                comment = None
                i += 1
        elif quoted:
            if c == '\\':
                i += 1
            elif c == quoted:
                quoted = None
        elif nxt in ('//', '/*'):
            comment = nxt
            i += 1
        elif c in ('"', "'"):
            quoted = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return source[start:i + 1]
        i += 1
    raise RuntimeError('Unterminated method ' + signature)


signatures = [
    '- (instancetype)init {', '- (void)updateProps:', '- (void)updateMarker {',
    '- (void)prepareForRecycle', '- (void)detachMapObject', '- (void)setMapObject:',
]
methods = [method(signature) for signature in signatures]
fixture = r'''
#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#include <memory>
#include <string>
#include <cmath>
#include <iostream>
namespace facebook::react {
struct Props { using Shared = std::shared_ptr<const Props>; virtual ~Props() = default; };
struct MarkerViewProps : Props {
    struct { double lat=53.51, lon=49.42; } point;
    std::string source;
    struct { double x=.04, y=.5; } anchor;
    float scale=1.3, zI=8;
    bool visible=true, rotated=false, handled=true, strictTapBounds=true, excludeFromCluster=false;
};
}
using namespace facebook::react;
@interface NSValue (FixtureCGPoint)
+ (NSValue*)valueWithCGPoint:(CGPoint)point;
- (CGPoint)CGPointValue;
@end
@implementation NSValue (FixtureCGPoint)
+ (NSValue*)valueWithCGPoint:(CGPoint)point { return [NSValue valueWithBytes:&point objCType:@encode(CGPoint)]; }
- (CGPoint)CGPointValue { CGPoint result; [self getValue:&result]; return result; }
@end
@interface UIView : NSObject
@property CGRect bounds;
@end
@implementation UIView @end
@interface YRTViewProvider : NSObject @end
@implementation YRTViewProvider @end
@interface YMKPoint : NSObject
@property double latitude;
@property double longitude;
+ (instancetype)pointWithLatitude:(double)latitude longitude:(double)longitude;
@end
@implementation YMKPoint
+ (instancetype)pointWithLatitude:(double)latitude longitude:(double)longitude {
    YMKPoint *p=[YMKPoint new]; p.latitude=latitude; p.longitude=longitude; return p;
}
@end
@interface YMKRect : NSObject
+ (instancetype)rectWithMin:(CGPoint)min max:(CGPoint)max;
@end
@implementation YMKRect
+ (instancetype)rectWithMin:(CGPoint)min max:(CGPoint)max { return [self new]; }
@end
@interface YMKIconStyle : NSObject
@property NSNumber *scale, *visible, *rotationType;
@property NSValue *anchor;
@property YMKRect *tappableArea;
@end
@implementation YMKIconStyle @end
@interface UIImage : NSObject {
    CGImageRef _image;
}
@property NSString *tag;
@property (readonly) CGImageRef CGImage;
+ (instancetype)image:(NSString*)tag width:(size_t)width height:(size_t)height;
@end
@implementation UIImage
+ (instancetype)image:(NSString*)tag width:(size_t)width height:(size_t)height {
    UIImage *image=[self new]; image.tag=tag;
    CGColorSpaceRef colorSpace=CGColorSpaceCreateDeviceRGB();
    CGContextRef context=CGBitmapContextCreate(nullptr,width,height,8,width*4,colorSpace,kCGImageAlphaPremultipliedLast);
    image->_image=CGBitmapContextCreateImage(context);
    CGContextRelease(context); CGColorSpaceRelease(colorSpace);
    return image;
}
- (CGImageRef)CGImage { return _image; }
- (void)dealloc { if (_image) CGImageRelease(_image); }
@end
@interface YMKPlacemarkMapObject : NSObject
@property BOOL valid;
@property YMKPoint *geometry;
@property float zIndex;
@property YMKIconStyle *appliedStyle;
@property UIImage *image;
@property NSUInteger iconWrites;
- (BOOL)isValid;
- (void)removeTapListenerWithTapListener:(id)listener;
- (void)addTapListenerWithTapListener:(id)listener;
- (void)setIconStyleWithStyle:(YMKIconStyle*)style;
- (void)setIconWithImage:(UIImage*)image;
- (void)setViewWithView:(YRTViewProvider*)view style:(YMKIconStyle*)style;
@end
@implementation YMKPlacemarkMapObject
- (instancetype)init { if(self=[super init]) _valid=YES; return self; }
- (BOOL)isValid { return _valid; }
- (void)removeTapListenerWithTapListener:(id)listener {}
- (void)addTapListenerWithTapListener:(id)listener {}
- (void)setIconStyleWithStyle:(YMKIconStyle*)style { _appliedStyle=style; }
- (void)setIconWithImage:(UIImage*)image { _image=image; ++_iconWrites; }
- (void)setViewWithView:(YRTViewProvider*)view style:(YMKIconStyle*)style { _appliedStyle=style; }
@end
@interface YMKMapWindow : NSObject
@property CGFloat scaleFactor;
@end
@implementation YMKMapWindow @end
@interface ImageRequest : NSObject
@property NSString *source;
@property (copy) void (^completion)(UIImage*);
@end
@implementation ImageRequest @end
@interface ImageCacheManager : NSObject
@property NSMutableArray<ImageRequest*> *requests;
@property NSMutableDictionary<NSString*, UIImage*> *cache;
+ (instancetype)instance;
- (void)getWithSource:(NSString*)source completion:(void (^)(UIImage*))completion;
- (void)clear;
@end
@implementation ImageCacheManager
+ (instancetype)instance { static ImageCacheManager *instance; if (!instance) instance=[self new]; return instance; }
- (instancetype)init { if(self=[super init]) { _requests=[NSMutableArray new]; _cache=[NSMutableDictionary new]; } return self; }
- (void)getWithSource:(NSString*)source completion:(void (^)(UIImage*))completion {
    auto request=[ImageRequest new]; request.source=source; request.completion=completion;
    [_requests addObject:request];
    UIImage *cached=_cache[source]; if(cached) completion(cached);
}
- (void)clear { [_requests removeAllObjects]; [_cache removeAllObjects]; }
@end
@interface FixtureFabricView : NSObject {
@public Props::Shared _props;
}
- (void)updateProps:(const Props::Shared&)props oldProps:(const Props::Shared&)oldProps;
- (void)prepareForRecycle;
@end
@implementation FixtureFabricView
- (void)updateProps:(const Props::Shared&)props oldProps:(const Props::Shared&)oldProps { _props=props; }
- (void)prepareForRecycle {}
@end
@interface MarkerView : FixtureFabricView {
@public
    YMKPoint *_point;
    YMKPlacemarkMapObject *mapObject;
    float zIndex;
    NSNumber *scale;
    BOOL rotated, visible, handled, strictTapBounds, excludeFromCluster;
    NSString *source, *lastSource, *pendingSource;
    NSValue *anchor;
    YMKMapWindow *markerMapWindow;
    CGSize iconSize;
    NSUInteger imageRequestId;
    NSMutableArray<UIView*> *_reactSubviews;
    YRTViewProvider *_markerViewProvider;
}
- (void)updateMarker;
- (void)detachMapObject;
- (void)setMapObject:(YMKPlacemarkMapObject*)object;
@end
@implementation MarkerView
__REAL_METHODS__
@end
static int checked=0, failed=0;
static void check(bool condition, const char *name) {
    ++checked; if(!condition) { ++failed; std::cerr << "FAIL " << name << "\n"; }
}
static void change(MarkerView *marker, const char *source) {
    auto props=std::make_shared<MarkerViewProps>(); props->source=source;
    [marker updateProps:props oldProps:marker->_props];
}
static ImageRequest *latest() { return [ImageCacheManager instance].requests.lastObject; }
static NSUInteger requests() { return [ImageCacheManager instance].requests.count; }
static UIImage *image(NSString *tag) { return [UIImage image:tag width:120 height:40]; }
static MarkerView *mount(const char *source) {
    [[ImageCacheManager instance] clear];
    auto marker=[MarkerView new]; change(marker,source);
    [marker setMapObject:[YMKPlacemarkMapObject new]];
    return marker;
}
static void deliver(ImageRequest *request, NSString *tag) { request.completion(tag ? image(tag) : nil); }
int main() {
@autoreleasepool {
    // Reported lock: A loaded, B pending, A again. Old B finishes while A is
    // current, then a later B must request again instead of being suppressed.
    auto m=mount("A"); deliver(latest(),@"A");
    change(m,"B"); auto staleB=latest(); change(m,"A");
    deliver(staleB,@"old-B");
    check([m->mapObject.image.tag isEqual:@"A"],"stale B keeps loaded A");
    check(m->pendingSource == nil,"source A clears abandoned pending B");
    change(m,"B");
    check(requests()==3,"A-B-A-complete-B-B starts a fresh B request");
    deliver(latest(),@"new-B");
    check([m->mapObject.image.tag isEqual:@"new-B"],"fresh B applies after abandoned completion");
    check(m->iconSize.width==120 && m->iconSize.height==40,"current bitmap sets native tap bounds");

    // Returning to B before the original B completion must also invalidate it.
    m=mount("A"); deliver(latest(),@"A");
    change(m,"B"); staleB=latest(); change(m,"A"); change(m,"B");
    auto currentB=latest();
    check(requests()==3,"A-B-A-B before callback starts a new B request");
    deliver(staleB,@"stale-B");
    check([m->mapObject.image.tag isEqual:@"A"],"old B cannot satisfy current B generation");
    check([m->pendingSource isEqual:@"B"],"old B cannot clear current pending B");
    deliver(currentB,@"current-B");
    check([m->mapObject.image.tag isEqual:@"current-B"],"latest B generation applies");

    // Repeated updates/styles with the same in-flight source must not duplicate
    // work. Coordinates/style still rehydrate through the actual updateProps.
    m=mount("A"); auto pendingA=latest();
    for(int i=0;i<20;i++) { change(m,"A"); [m updateMarker]; }
    check(requests()==1,"identical pending props do not duplicate requests");
    deliver(pendingA,@"A");
    for(int i=0;i<20;i++) change(m,"A");
    check(requests()==1,"identical loaded props do not duplicate requests");
    check(m->mapObject.geometry.latitude==53.51 && m->mapObject.geometry.longitude==49.42,"actual updateMarker applies coordinates");
    check(std::fabs([m->mapObject.appliedStyle.scale floatValue]-1.3)<1e-6 && m->mapObject.zIndex==8,"actual updateMarker applies style");

    // An empty source abandons the request as well, and a later source is free
    // to load. The existing icon stays until a valid replacement arrives.
    m=mount("A"); deliver(latest(),@"A");
    change(m,"B"); staleB=latest(); change(m,"");
    deliver(staleB,@"stale-B");
    check(m->pendingSource == nil,"empty source clears abandoned request");
    check([m->mapObject.image.tag isEqual:@"A"],"empty source blocks old image callback");
    change(m,"B");
    check(requests()==3,"B can retry after empty source");
    deliver(latest(),@"B");
    check([m->mapObject.image.tag isEqual:@"B"],"B applies after empty source");

    // A null result clears the request without treating it as a loaded image or
    // recursively retrying forever. A later explicit update can retry once.
    m=mount("A"); deliver(latest(),@"A");
    change(m,"B"); auto failedB=latest(); const auto iconWrites=m->mapObject.iconWrites;
    deliver(failedB,nil);
    check(m->pendingSource == nil,"null image clears pending source");
    check([m->lastSource isEqual:@"A"],"null image preserves last valid source");
    check([m->mapObject.image.tag isEqual:@"A"] && m->mapObject.iconWrites==iconWrites,"null image never writes an empty native icon");
    check(requests()==2,"null image does not recursively start requests");
    check(m->iconSize.width==120 && m->iconSize.height==40,"null image preserves last valid hit bounds");
    change(m,"B");
    check(requests()==3,"explicit update retries failed B");
    deliver(latest(),@"B");
    check([m->mapObject.image.tag isEqual:@"B"],"retry after null result succeeds");

    // Detach/recycle starts a distinct generation even with identical props.
    m=mount("A"); auto oldA=latest(); auto oldObject=m->mapObject;
    [m prepareForRecycle]; change(m,"A");
    auto newObject=[YMKPlacemarkMapObject new]; [m setMapObject:newObject];
    auto newA=latest(); deliver(oldA,@"old-A");
    check(oldObject.image==nil && newObject.image==nil,"recycled callbacks cannot mutate either map object");
    check([m->pendingSource isEqual:@"A"],"recycled callback cannot clear new pending request");
    deliver(newA,@"new-A");
    check([newObject.image.tag isEqual:@"new-A"],"recycled identical source loads into new object");
    check(newObject.geometry.latitude==53.51 && newObject.geometry.longitude==49.42,"Fabric identical props preserve recycled coordinate");

    // A synchronous cache hit re-enters updateMarker: it must apply only once,
    // clear pending before the nested update, and keep the loaded generation.
    m=mount("A"); deliver(latest(),@"A");
    [ImageCacheManager instance].cache[@"B"]=image(@"cached-B");
    const auto beforeWrites=m->mapObject.iconWrites;
    change(m,"B");
    check(requests()==2,"synchronous cache hit does not recurse into new requests");
    check([m->mapObject.image.tag isEqual:@"cached-B"] && m->mapObject.iconWrites==beforeWrites+1,"synchronous cache hit applies exactly once");
    check(m->pendingSource==nil && [m->lastSource isEqual:@"B"],"synchronous cache hit clears pending and records source");

    std::cout << "Native image race regression: " << checked-failed << "/" << checked << " assertions passed; " << failed << " failed\n";
    return failed ? 1 : 0;
}}
'''.replace('__REAL_METHODS__', '\n\n'.join(methods))

with tempfile.TemporaryDirectory(prefix='yamap-image-race-', dir='/private/tmp') as directory:
    fixture_path=Path(directory)/'regression.mm'
    fixture_path.write_text(fixture)
    binary=Path(directory)/'regression'
    subprocess.run(['xcrun', 'clang++', '-std=c++20', '-fobjc-arc', '-framework', 'Foundation', '-framework', 'CoreGraphics', str(fixture_path), '-o', str(binary)], check=True)
    print('Extracted real MarkerView image/lifecycle bodies:', flush=True)
    for signature, body in zip(signatures, methods):
        print(signature, hashlib.sha256(body.encode()).hexdigest()[:16], flush=True)
    sys.exit(subprocess.run([str(binary)]).returncode)
