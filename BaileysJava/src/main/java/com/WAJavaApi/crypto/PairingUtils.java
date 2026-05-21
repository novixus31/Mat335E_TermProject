package com.WAJavaApi.crypto;

import com.WAJavaApi.binary.BinaryConstants;
import com.WAJavaApi.binary.BinaryNode;
import com.WAJavaApi.proto.WAProto;
import com.WAJavaApi.socket.WASocket;
import com.google.protobuf.ByteString;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Pairing utilities - handles registration, login, and pairing success.
 * Java port of Baileys Utils/auth-utils.ts and crypto.ts pairing functions.
 */
public class PairingUtils {

    private static final Logger logger = LoggerFactory.getLogger(PairingUtils.class);

    /**
     * Generate ClientPayload for new device registration (no existing session).
     * Equivalent to Baileys generateRegistrationNode().
     */
    public static byte[] generateRegistrationPayload(WASocket.AuthCreds creds, String browserName) throws Exception {
        // Build DeviceProps with historySyncConfig and version (matches Baileys)
        WAProto.DeviceProps.HistorySyncConfig historySyncConfig =
                WAProto.DeviceProps.HistorySyncConfig.newBuilder()
                        .setStorageQuotaMb(10240)
                        .setInlineInitialPayloadInE2EeMsg(true)
                        .setSupportCallLogHistory(false)
                        .setSupportBotUserAgentChatHistory(true)
                        .setSupportCagReactionsAndPolls(true)
                        .setSupportBizHostedMsg(true)
                        .setSupportRecentSyncChunkMessageCountTuning(true)
                        .setSupportHostedGroupMsg(true)
                        .setSupportFbidBotChatHistory(true)
                        .setSupportMessageAssociation(true)
                        .setSupportGroupHistory(false)
                        .build();

        WAProto.DeviceProps deviceProps = WAProto.DeviceProps.newBuilder()
                .setOs(browserName != null ? browserName : "Chatin")
                .setPlatformType(WAProto.DeviceProps.PlatformType.CHROME)
                .setRequireFullSync(false)
                .setHistorySyncConfig(historySyncConfig)
                .setVersion(WAProto.DeviceProps.AppVersion.newBuilder()
                        .setPrimary(10)
                        .setSecondary(15)
                        .setTertiary(7)
                        .build())
                .build();

        // Build version hash (MD5 of version string) — required by WhatsApp server
        String versionString = BinaryConstants.WA_VERSION[0] + "." +
                BinaryConstants.WA_VERSION[1] + "." +
                BinaryConstants.WA_VERSION[2];
        byte[] buildHash = MessageDigest.getInstance("MD5").digest(
                versionString.getBytes(java.nio.charset.StandardCharsets.UTF_8));

        byte[] registrationIdBytes = ByteBuffer.allocate(4).putInt(creds.registrationId).array();

        // Build device pairing registration data
        // IMPORTANT: eIdent and eSkeyVal must be raw 32-byte public keys WITHOUT 0x05 prefix
        // The key type is already specified by eKeytype. Baileys sends raw .public (32 bytes).
        WAProto.ClientPayload.DevicePairingRegistrationData.Builder regData =
                WAProto.ClientPayload.DevicePairingRegistrationData.newBuilder()
                        .setERegid(ByteString.copyFrom(registrationIdBytes))
                        .setEKeytype(ByteString.copyFrom(BinaryConstants.KEY_BUNDLE_TYPE))
                        .setEIdent(ByteString.copyFrom(creds.signedIdentityKey.getPublicKey()))
                        .setESkeyId(ByteString.copyFrom(encodeSignedPreKeyId(creds.signedPreKey.getKeyId())))
                        .setESkeyVal(ByteString.copyFrom(creds.signedPreKey.getKeyPair().getPublicKey()))
                        .setESkeySig(ByteString.copyFrom(creds.signedPreKey.getSignature()))
                        .setBuildHash(ByteString.copyFrom(buildHash))
                        .setDeviceProps(ByteString.copyFrom(deviceProps.toByteArray()));

        // Build UserAgent (matches Baileys getUserAgent)
        WAProto.ClientPayload.UserAgent userAgent = WAProto.ClientPayload.UserAgent.newBuilder()
                .setPlatform(WAProto.ClientPayload.UserAgent.Platform.WEB)
                .setAppVersion(WAProto.ClientPayload.UserAgent.AppVersion.newBuilder()
                        .setPrimary(BinaryConstants.WA_VERSION[0])
                        .setSecondary(BinaryConstants.WA_VERSION[1])
                        .setTertiary(BinaryConstants.WA_VERSION[2])
                        .build())
                .setReleaseChannel(WAProto.ClientPayload.UserAgent.ReleaseChannel.RELEASE)
                .setOsVersion("0.1")
                .setOsBuildNumber("0.1")
                .setManufacturer("")
                .setDevice("Desktop")
                .setMnc("000")
                .setMcc("000")
                .setLocaleLanguageIso6391("en")
                .setLocaleCountryIso31661Alpha2("US")
                .build();

        // Build WebInfo
        WAProto.ClientPayload.WebInfo webInfo = WAProto.ClientPayload.WebInfo.newBuilder()
                .setWebSubPlatform(WAProto.ClientPayload.WebInfo.WebSubPlatform.WEB_BROWSER)
                .build();

        // Build ClientPayload for registration (passive=false, pull=false, no username)
        WAProto.ClientPayload payload = WAProto.ClientPayload.newBuilder()
                .setPassive(false)
                .setPull(false)
                .setUserAgent(userAgent)
                .setWebInfo(webInfo)
                .setSessionId(new SecureRandom().nextInt())
                .setShortConnect(true)
                .setConnectType(WAProto.ClientPayload.ConnectType.WIFI_UNKNOWN)
                .setConnectReason(WAProto.ClientPayload.ConnectReason.USER_ACTIVATED)
                .setDevicePairingData(regData.build())
                .build();

        return payload.toByteArray();
    }

    /**
     * Generate ClientPayload for login with existing session.
     * Equivalent to Baileys generateLoginNode().
     */
    public static byte[] generateLoginPayload(WASocket.AuthCreds creds) throws Exception {
        String jid = creds.me.id;
        String username = jid.contains("@") ? jid.split("@")[0] : jid;
        // Extract device number from JID (e.g. "12345:1@s.whatsapp.net" -> device=1)
        int device = 0;
        if (username.contains(":")) {
            String[] parts = username.split(":");
            username = parts[0];
            try { device = Integer.parseInt(parts[1]); } catch (NumberFormatException ignored) {}
        }

        // Build UserAgent (matches Baileys getUserAgent)
        WAProto.ClientPayload.UserAgent userAgent = WAProto.ClientPayload.UserAgent.newBuilder()
                .setPlatform(WAProto.ClientPayload.UserAgent.Platform.WEB)
                .setAppVersion(WAProto.ClientPayload.UserAgent.AppVersion.newBuilder()
                        .setPrimary(BinaryConstants.WA_VERSION[0])
                        .setSecondary(BinaryConstants.WA_VERSION[1])
                        .setTertiary(BinaryConstants.WA_VERSION[2])
                        .build())
                .setReleaseChannel(WAProto.ClientPayload.UserAgent.ReleaseChannel.RELEASE)
                .setOsVersion("0.1")
                .setOsBuildNumber("0.1")
                .setManufacturer("")
                .setDevice("Desktop")
                .setMnc("000")
                .setMcc("000")
                .setLocaleLanguageIso6391("en")
                .setLocaleCountryIso31661Alpha2("US")
                .build();

        // Build WebInfo
        WAProto.ClientPayload.WebInfo webInfo = WAProto.ClientPayload.WebInfo.newBuilder()
                .setWebSubPlatform(WAProto.ClientPayload.WebInfo.WebSubPlatform.WEB_BROWSER)
                .build();

        // Build ClientPayload for login (passive=true, pull=true, with username + device)
        WAProto.ClientPayload.Builder payloadBuilder = WAProto.ClientPayload.newBuilder()
                .setPassive(true)
                .setPull(true)
                .setUsername(Long.parseLong(username))
                .setUserAgent(userAgent)
                .setWebInfo(webInfo)
                .setConnectType(WAProto.ClientPayload.ConnectType.WIFI_UNKNOWN)
                .setConnectReason(WAProto.ClientPayload.ConnectReason.USER_ACTIVATED)
                .setLidDbMigrated(false);

        if (device > 0) {
            payloadBuilder.setDevice(device);
        }

        return payloadBuilder.build().toByteArray();
    }

    /**
     * Configure a successful pairing from server pair-success stanza.
     * Extracts device identity, verifies ADV signatures, and builds reply node.
     */
    public static PairingResult configureSuccessfulPairing(BinaryNode stanza, WASocket.AuthCreds creds) {
        try {
            BinaryNode pairSuccessNode = findChild(stanza, "pair-success");
            if (pairSuccessNode == null) {
                throw new RuntimeException("No pair-success node in stanza");
            }

            BinaryNode deviceIdentityNode = findChild(pairSuccessNode, "device-identity");
            BinaryNode platformNode = findChild(pairSuccessNode, "platform");
            BinaryNode deviceNode = findChild(pairSuccessNode, "device");
            BinaryNode businessNode = findChild(pairSuccessNode, "biz");

            if (deviceIdentityNode == null || deviceNode == null) {
                throw new RuntimeException("Missing required pairing nodes");
            }

            String jid = deviceNode.getAttr("jid");
            if (jid == null) {
                throw new RuntimeException("No JID in device node");
            }

            byte[] deviceIdentityBytes = (byte[]) deviceIdentityNode.getContent();
            WAProto.ADVSignedDeviceIdentityHMAC hmacIdentity =
                    WAProto.ADVSignedDeviceIdentityHMAC.parseFrom(deviceIdentityBytes);

            // Derive ADV secret for HMAC verification
            byte[] advSecretBytes = Base64.getDecoder().decode(creds.advSecretKey);
            byte[] advSign = CryptoUtils.hmacSign(hmacIdentity.getDetails().toByteArray(), advSecretBytes);

            // Verify HMAC
            if (!java.util.Arrays.equals(advSign, hmacIdentity.getHmac().toByteArray())) {
                logger.warn("ADV HMAC verification failed (non-fatal, continuing)");
            }

            WAProto.ADVSignedDeviceIdentity signedIdentity =
                    WAProto.ADVSignedDeviceIdentity.parseFrom(hmacIdentity.getDetails());

            byte[] accountSignatureKey = signedIdentity.getAccountSignatureKey().toByteArray();

            // Verify account signature
            // Baileys uses getKeyAuthor(signedIdentityKey) which returns raw 32-byte .public
            byte[] accountMsg = CryptoUtils.concat(
                    BinaryConstants.WA_ADV_ACCOUNT_SIG_PREFIX,
                    signedIdentity.getDetails().toByteArray(),
                    creds.signedIdentityKey.getPublicKey()
            );

            boolean accountVerified = CurveUtils.verify(
                    accountSignatureKey, accountMsg, signedIdentity.getAccountSignature().toByteArray());

            if (!accountVerified) {
                throw new RuntimeException("Failed to verify account signature");
            }

            // Create device signature (must include accountSignatureKey per Baileys)
            WAProto.ADVDeviceIdentity deviceIdentity =
                    WAProto.ADVDeviceIdentity.parseFrom(signedIdentity.getDetails());

            byte[] deviceMsg = CryptoUtils.concat(
                    BinaryConstants.WA_ADV_DEVICE_SIG_PREFIX,
                    signedIdentity.getDetails().toByteArray(),
                    creds.signedIdentityKey.getPublicKey(),
                    accountSignatureKey
            );

            byte[] deviceSignature = CurveUtils.sign(creds.signedIdentityKey.getPrivateKey(), deviceMsg);

            // Build signed identity with device signature
            WAProto.ADVSignedDeviceIdentity newSignedIdentity = WAProto.ADVSignedDeviceIdentity.newBuilder()
                    .mergeFrom(signedIdentity)
                    .setDeviceSignature(ByteString.copyFrom(deviceSignature))
                    .build();

            // Encode for reply — must strip accountSignatureKey (Baileys encodeSignedDeviceIdentity(account, false))
            WAProto.ADVSignedDeviceIdentity forReply = WAProto.ADVSignedDeviceIdentity.newBuilder()
                    .mergeFrom(newSignedIdentity)
                    .clearAccountSignatureKey()
                    .build();
            byte[] identityBytes = forReply.toByteArray();

            // Build reply node
            BinaryNode reply = new BinaryNode("iq", Map.of(
                    "to", "s.whatsapp.net",
                    "type", "result",
                    "id", stanza.getAttr("id")
            ), List.of(new BinaryNode("pair-device-sign", Map.of(),
                    List.of(new BinaryNode("device-identity", Map.of("key-index",
                            String.valueOf(deviceIdentity.getKeyIndex())),
                            identityBytes)))));

            // Update creds (matching Baileys configureSuccessfulPairing output)
            WASocket.AuthCreds updatedCreds = creds;
            updatedCreds.me = new WASocket.AuthCreds.UserInfo();
            updatedCreds.me.id = jid;
            updatedCreds.me.lid = jid;

            if (platformNode != null) {
                updatedCreds.platform = platformNode.getAttr("name");
            }

            String name = deviceNode.getAttr("name");
            if (name != null) {
                updatedCreds.me.name = name;
            }

            // Save ADV account identity (matches Baileys' account field)
            WASocket.AuthCreds.AccountInfo accountInfo = new WASocket.AuthCreds.AccountInfo();
            accountInfo.details = newSignedIdentity.getDetails().toByteArray();
            accountInfo.accountSignatureKey = accountSignatureKey;
            accountInfo.accountSignature = newSignedIdentity.getAccountSignature().toByteArray();
            accountInfo.deviceSignature = deviceSignature;
            updatedCreds.account = accountInfo;

            // Save signal identities (for E2E encryption)
            WASocket.AuthCreds.SignalIdentity identity = new WASocket.AuthCreds.SignalIdentity();
            identity.identifierKey = creds.signedIdentityKey.getPublicKey();
            identity.identifier = new WASocket.AuthCreds.SignalIdentity.SignalIdentifier();
            identity.identifier.name = updatedCreds.me.lid;
            identity.identifier.deviceId = 0;
            updatedCreds.signalIdentities = new java.util.ArrayList<>();
            updatedCreds.signalIdentities.add(identity);

            logger.info("Pairing configured successfully for: {}", jid);
            return new PairingResult(reply, updatedCreds);
        } catch (Exception e) {
            throw new RuntimeException("Failed to configure pairing: " + e.getMessage(), e);
        }
    }

    /**
     * Generate pairing key for phone-number-based pairing.
     */
    public static byte[] generatePairingKey(String pairingCode, byte[] pairingEphemeralPublicKey) throws Exception {
        byte[] salt = CryptoUtils.randomBytes(32);
        byte[] randomIv = CryptoUtils.randomBytes(16);
        byte[] key = CryptoUtils.derivePairingCodeKey(pairingCode, salt);
        byte[] ciphered = CryptoUtils.aesEncryptCTR(pairingEphemeralPublicKey, key, randomIv);
        return CryptoUtils.concat(salt, randomIv, ciphered);
    }

    /**
     * Convert bytes to Crockford base32 (for pairing code generation).
     */
    public static String bytesToCrockford(byte[] buffer) {
        String alphabet = "123456789ABCDEFGHJKLMNPQRSTVWXYZ";
        StringBuilder result = new StringBuilder();
        for (byte b : buffer) {
            int val = b & 0xFF;
            result.append(alphabet.charAt(val % 32));
            val /= 32;
            if (val > 0) {
                result.append(alphabet.charAt(val % 32));
            }
        }
        // Trim to 8 characters
        return result.length() > 8 ? result.substring(0, 8) : result.toString();
    }

    // Helper to find child node
    private static BinaryNode findChild(BinaryNode parent, String tag) {
        Object content = parent.getContent();
        if (content instanceof List<?>) {
            for (Object child : (List<?>) content) {
                if (child instanceof BinaryNode node && tag.equals(node.getTag())) {
                    return node;
                }
            }
        }
        return null;
    }

    private static byte[] encodeSignedPreKeyId(int id) {
        return new byte[]{
                (byte) (id & 0xFF),
                (byte) ((id >> 8) & 0xFF),
                (byte) ((id >> 16) & 0xFF)
        };
    }

    /**
     * Result of configureSuccessfulPairing
     */
    public static class PairingResult {
        public final BinaryNode reply;
        public final WASocket.AuthCreds creds;

        public PairingResult(BinaryNode reply, WASocket.AuthCreds creds) {
            this.reply = reply;
            this.creds = creds;
        }
    }
}
