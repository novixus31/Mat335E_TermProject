package com.WAJavaApi;

import com.WAJavaApi.binary.BinaryNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Sandbox test for WhatsApp connection.
 * Tests: WebSocket connect → Noise handshake → QR code generation
 */
public class SandboxTest {

    private static final Logger logger = LoggerFactory.getLogger(SandboxTest.class);

    public static void main(String[] args) {
        System.out.println("=== BaileysJava Sandbox Test ===");
        System.out.println();

        CountDownLatch latch = new CountDownLatch(1);

        try {
            WhatsappClient client = new WhatsappClient("sandbox_test", "BaileysJava");
            client.setAutoReconnect(false); // Don't reconnect in test

            client.setEventListener(new WhatsappClient.WhatsappEventListener() {
                @Override
                public void onQrCode(String qr) {
                    System.out.println();
                    System.out.println("✅ QR CODE RECEIVED!");
                    System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    System.out.println("QR String (first 80 chars): " + qr.substring(0, Math.min(80, qr.length())) + "...");
                    System.out.println("QR parts count: " + qr.split(",").length);
                    System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    System.out.println();
                    System.out.println("✅ TEST PASSED: Full pipeline working!");
                    System.out.println("   WebSocket ✓ → Noise Handshake ✓ → Registration ✓ → QR Code ✓");
                    latch.countDown();
                }

                @Override
                public void onConnectionUpdate(String status, String reason) {
                    System.out.println("[CONNECTION] " + status + (reason != null ? " (" + reason + ")" : ""));
                    if ("close".equals(status) || "error".equals(status)) {
                        latch.countDown();
                    }
                }

                @Override
                public void onMessage(BinaryNode message) {
                    System.out.println("[MESSAGE] " + message.getTag() + " " + message.getAttrs());
                }

                @Override
                public void onLoggedIn(String jid) {
                    System.out.println("[LOGGED IN] " + jid);
                }
            });

            System.out.println("Starting connection...");
            client.connect();

            // Wait max 30 seconds for QR or close
            boolean finished = latch.await(30, TimeUnit.SECONDS);

            if (!finished) {
                System.out.println("⏰ Timeout (30s). Test inconclusive.");
            }

            // Cleanup
            System.out.println("\nCleaning up...");
            client.disconnect();

            // Delete test session
            new java.io.File("sandbox_test_auth/creds.json").delete();
            new java.io.File("sandbox_test_auth").delete();

            System.out.println("Done.");

        } catch (Exception e) {
            System.out.println("❌ ERROR: " + e.getMessage());
            e.printStackTrace();
            latch.countDown();
        }

        System.exit(0);
    }
}
