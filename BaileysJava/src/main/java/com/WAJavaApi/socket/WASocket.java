package com.WAJavaApi.socket;

import com.WAJavaApi.binary.*;
import com.WAJavaApi.crypto.CryptoUtils;
import com.WAJavaApi.crypto.CurveUtils;
import com.WAJavaApi.crypto.PairingUtils;
import com.WAJavaApi.noise.NoiseHandler;
import com.WAJavaApi.proto.WAProto;
import com.google.protobuf.ByteString;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

/**
 * WASocket - Real WhatsApp Multi-Device WebSocket connection.
 * Implements Noise_XX_25519_AESGCM_SHA256 handshake, server-driven QR code,
 * keep-alive, and encrypted binary node messaging.
 *
 * Java port of Baileys src/Socket/socket.ts
 */
public class WASocket {

    private static final Logger logger = LoggerFactory.getLogger(WASocket.class);

    public enum ConnectionState { CONNECTING, OPEN, CLOSING, CLOSED }

    private WAWebSocketClient ws;
    private NoiseHandler noise;
    private CurveUtils.KeyPair ephemeralKeyPair;

    private final AtomicInteger epoch = new AtomicInteger(1);
    private final String tagPrefix;
    private final Map<String, CompletableFuture<BinaryNode>> pendingQueries = new ConcurrentHashMap<>();

    // Handshake synchronization: raw bytes arrive here during handshake
    private final BlockingQueue<byte[]> handshakeQueue = new LinkedBlockingQueue<>();
    private volatile boolean handshakeComplete = false;

    private ScheduledExecutorService keepAliveExecutor;
    private ScheduledFuture<?> keepAliveFuture;
    private ScheduledFuture<?> qrRefreshFuture;
    private volatile ConnectionState state = ConnectionState.CLOSED;
    private volatile long lastDateRecv = System.currentTimeMillis();

    private AuthState authState;
    private String browserName = "Chatin";

    // QR state
    private List<String> qrRefs = new ArrayList<>();
    private int qrRefIndex = 0;

    // Timeouts
    private static final int CONNECT_TIMEOUT_MS = 20000;
    private static final int KEEP_ALIVE_INTERVAL_MS = 30000;
    private static final int DEFAULT_QUERY_TIMEOUT_MS = 60000;
    private static final int QR_FIRST_TIMEOUT_MS = 60000;
    private static final int QR_TIMEOUT_MS = 20000;

    // Event consumers
    private Consumer<String> onQrCode;
    private Consumer<Map<String, Object>> onConnectionUpdate;
    private Consumer<Map<String, Object>> onCredsUpdate;
    private Consumer<BinaryNode> onMessage;

    public WASocket() {
        this.tagPrefix = generateTagPrefix();
    }

    public WASocket(String browserName) {
        this.tagPrefix = generateTagPrefix();
        this.browserName = browserName;
    }

    // =========== Auth Data Classes ===========

    public static class AuthState {
        public AuthCreds creds;
        public AuthKeys keys;
    }

    public static class AuthCreds {
        public CurveUtils.KeyPair noiseKey;
        public CurveUtils.KeyPair signedIdentityKey;
        public CurveUtils.KeyPair pairingEphemeralKeyPair;
        public String advSecretKey;
        public int registrationId;
        public int nextPreKeyId;
        public int firstUnuploadedPreKeyId;
        public CurveUtils.SignedKeyPair signedPreKey;
        public UserInfo me;
        public byte[] routingInfo;
        public String pairingCode;
        public String platform;

        // ADV account identity (set after successful pairing)
        public AccountInfo account;

        // Signal identities for E2E encryption
        public List<SignalIdentity> signalIdentities = new ArrayList<>();

        // Sync and state tracking
        public List<Object> processedHistoryMessages = new ArrayList<>();
        public int accountSyncCounter = 0;
        public AccountSettings accountSettings = new AccountSettings();
        public int lastAccountSyncTimestamp = 0;
        public String lastPropHash;
        public String myAppStateKeyId;

        public static class UserInfo {
            public String id;
            public String name;
            public String lid;
        }

        public static class AccountInfo {
            public byte[] details;
            public byte[] accountSignatureKey;
            public byte[] accountSignature;
            public byte[] deviceSignature;
        }

        public static class SignalIdentity {
            public byte[] identifierKey;
            public SignalIdentifier identifier;

            public static class SignalIdentifier {
                public String name;
                public int deviceId;
            }
        }

        public static class AccountSettings {
            public boolean unarchiveChats = false;
        }
    }

    public interface AuthKeys {
        Map<String, Object> get(String type, List<String> ids);
        void set(Map<String, Object> data);
    }

    // =========== Connection ===========

    /**
     * Start WhatsApp connection and perform Noise handshake.
     */
    public void connect(AuthState authState) throws Exception {
        this.authState = authState;
        this.state = ConnectionState.CONNECTING;
        this.handshakeComplete = false;
        this.qrRefs.clear();
        this.qrRefIndex = 0;

        // Emit connecting state
        if (onConnectionUpdate != null) {
            onConnectionUpdate.accept(Map.of("connection", "connecting"));
        }

        // Generate ephemeral key pair for this session
        ephemeralKeyPair = CurveUtils.generateKeyPair();

        // Initialize Noise handler
        noise = new NoiseHandler(
                ephemeralKeyPair.getPrivateKey(),
                ephemeralKeyPair.getPublicKey(),
                BinaryConstants.NOISE_WA_HEADER,
                authState.creds != null ? authState.creds.routingInfo : null
        );

        // Build WebSocket URL
        String wsUrl = BinaryConstants.WA_WEB_SOCKET_URL;
        if (authState.creds != null && authState.creds.routingInfo != null) {
            wsUrl += "?ED=" + Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(authState.creds.routingInfo);
        }

        ws = new WAWebSocketClient(new URI(wsUrl));

        // Single unified message handler - routes based on handshake state
        ws.on("message", data -> {
            lastDateRecv = System.currentTimeMillis();
            byte[] bytes = (byte[]) data;

            if (!handshakeComplete) {
                // During handshake: put raw bytes into the queue
                handshakeQueue.offer(bytes);
            } else {
                // After handshake: decrypt and process as BinaryNode
                try {
                    noise.decodeFrame(bytes, frame -> {
                        if (frame instanceof BinaryNode node) {
                            handleDecryptedNode(node);
                        }
                    });
                } catch (Exception e) {
                    logger.error("Error decrypting message: {}", e.getMessage());
                }
            }
        });

        ws.on("open", data -> {
            // Run handshake in a separate thread so we can block-wait for responses
            CompletableFuture.runAsync(() -> {
                try {
                    performNoiseHandshake();
                } catch (Exception e) {
                    logger.error("Noise handshake failed: {}", e.getMessage(), e);
                    end(e);
                }
            });
        });

        ws.on("close", data -> end(new RuntimeException("WebSocket closed")));
        ws.on("error", data -> end((Exception) data));

        logger.info("Connecting to WhatsApp WebSocket...");
        ws.connectBlocking(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS);
    }

    // =========== Noise XX Handshake (3-way) ===========

    /**
     * Full Noise_XX_25519_AESGCM_SHA256 handshake:
     *   1. Client -> Server: ClientHello {ephemeral public key}
     *   2. Server -> Client: ServerHello {ephemeral, static(enc), payload(enc)}
     *   3. Client -> Server: ClientFinish {static(enc noise key), payload(enc ClientPayload)}
     */
    private void performNoiseHandshake() throws Exception {
        logger.info("Starting Noise XX handshake...");

        // ---- Step 1: Send ClientHello ----
        WAProto.HandshakeMessage clientHello = WAProto.HandshakeMessage.newBuilder()
                .setClientHello(
                        WAProto.HandshakeMessage.ClientHello.newBuilder()
                                .setEphemeral(ByteString.copyFrom(ephemeralKeyPair.getPublicKey()))
                                .build()
                )
                .build();

        byte[] encodedHello = noise.encodeFrame(clientHello.toByteArray());
        ws.sendBinary(encodedHello);
        logger.info("ClientHello sent, waiting for ServerHello...");

        // ---- Step 2: Wait for and process ServerHello ----
        byte[] serverHelloRawFrame = handshakeQueue.poll(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        if (serverHelloRawFrame == null) {
            throw new RuntimeException("Timeout waiting for ServerHello");
        }

        // Decode the frame through noise (at this stage noise strips the 3-byte length header)
        CompletableFuture<byte[]> decodedFuture = new CompletableFuture<>();
        noise.decodeFrame(serverHelloRawFrame, frame -> {
            if (frame instanceof byte[] rawBytes) {
                decodedFuture.complete(rawBytes);
            }
        });

        byte[] serverHelloBytes = decodedFuture.get(5, TimeUnit.SECONDS);

        WAProto.HandshakeMessage serverHelloMsg = WAProto.HandshakeMessage.parseFrom(serverHelloBytes);

        // Process full handshake with certificate verification
        byte[] encryptedNoiseKey = noise.processHandshake(
                serverHelloMsg,
                authState.creds.noiseKey.getPrivateKey(),
                authState.creds.noiseKey.getPublicKey()
        );

        // ---- Step 3: Send ClientFinish ----
        // Build client payload based on whether we have existing session
        byte[] clientPayloadBytes;
        if (authState.creds.me == null) {
            logger.info("Not logged in, attempting registration...");
            clientPayloadBytes = PairingUtils.generateRegistrationPayload(authState.creds, browserName);
        } else {
            logger.info("Logging in as: {}", authState.creds.me.id);
            clientPayloadBytes = PairingUtils.generateLoginPayload(authState.creds);
        }

        byte[] encryptedPayload = noise.encrypt(clientPayloadBytes);

        WAProto.HandshakeMessage clientFinish = WAProto.HandshakeMessage.newBuilder()
                .setClientFinish(
                        WAProto.HandshakeMessage.ClientFinish.newBuilder()
                                .setStatic(ByteString.copyFrom(encryptedNoiseKey))
                                .setPayload(ByteString.copyFrom(encryptedPayload))
                                .build()
                )
                .build();

        byte[] encodedFinish = noise.encodeFrame(clientFinish.toByteArray());
        ws.sendBinary(encodedFinish);

        // Finalize noise state: split into separate read/write keys
        noise.finishInit();
        handshakeComplete = true;

        logger.info("Noise handshake completed. Encryption established.");

        // Start keep-alive
        startKeepAlive();
    }

    // =========== Decrypted Message Handling ===========

    /**
     * Handle decrypted BinaryNode messages from WhatsApp server.
     * Implements Baileys-style event routing with prefix-based callbacks.
     */
    private void handleDecryptedNode(BinaryNode node) {
        String msgId = node.getAttr("id");

        // Response to pending query (TAG: prefix in Baileys)?
        if (msgId != null) {
            CompletableFuture<BinaryNode> pending = pendingQueries.get(msgId);
            if (pending != null) {
                pending.complete(node);
                // Don't return - also route through CB handlers
            }
        }

        String tag = node.getTag();
        Map<String, String> attrs = node.getAttrs();

        // Get first child tag for deeper matching
        String childTag = "";
        if (node.getContent() instanceof List<?> children && !children.isEmpty()) {
            Object first = children.get(0);
            if (first instanceof BinaryNode childNode) {
                childTag = childNode.getTag();
            }
        }

        // Route: xmlstreamend
        if ("xmlstreamend".equals(tag)) {
            end(new RuntimeException("Connection Terminated by Server"));
            return;
        }

        // Route: pair-device (QR code generation - server-driven)
        if ("iq".equals(tag) && "set".equals(node.getAttr("type"))) {
            BinaryNode pairDevice = findChild(node, "pair-device");
            if (pairDevice != null) {
                handlePairDevice(node, pairDevice);
                return;
            }
        }

        // Route: pair-success (device paired for the first time)
        if ("iq".equals(tag) && findChild(node, "pair-success") != null) {
            handlePairSuccess(node);
            return;
        }

        // Route: success (login complete)
        if ("success".equals(tag)) {
            handleLoginSuccess(node);
            return;
        }

        // Route: failure
        if ("failure".equals(tag)) {
            String reason = node.getAttr("reason");
            int statusCode = 500;
            try { statusCode = Integer.parseInt(reason); } catch (Exception ignored) {}
            logger.error("Connection failure: {}", reason);
            end(new RuntimeException("Connection Failure: " + reason));
            return;
        }

        // Route: stream:error
        if ("stream:error".equals(tag)) {
            String code = node.getAttr("code");
            // Log child nodes for more detail
            String childInfo = "";
            if (node.getContent() instanceof List<?> children) {
                for (Object child : children) {
                    if (child instanceof BinaryNode cn) {
                        childInfo += cn.getTag() + "(attrs=" + cn.getAttrs() + ") ";
                    }
                }
            }
            logger.error("Stream error: code={}, attrs={}, children=[{}], raw={}", 
                    code, attrs, childInfo, node);
            end(new RuntimeException("Stream Error (code=" + (code != null ? code : "unknown") + ")"));
            return;
        }

        // Route: ib (info block) - handle edge_routing and offline
        if ("ib".equals(tag)) {
            BinaryNode edgeRouting = findChild(node, "edge_routing");
            if (edgeRouting != null) {
                BinaryNode routingInfo = findChild(edgeRouting, "routing_info");
                if (routingInfo != null && routingInfo.getContent() instanceof byte[] ri) {
                    authState.creds.routingInfo = ri;
                    if (onCredsUpdate != null) {
                        onCredsUpdate.accept(Map.of("creds", authState.creds));
                    }
                }
            }

            BinaryNode offline = findChild(node, "offline");
            if (offline != null) {
                String offlineCount = offline.getAttr("count");
                logger.info("Handled {} offline messages/notifications", offlineCount);
            }
            return;
        }

        // Route to generic handler
        if (onMessage != null) {
            onMessage.accept(node);
        }

        // Auto-ack unhandled server IQ stanzas (type=set or type=get)
        // Baileys routes these through its CB: callback system, but we must at least
        // send a result ack back so the server doesn't drop us with stream:error 500
        if ("iq".equals(tag)) {
            String iqType = node.getAttr("type");
            String iqId = node.getAttr("id");
            String xmlns = node.getAttr("xmlns");
            if (("set".equals(iqType) || "get".equals(iqType)) && iqId != null) {
                logger.debug("Auto-acking unhandled IQ: type={}, xmlns={}, childTag={}, id={}", 
                        iqType, xmlns, childTag, iqId);
                try {
                    BinaryNode resultAck = new BinaryNode("iq", Map.of(
                            "to", JidUtils.S_WHATSAPP_NET,
                            "type", "result",
                            "id", iqId
                    ));
                    sendNode(resultAck);
                } catch (Exception e) {
                    logger.error("Failed to auto-ack IQ {}: {}", iqId, e.getMessage());
                }
            }
        }
    }

    // =========== Server-Driven QR Code Flow ===========

    /**
     * Handle pair-device stanza from server.
     * Server sends ref nodes which we use to build QR strings.
     * This matches Baileys CB:iq,type:set,pair-device handler.
     */
    private void handlePairDevice(BinaryNode stanza, BinaryNode pairDeviceNode) {
        // Send acknowledgement
        try {
            BinaryNode ack = new BinaryNode("iq", Map.of(
                    "to", JidUtils.S_WHATSAPP_NET,
                    "type", "result",
                    "id", stanza.getAttr("id")
            ));
            sendNode(ack);
        } catch (Exception e) {
            logger.error("Failed to send pair-device ack: {}", e.getMessage());
        }

        // Extract ref nodes
        qrRefs.clear();
        qrRefIndex = 0;
        if (pairDeviceNode.getContent() instanceof List<?> children) {
            for (Object child : children) {
                if (child instanceof BinaryNode refNode && "ref".equals(refNode.getTag())) {
                    Object content = refNode.getContent();
                    if (content instanceof byte[] bytes) {
                        qrRefs.add(new String(bytes, StandardCharsets.UTF_8));
                    } else if (content instanceof String s) {
                        qrRefs.add(s);
                    }
                }
            }
        }

        logger.info("Received {} QR refs from server", qrRefs.size());

        // Generate first QR
        generateAndEmitQr();

        // Schedule subsequent QR refreshes with timer
        if (keepAliveExecutor == null || keepAliveExecutor.isShutdown()) {
            keepAliveExecutor = Executors.newSingleThreadScheduledExecutor();
        }

        // First QR lives longer (60s), subsequent ones are 20s
        qrRefreshFuture = keepAliveExecutor.scheduleAtFixedRate(() -> {
            qrRefIndex++;
            if (qrRefIndex >= qrRefs.size()) {
                logger.warn("QR refs exhausted ({}/{}), closing connection", qrRefIndex, qrRefs.size());
                end(new RuntimeException("QR code scan timeout"));
                return;
            }
            generateAndEmitQr();
        }, QR_FIRST_TIMEOUT_MS, QR_TIMEOUT_MS, TimeUnit.MILLISECONDS);
    }

    /**
     * Generate QR string from current ref and emit to listener.
     * QR format: ref,base64(noisePublicKey),base64(identityPublicKey),advSecretKey
     */
    private void generateAndEmitQr() {
        if (qrRefIndex >= qrRefs.size()) return;

        try {
            AuthCreds creds = authState.creds;
            String ref = qrRefs.get(qrRefIndex);
            String noiseKeyB64 = Base64.getEncoder().encodeToString(creds.noiseKey.getPublicKey());
            String identityKeyB64 = Base64.getEncoder().encodeToString(creds.signedIdentityKey.getPublicKey());
            String advSecret = creds.advSecretKey;

            String qrString = ref + "," + noiseKeyB64 + "," + identityKeyB64 + "," + advSecret;

            logger.info("QR code generated (ref {}/{})", qrRefIndex + 1, qrRefs.size());

            if (onQrCode != null) {
                onQrCode.accept(qrString);
            }

            // Also emit via connection.update like Baileys
            if (onConnectionUpdate != null) {
                Map<String, Object> update = new HashMap<>();
                update.put("qr", qrString);
                onConnectionUpdate.accept(update);
            }
        } catch (Exception e) {
            logger.error("Failed to generate QR code: {}", e.getMessage());
        }
    }

    private void stopQrLoop() {
        if (qrRefreshFuture != null) qrRefreshFuture.cancel(true);
    }

    // =========== Pairing Success ===========

    /**
     * Handle pair-success stanza - device paired for the first time.
     * Uses PairingUtils.configureSuccessfulPairing to verify ADV signatures.
     */
    private void handlePairSuccess(BinaryNode stanza) {
        logger.info("Pair success received!");
        stopQrLoop();

        try {
            PairingUtils.PairingResult result = PairingUtils.configureSuccessfulPairing(stanza, authState.creds);

            // Update creds
            authState.creds = result.creds;
            logger.info("Pairing configured for: {} (platform: {})",
                    result.creds.me.id, result.creds.platform);

            // Emit creds update
            if (onCredsUpdate != null) {
                onCredsUpdate.accept(Map.of("creds", authState.creds));
            }

            // Emit connection update (isNewLogin)
            if (onConnectionUpdate != null) {
                Map<String, Object> update = new HashMap<>();
                update.put("isNewLogin", true);
                onConnectionUpdate.accept(update);
            }

            // Send reply
            sendNode(result.reply);
        } catch (Exception e) {
            logger.error("Error in pairing: {}", e.getMessage(), e);
            end(e);
        }
    }

    // =========== Login Success ===========

    /**
     * Handle success stanza - login completed.
     * Equivalent to Baileys CB:success handler.
     */
    private void handleLoginSuccess(BinaryNode node) {
        logger.info("Login successful!");
        stopQrLoop();

        // Update LID if present
        String lid = node.getAttr("lid");
        if (lid != null && authState.creds.me != null) {
            authState.creds.me.lid = lid;
        }

        // Emit creds update
        if (onCredsUpdate != null) {
            onCredsUpdate.accept(Map.of("creds", authState.creds));
        }

        // Send passive IQ (tell server we're active)
        try {
            sendPassiveIq("active");
        } catch (Exception e) {
            logger.warn("Failed to send passive IQ: {}", e.getMessage());
        }

        state = ConnectionState.OPEN;
        if (onConnectionUpdate != null) {
            onConnectionUpdate.accept(Map.of("connection", "open"));
        }
    }

    /**
     * Send passive/active IQ to WhatsApp server.
     */
    private void sendPassiveIq(String tag) throws Exception {
        query(new BinaryNode("iq", Map.of(
                "to", JidUtils.S_WHATSAPP_NET,
                "xmlns", "passive",
                "type", "set"
        ), List.of(new BinaryNode(tag, Map.of()))));
    }

    // =========== Sending ===========

    public BinaryNode query(BinaryNode node) throws Exception {
        return query(node, DEFAULT_QUERY_TIMEOUT_MS);
    }

    public BinaryNode query(BinaryNode node, int timeoutMs) throws Exception {
        // Ensure attrs is mutable (Map.of() produces immutable maps)
        if (node.getAttrs() == null) {
            node.setAttrs(new HashMap<>());
        } else {
            try { node.getAttrs().put("__test__", ""); node.getAttrs().remove("__test__"); }
            catch (UnsupportedOperationException e) { node.setAttrs(new HashMap<>(node.getAttrs())); }
        }
        if (node.getAttr("id") == null) node.getAttrs().put("id", generateMessageTag());

        String msgId = node.getAttr("id");
        CompletableFuture<BinaryNode> future = new CompletableFuture<>();
        pendingQueries.put(msgId, future);

        try {
            sendNode(node);
            return future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            logger.warn("Query timed out: {}", msgId);
            return null;
        } finally {
            pendingQueries.remove(msgId);
        }
    }

    public void sendNode(BinaryNode node) throws Exception {
        byte[] encoded = BinaryEncoder.encode(node);
        sendRaw(encoded);
    }

    private void sendRaw(byte[] data) throws Exception {
        if (ws == null || !ws.isConnected()) throw new RuntimeException("Connection closed");
        byte[] encrypted = noise.encodeFrame(data);
        ws.sendBinary(encrypted);
    }

    // =========== Keep-Alive ===========

    private void startKeepAlive() {
        if (keepAliveExecutor == null || keepAliveExecutor.isShutdown()) {
            keepAliveExecutor = Executors.newSingleThreadScheduledExecutor();
        }
        keepAliveFuture = keepAliveExecutor.scheduleAtFixedRate(() -> {
            long diff = System.currentTimeMillis() - lastDateRecv;
            if (diff > KEEP_ALIVE_INTERVAL_MS + 5000) {
                end(new RuntimeException("Connection lost - no response"));
                return;
            }

            if (ws != null && ws.isConnected()) {
                try {
                    BinaryNode ping = new BinaryNode("iq", Map.of(
                            "id", generateMessageTag(),
                            "to", JidUtils.S_WHATSAPP_NET,
                            "type", "get",
                            "xmlns", "w:p"
                    ), List.of(new BinaryNode("ping", Map.of())));
                    query(ping);
                } catch (Exception e) {
                    logger.error("Keep-alive error: {}", e.getMessage());
                }
            }
        }, KEEP_ALIVE_INTERVAL_MS, KEEP_ALIVE_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    // =========== Lifecycle ===========

    public void end(Exception error) {
        if (state == ConnectionState.CLOSED) return;
        state = ConnectionState.CLOSED;

        if (error != null) logger.info("Connection ended: {}", error.getMessage());

        stopQrLoop();
        if (keepAliveFuture != null) keepAliveFuture.cancel(true);
        if (keepAliveExecutor != null) keepAliveExecutor.shutdown();
        if (ws != null) { try { ws.close(); } catch (Exception ignored) {} }

        if (onConnectionUpdate != null) {
            Map<String, Object> update = new HashMap<>();
            update.put("connection", "close");
            if (error != null) {
                update.put("lastDisconnect", Map.of("error", error.getMessage(), "date", new Date()));
            }
            onConnectionUpdate.accept(update);
        }

        pendingQueries.values().forEach(f -> f.completeExceptionally(new RuntimeException("Connection closed")));
        pendingQueries.clear();
    }

    public void logout() throws Exception {
        if (authState.creds != null && authState.creds.me != null) {
            sendNode(new BinaryNode("iq", Map.of(
                    "to", JidUtils.S_WHATSAPP_NET,
                    "type", "set",
                    "id", generateMessageTag(),
                    "xmlns", "md"
            ), List.of(new BinaryNode("remove-companion-device", Map.of(
                    "jid", authState.creds.me.id,
                    "reason", "user_initiated"
            )))));
        }
        end(new RuntimeException("Intentional Logout"));
    }

    /**
     * Request a pairing code for phone-number-based linking.
     */
    public String requestPairingCode(String phoneNumber) throws Exception {
        return requestPairingCode(phoneNumber, null);
    }

    /**
     * Request a pairing code for phone-number-based linking with optional custom code.
     */
    public String requestPairingCode(String phoneNumber, String customPairingCode) throws Exception {
        String pairingCode = customPairingCode != null ? customPairingCode :
                PairingUtils.bytesToCrockford(CryptoUtils.randomBytes(5));

        if (customPairingCode != null && customPairingCode.length() != 8) {
            throw new IllegalArgumentException("Custom pairing code must be exactly 8 chars");
        }

        authState.creds.pairingCode = pairingCode;
        authState.creds.me = new AuthCreds.UserInfo();
        authState.creds.me.id = phoneNumber + "@s.whatsapp.net";
        authState.creds.me.name = "~";

        if (onCredsUpdate != null) {
            onCredsUpdate.accept(Map.of("creds", authState.creds));
        }

        byte[] pairingKey = PairingUtils.generatePairingKey(
                pairingCode, authState.creds.pairingEphemeralKeyPair.getPublicKey());

        sendNode(new BinaryNode("iq", Map.of(
                "to", JidUtils.S_WHATSAPP_NET,
                "type", "set",
                "id", generateMessageTag(),
                "xmlns", "md"
        ), List.of(new BinaryNode("link_code_companion_reg", Map.of(
                "jid", authState.creds.me.id,
                "stage", "companion_hello",
                "should_show_push_notification", "true"
        ), List.of(
                new BinaryNode("link_code_pairing_wrapped_companion_ephemeral_pub", Map.of(), pairingKey),
                new BinaryNode("companion_server_auth_key_pub", Map.of(),
                        authState.creds.noiseKey.getPublicKey()),
                new BinaryNode("companion_platform_id", Map.of(), "49"),
                new BinaryNode("companion_platform_display", Map.of(),
                        (browserName + " (Chatin)").getBytes(StandardCharsets.UTF_8)),
                new BinaryNode("link_code_pairing_nonce", Map.of(),
                        "0".getBytes(StandardCharsets.UTF_8))
        )))));

        return pairingCode;
    }

    // =========== Utilities ===========

    public String generateMessageTag() { return tagPrefix + epoch.getAndIncrement(); }
    private String generateTagPrefix() { return Long.toHexString(System.currentTimeMillis() / 1000) + "."; }

    private BinaryNode findChild(BinaryNode parent, String tag) {
        Object content = parent.getContent();
        if (content instanceof List<?> list) {
            for (Object child : list) {
                if (child instanceof BinaryNode node && tag.equals(node.getTag())) {
                    return node;
                }
            }
        }
        return null;
    }

    // =========== Event Setters & Getters ===========

    public void setOnQrCode(Consumer<String> h) { this.onQrCode = h; }
    public void setOnConnectionUpdate(Consumer<Map<String, Object>> h) { this.onConnectionUpdate = h; }
    public void setOnCredsUpdate(Consumer<Map<String, Object>> h) { this.onCredsUpdate = h; }
    public void setOnMessage(Consumer<BinaryNode> h) { this.onMessage = h; }

    public ConnectionState getState() { return state; }
    public boolean isOpen() { return state == ConnectionState.OPEN; }
    public AuthState getAuthState() { return authState; }
}
