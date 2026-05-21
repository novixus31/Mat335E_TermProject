package com.chatin.service;

import com.chatin.model.WhatsAppAuth;
import com.chatin.repository.WhatsAppAuthRepository;
import com.WAJavaApi.crypto.CurveUtils;
import com.WAJavaApi.socket.WASocket;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.*;

/**
 * MongoDB-based authentication state manager
 * Java port of useMongoAuthState.ts
 * Stores and retrieves WhatsApp session credentials and keys from MongoDB
 * All data for one account lives in a single WhatsAppAuth document with 'creds' and 'keys' fields.
 */
@Service
public class MongoAuthState {

    private static final Logger logger = LoggerFactory.getLogger(MongoAuthState.class);

    private final WhatsAppAuthRepository authRepository;
    private final ObjectMapper objectMapper;

    public MongoAuthState(WhatsAppAuthRepository authRepository, ObjectMapper objectMapper) {
        this.authRepository = authRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Get or create auth state for an account
     */
    public WASocket.AuthState getAuthState(String accountId) {
        WASocket.AuthState authState = new WASocket.AuthState();

        // Try to load existing credentials
        Optional<WhatsAppAuth> doc = authRepository.findByAccountId(accountId);

        if (doc.isPresent()) {
            WhatsAppAuth auth = doc.get();
            try {
                authState.creds = deserializeCreds(auth.getCreds());
                logger.info("Loaded existing credentials for account: {}", accountId);
            } catch (Exception e) {
                logger.warn("Failed to load credentials, creating new: {}", e.getMessage());
                authState.creds = initAuthCreds();
                saveCreds(accountId, authState.creds);
            }
        } else {
            authState.creds = initAuthCreds();
            logger.info("Created new credentials for account: {}", accountId);
            saveCreds(accountId, authState.creds);
        }

        // Create keys handler that stores in the same document's 'keys' field
        authState.keys = createKeysHandler(accountId);

        return authState;
    }

    /**
     * Save credentials to MongoDB (creds field of the document)
     */
    public void saveCreds(String accountId, WASocket.AuthCreds creds) {
        try {
            WhatsAppAuth auth = authRepository.findByAccountId(accountId)
                    .orElse(new WhatsAppAuth());
            auth.setAccountId(accountId);
            auth.setCreds(serializeCreds(creds));
            authRepository.save(auth);
            logger.info("Saved credentials for account: {} (me={})", accountId,
                    creds.me != null ? creds.me.id : "not paired yet");
        } catch (Exception e) {
            logger.error("Failed to save credentials for account {}: {}", accountId, e.getMessage(), e);
        }
    }

    /**
     * Remove all auth data for an account
     */
    public void removeAuthState(String accountId) {
        authRepository.deleteByAccountId(accountId);
        logger.info("Removed auth state for account: {}", accountId);
    }

    /**
     * Initialize new auth credentials
     */
    public WASocket.AuthCreds initAuthCreds() {
        WASocket.AuthCreds creds = new WASocket.AuthCreds();

        try {
            creds.noiseKey = CurveUtils.generateKeyPair();
            creds.signedIdentityKey = CurveUtils.generateKeyPair();
            creds.pairingEphemeralKeyPair = CurveUtils.generateKeyPair();
            creds.signedPreKey = CurveUtils.signedKeyPair(creds.signedIdentityKey, 1);
            creds.registrationId = new SecureRandom().nextInt(16383) + 1;
            creds.advSecretKey = Base64.getEncoder().encodeToString(
                    com.WAJavaApi.crypto.CryptoUtils.randomBytes(32));
            creds.nextPreKeyId = 1;
            creds.firstUnuploadedPreKeyId = 1;
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize auth credentials", e);
        }

        return creds;
    }

    /**
     * Create a keys handler backed by MongoDB.
     * Keys are stored in the 'keys' field of the WhatsAppAuth document as a flat map.
     * Structure: keys = { "pre-key-1": {...}, "pre-key-2": {...}, "session-jid1": {...}, "sender-key-xxx": {...} }
     * Key name format: "type-id" (e.g., "pre-key-1", "session-905xxx@s.whatsapp.net")
     */
    private WASocket.AuthKeys createKeysHandler(String accountId) {
        return new WASocket.AuthKeys() {
            @Override
            @SuppressWarnings("unchecked")
            public Map<String, Object> get(String type, List<String> ids) {
                Map<String, Object> result = new HashMap<>();
                try {
                    Optional<WhatsAppAuth> doc = authRepository.findByAccountId(accountId);
                    if (doc.isPresent() && doc.get().getKeys() instanceof Map) {
                        Map<String, Object> allKeys = (Map<String, Object>) doc.get().getKeys();
                        for (String id : ids) {
                            String flatKey = type + "-" + id;
                            Object val = allKeys.get(flatKey);
                            if (val != null) {
                                result.put(id, val);
                            }
                        }
                    }
                } catch (Exception e) {
                    logger.error("Error getting keys type={}, ids={}: {}", type, ids, e.getMessage());
                }
                return result;
            }

            @Override
            @SuppressWarnings("unchecked")
            public void set(Map<String, Object> data) {
                try {
                    WhatsAppAuth auth = authRepository.findByAccountId(accountId)
                            .orElse(new WhatsAppAuth());
                    auth.setAccountId(accountId);

                    // Get existing flat keys map or create new
                    Map<String, Object> allKeys;
                    if (auth.getKeys() instanceof Map) {
                        allKeys = new HashMap<>((Map<String, Object>) auth.getKeys());
                    } else {
                        allKeys = new HashMap<>();
                    }

                    // Merge incoming data with flat key format: "type-id"
                    for (Map.Entry<String, Object> entry : data.entrySet()) {
                        String type = entry.getKey();
                        Map<String, Object> keys = (Map<String, Object>) entry.getValue();
                        if (keys == null) continue;

                        for (Map.Entry<String, Object> keyEntry : keys.entrySet()) {
                            String keyId = keyEntry.getKey();
                            Object value = keyEntry.getValue();
                            String flatKey = type + "-" + keyId;

                            if (value == null) {
                                allKeys.remove(flatKey);
                            } else {
                                allKeys.put(flatKey, serializeKeyValue(value));
                            }
                        }
                    }

                    auth.setKeys(allKeys);
                    authRepository.save(auth);
                    logger.debug("Saved keys for account: {} (total keys: {})", accountId, allKeys.size());
                } catch (Exception e) {
                    logger.error("Error saving keys for account {}: {}", accountId, e.getMessage(), e);
                }
            }
        };
    }

    /**
     * Serialize a key value for storage.
     * Handles KeyPair, byte[], and nested objects.
     */
    @SuppressWarnings("unchecked")
    private Object serializeKeyValue(Object value) {
        if (value == null) return null;
        if (value instanceof byte[] bytes) {
            return Base64.getEncoder().encodeToString(bytes);
        }
        if (value instanceof CurveUtils.KeyPair kp) {
            Map<String, String> m = new HashMap<>();
            m.put("public", Base64.getEncoder().encodeToString(kp.getPublicKey()));
            m.put("private", Base64.getEncoder().encodeToString(kp.getPrivateKey()));
            return m;
        }
        if (value instanceof Map) {
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<String, Object> e : ((Map<String, Object>) value).entrySet()) {
                result.put(e.getKey(), serializeKeyValue(e.getValue()));
            }
            return result;
        }
        // primitives (String, Number, Boolean) pass through
        return value;
    }

    // =========== Credentials Serialization ===========

    /**
     * Serialize credentials to a storable format
     */
    private Object serializeCreds(WASocket.AuthCreds creds) {
        Map<String, Object> map = new HashMap<>();
        if (creds.noiseKey != null) {
            map.put("noiseKey", Map.of(
                    "public", Base64.getEncoder().encodeToString(creds.noiseKey.getPublicKey()),
                    "private", Base64.getEncoder().encodeToString(creds.noiseKey.getPrivateKey())
            ));
        }
        if (creds.signedIdentityKey != null) {
            map.put("signedIdentityKey", Map.of(
                    "public", Base64.getEncoder().encodeToString(creds.signedIdentityKey.getPublicKey()),
                    "private", Base64.getEncoder().encodeToString(creds.signedIdentityKey.getPrivateKey())
            ));
        }
        if (creds.pairingEphemeralKeyPair != null) {
            map.put("pairingEphemeralKeyPair", Map.of(
                    "public", Base64.getEncoder().encodeToString(creds.pairingEphemeralKeyPair.getPublicKey()),
                    "private", Base64.getEncoder().encodeToString(creds.pairingEphemeralKeyPair.getPrivateKey())
            ));
        }
        map.put("registrationId", creds.registrationId);
        map.put("advSecretKey", creds.advSecretKey);
        map.put("nextPreKeyId", creds.nextPreKeyId);
        map.put("firstUnuploadedPreKeyId", creds.firstUnuploadedPreKeyId);

        // signedPreKey with keyPair sub-object (matching Baileys structure)
        if (creds.signedPreKey != null) {
            Map<String, Object> spkMap = new HashMap<>();
            spkMap.put("keyId", creds.signedPreKey.getKeyId());
            spkMap.put("keyPair", Map.of(
                    "public", Base64.getEncoder().encodeToString(creds.signedPreKey.getKeyPair().getPublicKey()),
                    "private", Base64.getEncoder().encodeToString(creds.signedPreKey.getKeyPair().getPrivateKey())
            ));
            spkMap.put("signature", Base64.getEncoder().encodeToString(creds.signedPreKey.getSignature()));
            map.put("signedPreKey", spkMap);
        }

        if (creds.me != null) {
            Map<String, Object> meMap = new HashMap<>();
            meMap.put("id", creds.me.id);
            meMap.put("name", creds.me.name != null ? creds.me.name : "");
            if (creds.me.lid != null) meMap.put("lid", creds.me.lid);
            map.put("me", meMap);
        }
        if (creds.routingInfo != null) {
            map.put("routingInfo", Base64.getEncoder().encodeToString(creds.routingInfo));
        }
        if (creds.platform != null) {
            map.put("platform", creds.platform);
        }

        // Account (ADV signed device identity)
        if (creds.account != null) {
            Map<String, Object> accountMap = new HashMap<>();
            if (creds.account.details != null)
                accountMap.put("details", Base64.getEncoder().encodeToString(creds.account.details));
            if (creds.account.accountSignatureKey != null)
                accountMap.put("accountSignatureKey", Base64.getEncoder().encodeToString(creds.account.accountSignatureKey));
            if (creds.account.accountSignature != null)
                accountMap.put("accountSignature", Base64.getEncoder().encodeToString(creds.account.accountSignature));
            if (creds.account.deviceSignature != null)
                accountMap.put("deviceSignature", Base64.getEncoder().encodeToString(creds.account.deviceSignature));
            map.put("account", accountMap);
        }

        // Signal identities
        if (creds.signalIdentities != null && !creds.signalIdentities.isEmpty()) {
            List<Map<String, Object>> identitiesList = new ArrayList<>();
            for (WASocket.AuthCreds.SignalIdentity si : creds.signalIdentities) {
                Map<String, Object> siMap = new HashMap<>();
                if (si.identifierKey != null)
                    siMap.put("identifierKey", Base64.getEncoder().encodeToString(si.identifierKey));
                if (si.identifier != null) {
                    siMap.put("identifier", Map.of(
                            "name", si.identifier.name != null ? si.identifier.name : "",
                            "deviceId", si.identifier.deviceId
                    ));
                }
                identitiesList.add(siMap);
            }
            map.put("signalIdentities", identitiesList);
        }

        // Sync and state fields
        map.put("processedHistoryMessages", creds.processedHistoryMessages != null ? creds.processedHistoryMessages : new ArrayList<>());
        map.put("accountSyncCounter", creds.accountSyncCounter);
        if (creds.accountSettings != null) {
            map.put("accountSettings", Map.of("unarchiveChats", creds.accountSettings.unarchiveChats));
        }
        map.put("lastAccountSyncTimestamp", creds.lastAccountSyncTimestamp);
        if (creds.lastPropHash != null) map.put("lastPropHash", creds.lastPropHash);
        if (creds.myAppStateKeyId != null) map.put("myAppStateKeyId", creds.myAppStateKeyId);

        return map;
    }

    /**
     * Deserialize credentials from MongoDB
     */
    @SuppressWarnings("unchecked")
    private WASocket.AuthCreds deserializeCreds(Object data) throws Exception {
        Map<String, Object> map = (Map<String, Object>) data;
        WASocket.AuthCreds creds = new WASocket.AuthCreds();

        Map<String, String> noiseKeyMap = (Map<String, String>) map.get("noiseKey");
        if (noiseKeyMap != null) {
            creds.noiseKey = new CurveUtils.KeyPair(
                    Base64.getDecoder().decode(noiseKeyMap.get("public")),
                    Base64.getDecoder().decode(noiseKeyMap.get("private"))
            );
        }

        Map<String, String> idKeyMap = (Map<String, String>) map.get("signedIdentityKey");
        if (idKeyMap != null) {
            creds.signedIdentityKey = new CurveUtils.KeyPair(
                    Base64.getDecoder().decode(idKeyMap.get("public")),
                    Base64.getDecoder().decode(idKeyMap.get("private"))
            );
        }

        Map<String, String> pairingKeyMap = (Map<String, String>) map.get("pairingEphemeralKeyPair");
        if (pairingKeyMap != null) {
            creds.pairingEphemeralKeyPair = new CurveUtils.KeyPair(
                    Base64.getDecoder().decode(pairingKeyMap.get("public")),
                    Base64.getDecoder().decode(pairingKeyMap.get("private"))
            );
        } else {
            creds.pairingEphemeralKeyPair = CurveUtils.generateKeyPair();
        }

        creds.registrationId = ((Number) map.getOrDefault("registrationId", 0)).intValue();
        creds.advSecretKey = (String) map.get("advSecretKey");
        creds.nextPreKeyId = ((Number) map.getOrDefault("nextPreKeyId", 1)).intValue();
        creds.firstUnuploadedPreKeyId = ((Number) map.getOrDefault("firstUnuploadedPreKeyId", 1)).intValue();

        // signedPreKey — supports both flat (legacy) and keyPair sub-object format
        Map<String, Object> spkMap = (Map<String, Object>) map.get("signedPreKey");
        if (spkMap != null) {
            CurveUtils.KeyPair spkKeyPair;
            Map<String, String> kpMap = (Map<String, String>) spkMap.get("keyPair");
            if (kpMap != null) {
                // New format: keyPair sub-object
                spkKeyPair = new CurveUtils.KeyPair(
                        Base64.getDecoder().decode(kpMap.get("public")),
                        Base64.getDecoder().decode(kpMap.get("private"))
                );
            } else {
                // Legacy flat format
                spkKeyPair = new CurveUtils.KeyPair(
                        Base64.getDecoder().decode((String) spkMap.get("public")),
                        Base64.getDecoder().decode((String) spkMap.get("private"))
                );
            }
            byte[] spkSig = Base64.getDecoder().decode((String) spkMap.get("signature"));
            int spkId = ((Number) spkMap.get("keyId")).intValue();
            creds.signedPreKey = new CurveUtils.SignedKeyPair(spkKeyPair, spkSig, spkId);
        } else {
            creds.signedPreKey = CurveUtils.signedKeyPair(creds.signedIdentityKey, 1);
        }

        Map<String, String> meMap = (Map<String, String>) map.get("me");
        if (meMap != null) {
            creds.me = new WASocket.AuthCreds.UserInfo();
            creds.me.id = meMap.get("id");
            creds.me.name = meMap.get("name");
            creds.me.lid = meMap.get("lid");
        }

        String routingInfoB64 = (String) map.get("routingInfo");
        if (routingInfoB64 != null) {
            creds.routingInfo = Base64.getDecoder().decode(routingInfoB64);
        }

        creds.platform = (String) map.get("platform");

        // Account (ADV identity)
        Map<String, String> accountMap = (Map<String, String>) map.get("account");
        if (accountMap != null) {
            creds.account = new WASocket.AuthCreds.AccountInfo();
            if (accountMap.get("details") != null)
                creds.account.details = Base64.getDecoder().decode(accountMap.get("details"));
            if (accountMap.get("accountSignatureKey") != null)
                creds.account.accountSignatureKey = Base64.getDecoder().decode(accountMap.get("accountSignatureKey"));
            if (accountMap.get("accountSignature") != null)
                creds.account.accountSignature = Base64.getDecoder().decode(accountMap.get("accountSignature"));
            if (accountMap.get("deviceSignature") != null)
                creds.account.deviceSignature = Base64.getDecoder().decode(accountMap.get("deviceSignature"));
        }

        // Signal identities
        List<Map<String, Object>> identitiesList = (List<Map<String, Object>>) map.get("signalIdentities");
        if (identitiesList != null) {
            creds.signalIdentities = new ArrayList<>();
            for (Map<String, Object> siMap : identitiesList) {
                WASocket.AuthCreds.SignalIdentity si = new WASocket.AuthCreds.SignalIdentity();
                String ikB64 = (String) siMap.get("identifierKey");
                if (ikB64 != null) si.identifierKey = Base64.getDecoder().decode(ikB64);
                Map<String, Object> idMap = (Map<String, Object>) siMap.get("identifier");
                if (idMap != null) {
                    si.identifier = new WASocket.AuthCreds.SignalIdentity.SignalIdentifier();
                    si.identifier.name = (String) idMap.get("name");
                    si.identifier.deviceId = ((Number) idMap.getOrDefault("deviceId", 0)).intValue();
                }
                creds.signalIdentities.add(si);
            }
        }

        // Sync and state fields
        creds.accountSyncCounter = ((Number) map.getOrDefault("accountSyncCounter", 0)).intValue();
        Map<String, Object> settingsMap = (Map<String, Object>) map.get("accountSettings");
        if (settingsMap != null) {
            creds.accountSettings = new WASocket.AuthCreds.AccountSettings();
            creds.accountSettings.unarchiveChats = Boolean.TRUE.equals(settingsMap.get("unarchiveChats"));
        }
        creds.lastAccountSyncTimestamp = ((Number) map.getOrDefault("lastAccountSyncTimestamp", 0)).intValue();
        creds.lastPropHash = (String) map.get("lastPropHash");
        creds.myAppStateKeyId = (String) map.get("myAppStateKeyId");
        Object phm = map.get("processedHistoryMessages");
        creds.processedHistoryMessages = phm instanceof List ? (List<Object>) phm : new ArrayList<>();

        return creds;
    }
}
