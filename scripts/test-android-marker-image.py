#!/usr/bin/env python3
"""Run the installed Kotlin marker/image-loader bodies with deterministic doubles.

Only Context/MapKit/React drawing and the main-loop/image decoder are replaced.
The real source-change, request, callback, detach and downloader bodies compile
and execute on the JVM. No Android app, device, Gradle build or network is used.
An optional MarkerView.kt and ImageCacheManager.kt pair can test a saved baseline.
Kotlin compiler dependencies must already exist in the project's Gradle cache.
"""
from pathlib import Path
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
module = root / 'node_modules/react-native-yamap-plus/android/src/main/java/ru/yamap'
marker_path = Path(sys.argv[1]) if len(sys.argv) > 1 else module / 'view/MarkerView.kt'
cache_path = Path(sys.argv[2]) if len(sys.argv) > 2 else module / 'utils/ImageCacheManager.kt'
marker_source = marker_path.read_text()
cache_source = cache_path.read_text()


def method(source, signature):
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
    raise RuntimeError('Unterminated Kotlin method: ' + signature)


methods = '\n\n'.join(method(marker_source, signature) for signature in (
    'fun setPoint(', 'fun setScale(', 'fun setZIndex(', 'fun setIconSource(',
    'private fun updateMarker(', 'fun setMarkerMapObject(',
))
download_method = method(cache_source, 'private fun downloadImageBitmap(')
fixture = r'''
import java.lang.ref.WeakReference
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.system.exitProcess

class Context
class Point(val latitude: Double, val longitude: Double)
class PointF(val x: Float, val y: Float)
class Rect(val min: PointF, val max: PointF)
enum class RotationType { ROTATE, NO_ROTATION }
class IconStyle {
    var scale = 1f
    var rotationType = RotationType.NO_ROTATION
    var visible = true
    var tappableArea: Rect? = null
    var anchor: PointF? = null
}
class Bitmap(val tag: String, val width: Int = 120, val height: Int = 40)
class Canvas(val bitmap: Bitmap)
class View(val width: Int = 20, val height: Int = 20) { fun draw(canvas: Canvas) {} }
fun createBitmap(width: Int, height: Int) = Bitmap("child", width, height)
class ImageProvider(val bitmap: Bitmap) {
    companion object { fun fromBitmap(bitmap: Bitmap) = ImageProvider(bitmap) }
}
open class MapObject {
    var isValid = true
    var tapListeners = 0
    fun removeTapListener(listener: WeakReference<Any>) { tapListeners-- }
    fun addTapListener(listener: WeakReference<Any>) { tapListeners++ }
}
class PlacemarkMapObject : MapObject() {
    var geometry = Point(0.0, 0.0)
    var zIndex = 0f
    var appliedStyle = IconStyle()
    var bitmap: Bitmap? = null
    var iconWrites = 0
    fun setIconStyle(style: IconStyle) { appliedStyle = style }
    fun setIcon(image: ImageProvider) { bitmap = image.bitmap; iconWrites++ }
}
// Callback delivery is explicit so each stale/cached/in-flight ordering is exact.
object ImageCacheManager {
    class Request(val source: String, val callback: (Bitmap?) -> Unit)
    val requests = mutableListOf<Request>()
    val cache = mutableMapOf<String, Bitmap>()
    fun getImage(context: Context, source: String, callback: (Bitmap?) -> Unit) {
        requests.add(Request(source, callback))
        cache[source]?.let { callback(it) }
    }
    fun last() = requests.last()
    fun clear() { requests.clear(); cache.clear() }
}
class MarkerView {
    val context = Context()
    @JvmField var point: Point? = Point(53.51, 49.42)
    private var _scale = 1f
    private var _zIndex = 1f
    private var _rotated = false
    private var _visible = true
    private var _strictTapBounds = false
    private var _markerAnchor: PointF? = null
    private var _iconSource: String? = null
    private var _childView: View? = null
    private val _children = mutableListOf<View>()
    private var loadedSource: String? = null
    private var pendingSource: String? = null
    private var imageRequestId = 0
    private var iconWidth = 0f
    private var iconHeight = 0f
    private val tapListener = WeakReference<Any>(this)
    var rnMapObject: MapObject? = null
    __MARKER_METHODS__
}
interface Callback<T> { fun invoke(arg: T) }
class Looper { companion object { fun getMainLooper() = Looper() } }
class Handler(looper: Looper) {
    fun post(callback: () -> Unit) { queue.put(callback) }
    companion object {
        private val queue = LinkedBlockingQueue<() -> Unit>()
        fun runOne(): Boolean {
            val callback = queue.poll(1500, TimeUnit.MILLISECONDS) ?: return false
            callback()
            return true
        }
    }
}
class ActualImageDownloader {
    // Decoder double: real downloadImageBitmap still creates its worker Thread
    // and posts callbacks through Handler, including the exception path.
    fun getBitmapSync(context: Context, source: String): Bitmap? {
        if (source == "throw") throw java.io.IOException("controlled decoder failure")
        if (source == "null") return null
        return Bitmap(source)
    }
    __DOWNLOAD_METHOD__
    fun request(source: String, callback: Callback<Bitmap?>) {
        downloadImageBitmap(Context(), source, callback)
    }
}
var checked = 0
var failed = 0
fun verify(condition: Boolean, name: String) {
    checked++
    if (!condition) { failed++; println("FAIL $name") }
}
fun mounted(source: String): Pair<MarkerView, PlacemarkMapObject> {
    ImageCacheManager.clear()
    val marker = MarkerView()
    marker.setIconSource(source)
    val obj = PlacemarkMapObject()
    marker.setMarkerMapObject(obj)
    return Pair(marker, obj)
}
fun main() {
    // Loaded A -> pending B -> A, complete B while A is current, then B again.
    val (race, raceObj) = mounted("A")
    ImageCacheManager.last().callback(Bitmap("A"))
    verify(raceObj.bitmap?.tag == "A", "initial A rendered")
    race.setIconSource("B")
    val staleB = ImageCacheManager.last()
    race.setIconSource("A")
    staleB.callback(Bitmap("stale-B"))
    verify(raceObj.bitmap?.tag == "A", "B callback while current A ignored")
    val beforeB = ImageCacheManager.requests.size
    race.setIconSource("B")
    verify(ImageCacheManager.requests.size == beforeB + 1, "A-B-A-B starts fresh B request")
    if (ImageCacheManager.requests.size > beforeB) ImageCacheManager.last().callback(Bitmap("B"))
    verify(raceObj.bitmap?.tag == "B", "A-B-A-B renders current B")

    // Returning to the same source must not make the older A callback current.
    val (same, sameObj) = mounted("A")
    val oldA = ImageCacheManager.last()
    same.setIconSource("B")
    val oldB = ImageCacheManager.last()
    same.setIconSource("A")
    val latestA = ImageCacheManager.last()
    oldA.callback(Bitmap("old-A"))
    oldB.callback(Bitmap("old-B"))
    verify(sameObj.iconWrites == 0, "old matching-source A and B callbacks ignored")
    latestA.callback(Bitmap("new-A"))
    verify(sameObj.bitmap?.tag == "new-A", "latest same-source A callback wins")

    // Reattaching an identical source to a different placemark must reload.
    val (detach, firstObj) = mounted("A")
    val detachedRequest = ImageCacheManager.last()
    detach.setMarkerMapObject(null)
    val secondObj = PlacemarkMapObject()
    detach.setMarkerMapObject(secondObj)
    val reattachedRequest = ImageCacheManager.last()
    detachedRequest.callback(Bitmap("detached-A"))
    verify(firstObj.iconWrites == 0 && secondObj.iconWrites == 0, "detached callback affects neither placemark")
    verify(firstObj.tapListeners == 0 && secondObj.tapListeners == 1, "tap listener moves to new placemark")
    reattachedRequest.callback(Bitmap("reattached-A"))
    verify(secondObj.bitmap?.tag == "reattached-A", "identical source after reattach loads")

    // Identical prop/style changes must deduplicate the current in-flight request.
    val (props, propsObj) = mounted("A")
    props.setIconSource("A")
    props.setScale(1.8f)
    props.setZIndex(8f)
    props.setPoint(Point(53.52, 49.43))
    verify(ImageCacheManager.requests.size == 1, "same pending source and style updates deduplicated")
    ImageCacheManager.last().callback(Bitmap("A", 200, 50))
    verify(propsObj.bitmap?.width == 200 && propsObj.appliedStyle.scale == 1.8f, "loaded icon keeps latest style")
    verify(propsObj.zIndex == 8f && propsObj.geometry.longitude == 49.43, "loaded icon keeps latest geometry")
    props.setIconSource("A")
    verify(ImageCacheManager.requests.size == 1, "already loaded source deduplicated")

    val (clear, clearObj) = mounted("A")
    val beforeClear = ImageCacheManager.last()
    clear.setIconSource(null)
    beforeClear.callback(Bitmap("cleared-A"))
    verify(clearObj.iconWrites == 0, "cleared source rejects old callback")
    val beforeRestore = ImageCacheManager.requests.size
    clear.setIconSource("A")
    verify(ImageCacheManager.requests.size == beforeRestore + 1, "restoring cleared source starts new request")
    if (ImageCacheManager.requests.size > beforeRestore) ImageCacheManager.last().callback(Bitmap("restored-A"))
    verify(clearObj.bitmap?.tag == "restored-A", "restored source renders")

    // Decode failure releases pending; retry waits for a later normal update.
    val (retry, retryObj) = mounted("fallback")
    ImageCacheManager.last().callback(Bitmap("fallback"))
    retry.setIconSource("B")
    val failedB = ImageCacheManager.last()
    val beforeFailure = ImageCacheManager.requests.size
    failedB.callback(null)
    verify(ImageCacheManager.requests.size == beforeFailure, "null decode never starts recursive retry")
    verify(retryObj.bitmap?.tag == "fallback", "null decode preserves visible fallback")
    retry.setPoint(Point(53.53, 49.44))
    verify(ImageCacheManager.requests.size == beforeFailure + 1, "ordinary update can retry null decode")
    if (ImageCacheManager.requests.size > beforeFailure) ImageCacheManager.last().callback(Bitmap("retried-B"))
    verify(retryObj.bitmap?.tag == "retried-B", "retried decode renders")

    ImageCacheManager.clear()
    ImageCacheManager.cache["cached"] = Bitmap("cached")
    val cached = MarkerView()
    cached.setIconSource("cached")
    val cachedObj = PlacemarkMapObject()
    cached.setMarkerMapObject(cachedObj)
    verify(cachedObj.bitmap?.tag == "cached" && cachedObj.iconWrites == 1, "synchronous cache callback renders once")
    verify(ImageCacheManager.requests.size == 1, "synchronous cache hit avoids recursive request")

    // Real downloader must signal null once on the main loop for exceptions/null.
    val downloader = ActualImageDownloader()
    val mainThread = Thread.currentThread()
    for (source in listOf("throw", "null", "valid")) {
        var calls = 0
        var delivered: Bitmap? = null
        var onMain = false
        downloader.request(source, object : Callback<Bitmap?> {
            override fun invoke(arg: Bitmap?) {
                calls++; delivered = arg; onMain = Thread.currentThread() === mainThread
            }
        })
        verify(Handler.runOne(), "$source decoder result reaches main loop")
        verify(calls == 1 && onMain, "$source decoder invokes callback once on main loop")
        verify(if (source == "valid") delivered?.tag == "valid" else delivered == null,
            "$source decoder result matches success/failure")
    }
    println("Android native marker image: ${checked - failed}/$checked assertions passed")
    if (failed > 0) exitProcess(1)
}
'''.replace('__MARKER_METHODS__', methods).replace('__DOWNLOAD_METHOD__', download_method)

# Match the project's compiler version, use cached dependencies only. This does
# not start Gradle or download/install another compiler for the regression test.
kotlin_version = re.search(r'kotlinVersion\s*=\s*"([^"]+)"', (root / 'android/build.gradle').read_text()).group(1)
gradle_home = Path(os.environ.get('GRADLE_USER_HOME', Path.home() / '.gradle'))
cache = gradle_home / 'caches/modules-2/files-2.1'


def cached_jar(group, artifact, version=None):
    base = cache / group / artifact
    candidates = list((base / version if version else base).glob('**/*.jar'))
    candidates = [p for p in candidates if not p.name.endswith(('-sources.jar', '-javadoc.jar'))]
    if not candidates:
        raise SystemExit(f'Missing cached Kotlin dependency {group}:{artifact}:{version or "*"}; run the normal Android build once.')
    return sorted(candidates)[-1]


stdlib = cached_jar('org.jetbrains.kotlin', 'kotlin-stdlib', kotlin_version)
compiler_jars = [cached_jar('org.jetbrains.kotlin', name, kotlin_version) for name in (
    'kotlin-compiler-embeddable', 'kotlin-stdlib', 'kotlin-script-runtime', 'kotlin-daemon-embeddable',
)] + [cached_jar('org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'),
      cached_jar('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0'),
      cached_jar('org.jetbrains', 'annotations')]
java_candidates = [Path(os.environ.get('JAVA_HOME', '')) / 'bin/java',
                   Path('/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java')]
java = next((str(p) for p in java_candidates if p.is_file()), shutil.which('java'))
if not java:
    raise SystemExit('Java 17+ is required to execute the Kotlin regression test.')

with tempfile.TemporaryDirectory(prefix='jaco-android-marker-') as temporary:
    directory = Path(temporary)
    kotlin_file = directory / 'Fixture.kt'
    kotlin_file.write_text(fixture)
    classes = directory / 'classes'
    compilation = subprocess.run([
        java, '-cp', os.pathsep.join(map(str, compiler_jars)), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
        '-no-stdlib', '-no-reflect', '-nowarn', '-jvm-target', '17',
        '-classpath', str(stdlib), '-d', str(classes), str(kotlin_file),
    ], capture_output=True, text=True)
    if compilation.returncode:
        sys.stderr.write(compilation.stdout + compilation.stderr)
        raise SystemExit(compilation.returncode)
    result = subprocess.run([java, '-cp', os.pathsep.join((str(classes), str(stdlib))), 'FixtureKt'],
                            capture_output=True, text=True)
    sys.stdout.write(result.stdout)
    if result.returncode:
        sys.stderr.write(result.stderr)
    print('Kotlin bodies SHA256:', hashlib.sha256((methods + download_method).encode()).hexdigest()[:16])
    raise SystemExit(result.returncode)
