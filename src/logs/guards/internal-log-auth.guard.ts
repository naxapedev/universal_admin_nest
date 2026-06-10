import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Request } from 'express';
import * as crypto from 'crypto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * InternalLogAuthGuard — RS256 Short-Lived JWT Verification
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY WE MOVED AWAY FROM x-log-secret (raw private key in header):
 * ─────────────────────────────────────────────────────────────────
 * The previous approach sent the RSA private key itself as an HTTP header.
 * This is a critical security flaw:
 *   - The private key is PERMANENT and CANNOT be rotated without re-registration.
 *   - If any log, proxy, CDN edge, or network capture ever records it, the
 *     attacker has a permanent key that works forever.
 *   - It defeats the entire purpose of asymmetric cryptography.
 *
 * THE CORRECT APPROACH — Short-Lived RS256 JWT:
 * ──────────────────────────────────────────────
 * The private key NEVER travels over the wire. Instead:
 *
 *   1. The calling platform SIGNS a short-lived JWT (exp: 5 minutes) using
 *      their `app_private_key` with the RS256 algorithm.
 *   2. They send the JWT in the `Authorization: Bearer <token>` header.
 *   3. THIS guard reads the `product_id` claim from the JWT body (without
 *      trusting it yet), looks up the product's `app_public_key` from the DB,
 *      and VERIFIES the JWT signature using the PUBLIC key.
 *   4. If verification passes, the JWT claims are trusted and the request proceeds.
 *
 * Security properties:
 *   ✅ Private key never leaves the product server — zero interception risk
 *   ✅ Token expires in 5 minutes — replay window is tiny even if captured
 *   ✅ `jti` (JWT ID) claim can be used for one-time-use enforcement (future)
 *   ✅ `iat` ensures tokens are fresh — old tokens auto-expire
 *   ✅ The public key is safe to store in our DB — it proves identity without
 *      exposing any secret
 *
 * Token structure (payload the calling platform must include):
 * ────────────────────────────────────────────────────────────
 *   {
 *     "product_id": "uuid-from-product-registry",   // Required: identity claim
 *     "iat": 1718000000,                             // Issued at (auto by jwt lib)
 *     "exp": 1718000300                              // Expires at (iat + 5 min)
 *   }
 *
 * Header sent by calling platform:
 *   Authorization: Bearer <RS256-signed-JWT>
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Maximum allowed token age in seconds. Tokens older than this are rejected. */
const MAX_TOKEN_AGE_SECONDS = 5 * 60; // 5 minutes

/** Shape of the verified product metadata attached to the request after guard passes. */
export interface VerifiedProductContext {
  product_id: string;
  product_name: string;
  token_issued_at: number;
}

/** Raw decoded JWT structure we expect in the payload. */
interface LogTokenPayload {
  product_id: string;
  iat: number;
  exp: number;
  jti?: string; // Optional JWT ID — useful for future replay prevention
}

@Injectable()
export class InternalLogAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalLogAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // ── Step 1: Extract JWT from Authorization: Bearer header ─────────────────
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(
        `[LogAuthGuard] Rejected — missing Authorization: Bearer header. IP: ${request.ip}`,
      );
      throw new UnauthorizedException(
        'Missing Authorization header. Expected: Authorization: Bearer <signed-jwt>',
      );
    }

    const inboundToken = authHeader.substring(7).trim();

    if (!inboundToken) {
      throw new UnauthorizedException('Empty Bearer token provided.');
    }

    // ── Step 2: Decode the JWT header + payload WITHOUT verifying yet ──────────
    // We need to read the product_id claim to know WHICH public key to use.
    // At this point we DO NOT trust the payload — it's just a read.
    let unverifiedPayload: LogTokenPayload;
    try {
      unverifiedPayload = decodeJwtPayloadUnsafe(inboundToken);
    } catch {
      this.logger.warn(
        `[LogAuthGuard] Rejected — malformed JWT structure. IP: ${request.ip}`,
      );
      throw new UnauthorizedException(
        'Malformed JWT token. Ensure the token is signed with RS256.',
      );
    }

    // ── Step 3: Validate required claims exist in unverified payload ──────────
    if (!unverifiedPayload.product_id) {
      throw new UnauthorizedException(
        'JWT payload must include a "product_id" claim.',
      );
    }

    const productId = unverifiedPayload.product_id.trim();

    // ── Step 4: Look up the product's PUBLIC key from the registry ────────────
    // We fetch app_public_key (safe to store) — NOT the private key.
    const product = await this.prisma.productRegistry.findUnique({
      where: { product_id: productId },
      select: {
        product_id: true,
        name: true,
        app_public_key: true,
      },
    });

    if (!product) {
      this.logger.warn(
        `[LogAuthGuard] Rejected — product_id "${productId}" not found in registry. IP: ${request.ip}`,
      );
      throw new UnauthorizedException(
        'Unrecognised product_id in JWT claim. Ensure the product is registered.',
      );
    }

    // ── Step 5: Cryptographically verify the JWT signature using the PUBLIC key ─
    // This is the core of RS256 verification. We use Node's built-in crypto —
    // no external library needed. If the private key that signed this token
    // doesn't match the stored public key, verification FAILS.
    let verifiedPayload: LogTokenPayload;
    try {
      verifiedPayload = verifyRS256Jwt(inboundToken, product.app_public_key);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(
        `[LogAuthGuard] Rejected — JWT verification failed for product "${productId}": ${message}. IP: ${request.ip}`,
      );

      // Provide specific, actionable error messages without leaking internals
      if (message.includes('expired')) {
        throw new UnauthorizedException(
          'JWT token has expired. Generate a new token (max age: 5 minutes).',
        );
      }
      throw new UnauthorizedException(
        'JWT signature verification failed. Ensure the token is signed with your app_private_key using RS256.',
      );
    }

    // ── Step 6: Enforce max token age (defense-in-depth against stale tokens) ──
    // The JWT `exp` claim handles expiry, but we add a belt-and-suspenders check
    // on `iat` to reject tokens issued too far in the past, even if somehow
    // the exp was set to a very long duration.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenAgeSeconds = nowSeconds - verifiedPayload.iat;

    if (tokenAgeSeconds > MAX_TOKEN_AGE_SECONDS) {
      this.logger.warn(
        `[LogAuthGuard] Rejected — token for "${productId}" is ${tokenAgeSeconds}s old (max: ${MAX_TOKEN_AGE_SECONDS}s). IP: ${request.ip}`,
      );
      throw new UnauthorizedException(
        `Token age exceeds maximum allowed (${MAX_TOKEN_AGE_SECONDS / 60} minutes). Generate a fresh token.`,
      );
    }

    // ── Step 7: Attach verified product context to the request ────────────────
    (request as any).verifiedProduct = {
      product_id: verifiedPayload.product_id,
      product_name: product.name,
      token_issued_at: verifiedPayload.iat,
    } satisfies VerifiedProductContext;

    this.logger.debug(
      `[LogAuthGuard] ✅ Authenticated: "${product.name}" (${productId}) — token age: ${tokenAgeSeconds}s`,
    );

    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT Utilities — Pure Node.js crypto, no external dependencies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decodes a JWT's payload WITHOUT cryptographic verification.
 * Used ONLY to read the product_id so we know which public key to fetch.
 * The result is UNTRUSTED until verifyRS256Jwt() succeeds.
 */
function decodeJwtPayloadUnsafe(token: string): LogTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT must have exactly 3 parts (header.payload.signature)');
  }
  const payloadBase64 = parts[1];
  // JWT uses base64url — replace URL-safe chars and pad
  const padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
  const jsonStr = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(jsonStr) as LogTokenPayload;
}

/**
 * Verifies a JWT signed with RS256 (RSA + SHA-256) using the given public key.
 * Uses Node.js built-in `crypto` module — no jsonwebtoken package needed.
 *
 * Checks:
 *  - Algorithm header is exactly "RS256"
 *  - Signature is cryptographically valid against the public key
 *  - Token is not expired (exp claim)
 *  - Token is not used before its issued time (iat claim)
 *
 * @throws Error with descriptive message on any validation failure
 */
function verifyRS256Jwt(token: string, publicKeyPem: string): LogTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT structure');

  const [headerB64, payloadB64, signatureB64] = parts;

  // ── Verify algorithm claim in header ──────────────────────────────────────
  const headerJson = Buffer.from(
    headerB64.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  ).toString('utf8');
  const header = JSON.parse(headerJson) as { alg: string; typ: string };

  if (header.alg !== 'RS256') {
    throw new Error(
      `Unsupported algorithm: "${header.alg}". Only RS256 is accepted.`,
    );
  }

  // ── Verify cryptographic signature ────────────────────────────────────────
  // The signing input is exactly "base64url(header) + '.' + base64url(payload)"
  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureBuffer = Buffer.from(
    signatureB64.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );

  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(signingInput, 'utf8');

  const isValid = verify.verify(publicKeyPem, signatureBuffer);
  if (!isValid) {
    throw new Error('Signature verification failed — invalid signing key');
  }

  // ── Decode and validate time claims ──────────────────────────────────────
  const payloadJson = Buffer.from(
    payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  ).toString('utf8');
  const payload = JSON.parse(payloadJson) as LogTokenPayload;

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (payload.exp && nowSeconds >= payload.exp) {
    throw new Error('Token has expired (exp claim)');
  }

  if (payload.iat && nowSeconds < payload.iat - 30) {
    // Allow 30s clock skew
    throw new Error('Token issued in the future (iat claim) — check server clock');
  }

  return payload;
}
