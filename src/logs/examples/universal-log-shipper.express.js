/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Universal Exception Log Shipper — Express.js Integration
 * Authentication: RS256 JWT (short-lived, signed with app_private_key)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * HOW THIS WORKS — IMPORTANT TO UNDERSTAND:
 * ─────────────────────────────────────────
 * Your platform was registered with the Universal Backend and received:
 *   - app_private_key  → You keep this SECRET on your server. NEVER expose it.
 *   - app_public_key   → Stored in Universal Backend. Used to VERIFY your tokens.
 *   - product_id       → Your platform's unique identity UUID.
 *
 * For each log request, you:
 *   1. Sign a fresh JWT with your app_private_key (RS256, expires in 5 min)
 *   2. Send it as:  Authorization: Bearer <your-signed-jwt>
 *   3. The Universal Backend verifies the signature using YOUR public key
 *
 * WHY JWT AND NOT A STATIC SECRET:
 * ──────────────────────────────────
 *   ❌ Static secret (old approach): If it leaks → permanent breach, no recovery
 *   ✅ Short-lived JWT: If it leaks → it expires in 5 minutes automatically
 *      The private key NEVER leaves your server — only the signed token does.
 *
 * SETUP:
 * ──────
 * 1. Install jsonwebtoken:
 *      npm install jsonwebtoken
 *      npm install --save-dev @types/jsonwebtoken   (TypeScript projects)
 *
 * 2. Add to your .env file:
 *      UNIVERSAL_GATEWAY_URL=https://your-universal-backend.com/api/v1/logs/errors
 *      PRODUCT_ID=<uuid issued at product registration>
 *      APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
 *      DEFAULT_COMPANY_ID=<your default company_id, or leave as N/A>
 *
 * 3. Register in your Express app (see USAGE EXAMPLE at the bottom of this file)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────────────────────
// Config factory — call once at app startup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a pre-configured log shipper bound to this platform's credentials.
 * Call this ONCE at app startup. Pass the result to globalErrorHandler.
 *
 * @param {object} config
 * @param {string} config.gatewayUrl        Full URL of the NestJS log endpoint
 * @param {string} config.productId         Your product_id from ProductRegistry
 * @param {string} config.appPrivateKey     Your RSA private key (PEM format) — NEVER log or expose
 * @param {string} [config.defaultCompanyId='N/A']  Default company_id for non-tenant errors
 * @param {number} [config.tokenTtlSeconds=300]     JWT lifetime in seconds (default: 5 min)
 */
function createLogShipper({
  gatewayUrl,
  productId,
  appPrivateKey,
  defaultCompanyId = 'N/A',
  tokenTtlSeconds = 300, // 5 minutes
}) {
  // Validate at startup so you get a clear error immediately, not at runtime
  if (!gatewayUrl) throw new Error('[LogShipper] gatewayUrl is required');
  if (!productId) throw new Error('[LogShipper] productId is required');
  if (!appPrivateKey) throw new Error('[LogShipper] appPrivateKey is required');
  if (!appPrivateKey.includes('BEGIN')) {
    throw new Error('[LogShipper] appPrivateKey must be in PEM format. Check your .env — newlines may be escaped.');
  }

  /**
   * Generates a fresh short-lived RS256 JWT for authenticating to the gateway.
   *
   * The JWT payload contains only your product_id and standard time claims.
   * The private key SIGNS the token but is not included in the token itself.
   * The gateway verifies your identity using only the PUBLIC key stored in its DB.
   *
   * @returns {string} Signed JWT valid for tokenTtlSeconds
   */
  function generateLogToken() {
    return jwt.sign(
      {
        product_id: productId,
        // You can optionally add more claims here — they will be verified
        // but cannot be forged without the private key
      },
      appPrivateKey,
      {
        algorithm: 'RS256',         // ← Asymmetric RSA signing
        expiresIn: tokenTtlSeconds, // ← Token expires in 5 minutes
        // issuer: 'your-product-name', // Optional: add for extra traceability
      },
    );
  }

  /**
   * Ships a single exception to the universal log gateway.
   * Fire-and-forget — callers do NOT await this function.
   *
   * A fresh JWT is generated per call (or you can cache and refresh —
   * see the caching section below for high-frequency error scenarios).
   *
   * @param {Error}  error    - The caught exception
   * @param {object} context  - Request context extracted by the error handler
   */
  async function shipExceptionLog(error, context = {}) {
    const {
      method,
      path,
      statusCode = 500,
      companyId = defaultCompanyId,
      userId = null,
      ipAddress = null,
      userAgent = null,
      requestBody = null,
    } = context;

    // ── Build the payload ──────────────────────────────────────────────────
    const payload = {
      // Identification block — required by the gateway's DTO validation
      product_id: productId,   // Must match the product_id in your JWT claim
      company_id: companyId,
      user_id: userId,

      // Error details
      error_name:    error.name || 'UnknownError',
      error_message: error.message || 'No message provided',
      stack_trace:   error.stack || null,

      // Request context
      method:      method || null,
      path:        path || null,
      status_code: statusCode,

      // Metadata
      platform:    'express',
      environment: process.env.NODE_ENV || 'production',
      ip_address:  ipAddress,
      user_agent:  userAgent,
      request_body: requestBody ? sanitiseBody(requestBody) : null,
    };

    // ── Generate a fresh JWT for this request ──────────────────────────────
    // Generating a new token per call is safe and simple.
    // For very high error rates, see the token caching note below.
    let token;
    try {
      token = generateLogToken();
    } catch (tokenError) {
      console.error('[LogShipper] Failed to sign JWT — check APP_PRIVATE_KEY format:', tokenError.message);
      return; // Abort silently — logging failure must not crash your app
    }

    // ── Ship to gateway ────────────────────────────────────────────────────
    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // ← Short-lived RS256 JWT
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000), // Abort after 5 seconds
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(
          `[LogShipper] Gateway rejected log (HTTP ${response.status}): ${body}`,
        );
      }
    } catch (shipError) {
      // Network failure, timeout, or gateway down.
      // Absorb silently — production traffic MUST NOT be affected.
      console.error('[LogShipper] Failed to reach gateway:', shipError.message);
    }
  }

  return shipExceptionLog;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Express Error Middleware Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the Express 4-argument error middleware.
 *
 * Flow:
 *  1. Client receives HTTP error response immediately (non-blocking)
 *  2. Error is shipped to gateway asynchronously (fire-and-forget)
 *  3. Only 5xx errors are shipped — 4xx are client mistakes, not platform bugs
 *
 * Register AFTER all your routes:
 *   app.use(globalErrorHandler(shipExceptionLog));
 *
 * @param {Function} shipExceptionLog - The function returned by createLogShipper()
 */
function globalErrorHandler(shipExceptionLog) {
  // Express requires exactly 4 parameters to recognise this as an error handler
  // eslint-disable-next-line no-unused-vars
  return function universalErrorMiddleware(err, req, res, next) {
    const statusCode = err.status || err.statusCode || 500;

    // ── Step 1: Respond to client immediately ────────────────────────────────
    res.status(statusCode).json({
      status: 'error',
      statusCode,
      message:
        process.env.NODE_ENV === 'production'
          ? 'An internal server error occurred.'
          : err.message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });

    // ── Step 2: Only ship server errors (5xx) ───────────────────────────────
    if (statusCode < 500) return;

    // ── Step 3: Extract context from the request ─────────────────────────────
    const context = {
      method:     req.method,
      path:       req.originalUrl || req.path,
      statusCode,
      companyId:  req.user?.companyId || req.body?.company_id || 'N/A',
      userId:     req.user?.userId   || req.user?.id         || null,
      ipAddress:
        req.ip ||
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        null,
      userAgent:   req.headers['user-agent'] || null,
      requestBody: req.body ? sanitiseBody(req.body) : null,
    };

    // ── Step 4: Fire-and-forget — response already sent ─────────────────────
    shipExceptionLog(err, context).catch((unexpectedError) => {
      console.error('[LogShipper] Unexpected error in shipExceptionLog:', unexpectedError);
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Process-Level Error Handlers (catches errors outside HTTP middleware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers Node.js process handlers for:
 *   - unhandledRejection  → background Promise failures
 *   - uncaughtException   → synchronous errors outside try/catch
 *
 * These catch errors that slip past Express (cron jobs, event emitters, etc.)
 *
 * @param {Function} shipExceptionLog - The function returned by createLogShipper()
 */
function registerProcessErrorHandlers(shipExceptionLog) {
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error('[Process] Unhandled Promise Rejection:', error.message);
    shipExceptionLog(error, { path: 'process:unhandledRejection', statusCode: 500 })
      .catch(console.error);
  });

  process.on('uncaughtException', (error) => {
    console.error('[Process] Uncaught Exception:', error.message);
    shipExceptionLog(error, { path: 'process:uncaughtException', statusCode: 500 })
      .catch(console.error)
      .finally(() => {
        // After uncaughtException the process state is undefined — always exit
        process.exit(1);
      });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Body Sanitiser — strips sensitive fields before shipping
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'passwordhash',
  'confirmpassword', 'confirm_password',
  'token', 'accesstoken', 'access_token',
  'refreshtoken', 'refresh_token',
  'authorization', 'secret', 'card_number',
  'cvv', 'pin', 'ssn', 'social_security_number',
]);

function sanitiseBody(body) {
  if (typeof body !== 'object' || body === null) return {};
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value,
    ]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN CACHING NOTE (for high-frequency error scenarios)
// ─────────────────────────────────────────────────────────────────────────────
// If your platform experiences burst error scenarios (e.g., DB down → 1000
// errors/second), generating a new JWT per call adds minimal CPU overhead
// (RSA signing is ~1ms) but if you want to optimise:
//
//   let cachedToken = null;
//   let tokenExpiry = 0;
//
//   function getOrRefreshToken() {
//     const nowSeconds = Math.floor(Date.now() / 1000);
//     if (!cachedToken || nowSeconds >= tokenExpiry - 30) { // refresh 30s before expiry
//       cachedToken = generateLogToken();
//       tokenExpiry = nowSeconds + tokenTtlSeconds;
//     }
//     return cachedToken;
//   }
//
// Then replace `generateLogToken()` with `getOrRefreshToken()` in shipExceptionLog.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  createLogShipper,
  globalErrorHandler,
  registerProcessErrorHandlers,
  sanitiseBody,
};
