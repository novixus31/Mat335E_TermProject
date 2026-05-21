package com.WAJavaApi;

import com.WAJavaApi.crypto.CurveUtils;
import com.WAJavaApi.socket.WASocket;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * FileAuthStateManager - Manages WhatsApp authentication creds on disk.
 * Java port of Baileys useMultiFileAuthState.
 */
public class FileAuthStateManager {

    private static final Logger logger = LoggerFactory.getLogger(FileAuthStateManager.class);

    private final ObjectMapper objectMapper;
    private final String sessionDir;
    private final String credsPath;

    public FileAuthStateManager(String sessionName) {
        this.sessionDir = sessionName + "_auth";
        this.credsPath = sessionDir + "/creds.json";
        this.objectMapper = new ObjectMapper();
        this.objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        this.objectMapper.configure(SerializationFeature.INDENT_OUTPUT, true);

        File dir = new File(sessionDir);
        if (!dir.exists()) dir.mkdirs();
    }

    /**
     * Get or create AuthState for WASocket.
     */
    public WASocket.AuthState getAuthState() {
        WASocket.AuthState authState = new WASocket.AuthState();
        authState.creds = loadOrInitCreds();
        authState.keys = new SimpleAuthKeys(sessionDir, objectMapper);
        return authState;
    }

    /**
     * Save creds to disk.
     */
    public void saveCreds(WASocket.AuthCreds creds) {
        try {
            SerializableCreds sc = toSerializable(creds);
            objectMapper.writeValue(new File(credsPath), sc);
            logger.debug("Credentials saved to {}", credsPath);
        } catch (Exception e) {
            logger.error("Failed to save creds: {}", e.getMessage());
        }
    }

    /**
     * Delete session files.
     */
    public void deleteSession() {
        try {
            File dir = new File(sessionDir);
            if (dir.exists()) {
                for (File f : dir.listFiles()) f.delete();
                dir.delete();
            }
        } catch (Exception e) {
            logger.error("Failed to delete session: {}", e.getMessage());
        }
    }

    // =========== Internal ===========

    private WASocket.AuthCreds loadOrInitCreds() {
        File credsFile = new File(credsPath);
        if (credsFile.exists()) {
            try {
                SerializableCreds sc = objectMapper.readValue(credsFile, SerializableCreds.class);
                return fromSerializable(sc);
            } catch (Exception e) {
                logger.warn("Failed to load creds, creating new: {}", e.getMessage());
            }
        }
        return initNewCreds();
    }

    private WASocket.AuthCreds initNewCreds() {
        try {
            WASocket.AuthCreds creds = new WASocket.AuthCreds();

            creds.noiseKey = CurveUtils.generateKeyPair();
            creds.signedIdentityKey = CurveUtils.generateKeyPair();
            creds.pairingEphemeralKeyPair = CurveUtils.generateKeyPair();
            creds.registrationId = new SecureRandom().nextInt(16383) + 1;
            creds.advSecretKey = Base64.getEncoder().encodeToString(
                    new byte[32]); // Will be filled with random bytes
            byte[] advSecret = new byte[32];
            new SecureRandom().nextBytes(advSecret);
            creds.advSecretKey = Base64.getEncoder().encodeToString(advSecret);

            creds.nextPreKeyId = 1;
            creds.firstUnuploadedPreKeyId = 1;

            // Create signed pre-key
            CurveUtils.KeyPair preKeyPair = CurveUtils.generateKeyPair();
            byte[] signature = CurveUtils.sign(
                    creds.signedIdentityKey.getPrivateKey(), preKeyPair.getPublicKey());
            creds.signedPreKey = new CurveUtils.SignedKeyPair(preKeyPair, signature, 1);

            saveCreds(creds);
            logger.info("New WhatsApp credentials initialized");
            return creds;
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize creds", e);
        }
    }

    // =========== Serialization ===========

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class SerializableCreds {
        @JsonProperty public String noiseKeyPublic;
        @JsonProperty public String noiseKeyPrivate;
        @JsonProperty public String signedIdentityKeyPublic;
        @JsonProperty public String signedIdentityKeyPrivate;
        @JsonProperty public String pairingEphemeralPublic;
        @JsonProperty public String pairingEphemeralPrivate;
        @JsonProperty public String advSecretKey;
        @JsonProperty public int registrationId;
        @JsonProperty public int nextPreKeyId;
        @JsonProperty public int firstUnuploadedPreKeyId;
        @JsonProperty public String signedPreKeyPublic;
        @JsonProperty public String signedPreKeyPrivate;
        @JsonProperty public String signedPreKeySignature;
        @JsonProperty public int signedPreKeyId;
        @JsonProperty public String meId;
        @JsonProperty public String meName;
        @JsonProperty public String meLid;
        @JsonProperty public String routingInfo;
        @JsonProperty public String platform;
        @JsonProperty public String pairingCode;
    }

    private SerializableCreds toSerializable(WASocket.AuthCreds c) {
        SerializableCreds sc = new SerializableCreds();
        sc.noiseKeyPublic = b64(c.noiseKey.getPublicKey());
        sc.noiseKeyPrivate = b64(c.noiseKey.getPrivateKey());
        sc.signedIdentityKeyPublic = b64(c.signedIdentityKey.getPublicKey());
        sc.signedIdentityKeyPrivate = b64(c.signedIdentityKey.getPrivateKey());
        if (c.pairingEphemeralKeyPair != null) {
            sc.pairingEphemeralPublic = b64(c.pairingEphemeralKeyPair.getPublicKey());
            sc.pairingEphemeralPrivate = b64(c.pairingEphemeralKeyPair.getPrivateKey());
        }
        sc.advSecretKey = c.advSecretKey;
        sc.registrationId = c.registrationId;
        sc.nextPreKeyId = c.nextPreKeyId;
        sc.firstUnuploadedPreKeyId = c.firstUnuploadedPreKeyId;
        if (c.signedPreKey != null) {
            sc.signedPreKeyPublic = b64(c.signedPreKey.getKeyPair().getPublicKey());
            sc.signedPreKeyPrivate = b64(c.signedPreKey.getKeyPair().getPrivateKey());
            sc.signedPreKeySignature = b64(c.signedPreKey.getSignature());
            sc.signedPreKeyId = c.signedPreKey.getKeyId();
        }
        if (c.me != null) {
            sc.meId = c.me.id;
            sc.meName = c.me.name;
            sc.meLid = c.me.lid;
        }
        if (c.routingInfo != null) {
            sc.routingInfo = b64(c.routingInfo);
        }
        sc.platform = c.platform;
        sc.pairingCode = c.pairingCode;
        return sc;
    }

    private WASocket.AuthCreds fromSerializable(SerializableCreds sc) {
        WASocket.AuthCreds c = new WASocket.AuthCreds();
        c.noiseKey = new CurveUtils.KeyPair(db64(sc.noiseKeyPublic), db64(sc.noiseKeyPrivate));
        c.signedIdentityKey = new CurveUtils.KeyPair(db64(sc.signedIdentityKeyPublic), db64(sc.signedIdentityKeyPrivate));
        if (sc.pairingEphemeralPublic != null && sc.pairingEphemeralPrivate != null) {
            c.pairingEphemeralKeyPair = new CurveUtils.KeyPair(db64(sc.pairingEphemeralPublic), db64(sc.pairingEphemeralPrivate));
        }
        c.advSecretKey = sc.advSecretKey;
        c.registrationId = sc.registrationId;
        c.nextPreKeyId = sc.nextPreKeyId;
        c.firstUnuploadedPreKeyId = sc.firstUnuploadedPreKeyId;
        if (sc.signedPreKeyPublic != null) {
            CurveUtils.KeyPair spkp = new CurveUtils.KeyPair(db64(sc.signedPreKeyPublic), db64(sc.signedPreKeyPrivate));
            c.signedPreKey = new CurveUtils.SignedKeyPair(spkp, db64(sc.signedPreKeySignature), sc.signedPreKeyId);
        }
        if (sc.meId != null) {
            c.me = new WASocket.AuthCreds.UserInfo();
            c.me.id = sc.meId;
            c.me.name = sc.meName;
            c.me.lid = sc.meLid;
        }
        if (sc.routingInfo != null) {
            c.routingInfo = db64(sc.routingInfo);
        }
        c.platform = sc.platform;
        c.pairingCode = sc.pairingCode;
        return c;
    }

    private String b64(byte[] data) { return data != null ? Base64.getEncoder().encodeToString(data) : null; }
    private byte[] db64(String s) { return s != null ? Base64.getDecoder().decode(s) : null; }

    // =========== Simple Key Store ===========

    /**
     * Minimal file-based key store for signal keys.
     */
    private static class SimpleAuthKeys implements WASocket.AuthKeys {
        private final String dir;
        private final ObjectMapper mapper;

        SimpleAuthKeys(String dir, ObjectMapper mapper) {
            this.dir = dir;
            this.mapper = mapper;
        }

        @Override
        public Map<String, Object> get(String type, List<String> ids) {
            Map<String, Object> result = new java.util.HashMap<>();
            for (String id : ids) {
                File f = new File(dir + "/" + type + "-" + id + ".json");
                if (f.exists()) {
                    try {
                        result.put(id, mapper.readValue(f, Object.class));
                    } catch (Exception ignored) {}
                }
            }
            return result;
        }

        @Override
        public void set(Map<String, Object> data) {
            // data is { type: { id: value } }
            for (var entry : data.entrySet()) {
                String type = entry.getKey();
                if (entry.getValue() instanceof Map<?, ?> items) {
                    for (var item : items.entrySet()) {
                        File f = new File(dir + "/" + type + "-" + item.getKey() + ".json");
                        try {
                            if (item.getValue() == null) {
                                f.delete();
                            } else {
                                mapper.writeValue(f, item.getValue());
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }
        }
    }
}
