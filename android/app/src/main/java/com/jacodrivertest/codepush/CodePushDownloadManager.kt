package com.jacodrivertest.codepush

import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.channels.OverlappingFileLockException
import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardCopyOption.REPLACE_EXISTING
import java.nio.file.StandardOpenOption.CREATE_NEW
import java.nio.file.StandardOpenOption.READ
import java.nio.file.StandardOpenOption.WRITE
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

data class CodePushDownloadResult(
    val status: String,
    val errorCode: String = "",
    val packageId: String = "",
    val version: String = "",
    val nativeRuntimeId: String = "",
    val packageSha256: String = "",
)

class CodePushResponse(
    val statusCode: Int,
    val contentLength: Long?,
    val stream: InputStream,
    val onClose: () -> Unit = {},
) : Closeable {
    override fun close() { try { stream.close() } finally { onClose() } }
}

fun interface CodePushTransport {
    /** timeoutMillis is the remaining time in the bounded operation. */
    fun get(url: String, timeoutMillis: Int): CodePushResponse
}

/** No redirects, supplied credentials, retry loop or arbitrary endpoints. */
class CodePushHttpTransport : CodePushTransport {
    override fun get(url: String, timeoutMillis: Int): CodePushResponse {
        val uri = try { URI(url) } catch (_: Exception) { throw CodePushFailure("url_invalid") }
        cpRequire(uri.scheme == "https" && uri.host == "storage.yandexcloud.net" &&
            uri.port == -1 && uri.userInfo == null && uri.fragment == null &&
            Regex("/jaco-driver-codepush/android/[a-f0-9]{64}/(?:manifest\\.json|releases/[a-f0-9]{64}\\.bundle)")
                .matches(uri.rawPath), "url_source_mismatch")
        val connection = uri.toURL().openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = minOf(15000, timeoutMillis)
        connection.readTimeout = minOf(30000, timeoutMillis)
        connection.useCaches = false
        connection.setRequestProperty("Accept-Encoding", "identity")
        val deadline = timer.schedule({ connection.disconnect() }, timeoutMillis.toLong(), TimeUnit.MILLISECONDS)
        try {
            val status = connection.responseCode
            val header = connection.getHeaderField("Content-Length")
            val length = if (header == null) null else {
                cpRequire(Regex("0|[1-9][0-9]*").matches(header), "content_length_mismatch")
                header.toLongOrNull() ?: throw CodePushFailure("content_length_mismatch")
            }
            cpRequire(status == 200, "http_status_invalid")
            cpRequire(connection.getHeaderField("Content-Encoding").let { it == null || it == "identity" }, "http_encoding_invalid")
            return CodePushResponse(status, length, connection.inputStream) {
                deadline.cancel(false)
                connection.disconnect()
            }
        } catch (failure: Exception) {
            deadline.cancel(false)
            connection.disconnect()
            throw failure
        }
    }

    companion object {
        private val timer = Executors.newSingleThreadScheduledExecutor { task ->
            Thread(task, "CodePush-HTTP-deadline").apply { isDaemon = true }
        }
    }
}

/** Owns candidate files only. It never selects, reloads or executes downloaded JS. */
class CodePushDownloadManager(
    private val privateRoot: File,
    private val runtime: CodePushRuntime,
    private val verifyEnvelope: (ByteArray) -> CodePushManifestVerifier.VerificationResult,
    private val transport: CodePushTransport,
    private val clock: () -> Long = System::currentTimeMillis,
    private val availableBytes: (File) -> Long = { it.usableSpace },
    private val fault: (String) -> Unit = {},
    private val monotonicNanos: () -> Long = System::nanoTime,
) {
    private var started = 0L
    private var temporary: File? = null
    private var knownManifest: CodePushManifest? = null
    private val running = AtomicBoolean(false)
    private val reserve = 16L * 1024 * 1024
    private var operationMillis = 120000L

    fun checkAndDownload(timeoutMillis: Long = 120000): CodePushDownloadResult {
        if (!running.compareAndSet(false, true)) return CodePushDownloadResult("busy", nativeRuntimeId = runtime.nativeRuntimeId)
        // Per-instance serialization is insufficient: the OS lock also covers other modules/processes.
        return try {
            knownManifest = null
            started = monotonicNanos()
            cpRequire(timeoutMillis in 1..120000, "download_timeout")
            operationMillis = timeoutMillis
            cpRequire(runtime.platform == "android" && runtime.appId == "jaco-driver" &&
                CodePushManifestValidator.hashPattern.matches(runtime.nativeRuntimeId), "runtime_invalid")
            directory(privateRoot.parentFile ?: throw CodePushFailure("storage_invalid"), false)
            directory(privateRoot, true)
            val lockPath = File(privateRoot, ".manager.lock").toPath()
            try { Files.createFile(lockPath) } catch (_: java.nio.file.FileAlreadyExistsException) { }
            regular(lockPath.toFile())
            FileChannel.open(lockPath, WRITE, NOFOLLOW_LINKS).use { channel ->
                val lock = try { channel.tryLock() } catch (_: OverlappingFileLockException) { null }
                if (lock == null) return CodePushDownloadResult("busy", nativeRuntimeId = runtime.nativeRuntimeId)
                lock.use { perform() }
            }
        } catch (failure: CodePushFailure) {
            result("error", failure.code)
        } catch (_: java.net.SocketTimeoutException) {
            result("error", "download_timeout")
        } catch (_: java.io.IOException) {
            result("error", if (availableBytes(privateRoot) < reserve) "insufficient_space" else "write_failed")
        } catch (_: Exception) {
            result("error", "operation_failed")
        } finally {
            temporary?.let { cleanupOwnedTemporary(it) }
            temporary = null
            running.set(false)
        }
    }

    private fun perform(): CodePushDownloadResult {
        val versionRoot = File(privateRoot, "v1").also { directory(it, true) }
        val runtimeRoot = File(versionRoot, runtime.nativeRuntimeId).also { directory(it, true) }
        val candidates = File(runtimeRoot, "candidates").also { directory(it, true) }
        cleanupAbandoned(privateRoot, setOf("install-id.json"), false)
        cleanupAbandoned(runtimeRoot, setOf("watermark.json", "candidate.json"), true)
        val installId = installationId()
        val watermark = readWatermark(File(runtimeRoot, "watermark.json"))
        requireSpace(runtimeRoot, 704L * 1024 + 32768)
        val manifestUrl = "https://storage.yandexcloud.net/jaco-driver-codepush/android/${runtime.nativeRuntimeId}/manifest.json"
        val envelope = fetchEnvelope(manifestUrl)
        val verification = verifyEnvelope(envelope)
        cpRequire(verification.isVerified, verification.errorCode ?: "signature_invalid")
        val payload = verification.payloadBytes ?: throw CodePushFailure("signature_invalid")
        val manifest = CodePushManifestValidator.validate(payload, runtime, clock())
        knownManifest = manifest
        val payloadSha = sha256(payload)
        if (watermark != null) {
            cpRequire(manifest.sequence >= watermark.first, "manifest_replayed")
            cpRequire(manifest.sequence != watermark.first || payloadSha == watermark.second, "manifest_sequence_conflict")
        }
        // Persist every admitted signed publication, including stop and nonselected manifests.
        // A failed transfer can retry the same sequence and identical payload.
        atomicWrite(File(runtimeRoot, "watermark.json"),
            "{\"manifestSequence\":${manifest.sequence},\"payloadSha256\":\"$payloadSha\"}\n".toByteArray(), "watermark")
        if (!manifest.enabled) return result("disabled")
        if (!selected(installId, manifest)) return result("not_selected")
        val candidate = File(candidates, "${manifest.sha256}-$payloadSha")
        if (Files.exists(candidate.toPath(), NOFOLLOW_LINKS)) {
            verifyCandidate(candidate, manifest, payloadSha)
            atomicWrite(File(runtimeRoot, "candidate.json"), pointer(manifest, payloadSha), "candidate_pointer")
            return result("already_downloaded")
        }
        requireSpace(runtimeRoot, manifest.size + envelope.size + 32768L)
        val stage = File(runtimeRoot, ".download-${UUID.randomUUID()}")
        Files.createDirectory(stage.toPath())
        temporary = stage
        fault("temporary_created")
        downloadBundle(manifest, File(stage, manifest.entrypoint), runtimeRoot)
        writeNew(File(stage, "manifest.json"), envelope)
        writeNew(File(stage, "metadata.json"), metadata(manifest, payloadSha))
        syncDirectory(stage)
        fault("before_candidate_commit")
        cpRequire(!Files.exists(candidate.toPath(), NOFOLLOW_LINKS), "candidate_invalid")
        Files.move(stage.toPath(), candidate.toPath(), ATOMIC_MOVE)
        temporary = null
        syncDirectory(candidates)
        fault("candidate_committed")
        atomicWrite(File(runtimeRoot, "candidate.json"), pointer(manifest, payloadSha), "candidate_pointer")
        return result("downloaded")
    }

    private fun fetchEnvelope(url: String): ByteArray {
        try {
            transport.get(url, remainingMillis()).use { response ->
                cpRequire(response.statusCode == 200, "http_status_invalid")
                cpRequire(response.contentLength == null || response.contentLength >= 0, "content_length_mismatch")
                cpRequire(response.contentLength == null || response.contentLength <= 704L * 1024, "input_too_large")
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    remainingMillis()
                    val count = response.stream.read(buffer)
                    remainingMillis()
                    if (count == -1) break
                    cpRequire(output.size() + count <= 704 * 1024, "input_too_large")
                    output.write(buffer, 0, count)
                }
                cpRequire(response.contentLength == null || response.contentLength == output.size().toLong(), "content_length_mismatch")
                return output.toByteArray()
            }
        } catch (failure: CodePushFailure) { throw failure }
        catch (_: java.net.SocketTimeoutException) { throw CodePushFailure("download_timeout") }
        catch (_: java.io.IOException) { throw CodePushFailure(if (remainingMillisOrZero() == 0) "download_timeout" else "network_error") }
    }

    private fun downloadBundle(manifest: CodePushManifest, target: File, diskRoot: File) {
        try {
            transport.get(manifest.url, remainingMillis()).use { response ->
                cpRequire(response.statusCode == 200, "http_status_invalid")
                cpRequire(response.contentLength == null || response.contentLength == manifest.size, "content_length_mismatch")
                val digest = MessageDigest.getInstance("SHA-256")
                var size = 0L
                try { FileChannel.open(target.toPath(), CREATE_NEW, WRITE, NOFOLLOW_LINKS).use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        remainingMillis()
                        val count = try { response.stream.read(buffer) }
                        catch (_: java.net.SocketTimeoutException) { throw CodePushFailure("download_timeout") }
                        catch (_: java.io.IOException) { throw CodePushFailure(if (remainingMillisOrZero() == 0) "download_timeout" else "network_error") }
                        remainingMillis()
                        if (count == -1) break
                        size += count
                        cpRequire(size <= manifest.size && size <= 128L * 1024 * 1024, "download_too_large")
                        cpRequire(availableBytes(diskRoot) >= reserve + count, "insufficient_space")
                        digest.update(buffer, 0, count)
                        val bytes = ByteBuffer.wrap(buffer, 0, count)
                        while (bytes.hasRemaining()) output.write(bytes)
                        fault("bundle_chunk_written")
                    }
                    cpRequire(size == manifest.size, "size_mismatch")
                    cpRequire(hex(digest.digest()) == manifest.sha256, "hash_mismatch")
                    output.force(true)
                } } catch (_: java.io.IOException) {
                    throw CodePushFailure(if (availableBytes(diskRoot) < reserve) "insufficient_space" else "write_failed")
                }
            }
        } catch (failure: CodePushFailure) { throw failure }
        catch (_: java.net.SocketTimeoutException) { throw CodePushFailure("download_timeout") }
        catch (_: java.io.IOException) { throw CodePushFailure(if (remainingMillisOrZero() == 0) "download_timeout" else "network_error") }
    }

    private fun verifyCandidate(candidate: File, manifest: CodePushManifest, payloadSha: String) {
        directory(candidate, false)
        cpRequire(candidate.list()?.toSet() == setOf(manifest.entrypoint, "manifest.json", "metadata.json"), "candidate_invalid")
        val storedMetadata = boundedRead(File(candidate, "metadata.json"), 8192)
        cpRequire(storedMetadata.contentEquals(metadata(manifest, payloadSha)), "candidate_invalid")
        val stored = verifyEnvelope(boundedRead(File(candidate, "manifest.json"), 704 * 1024))
        cpRequire(stored.isVerified && stored.payloadBytes?.let { sha256(it) == payloadSha } == true, "candidate_invalid")
        val bundle = File(candidate, manifest.entrypoint)
        regular(bundle)
        cpRequire(bundle.length() == manifest.size, "size_mismatch")
        val digest = MessageDigest.getInstance("SHA-256")
        FileChannel.open(bundle.toPath(), READ, NOFOLLOW_LINKS).use { channel ->
            val buffer = ByteBuffer.allocate(64 * 1024)
            var size = 0L
            while (true) {
                remainingMillis()
                val count = channel.read(buffer)
                if (count == -1) break
                size += count
                cpRequire(size <= manifest.size, "size_mismatch")
                buffer.flip()
                digest.update(buffer)
                buffer.clear()
            }
            cpRequire(size == manifest.size && hex(digest.digest()) == manifest.sha256, "hash_mismatch")
        }
    }

    private fun installationId(): String {
        val file = File(privateRoot, "install-id.json")
        if (Files.exists(file.toPath(), NOFOLLOW_LINKS)) {
            try {
                val data = CodePushManifestValidator.record(CodePushJson.parse(boundedRead(file, 1024)), setOf("installId"))
                return CodePushManifestValidator.text(data["installId"], Regex("[a-f0-9]{32}"))
            } catch (_: Exception) { throw CodePushFailure("state_invalid") }
        }
        val id = hex(ByteArray(16).also { SecureRandom().nextBytes(it) })
        atomicWrite(file, "{\"installId\":\"$id\"}\n".toByteArray(), "install_id")
        return id
    }

    private fun readWatermark(file: File): Pair<Long, String>? {
        if (!Files.exists(file.toPath(), NOFOLLOW_LINKS)) return null
        try {
            val data = CodePushManifestValidator.record(CodePushJson.parse(boundedRead(file, 4096)), setOf("manifestSequence", "payloadSha256"))
            return CodePushManifestValidator.integer(data["manifestSequence"], 1, CodePushJson.MAX_SAFE_INTEGER) to
                CodePushManifestValidator.text(data["payloadSha256"], CodePushManifestValidator.hashPattern)
        } catch (_: Exception) { throw CodePushFailure("state_invalid") }
    }

    private fun selected(id: String, manifest: CodePushManifest): Boolean {
        val hash = MessageDigest.getInstance("SHA-256").digest(
            "jaco-driver-codepush-rollout-v1\n$id\n${runtime.appId}\n${manifest.rolloutSeed}".toByteArray(Charsets.UTF_8))
        val slot = ((hash[0].toLong() and 255) shl 24) or ((hash[1].toLong() and 255) shl 16) or
            ((hash[2].toLong() and 255) shl 8) or (hash[3].toLong() and 255)
        return slot % 10000 < manifest.rolloutBasisPoints
    }

    private fun pointer(m: CodePushManifest, payload: String) =
        "{\"packageSha256\":\"${m.sha256}\",\"payloadSha256\":\"$payload\"}\n".toByteArray()
    private fun metadata(m: CodePushManifest, payload: String) =
        "{\"manifestSequence\":${m.sequence},\"nativeRuntimeId\":\"${runtime.nativeRuntimeId}\",\"packageSha256\":\"${m.sha256}\",\"payloadSha256\":\"$payload\",\"size\":${m.size},\"version\":\"${m.version}\"}\n".toByteArray()

    private fun result(status: String, error: String = ""): CodePushDownloadResult {
        val m = knownManifest
        return CodePushDownloadResult(status, error, m?.packageId ?: "", m?.version ?: "", runtime.nativeRuntimeId, m?.sha256 ?: "")
    }

    private fun remainingMillisOrZero(): Int {
        val elapsed = monotonicNanos() - started
        if (Thread.currentThread().isInterrupted || elapsed < 0) return 0
        return (operationMillis - elapsed / 1_000_000).coerceIn(0, operationMillis).toInt()
    }
    private fun remainingMillis(): Int {
        val remaining = remainingMillisOrZero()
        cpRequire(remaining > 0, "download_timeout")
        return remaining
    }
    private fun requireSpace(where: File, bytes: Long) { cpRequire(availableBytes(where) >= bytes + reserve, "insufficient_space") }

    private fun directory(file: File, create: Boolean) {
        if (!Files.exists(file.toPath(), NOFOLLOW_LINKS) && create) {
            try { Files.createDirectory(file.toPath()) } catch (_: java.nio.file.FileAlreadyExistsException) { }
        }
        cpRequire(Files.isDirectory(file.toPath(), NOFOLLOW_LINKS) && !Files.isSymbolicLink(file.toPath()), "storage_invalid")
    }
    private fun regular(file: File) {
        cpRequire(Files.isRegularFile(file.toPath(), NOFOLLOW_LINKS) && !Files.isSymbolicLink(file.toPath()), "storage_invalid")
    }
    private fun boundedRead(file: File, max: Int): ByteArray {
        regular(file)
        FileChannel.open(file.toPath(), READ, NOFOLLOW_LINKS).use { channel ->
            cpRequire(channel.size() in 1..max.toLong(), "storage_invalid")
            val output = ByteArrayOutputStream()
            val buffer = ByteBuffer.allocate(8192)
            while (true) {
                val count = channel.read(buffer)
                if (count == -1) break
                cpRequire(output.size() + count <= max, "storage_invalid")
                output.write(buffer.array(), 0, count)
                buffer.clear()
            }
            return output.toByteArray()
        }
    }
    private fun writeNew(file: File, bytes: ByteArray) {
        FileChannel.open(file.toPath(), CREATE_NEW, WRITE, NOFOLLOW_LINKS).use { channel ->
            val buffer = ByteBuffer.wrap(bytes)
            while (buffer.hasRemaining()) channel.write(buffer)
            channel.force(true)
        }
    }
    private fun atomicWrite(file: File, bytes: ByteArray, label: String) {
        val parent = file.parentFile ?: throw CodePushFailure("storage_invalid")
        if (Files.exists(file.toPath(), NOFOLLOW_LINKS)) regular(file)
        val tmp = File(parent, ".${file.name}-${UUID.randomUUID()}.tmp")
        var owned = false
        try {
            FileChannel.open(tmp.toPath(), CREATE_NEW, WRITE, NOFOLLOW_LINKS).use { channel ->
                owned = true
                val buffer = ByteBuffer.wrap(bytes)
                while (buffer.hasRemaining()) channel.write(buffer)
                channel.force(true)
            }
            fault("${label}_before_commit")
            Files.move(tmp.toPath(), file.toPath(), ATOMIC_MOVE, REPLACE_EXISTING)
            owned = false
            syncDirectory(parent)
            fault("${label}_committed")
        } finally { if (owned) Files.deleteIfExists(tmp.toPath()) }
    }
    private fun syncDirectory(file: File) { FileChannel.open(file.toPath(), READ).use { it.force(true) } }
    private fun cleanupOwnedTemporary(file: File) {
        try {
            cleanDownloadDirectory(file)
        } catch (_: Exception) { /* A failed cleanup never touches other candidates. */ }
    }
    private fun cleanupAbandoned(parent: File, records: Set<String>, downloads: Boolean) {
        for (entry in parent.listFiles() ?: throw CodePushFailure("storage_invalid")) {
            if (downloads && Regex("\\.download-$uuidPattern").matches(entry.name)) {
                cleanDownloadDirectory(entry)
            } else if (records.any { Regex("\\.${Regex.escape(it)}-$uuidPattern\\.tmp").matches(entry.name) }) {
                // A lock is held; a regular temporary record cannot belong to a live writer.
                if (Files.isRegularFile(entry.toPath(), NOFOLLOW_LINKS) && !Files.isSymbolicLink(entry.toPath())) {
                    Files.delete(entry.toPath())
                    syncDirectory(parent)
                }
            }
        }
    }
    private fun cleanDownloadDirectory(file: File) {
        val parent = file.parentFile ?: throw CodePushFailure("storage_invalid")
        if (!Files.isDirectory(file.toPath(), NOFOLLOW_LINKS) || Files.isSymbolicLink(file.toPath())) return
        val children = file.listFiles() ?: return
        val allowed = setOf("index.android.bundle", "manifest.json", "metadata.json")
        // Unknown children or links are preserved in their entirety, including their directory.
        if (children.any { it.name !in allowed || !Files.isRegularFile(it.toPath(), NOFOLLOW_LINKS) || Files.isSymbolicLink(it.toPath()) }) return
        children.forEach { Files.delete(it.toPath()) }
        Files.delete(file.toPath())
        syncDirectory(parent)
    }
    companion object {
        private const val uuidPattern = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
        private fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
        private fun sha256(bytes: ByteArray): String = hex(MessageDigest.getInstance("SHA-256").digest(bytes))
    }
}
