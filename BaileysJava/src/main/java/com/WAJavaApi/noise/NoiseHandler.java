package com.WAJavaApi.noise;

import com.WAJavaApi.binary.BinaryConstants;
import com.WAJavaApi.binary.BinaryDecoder;
import com.WAJavaApi.binary.BinaryNode;
import com.WAJavaApi.crypto.CryptoUtils;
import com.WAJavaApi.crypto.CurveUtils;
import com.WAJavaApi.proto.WAProto;
import com.google.protobuf.ByteString;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.ByteBuffer;
import java.util.function.Consumer;

/**
 * Noise Protocol handler - Java port of baileys noise-handler.ts
 * Implements Noise_XX_25519_AESGCM_SHA256 protocol for WhatsApp.
 *
 * During handshake: uses a single shared counter for both encrypt/decrypt.
 * After finishInit(): transitions to TransportState with separate read/write counters.
 */
public class NoiseHandler {

    private static final Logger logger = LoggerFactory.getLogger(NoiseHandler.class);

    private static final String NOISE_MODE = "Noise_XX_25519_AESGCM_SHA256\0\0\0\0";
    private static final int IV_LENGTH = 12;

    private final byte[] privateKey;
    private final byte[] publicKey;
    private final byte[] introHeader;

    private byte[] hash;
    private byte[] salt;
    private byte[] encKey;
    private byte[] decKey;

    // During handshake: single counter shared for both encrypt and decrypt
    private int counter = 0;

    private boolean sentIntro = false;
    private byte[] inBytes = new byte[0];

    // Transport state: null during handshake, set after finishInit()
    private TransportState transport = null;

    /**
     * Separate read/write encryption state after handshake completes.
     */
    private static class TransportState {
        private final byte[] encKey;
        private final byte[] decKey;
        private int writeCounter = 0;
        private int readCounter = 0;

        TransportState(byte[] encKey, byte[] decKey) {
            this.encKey = encKey;
            this.decKey = decKey;
        }

        byte[] encrypt(byte[] plaintext) throws Exception {
            byte[] iv = generateCounterIV(writeCounter++);
            return CryptoUtils.aesEncryptGCM(plaintext, encKey, iv, new byte[0]);
        }

        byte[] decrypt(byte[] ciphertext) throws Exception {
            byte[] iv = generateCounterIV(readCounter++);
            return CryptoUtils.aesDecryptGCM(ciphertext, decKey, iv, new byte[0]);
        }

        private static byte[] generateCounterIV(int counter) {
            byte[] iv = new byte[IV_LENGTH];
            iv[8] = (byte) ((counter >>> 24) & 0xff);
            iv[9] = (byte) ((counter >>> 16) & 0xff);
            iv[10] = (byte) ((counter >>> 8) & 0xff);
            iv[11] = (byte) (counter & 0xff);
            return iv;
        }
    }

    public NoiseHandler(byte[] privateKey, byte[] publicKey, byte[] noiseHeader, byte[] routingInfo) {
        this.privateKey = privateKey;
        this.publicKey = publicKey;

        // Build intro header
        if (routingInfo != null && routingInfo.length > 0) {
            ByteBuffer headerBuf = ByteBuffer.allocate(7 + routingInfo.length + noiseHeader.length);
            headerBuf.put((byte) 'E');
            headerBuf.put((byte) 'D');
            headerBuf.put((byte) 0);
            headerBuf.put((byte) 1);
            headerBuf.put((byte) (routingInfo.length >> 16));
            headerBuf.putShort((short) (routingInfo.length & 0xFFFF));
            headerBuf.put(routingInfo);
            headerBuf.put(noiseHeader);
            this.introHeader = headerBuf.array();
        } else {
            this.introHeader = noiseHeader.clone();
        }

        // Initialize hash
        byte[] data = NOISE_MODE.getBytes();
        try {
            this.hash = data.length == 32 ? data : CryptoUtils.sha256(data);
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize noise handler", e);
        }
        this.salt = this.hash.clone();
        this.encKey = this.hash.clone();
        this.decKey = this.hash.clone();

        // Authenticate initial data
        authenticate(noiseHeader);
        authenticate(publicKey);
    }

    /**
     * Update hash with new data (only during handshake)
     */
    public void authenticate(byte[] data) {
        if (transport == null) {
            try {
                hash = CryptoUtils.sha256(CryptoUtils.concat(hash, data));
            } catch (Exception e) {
                throw new RuntimeException("Failed to authenticate", e);
            }
        }
    }

    /**
     * Encrypt data. During handshake: uses shared counter + hash as AAD.
     * After finishInit: uses TransportState with separate write counter.
     */
    public byte[] encrypt(byte[] plaintext) throws Exception {
        if (transport != null) {
            return transport.encrypt(plaintext);
        }
        byte[] iv = CryptoUtils.generateIV(counter++);
        byte[] result = CryptoUtils.aesEncryptGCM(plaintext, encKey, iv, hash);
        authenticate(result);
        return result;
    }

    /**
     * Decrypt data. During handshake: uses shared counter + hash as AAD.
     * After finishInit: uses TransportState with separate read counter.
     */
    public byte[] decrypt(byte[] ciphertext) throws Exception {
        if (transport != null) {
            return transport.decrypt(ciphertext);
        }
        byte[] iv = CryptoUtils.generateIV(counter++);
        byte[] result = CryptoUtils.aesDecryptGCM(ciphertext, decKey, iv, hash);
        authenticate(ciphertext);
        return result;
    }

    /**
     * HKDF-based key mixing
     */
    private byte[][] localHKDF(byte[] data) throws Exception {
        byte[] key = CryptoUtils.hkdf(data, 64, salt, "");
        byte[] write = new byte[32];
        byte[] read = new byte[32];
        System.arraycopy(key, 0, write, 0, 32);
        System.arraycopy(key, 32, read, 0, 32);
        return new byte[][]{write, read};
    }

    /**
     * Mix data into key schedule
     */
    public void mixIntoKey(byte[] data) throws Exception {
        byte[][] keys = localHKDF(data);
        salt = keys[0];
        encKey = keys[1];
        decKey = keys[1];
        counter = 0;
    }

    /**
     * Finish initialization - transition to TransportState with separate read/write keys.
     */
    public void finishInit() throws Exception {
        byte[][] keys = localHKDF(new byte[0]);
        transport = new TransportState(keys[0], keys[1]);
        logger.debug("Noise handler transitioned to Transport state");
    }

    /**
     * Process the full server handshake and return encrypted noise key.
     * Performs certificate verification like Baileys.
     */
    public byte[] processHandshake(WAProto.HandshakeMessage handshakeMsg,
                                    byte[] noisePrivateKey, byte[] noisePublicKey) throws Exception {
        WAProto.HandshakeMessage.ServerHello serverHello = handshakeMsg.getServerHello();
        if (serverHello == null) {
            throw new RuntimeException("No ServerHello in handshake response");
        }

        byte[] serverEphemeral = serverHello.getEphemeral().toByteArray();
        byte[] serverStaticCiphertext = serverHello.getStatic().toByteArray();
        byte[] serverPayloadCiphertext = serverHello.getPayload().toByteArray();

        logger.info("ServerHello received (ephemeral: {} bytes, static: {} bytes, payload: {} bytes)",
                serverEphemeral.length, serverStaticCiphertext.length, serverPayloadCiphertext.length);

        // Authenticate server ephemeral
        authenticate(serverEphemeral);

        // DH with server ephemeral
        mixIntoKey(CurveUtils.sharedKey(privateKey, serverEphemeral));

        // Decrypt server static
        byte[] decStaticContent = decrypt(serverStaticCiphertext);

        // DH with decrypted server static
        mixIntoKey(CurveUtils.sharedKey(privateKey, decStaticContent));

        // Decrypt server payload (cert chain)
        byte[] certDecoded = decrypt(serverPayloadCiphertext);

        // Verify certificate chain
        verifyCertificate(certDecoded, decStaticContent);

        // Encrypt our noise key
        byte[] keyEnc = encrypt(noisePublicKey);

        // DH noise key with server ephemeral
        mixIntoKey(CurveUtils.sharedKey(noisePrivateKey, serverEphemeral));

        return keyEnc;
    }

    /**
     * Verify the server certificate chain (matches Baileys processHandshake).
     */
    private void verifyCertificate(byte[] certBytes, byte[] serverStaticKey) {
        try {
            WAProto.CertChain certChain = WAProto.CertChain.parseFrom(certBytes);

            WAProto.CertChain.NoiseCertificate leaf = certChain.getLeaf();
            WAProto.CertChain.NoiseCertificate intermediate = certChain.getIntermediate();

            if (leaf == null || !leaf.hasDetails() || !leaf.hasSignature()) {
                throw new RuntimeException("Invalid noise leaf certificate");
            }
            if (intermediate == null || !intermediate.hasDetails() || !intermediate.hasSignature()) {
                throw new RuntimeException("Invalid noise intermediate certificate");
            }

            // Decode intermediate details to get the issuer key
            WAProto.CertChain.NoiseCertificate.Details details =
                    WAProto.CertChain.NoiseCertificate.Details.parseFrom(intermediate.getDetails());

            // Verify leaf signature with intermediate key
            boolean leafVerified = CurveUtils.verify(
                    details.getKey().toByteArray(),
                    leaf.getDetails().toByteArray(),
                    leaf.getSignature().toByteArray());

            if (!leafVerified) {
                throw new RuntimeException("Noise leaf certificate signature invalid");
            }

            // Verify intermediate signature with WA root key
            boolean intermediateVerified = CurveUtils.verify(
                    BinaryConstants.WA_CERT_ISSUER_PUBLIC_KEY,
                    intermediate.getDetails().toByteArray(),
                    intermediate.getSignature().toByteArray());

            if (!intermediateVerified) {
                throw new RuntimeException("Noise intermediate certificate signature invalid");
            }

            // Verify issuer serial
            if (details.getIssuerSerial() != BinaryConstants.WA_CERT_SERIAL) {
                throw new RuntimeException("Certificate issuer serial mismatch");
            }

            logger.debug("Certificate chain verified successfully");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            logger.warn("Certificate verification failed (non-fatal): {}", e.getMessage());
        }
    }

    /**
     * Encode a frame for sending over WebSocket
     */
    public byte[] encodeFrame(byte[] data) throws Exception {
        if (transport != null) {
            data = transport.encrypt(data);
        }

        int introSize = sentIntro ? 0 : introHeader.length;
        byte[] frame = new byte[introSize + 3 + data.length];

        if (!sentIntro) {
            System.arraycopy(introHeader, 0, frame, 0, introHeader.length);
            sentIntro = true;
        }

        frame[introSize] = (byte) (data.length >> 16);
        frame[introSize + 1] = (byte) ((data.length >> 8) & 0xFF);
        frame[introSize + 2] = (byte) (data.length & 0xFF);
        System.arraycopy(data, 0, frame, introSize + 3, data.length);

        return frame;
    }

    /**
     * Decode incoming frames from WebSocket
     */
    public void decodeFrame(byte[] newData, Consumer<Object> onFrame) throws Exception {
        inBytes = CryptoUtils.concat(inBytes, newData);

        while (inBytes.length >= 3) {
            int size = ((inBytes[0] & 0xFF) << 16) | ((inBytes[1] & 0xFF) << 8) | (inBytes[2] & 0xFF);

            if (inBytes.length < size + 3) {
                break; // Wait for more data
            }

            byte[] frame = new byte[size];
            System.arraycopy(inBytes, 3, frame, 0, size);

            byte[] remaining = new byte[inBytes.length - size - 3];
            System.arraycopy(inBytes, size + 3, remaining, 0, remaining.length);
            inBytes = remaining;

            if (transport != null) {
                byte[] decrypted = transport.decrypt(frame);
                try {
                    BinaryNode node = BinaryDecoder.decode(decrypted);
                    onFrame.accept(node);
                } catch (Exception e) {
                    logger.warn("Failed to decode binary node ({} bytes): {}",
                            decrypted.length, e.getMessage());
                }
            } else {
                onFrame.accept(frame);
            }
        }
    }

    public boolean isFinished() { return transport != null; }
}
