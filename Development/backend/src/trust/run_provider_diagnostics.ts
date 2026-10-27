/**
 * TrustSense-BMS: Safe Provider Diagnostics Command
 * 
 * Reports provider configuration, authentication, genuine operation status,
 * safe error categories, and local fallback activity.
 * 
 * SECURITY MANDATE:
 * - NEVER prints or logs secret keys, session tokens, or credential values.
 * - Reports booleans (present: true/false) or public non-sensitive identifiers only.
 * - Distinguishes between genuine external operations and local fallbacks.
 * 
 * Run with:
 *   npx tsx src/trust/run_provider_diagnostics.ts
 */

import { initDb } from "../db";
import { billingService } from "../billing/razorpay";
import { cloudStorage } from "../cloud/storage";
import { ledgerGateway } from "../blockchain/ledger";

export interface ProviderDiagnosticResult {
  providerName: "Razorpay" | "AWS_S3" | "Hyperledger_Fabric";
  requiredConfigurationPresent: boolean;
  selectedProvider: string;
  selectedMode: string;
  authenticationSucceeded: boolean;
  genuineOperationSucceeded: boolean;
  safeErrorCategory: string | null;
  localFallbackActive: boolean;
  diagnostics: Record<string, any>;
}

async function runProviderDiagnostics(): Promise<ProviderDiagnosticResult[]> {
  console.log("=====================================================================");
  console.log(" TrustSense-BMS: Safe External Provider Diagnostics");
  console.log(" Timestamp: " + new Date().toISOString());
  console.log("=====================================================================");

  await initDb();
  const results: ProviderDiagnosticResult[] = [];

  // =========================================================================
  // 1. Razorpay Test-Mode Diagnostics
  // =========================================================================
  console.log("\n[1. Razorpay Payment Gateway Diagnostics]");
  const razorpayConfig = billingService.getPublicConfig();
  const razorpayConfigured = billingService.isConfigured();
  
  // Probe provider health using SDK orders.all()
  const razorpayHealth = await billingService.probeProviderHealth();
  const razorpayAuthSuccess = razorpayHealth.status === "ACTIVE_VERIFIED";
  
  let razorpayGenuineOpSuccess = false;
  let razorpayErrorCategory: string | null = null;

  if (razorpayAuthSuccess) {
    try {
      const order = await billingService.createStandardOrder({
        amount: 100, // 100 paise = 1 INR
        currency: "INR",
        receipt: `diag_${Date.now()}`,
      });
      razorpayGenuineOpSuccess = order.providerVerified === true;
    } catch (err: any) {
      razorpayGenuineOpSuccess = false;
      razorpayErrorCategory = err.statusCode === 401 ? "AUTHENTICATION_FAILED" : (err.name || "PROVIDER_ORDER_ERROR");
    }
  } else {
    razorpayGenuineOpSuccess = false;
    razorpayErrorCategory = razorpayHealth.status === "AUTHENTICATION_FAILED"
      ? "AUTHENTICATION_FAILED_HTTP_401"
      : razorpayHealth.status === "UNCONFIGURED"
      ? "CREDENTIALS_UNCONFIGURED"
      : "NETWORK_OR_CONFIG_ERROR";
  }

  const razorpayResult: ProviderDiagnosticResult = {
    providerName: "Razorpay",
    requiredConfigurationPresent: razorpayConfigured,
    selectedProvider: razorpayConfig.provider,
    selectedMode: razorpayConfig.providerStatus,
    authenticationSucceeded: razorpayAuthSuccess,
    genuineOperationSucceeded: razorpayGenuineOpSuccess,
    safeErrorCategory: razorpayErrorCategory,
    localFallbackActive: !razorpayGenuineOpSuccess,
    diagnostics: {
      keyIdConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
      keyIdPrefix: process.env.RAZORPAY_KEY_ID ? (process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_") ? "rzp_test_***" : "rzp_live_***") : "NONE",
      keySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
      currency: razorpayConfig.currency,
      providerMessage: razorpayHealth.message,
    },
  };
  results.push(razorpayResult);

  console.log(`  Configuration Present:    ${razorpayResult.requiredConfigurationPresent}`);
  console.log(`  Selected Provider & Mode: ${razorpayResult.selectedProvider} (${razorpayResult.selectedMode})`);
  console.log(`  Authentication Succeeded: ${razorpayResult.authenticationSucceeded}`);
  console.log(`  Genuine Op Succeeded:     ${razorpayResult.genuineOperationSucceeded}`);
  console.log(`  Safe Error Category:      ${razorpayResult.safeErrorCategory || "NONE"}`);
  console.log(`  Local Fallback Active:    ${razorpayResult.localFallbackActive}`);

  // =========================================================================
  // 2. AWS S3 Evidence Storage Diagnostics
  // =========================================================================
  console.log("\n[2. AWS S3 Evidence Storage Diagnostics]");
  const s3Probe = await cloudStorage.probeLiveS3Connection();
  const s3Status = cloudStorage.getStatus();

  const s3AuthSuccess = s3Probe.success === true;
  const s3GenuineOpSuccess = s3Probe.success === true;
  let s3ErrorCategory: string | null = null;

  if (!s3Probe.success) {
    if (s3Probe.error?.includes("Could not load credentials") || s3Probe.error?.includes("NoCredentials")) {
      s3ErrorCategory = "NO_AWS_CREDENTIALS_IN_CHAIN";
    } else if (
      s3Probe.error?.includes("InvalidClientTokenId") ||
      s3Probe.error?.includes("ExpiredToken") ||
      s3Probe.error?.includes("security token") ||
      s3Probe.error?.toLowerCase().includes("session has expired") ||
      s3Probe.error?.toLowerCase().includes("reauthenticate")
    ) {
      s3ErrorCategory = "INVALID_OR_EXPIRED_CLIENT_TOKEN";
    } else if (s3Probe.error?.includes("AccessDenied") || s3Probe.error?.includes("Forbidden")) {
      s3ErrorCategory = "ACCESS_DENIED_INSUFFICIENT_PERMISSIONS";
    } else if (s3Probe.error?.includes("NoSuchBucket")) {
      s3ErrorCategory = "BUCKET_NOT_FOUND";
    } else {
      s3ErrorCategory = s3Probe.error ? "S3_CLIENT_ERROR" : "UNCONFIGURED";
    }
  }

  const s3Result: ProviderDiagnosticResult = {
    providerName: "AWS_S3",
    requiredConfigurationPresent: Boolean(process.env.AWS_S3_BUCKET || s3Status.bucket),
    selectedProvider: s3Status.provider,
    selectedMode: s3Status.storageMode,
    authenticationSucceeded: s3AuthSuccess,
    genuineOperationSucceeded: s3GenuineOpSuccess,
    safeErrorCategory: s3ErrorCategory,
    localFallbackActive: s3Status.provider === "LOCAL_S3_COMPATIBLE" || !s3GenuineOpSuccess,
    diagnostics: {
      targetBucket: s3Status.bucket,
      targetRegion: s3Status.region,
      credentialsInDefaultChain: s3Status.awsCredentialsPresent,
      liveVerificationStatus: s3Status.liveVerificationStatus,
      probeError: s3Probe.error || null,
      localStoragePath: s3Status.localStoragePath,
    },
  };
  results.push(s3Result);

  console.log(`  Configuration Present:    ${s3Result.requiredConfigurationPresent} (Target: ${s3Result.diagnostics.targetBucket})`);
  console.log(`  Selected Provider & Mode: ${s3Result.selectedProvider} (${s3Result.selectedMode})`);
  console.log(`  Authentication Succeeded: ${s3Result.authenticationSucceeded}`);
  console.log(`  Genuine Op Succeeded:     ${s3Result.genuineOperationSucceeded}`);
  console.log(`  Safe Error Category:      ${s3Result.safeErrorCategory || "NONE"}`);
  console.log(`  Local Fallback Active:    ${s3Result.localFallbackActive}`);

  // =========================================================================
  // 3. Hyperledger Fabric Ledger Diagnostics
  // =========================================================================
  console.log("\n[3. Hyperledger Fabric Ledger Diagnostics]");
  const fabricProbe = await ledgerGateway.probeLiveFabricConnection();
  const ledgerStatus = await ledgerGateway.getStatus();

  const fabricAuthSuccess = fabricProbe.status === "FABRIC_CONNECTED" || fabricProbe.status === "FABRIC_TRANSACTION_VERIFIED";
  const fabricGenuineOpSuccess = fabricProbe.status === "FABRIC_TRANSACTION_VERIFIED";

  let fabricErrorCategory: string | null = null;
  if (!fabricGenuineOpSuccess) {
    if (fabricProbe.status === "LOCAL_ADAPTER_ACTIVE") {
      fabricErrorCategory = "PEER_ENDPOINT_NOT_CONFIGURED";
    } else if (fabricProbe.status === "FABRIC_UNAVAILABLE") {
      fabricErrorCategory = fabricProbe.errorCategory || "PEER_UNREACHABLE_OR_OFFLINE";
    } else if (fabricProbe.status === "FABRIC_CONFIGURED") {
      fabricErrorCategory = "FABRIC_NOT_CONNECTED";
    } else if (fabricProbe.status === "FABRIC_CONNECTED") {
      fabricErrorCategory = "TRANSACTION_NOT_YET_VERIFIED";
    }
  }

  const fabricResult: ProviderDiagnosticResult = {
    providerName: "Hyperledger_Fabric",
    requiredConfigurationPresent: ledgerStatus.livePeerConfigured,
    selectedProvider: ledgerStatus.provider,
    selectedMode: fabricProbe.status,
    authenticationSucceeded: fabricAuthSuccess,
    genuineOperationSucceeded: fabricGenuineOpSuccess,
    safeErrorCategory: fabricErrorCategory,
    localFallbackActive: ledgerStatus.localFallbackActive,
    diagnostics: {
      channelId: ledgerStatus.channel,
      chaincodeId: ledgerStatus.chaincode,
      fabricStatus: fabricProbe.status,
      livePeerConfigured: ledgerStatus.livePeerConfigured,
      livePeerVerified: ledgerStatus.livePeerVerified,
      endpoint: ledgerStatus.endpoint,
      totalAnchoredBatches: ledgerStatus.totalAnchoredBatches,
      activeState: fabricGenuineOpSuccess ? "FABRIC_TX_CONFIRMED_VERIFIED" : "LOCAL_DB_ANCHORED",
      probeMessage: fabricProbe.error || "Fabric probe executed.",
    },
  };
  results.push(fabricResult);

  console.log(`  Configuration Present:    ${fabricResult.requiredConfigurationPresent}`);
  console.log(`  Selected Provider & Mode: ${fabricResult.selectedProvider} (${fabricResult.selectedMode})`);
  console.log(`  Authentication Succeeded: ${fabricResult.authenticationSucceeded}`);
  console.log(`  Genuine Op Succeeded:     ${fabricResult.genuineOperationSucceeded}`);
  console.log(`  Safe Error Category:      ${fabricResult.safeErrorCategory || "NONE"}`);
  console.log(`  Local Fallback Active:    ${fabricResult.localFallbackActive} (${fabricResult.diagnostics.totalAnchoredBatches} batches anchored)`);

  // =========================================================================
  // Diagnostic Summary Table
  // =========================================================================
  console.log("\n=====================================================================");
  console.log(" Provider Diagnostic Summary Table");
  console.log("=====================================================================");
  console.table(
    results.map((r) => ({
      Provider: r.providerName,
      Configured: r.requiredConfigurationPresent ? "YES" : "NO",
      Provider_Status: r.selectedProvider,
      Auth_Success: r.authenticationSucceeded ? "YES" : "NO",
      Genuine_Op: r.genuineOperationSucceeded ? "YES" : "NO",
      Safe_Error_Category: r.safeErrorCategory || "NONE",
      Local_Fallback: r.localFallbackActive ? "ACTIVE" : "INACTIVE",
    }))
  );
  console.log("=====================================================================\n");

  return results;
}

if (require.main === module) {
  runProviderDiagnostics()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Diagnostics Error]:", err.message);
      process.exit(1);
    });
}

export { runProviderDiagnostics };
