#!/usr/bin/env python3
"""Run actual MarkerView lifecycle bodies on macOS with thin MapKit/Fabric stubs.
No iOS/UIKit runtime is involved. The MarkerView init/updateProps/recycle/detach/
setMapObject bodies are extracted verbatim from the installed module. The base
class intentionally retains _props during recycling, as React Native does.
"""
from pathlib import Path
import hashlib
import subprocess
import sys
import tempfile

# Optional explicit source file allows verifying the same test against a saved
# pre-fix implementation. Otherwise resolve the installed module from repo root.
argument = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
source_path = argument if argument.suffix == '.mm' else argument / 'node_modules/react-native-yamap-plus/ios/View/MarkerView.mm'
source = source_path.read_text()

def method(signature):
    start = source.index(signature)
    opening = source.index('{', start)
    depth = 0
    quoted = None
    comment = None
    i = opening
    while i < len(source):
        c = source[i]
        nxt = source[i:i+2]
        if comment == '//':
            if c == '\n': comment = None
        elif comment == '/*':
            if nxt == '*/': comment = None; i += 1
        elif quoted:
            if c == '\\': i += 1
            elif c == quoted: quoted = None
        elif nxt in ('//', '/*'):
            comment = nxt; i += 1
        elif c in ('"', "'"):
            quoted = c
        elif c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: return source[start:i+1]
        i += 1
    raise RuntimeError('Unterminated method ' + signature)

signatures = [
    '- (instancetype)init {',
    '- (void)updateProps:',
    '- (void)prepareForRecycle',
    '- (void)detachMapObject',
    '- (void)setMapObject:',
]
methods = [method(s) for s in signatures]
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
    struct { double lat=0, lon=0; } point;
    std::string source;
    struct { double x=0, y=0; } anchor;
    float scale=1, zI=1;
    bool visible=true, rotated=false, handled=false, strictTapBounds=false, excludeFromCluster=false;
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
@interface UIView : NSObject @end
@implementation UIView @end
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
@interface YMKPlacemarkMapObject : NSObject
@property BOOL valid;
@property YMKPoint *geometry;
@property NSString *loadedSource;
@property NSValue *appliedAnchor;
@property float appliedScale;
@property float appliedZIndex;
- (BOOL)isValid;
- (void)removeTapListenerWithTapListener:(id)listener;
- (void)addTapListenerWithTapListener:(id)listener;
@end
@implementation YMKPlacemarkMapObject
- (instancetype)init { if(self=[super init]) _valid=YES; return self; }
- (BOOL)isValid { return _valid; }
- (void)removeTapListenerWithTapListener:(id)listener {}
- (void)addTapListenerWithTapListener:(id)listener {}
@end
@interface YMKMapWindow : NSObject @end
@implementation YMKMapWindow @end
// RCTViewComponentView.updateProps stores props; prepareForRecycle does not reset
// them. This retention is the essential real Fabric behavior exercised here.
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
    NSObject *_markerViewProvider;
}
- (void)detachMapObject;
- (void)updateMarker;
- (void)setMapObject:(YMKPlacemarkMapObject*)object;
@end
@implementation MarkerView
__REAL_METHODS__
// Minimal MapKit double: records the geometry/image/style that the real lifecycle
// has hydrated. The test intentionally avoids image decoder or drawing claims.
- (void)updateMarker {
    if (!mapObject || ![mapObject isValid]) return;
    mapObject.geometry=_point;
    mapObject.loadedSource=source;
    mapObject.appliedAnchor=anchor;
    mapObject.appliedScale=[scale floatValue];
    mapObject.appliedZIndex=zIndex;
}
@end
static std::shared_ptr<const MarkerViewProps> props(double lat, double lon, const char *src, double x=.04, double y=.5, float s=1.3, float z=8) {
    auto p=std::make_shared<MarkerViewProps>();
    p->point.lat=lat; p->point.lon=lon; p->source=src;
    p->anchor.x=x; p->anchor.y=y; p->scale=s; p->zI=z;
    p->visible=true; p->handled=true; p->strictTapBounds=true;
    return p;
}
static int failed=0, checked=0;
static void verify(YMKPlacemarkMapObject *obj, const MarkerViewProps &p, const std::string &name) {
    const CGPoint a=obj.appliedAnchor ? [obj.appliedAnchor CGPointValue] : CGPointMake(.5,.5);
    auto check=[&](bool ok, const char *field) {
        ++checked;
        if (!ok) { ++failed; if (failed <= 20) std::cerr << "FAIL " << name << ": " << field << "\n"; }
    };
    check(obj.geometry && std::fabs(obj.geometry.latitude-p.point.lat)<1e-9 && std::fabs(obj.geometry.longitude-p.point.lon)<1e-9, "coordinate preserved");
    check(obj.loadedSource && std::string([obj.loadedSource UTF8String])==p.source, "image source preserved");
    check(std::fabs(a.x-p.anchor.x)<1e-9 && std::fabs(a.y-p.anchor.y)<1e-9, "anchor preserved");
    check(std::fabs(obj.appliedScale-p.scale)<1e-6, "scale preserved");
    check(std::fabs(obj.appliedZIndex-p.zI)<1e-6, "zIndex preserved");
}
static YMKPlacemarkMapObject *mount(MarkerView *m, Props::Shared p) {
    // RN Insert applies props before map parent creates the placemark.
    [m updateProps:p oldProps:nullptr];
    auto obj=[YMKPlacemarkMapObject new];
    [m setMapObject:obj];
    return obj;
}
int main() {
@autoreleasepool {
    auto a=props(53.5153,49.4297,"data:image/png;base64,sameFallback");
    auto b=props(53.53,49.44,"data:image/png;base64,newBitmap");
    auto c=props(53.54,49.45,"data:image/png;base64,allNew",.1,.9,2.1,19);
    MarkerView *m=[MarkerView new];
    auto first=mount(m,a); verify(first,*a,"fresh mount");
    [m updateProps:a oldProps:a]; verify(first,*a,"ordinary identical update");
    [m prepareForRecycle];
    auto same=mount(m,a); verify(same,*a,"recycle identical order/source");
    [m prepareForRecycle];
    auto partial=mount(m,b); verify(partial,*b,"recycle new order, shared style");
    [m prepareForRecycle];
    auto allNew=mount(m,c); verify(allNew,*c,"recycle all changed props");
    for(int i=0;i<20;i++) {
        [m prepareForRecycle];
        auto repeated=mount(m,c); verify(repeated,*c,"rapid reopen same order " + std::to_string(i+1));
    }
    std::cout << "Native lifecycle regression: " << checked-failed << "/" << checked << " assertions passed; " << failed << " failed\n";
    return failed ? 1 : 0;
}}
'''.replace('__REAL_METHODS__', '\n\n'.join(methods))
with tempfile.TemporaryDirectory(prefix='yamap-recycle-',dir='/private/tmp') as directory:
    f=Path(directory)/'regression.mm'; f.write_text(fixture)
    binary=Path(directory)/'regression'
    subprocess.run(['xcrun','clang++','-std=c++20','-fobjc-arc','-framework','Foundation','-framework','CoreGraphics',str(f),'-o',str(binary)],check=True)
    print('Extracted real MarkerView lifecycle bodies:', flush=True)
    for signature, body in zip(signatures, methods): print(signature, hashlib.sha256(body.encode()).hexdigest()[:16], flush=True)
    result=subprocess.run([str(binary)])
    sys.exit(result.returncode)
