package com.WAJavaApi;

import com.WAJavaApi.WhatsappClient;
import com.WAJavaApi.binary.BinaryNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WhatsAppClientExample {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppClientExample.class);

    public static void main(String[] args) {
        logger.info("Starting WhatsApp Client Example...");

        // Start a session named "my_session"
        // This will create a folder "my_session" to store authentication credentials
        WhatsappClient client = new WhatsappClient("my_session");

        client.setEventListener(new WhatsappClient.WhatsappEventListener() {
            @Override
            public void onQrCode(String qr) {
                logger.info("Please scan this QR Code: {}", qr);
            }

            @Override
            public void onConnectionUpdate(String status, String reason) {
                logger.info("Connection status: {} (Reason: {})", status, reason);
            }

            @Override
            public void onMessage(BinaryNode message) {
                logger.info("Received a message node: {}", message.getTag());
            }

            @Override
            public void onLoggedIn(String jid) {
                logger.info("Successfully logged in as: {}", jid);
            }
        });

        // Block main thread to keep application running
        try {
            client.connect();
            Thread.sleep(Long.MAX_VALUE);
        } catch (Exception e) {
            logger.error("Client exited exceptionally", e);
        }
    }
}
