/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Universal Exception Log Shipper — Express.js Integration
 * Authentication: Server API Key
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * HOW THIS WORKS:
 * ─────────────────────────────────────────
 * Your platform was registered with the Universal Backend and received:
 *   - server_api_key   → You keep this SECRET on your server. NEVER expose it to the client.
 *   - product_id       → Your platform's unique identity UUID.
 *
 * For each log request, you send:
 *   Authorization: Bearer <your-server-api-key>
 *
 * SETUP:
 * ──────
 * 1. Add to your .env file:
 *      UNIVERSAL_GATEWAY_URL=https://your-universal-backend.com/api/v1/logs/errors
 *      PRODUCT_ID=<uuid issued at product registration>
 *      SERVER_API_KEY=<your server API key>
 *      DEFAULT_COMPANY_ID=<your default company_id, or leave as N/A>
 *
 * 2. Register in your Express app
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

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
 * @param {string} config.serverApiKey      Your Server API Key — NEVER log or expose
 * @param {string} [config.defaultCompanyId='N/A']  Default company_id for non-tenant errors
 */
function createLogShipper({
  gatewayUrl,
  productId,
  serverApiKey,
  defaultCompanyId = 'N/A',
}) {
  if (!gatewayUrl) throw new Error('[LogShipper] gatewayUrl is required');
  if (!productId) throw new Error('[LogShipper] productId is required');
  if (!serverApiKey) throw new Error('[LogShipper] serverApiKey is required');

  /**
   * Ships a single exception to the universal log gateway.
   * Fire-and-forget — callers do NOT await this function.
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
      product_id: productId,
      company_id: companyId,
      user_id: userId,

      error_name:    error.name || 'UnknownError',
      error_message: error.message || 'No message provided',
      stack_trace:   error.stack || null,

      method:      method || null,
      path:        path || null,
      status_code: statusCode,

      platform:    'express',
      environment: process.env.NODE_ENV || 'production',
      ip_address:  ipAddress,
      user_agent:  userAgent,
      request_body: requestBody ? sanitiseBody(requestBody) : null,
    };

    // ── Ship to gateway ────────────────────────────────────────────────────
    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serverApiKey}`,
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
      console.error('[LogShipper] Failed to reach gateway:', shipError.message);
    }
  }

  return shipExceptionLog;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Express Error Middleware Factory
// ─────────────────────────────────────────────────────────────────────────────

function globalErrorHandler(shipExceptionLog) {
  // eslint-disable-next-line no-unused-vars
  return function universalErrorMiddleware(err, req, res, next) {
    const statusCode = err.status || err.statusCode || 500;

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

    if (statusCode < 500) return;

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

    shipExceptionLog(err, context).catch((unexpectedError) => {
      console.error('[LogShipper] Unexpected error in shipExceptionLog:', unexpectedError);
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Process-Level Error Handlers
// ─────────────────────────────────────────────────────────────────────────────

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
        process.exit(1);
      });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Body Sanitiser
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

module.exports = {
  createLogShipper,
  globalErrorHandler,
  registerProcessErrorHandlers,
  sanitiseBody,
};
