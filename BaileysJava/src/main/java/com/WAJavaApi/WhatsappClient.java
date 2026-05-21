package com.WAJavaApi;

import com.WAJavaApi.binary.BinaryNode;
import com.WAJavaApi.socket.WASocket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * WhatsappClient - A library-friendly manager for WhatsApp connection.
 * Provides automatic reconnection, QR/pairing code support, and event callbacks.
 */
public class WhatsappClient {

    private static final Logger logger = LoggerFactory.getLogger(WhatsappClient.class);

    private final String sessionName;
    private final String browserName;
    private final FileAuthStateManager authStateManager;
    private WASocket socket;

    // Reconnection
    private boolean autoReconnect = true;
    private int maxReconnectRetries = 5;
    private int reconnectCount = 0;
    private ScheduledExecutorService reconnectExecutor;

    // Callbacks
    private WhatsappEventListener eventListener;

    public interface WhatsappEventListener {
        void onQrCode(String qr);
        void onConnectionUpdate(String status, String reason);
        void onMessage(BinaryNode message);
        void onLoggedIn(String jid);
    }

    public WhatsappClient(String sessionName) {
        this(sessionName, "Chatin");
    }

    public WhatsappClient(String sessionName, String browserName) {
        this.sessionName = sessionName;
        this.browserName = browserName;
        this.authStateManager = new FileAuthStateManager(sessionName);
    }

    public void setEventListener(WhatsappEventListener listener) {
        this.eventListener = listener;
    }

    public void setAutoReconnect(boolean autoReconnect) {
        this.autoReconnect = autoReconnect;
    }

    public void setMaxReconnectRetries(int maxRetries) {
        this.maxReconnectRetries = maxRetries;
    }

    public void connect() {
        reconnectCount = 0;
        doConnect();
    }

    private void doConnect() {
        try {
            logger.info("Starting WhatsApp connection for session: {}", sessionName);
            WASocket.AuthState authState = authStateManager.getAuthState();

            socket = new WASocket(browserName);

            socket.setOnConnectionUpdate(update -> {
                String connection = (String) update.get("connection");
                String qr = update.containsKey("qr") ? (String) update.get("qr") : null;

                if (connection != null && eventListener != null) {
                    Map<?, ?> lastDisconnect = (Map<?, ?>) update.get("lastDisconnect");
                    String reason = (lastDisconnect != null) ? String.valueOf(lastDisconnect.get("error")) : null;
                    eventListener.onConnectionUpdate(connection, reason);

                    // Auto-reconnect on close
                    if ("close".equals(connection) && autoReconnect) {
                        handleReconnect(reason);
                    }
                }
            });

            socket.setOnQrCode(qr -> {
                logger.info("QR Code received from server");
                if (eventListener != null) {
                    eventListener.onQrCode(qr);
                }
            });

            socket.setOnCredsUpdate(credsUpdate -> {
                @SuppressWarnings("unchecked")
                WASocket.AuthCreds creds = (WASocket.AuthCreds) credsUpdate.get("creds");
                if (creds != null) {
                    authStateManager.saveCreds(creds);
                    if (creds.me != null && eventListener != null) {
                        eventListener.onLoggedIn(creds.me.id);
                    }
                }
            });

            socket.setOnMessage(node -> {
                if (eventListener != null) {
                    eventListener.onMessage(node);
                }
            });

            socket.connect(authState);
            reconnectCount = 0; // Reset on successful connection

        } catch (Exception e) {
            logger.error("Failed to start connection: {}", e.getMessage());
            if (eventListener != null) {
                eventListener.onConnectionUpdate("error", e.getMessage());
            }
            if (autoReconnect) {
                handleReconnect(e.getMessage());
            }
        }
    }

    private void handleReconnect(String reason) {
        if (reconnectCount >= maxReconnectRetries) {
            logger.warn("Max reconnect retries ({}) reached, giving up", maxReconnectRetries);
            return;
        }

        // Don't reconnect on intentional logout or QR timeout
        if (reason != null && (reason.contains("Intentional Logout") || reason.contains("QR code scan timeout"))) {
            logger.info("Not reconnecting: {}", reason);
            return;
        }

        reconnectCount++;
        int delayMs = Math.min(1000 * (int) Math.pow(2, reconnectCount - 1), 30000);
        logger.info("Reconnecting in {}ms (attempt {}/{})", delayMs, reconnectCount, maxReconnectRetries);

        if (reconnectExecutor == null || reconnectExecutor.isShutdown()) {
            reconnectExecutor = Executors.newSingleThreadScheduledExecutor();
        }

        reconnectExecutor.schedule(this::doConnect, delayMs, TimeUnit.MILLISECONDS);
    }

    public void disconnect() {
        autoReconnect = false;
        if (reconnectExecutor != null) reconnectExecutor.shutdown();
        if (socket != null) {
            socket.end(new RuntimeException("Manual disconnect"));
        }
    }

    public void logout() {
        autoReconnect = false;
        if (reconnectExecutor != null) reconnectExecutor.shutdown();
        if (socket != null) {
            try {
                socket.logout();
                authStateManager.deleteSession();
            } catch (Exception e) {
                logger.error("Failed to logout: {}", e.getMessage());
            }
        }
    }

    /**
     * Request a pairing code for phone-number-based linking (no QR needed).
     * Call this AFTER connect() and BEFORE scanning QR.
     * @param phoneNumber Phone number without + prefix (e.g. "905551234567")
     * @return 8-character pairing code to enter on the phone
     */
    public String requestPairingCode(String phoneNumber) throws Exception {
        if (socket == null) {
            throw new IllegalStateException("Not connected. Call connect() first.");
        }
        return socket.requestPairingCode(phoneNumber);
    }

    public WASocket getSocket() {
        return socket;
    }

    public boolean isConnected() {
        return socket != null && socket.isOpen();
    }
}
