"use strict";

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "store-data.json");
const DB_TABLE = "store_state";
const DB_HISTORY_TABLE = "store_state_history";
const MAX_BODY_SIZE = 30 * 1024 * 1024;
const REQUEST_BODY_TIMEOUT_MS = Math.max(5000, Number(process.env.REQUEST_BODY_TIMEOUT_MS || 20 * 1000));
const SERVER_REQUEST_TIMEOUT_MS = Math.max(10 * 1000, Number(process.env.SERVER_REQUEST_TIMEOUT_MS || 30 * 1000));
const SERVER_KEEP_ALIVE_TIMEOUT_MS = Math.max(1000, Number(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS || 5000));
const STATIC_CACHE_MAX_AGE_SEC = Math.max(0, Number(process.env.STATIC_CACHE_MAX_AGE_SEC || 300));
const STATIC_STALE_WHILE_REVALIDATE_SEC = Math.max(0, Number(process.env.STATIC_STALE_WHILE_REVALIDATE_SEC || 600));
const ADMIN_SESSION_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.ADMIN_SESSION_TTL_MS || 24 * 60 * 60 * 1000));
const MIN_ADMIN_PASSWORD_LENGTH = 6;
const MAX_ADMIN_PASSWORD_LENGTH = 128;
const ADMIN_BRUTE_FORCE_MAX_ATTEMPTS = Math.max(1, Number(process.env.ADMIN_BRUTE_FORCE_MAX_ATTEMPTS || 5));
const ADMIN_BRUTE_FORCE_WINDOW_MS = Math.max(60 * 1000, Number(process.env.ADMIN_BRUTE_FORCE_WINDOW_MS || 15 * 60 * 1000));
const ADMIN_BRUTE_FORCE_BLOCK_MS = Math.max(60 * 1000, Number(process.env.ADMIN_BRUTE_FORCE_BLOCK_MS || 15 * 60 * 1000));
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_REVIEW_AUTHOR_LENGTH = 80;
const MAX_REVIEW_CITY_LENGTH = 80;
const MAX_REVIEW_TEXT_LENGTH = 500;
const MAX_REVIEW_PHOTO_DATA_LENGTH = 700 * 1024;
const MAX_HOMEPAGE_REVIEWS = 30;
const MAX_PRODUCT_REVIEWS_PER_PRODUCT = 80;
const MAX_PENDING_HOMEPAGE_REVIEWS = 120;
const MAX_PENDING_PRODUCT_REVIEWS_PER_PRODUCT = 120;
const REVIEW_CAPTCHA_TTL_MS = 20 * 60 * 1000;
const REVIEW_CAPTCHA_MIN_AGE_MS = 1500;
const REVIEW_CAPTCHA_SECRET = crypto.randomBytes(32).toString("hex");
const REVIEW_LINK_PATTERN = /(https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/|\b))/i;
const REVIEW_PRIVACY_CONSENT_VERSION = safeString(process.env.REVIEW_PRIVACY_CONSENT_VERSION || "privacy-v1-2026-04-08").slice(0, 64) || "privacy-v1-2026-04-08";
const REVIEW_TERMS_CONSENT_VERSION = safeString(process.env.REVIEW_TERMS_CONSENT_VERSION || "terms-v2-2026-04-09").slice(0, 64) || "terms-v2-2026-04-09";
const ADMIN_PASSWORD_HASH_PREFIX = "pbkdf2_sha256";
const ADMIN_PASSWORD_HASH_ITERATIONS = 180000;
const ADMIN_PASSWORD_HASH_BYTES = 32;
const ADMIN_PASSWORD_SALT_BYTES = 16;
const ADMIN_PASSWORD_HASH_DIGEST = "sha256";
const STORE_SHRINK_GUARD_MIN_DROP_COUNT = Math.max(1, Number(process.env.STORE_SHRINK_GUARD_MIN_DROP_COUNT || 10));
const STORE_SHRINK_GUARD_MIN_DROP_RATIO = Math.min(0.95, Math.max(0.05, Number(process.env.STORE_SHRINK_GUARD_MIN_DROP_RATIO || 0.15)));
const STORE_HISTORY_MAX_ROWS = Math.max(20, Number(process.env.STORE_HISTORY_MAX_ROWS || 300));
const STORE_DELETE_INTENT_SAMPLE_LIMIT = Math.max(1, Number(process.env.STORE_DELETE_INTENT_SAMPLE_LIMIT || 8));

const RATE_LIMIT_RULES = {
  adminPanel: {
    name: "admin_panel",
    max: 120,
    windowMs: 60 * 1000,
    message: "Too many admin requests"
  },
  apiGeneral: {
    name: "api_general",
    max: 240,
    windowMs: 60 * 1000,
    message: "Too many API requests"
  },
  apiWrite: {
    name: "api_write",
    max: 60,
    windowMs: 60 * 1000,
    message: "Too many write requests"
  },
  adminAuth: {
    name: "admin_auth",
    max: 10,
    windowMs: 10 * 60 * 1000,
    message: "Too many login attempts"
  },
  adminPassword: {
    name: "admin_password",
    max: 20,
    windowMs: 10 * 60 * 1000,
    message: "Too many password change attempts"
  },
  adminSnapshot: {
    name: "admin_snapshot",
    max: 20,
    windowMs: 10 * 60 * 1000,
    message: "Too many snapshot attempts"
  },
  clientErrors: {
    name: "client_errors",
    max: 30,
    windowMs: 60 * 1000,
    message: "Too many client error reports"
  },
  productReviews: {
    name: "product_reviews",
    max: 20,
    windowMs: 60 * 1000,
    message: "Too many review submissions"
  },
  homepageReviews: {
    name: "homepage_reviews",
    max: 12,
    windowMs: 60 * 1000,
    message: "Too many homepage review submissions"
  },
  reviewCaptcha: {
    name: "review_captcha",
    max: 60,
    windowMs: 60 * 1000,
    message: "Too many captcha requests"
  }
};

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' https://mc.yandex.ru https://www.googletagmanager.com https://www.google-analytics.com",
  "connect-src 'self' https://mc.yandex.ru https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src https://mc.yandex.ru",
  "form-action 'self'"
].join("; ");

const ALLOWED_STATIC_FILES = new Set([
  "index.html",
  "styles.css",
  "favicon.svg",
  "assets/hero-welcome-readable.jpg",
  "assets/hero-welcome-logo.jpg",
  "robots.txt",
  "sitemap.xml",
  "privacy.html",
  "terms.html",
  "returns.html",
  "contacts.html",
  "admin/index.html",
  "scripts/common.js",
  "scripts/app.js",
  "scripts/admin.js",
  "scripts/site-config.js",
  "scripts/analytics.js",
  "scripts/monitoring.js"
]);

const FALLBACK_DATA = {
  settings: {
    telegramChannel: "https://t.me/veligodsky_ls",
    telegramDM: "https://t.me/veligodsky_ls",
    freeShippingThreshold: 8000,
    adminPassword: "admin123",
    storeName: "VELIGODSKY.PARFUMS",
    backupNoticeEnabled: true,
    heroImage: ""
  },
  products: []
};

let storeRepository = null;
let httpServer = null;
let shuttingDown = false;
let storeMutationQueue = Promise.resolve();
const adminSessions = new Map();
const rateLimitBuckets = new Map();
let rateLimitLastCleanupAt = 0;
const adminLoginFailures = new Map();

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end(text);
}

function buildWeakEtagFromString(value) {
  const hash = crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 24);
  return "W/\"" + hash + "\"";
}

function buildWeakEtagFromStat(stat) {
  const sizeHex = Math.max(0, Number(stat && stat.size) || 0).toString(16);
  const mtimeHex = Math.max(0, Math.trunc(Number(stat && stat.mtimeMs) || 0)).toString(16);
  return "W/\"" + sizeHex + "-" + mtimeHex + "\"";
}

function isEtagMatch(req, etag) {
  if (!etag || !req || !req.headers) {
    return false;
  }

  const raw = req.headers["if-none-match"];
  if (!raw) {
    return false;
  }

  const header = Array.isArray(raw) ? raw.join(",") : String(raw);
  if (!header.trim()) {
    return false;
  }

  if (header.includes("*")) {
    return true;
  }

  return header.split(",").map((part) => part.trim()).includes(etag);
}

function getStaticCacheControl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") {
    return "no-cache";
  }

  if (STATIC_CACHE_MAX_AGE_SEC <= 0) {
    return "no-cache";
  }

  if (STATIC_STALE_WHILE_REVALIDATE_SEC > 0) {
    return "public, max-age=" + STATIC_CACHE_MAX_AGE_SEC + ", stale-while-revalidate=" + STATIC_STALE_WHILE_REVALIDATE_SEC;
  }

  return "public, max-age=" + STATIC_CACHE_MAX_AGE_SEC;
}

function sendStoreDataResponse(req, res, statusCode, payload) {
  const body = JSON.stringify(payload);
  const etag = buildWeakEtagFromString(body);
  const baseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, max-age=0, must-revalidate",
    "ETag": etag,
    "Vary": "Authorization"
  };

  if (statusCode === 200 && (req.method === "GET" || req.method === "HEAD") && isEtagMatch(req, etag)) {
    res.writeHead(304, baseHeaders);
    res.end();
    return;
  }

  res.writeHead(statusCode, Object.assign({}, baseHeaders, {
    "Content-Length": Buffer.byteLength(body)
  }));

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  res.end(body);
}

function handleBodyReadFailure(res, error) {
  if (!error || typeof error.message !== "string") {
    return false;
  }

  if (error.message === "BODY_TOO_LARGE") {
    sendJson(res, 413, { error: "PAYLOAD_TOO_LARGE" });
    return true;
  }

  if (error.message === "BODY_TIMEOUT") {
    sendJson(res, 408, { error: "REQUEST_TIMEOUT" });
    return true;
  }

  if (error.message === "REQUEST_ABORTED") {
    sendJson(res, 400, { error: "REQUEST_ABORTED" });
    return true;
  }

  return false;
}

function getClientIp(req) {
  const forwardedFor = req.headers && req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    const firstIp = forwardedFor.split(",")[0];
    return safeString(firstIp) || "unknown";
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length) {
    return safeString(forwardedFor[0]) || "unknown";
  }
  const remoteAddress = req.socket && req.socket.remoteAddress;
  return safeString(remoteAddress) || "unknown";
}

function getRateLimitRule(pathname, method) {
  const safePath = String(pathname || "");
  const safeMethod = String(method || "").toUpperCase();

  if (safePath === "/api/admin/auth" && safeMethod === "POST") {
    return RATE_LIMIT_RULES.adminAuth;
  }

  if (safePath === "/api/admin/password" && safeMethod === "POST") {
    return RATE_LIMIT_RULES.adminPassword;
  }

  if (safePath === "/api/admin/snapshot" && safeMethod === "POST") {
    return RATE_LIMIT_RULES.adminSnapshot;
  }

  if (safePath === "/api/client-errors" && safeMethod === "POST") {
    return RATE_LIMIT_RULES.clientErrors;
  }

  if (safePath === "/api/product-reviews" && safeMethod === "POST") {
    return RATE_LIMIT_RULES.productReviews;
  }

  if (safePath === "/api/homepage-reviews" && safeMethod === "POST") {
    return RATE_LIMIT_RULES.homepageReviews;
  }

  if (safePath === "/api/review-captcha" && safeMethod === "GET") {
    return RATE_LIMIT_RULES.reviewCaptcha;
  }

  if (safePath === "/api/store-data" && safeMethod === "PUT") {
    return RATE_LIMIT_RULES.apiWrite;
  }

  if (safePath.startsWith("/api/")) {
    return RATE_LIMIT_RULES.apiGeneral;
  }

  if (safePath === "/admin" || safePath.startsWith("/admin/")) {
    return RATE_LIMIT_RULES.adminPanel;
  }

  return null;
}

function cleanupRateLimitBuckets(now) {
  if (now - rateLimitLastCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS && rateLimitBuckets.size < 5000) {
    return;
  }

  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (!bucket || bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }

  rateLimitLastCleanupAt = now;
}

function ensureRateLimit(req, res, pathname) {
  const rule = getRateLimitRule(pathname, req.method);
  if (!rule) {
    return true;
  }

  const now = Date.now();
  cleanupRateLimitBuckets(now);

  const clientIp = getClientIp(req);
  const key = rule.name + "|" + clientIp;
  let bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = {
      count: 0,
      resetAt: now + rule.windowMs
    };
    rateLimitBuckets.set(key, bucket);
  }

  if (bucket.count >= rule.max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    sendJson(res, 429, {
      error: "RATE_LIMIT_EXCEEDED",
      message: rule.message,
      retryAfterSec: retryAfterSec
    });
    return false;
  }

  bucket.count += 1;
  return true;
}

function cleanupAdminLoginFailures(now) {
  for (const [ip, state] of adminLoginFailures.entries()) {
    if (!state) {
      adminLoginFailures.delete(ip);
      continue;
    }

    const hasActiveBan = state.blockedUntil > now;
    const isWindowExpired = !hasActiveBan && state.windowStartedAt + ADMIN_BRUTE_FORCE_WINDOW_MS <= now;
    if (isWindowExpired) {
      adminLoginFailures.delete(ip);
    }
  }
}

function getAdminLoginBanState(clientIp) {
  const now = Date.now();
  cleanupAdminLoginFailures(now);

  const state = adminLoginFailures.get(clientIp);
  if (!state) {
    return { blocked: false, retryAfterSec: 0 };
  }

  if (state.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((state.blockedUntil - now) / 1000))
    };
  }

  return { blocked: false, retryAfterSec: 0 };
}

function registerFailedAdminLogin(clientIp) {
  const now = Date.now();
  cleanupAdminLoginFailures(now);

  let state = adminLoginFailures.get(clientIp);
  if (!state || state.windowStartedAt + ADMIN_BRUTE_FORCE_WINDOW_MS <= now) {
    state = {
      attempts: 0,
      windowStartedAt: now,
      blockedUntil: 0
    };
  }

  state.attempts += 1;

  if (state.attempts >= ADMIN_BRUTE_FORCE_MAX_ATTEMPTS) {
    state.blockedUntil = now + ADMIN_BRUTE_FORCE_BLOCK_MS;
  }

  adminLoginFailures.set(clientIp, state);

  return {
    attempts: state.attempts,
    blocked: state.blockedUntil > now,
    retryAfterSec: state.blockedUntil > now
      ? Math.max(1, Math.ceil((state.blockedUntil - now) / 1000))
      : 0
  };
}

function clearFailedAdminLogins(clientIp) {
  adminLoginFailures.delete(clientIp);
}

function safeString(value) {
  return String(value || "").trim();
}

function clampInteger(value, min, max, fallback) {
  const safeFallback = Number.isFinite(fallback) ? fallback : min;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return safeFallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function normalizeIsoDate(value) {
  const safe = safeString(value);
  if (!safe) {
    return new Date().toISOString();
  }
  const parsed = new Date(safe);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function parseBooleanLike(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const safe = safeString(value).toLowerCase();
  return safe === "1" || safe === "true" || safe === "yes" || safe === "on";
}

function containsLink(value) {
  return REVIEW_LINK_PATTERN.test(safeString(value));
}

function sanitizeReviewPhoto(value) {
  const safe = safeString(value);
  if (!safe) {
    return "";
  }

  if (safe.length > MAX_REVIEW_PHOTO_DATA_LENGTH) {
    throw new Error("REVIEW_PHOTO_TOO_LARGE");
  }

  if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(safe)) {
    throw new Error("INVALID_REVIEW_PHOTO");
  }

  return safe;
}

function normalizeReviewConsentProof(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const acceptedAt = normalizeIsoDate(raw.acceptedAt || raw.createdAt || raw.grantedAt);
  const version = safeString(raw.version).slice(0, 64) || REVIEW_PRIVACY_CONSENT_VERSION;
  const form = safeString(raw.form).slice(0, 48) || "review";
  const ip = safeString(raw.ip).slice(0, 120);

  return {
    acceptedAt,
    version,
    form,
    ip
  };
}

function normalizeReviewTermsProof(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const acceptedAt = normalizeIsoDate(raw.acceptedAt || raw.createdAt || raw.grantedAt);
  const version = safeString(raw.version).slice(0, 64) || REVIEW_TERMS_CONSENT_VERSION;
  const form = safeString(raw.form).slice(0, 48) || "review";
  const ip = safeString(raw.ip).slice(0, 120);

  return {
    acceptedAt,
    version,
    form,
    ip
  };
}

function normalizeStoredReview(raw, prefix) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const author = safeString(raw.author || raw.name).slice(0, MAX_REVIEW_AUTHOR_LENGTH);
  const text = safeString(raw.text || raw.message).slice(0, MAX_REVIEW_TEXT_LENGTH);
  if (!author || !text) {
    return null;
  }

  const city = safeString(raw.city).slice(0, MAX_REVIEW_CITY_LENGTH);
  const rating = clampInteger(raw.rating, 1, 5, 5);
  const idPrefix = safeString(prefix) || "r";
  const consentProof = normalizeReviewConsentProof(raw.consentProof || raw.consent);
  const termsProof = normalizeReviewTermsProof(raw.termsProof || raw.terms);

  const next = {
    id: safeString(raw.id) || (idPrefix + "_" + crypto.randomBytes(6).toString("hex")),
    author,
    city,
    text,
    rating,
    photo: sanitizeReviewPhoto(raw.photo || raw.image),
    createdAt: normalizeIsoDate(raw.createdAt)
  };

  if (consentProof) {
    next.consentProof = consentProof;
  }
  if (termsProof) {
    next.termsProof = termsProof;
  }

  return next;
}

function normalizeStoredReviewList(rawReviews, prefix, maxItems) {
  const source = Array.isArray(rawReviews) ? rawReviews : [];
  const normalized = source
    .map((entry) => normalizeStoredReview(entry, prefix))
    .filter(Boolean)
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

  if (Number.isFinite(maxItems) && maxItems > 0) {
    return normalized.slice(0, maxItems);
  }

  return normalized;
}

function parseIncomingReviewPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("INVALID_REVIEW_PAYLOAD");
  }

  const author = safeString(payload.author).slice(0, MAX_REVIEW_AUTHOR_LENGTH);
  const city = safeString(payload.city).slice(0, MAX_REVIEW_CITY_LENGTH);
  const text = safeString(payload.text).slice(0, MAX_REVIEW_TEXT_LENGTH);
  const rating = clampInteger(payload.rating, 1, 5, 5);
  const website = safeString(payload.website).slice(0, 200);
  const captchaToken = safeString(payload.captchaToken).slice(0, 2048);
  const captchaAnswer = safeString(payload.captchaAnswer).slice(0, 32);
  const consentAccepted = parseBooleanLike(payload.consentAccepted);
  const consentVersion = safeString(payload.consentVersion).slice(0, 64) || REVIEW_PRIVACY_CONSENT_VERSION;
  const termsAccepted = parseBooleanLike(payload.termsAccepted);
  const termsVersion = safeString(payload.termsVersion).slice(0, 64) || REVIEW_TERMS_CONSENT_VERSION;
  const photo = sanitizeReviewPhoto(payload.photo || payload.image);

  if (website) {
    throw new Error("SPAM_DETECTED");
  }

  if (!author || author.length < 2) {
    throw new Error("AUTHOR_REQUIRED");
  }
  if (!text || text.length < 6) {
    throw new Error("REVIEW_TEXT_REQUIRED");
  }
  if (containsLink(author) || containsLink(city) || containsLink(text)) {
    throw new Error("LINKS_NOT_ALLOWED");
  }
  if (!consentAccepted) {
    throw new Error("CONSENT_REQUIRED");
  }
  if (!termsAccepted) {
    throw new Error("TERMS_REQUIRED");
  }

  return {
    author,
    city,
    text,
    rating,
    photo,
    captchaToken,
    captchaAnswer,
    consentAccepted: true,
    consentVersion,
    termsAccepted: true,
    termsVersion
  };
}

function parseIncomingProductReview(payload) {
  const review = parseIncomingReviewPayload(payload);
  const productId = safeString(payload && payload.productId).slice(0, 120);

  if (!productId) {
    throw new Error("PRODUCT_ID_REQUIRED");
  }

  return Object.assign({ productId }, review);
}

function parseIncomingHomepageReview(payload) {
  return parseIncomingReviewPayload(payload);
}

function signReviewCaptcha(encodedPayload) {
  return crypto
    .createHmac("sha256", REVIEW_CAPTCHA_SECRET)
    .update(String(encodedPayload || ""), "utf8")
    .digest("hex");
}

function createReviewCaptchaChallenge() {
  const left = clampInteger(crypto.randomInt(1, 10), 1, 9, 1);
  const right = clampInteger(crypto.randomInt(1, 10), 1, 9, 1);
  const payload = {
    answer: left + right,
    iat: Date.now(),
    exp: Date.now() + REVIEW_CAPTCHA_TTL_MS,
    nonce: crypto.randomBytes(8).toString("hex")
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  return {
    token: encodedPayload + "." + signReviewCaptcha(encodedPayload),
    prompt: "Сколько будет " + left + " + " + right + "?"
  };
}

function verifyReviewCaptcha(token, answer) {
  const safeToken = safeString(token);
  const safeAnswer = safeString(answer);
  if (!safeToken || !safeAnswer) {
    throw new Error("CAPTCHA_REQUIRED");
  }

  const parts = safeToken.split(".");
  if (parts.length !== 2) {
    throw new Error("CAPTCHA_INVALID");
  }

  const encodedPayload = safeString(parts[0]);
  const signature = safeString(parts[1]);
  if (!encodedPayload || !signature) {
    throw new Error("CAPTCHA_INVALID");
  }

  if (!safeCompareStrings(signature, signReviewCaptcha(encodedPayload))) {
    throw new Error("CAPTCHA_INVALID");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch (error) {
    throw new Error("CAPTCHA_INVALID");
  }

  const now = Date.now();
  const expectedAnswer = clampInteger(payload && payload.answer, 0, 100, Number.NaN);
  const issuedAt = clampInteger(payload && payload.iat, 0, Number.MAX_SAFE_INTEGER, 0);
  const expiresAt = clampInteger(payload && payload.exp, 0, Number.MAX_SAFE_INTEGER, 0);
  const actualAnswer = clampInteger(safeAnswer, -100, 100, Number.NaN);

  if (!Number.isFinite(expectedAnswer) || !issuedAt || !expiresAt || !Number.isFinite(actualAnswer)) {
    throw new Error("CAPTCHA_INVALID");
  }

  if (now > expiresAt) {
    throw new Error("CAPTCHA_EXPIRED");
  }

  if (now - issuedAt < REVIEW_CAPTCHA_MIN_AGE_MS) {
    throw new Error("CAPTCHA_TOO_FAST");
  }

  if (actualAnswer !== expectedAnswer) {
    throw new Error("CAPTCHA_INVALID");
  }
}

function hashAdminPassword(password) {
  const safePassword = safeString(password);
  const salt = crypto.randomBytes(ADMIN_PASSWORD_SALT_BYTES);
  const hash = crypto.pbkdf2Sync(
    safePassword,
    salt,
    ADMIN_PASSWORD_HASH_ITERATIONS,
    ADMIN_PASSWORD_HASH_BYTES,
    ADMIN_PASSWORD_HASH_DIGEST
  );

  return [
    ADMIN_PASSWORD_HASH_PREFIX,
    String(ADMIN_PASSWORD_HASH_ITERATIONS),
    salt.toString("base64url"),
    hash.toString("base64url")
  ].join("$");
}

function parseAdminPasswordHash(value) {
  const safeValue = safeString(value);
  if (!safeValue) {
    return null;
  }

  const parts = safeValue.split("$");
  if (parts.length !== 4) {
    return null;
  }
  if (parts[0] !== ADMIN_PASSWORD_HASH_PREFIX) {
    return null;
  }

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 50000 || iterations > 2000000) {
    return null;
  }

  let salt;
  let hash;
  try {
    salt = Buffer.from(parts[2], "base64url");
    hash = Buffer.from(parts[3], "base64url");
  } catch (error) {
    return null;
  }

  if (!salt.length || !hash.length) {
    return null;
  }

  return {
    iterations,
    salt,
    hash
  };
}

function isAdminPasswordHash(value) {
  return Boolean(parseAdminPasswordHash(value));
}

function verifyAdminPassword(candidatePassword, storedPassword) {
  const safeCandidate = safeString(candidatePassword);
  const safeStored = safeString(storedPassword);
  const parsed = parseAdminPasswordHash(safeStored);

  if (!parsed) {
    return safeCompareStrings(safeCandidate, safeStored);
  }

  const candidateHash = crypto.pbkdf2Sync(
    safeCandidate,
    parsed.salt,
    parsed.iterations,
    parsed.hash.length,
    ADMIN_PASSWORD_HASH_DIGEST
  );

  return safeCompareStrings(candidateHash.toString("base64url"), parsed.hash.toString("base64url"));
}

function normalizePersistedAdminPassword(value) {
  const safeValue = safeString(value);
  if (!safeValue) {
    return hashAdminPassword(safeString(FALLBACK_DATA.settings.adminPassword || "admin123"));
  }
  if (isAdminPasswordHash(safeValue)) {
    return safeValue;
  }
  return hashAdminPassword(safeValue);
}

function readAdminPassword(data) {
  const fromData = safeString(data && data.settings && data.settings.adminPassword);
  if (fromData) {
    return fromData;
  }
  return safeString(FALLBACK_DATA.settings.adminPassword || "admin123");
}

function sanitizePublicStoreData(data) {
  const safe = cloneData(validateStoreData(data));
  if (safe.settings && Object.prototype.hasOwnProperty.call(safe.settings, "adminPassword")) {
    delete safe.settings.adminPassword;
  }
  delete safe.pendingHomepageReviews;
  if (Array.isArray(safe.reviews)) {
    safe.reviews = safe.reviews.map((review) => {
      const nextReview = Object.assign({}, review);
      delete nextReview.consentProof;
      delete nextReview.consent;
      delete nextReview.termsProof;
      delete nextReview.terms;
      return nextReview;
    });
  }
  safe.products = safe.products.map((product) => {
    const next = Object.assign({}, product);
    delete next.pendingReviews;
    if (Array.isArray(next.reviews)) {
      next.reviews = next.reviews.map((review) => {
        const nextReview = Object.assign({}, review);
        delete nextReview.consentProof;
        delete nextReview.consent;
        delete nextReview.termsProof;
        delete nextReview.terms;
        return nextReview;
      });
    }
    return next;
  });
  return safe;
}

function sanitizeAdminStoreData(data) {
  const safe = cloneData(validateStoreData(data));
  if (safe.settings && Object.prototype.hasOwnProperty.call(safe.settings, "adminPassword")) {
    delete safe.settings.adminPassword;
  }
  return safe;
}

function getStoreDataForRequest(req, data) {
  const token = getBearerToken(req);
  if (isAdminSessionValid(token)) {
    return sanitizeAdminStoreData(data);
  }
  return sanitizePublicStoreData(data);
}

function ensureIncomingAdminPassword(payload, currentData) {
  const next = cloneData(validateStoreData(payload));
  const currentPassword = readAdminPassword(currentData);
  next.settings.adminPassword = normalizePersistedAdminPassword(currentPassword);
  return next;
}

function getProductsCount(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.products)) {
    return 0;
  }
  return data.products.length;
}

function isIfMatchSatisfied(req, currentEtag) {
  const raw = req && req.headers ? req.headers["if-match"] : "";
  const header = Array.isArray(raw) ? raw.join(",") : String(raw || "");
  if (!header.trim()) {
    return false;
  }
  if (!currentEtag) {
    return false;
  }

  const values = header.split(",").map((part) => part.trim()).filter(Boolean);
  if (!values.length) {
    return true;
  }
  if (values.includes("*")) {
    return true;
  }
  return values.includes(currentEtag);
}

function hasForceReplaceFlag(req, parsedPayload) {
  const headerValue = req && req.headers ? req.headers["x-store-force-replace"] : "";
  const queryFlag = req && req.url ? new URL(req.url, "http://localhost").searchParams.get("forceReplace") : "";
  if (isTrueLike(headerValue) || isTrueLike(queryFlag)) {
    return true;
  }

  if (parsedPayload && typeof parsedPayload === "object") {
    if (isTrueLike(parsedPayload.forceReplaceProducts)) {
      return true;
    }

    if (parsedPayload.meta && typeof parsedPayload.meta === "object" && isTrueLike(parsedPayload.meta.forceReplaceProducts)) {
      return true;
    }
  }

  return false;
}

function parseNonNegativeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const normalized = Math.round(parsed);
  if (normalized < 0) {
    return null;
  }
  return normalized;
}

function getExpectedRemovedProductsCount(req, parsedPayload) {
  const headerRaw = req && req.headers ? req.headers["x-store-expected-removed-products"] : "";
  const headerValue = Array.isArray(headerRaw) ? headerRaw.join(",") : String(headerRaw || "").trim();
  if (headerValue) {
    const parsedHeader = parseNonNegativeInteger(headerValue);
    if (parsedHeader !== null) {
      return parsedHeader;
    }
  }

  if (parsedPayload && typeof parsedPayload === "object" && parsedPayload.meta && typeof parsedPayload.meta === "object") {
    const parsedMeta = parseNonNegativeInteger(parsedPayload.meta.expectedRemovedProducts);
    if (parsedMeta !== null) {
      return parsedMeta;
    }
  }

  return null;
}

function getRemovedProductIds(currentData, nextData) {
  const currentProducts = currentData && Array.isArray(currentData.products) ? currentData.products : [];
  const nextProducts = nextData && Array.isArray(nextData.products) ? nextData.products : [];
  const nextIds = new Set(
    nextProducts
      .map((product) => safeString(product && product.id))
      .filter(Boolean)
  );

  return currentProducts
    .map((product) => safeString(product && product.id))
    .filter(Boolean)
    .filter((id) => !nextIds.has(id));
}

function getCatalogShrinkGuard(currentData, nextData) {
  const currentCount = getProductsCount(currentData);
  const nextCount = getProductsCount(nextData);
  const dropCount = Math.max(0, currentCount - nextCount);
  const dropRatio = currentCount > 0 ? dropCount / currentCount : 0;
  const blocked = currentCount > 0
    && nextCount < currentCount
    && dropCount >= STORE_SHRINK_GUARD_MIN_DROP_COUNT
    && dropRatio >= STORE_SHRINK_GUARD_MIN_DROP_RATIO;

  return {
    blocked,
    currentCount,
    nextCount,
    dropCount,
    dropRatio
  };
}

function getCatalogDeleteIntentGuard(currentData, nextData, expectedRemovedProducts) {
  const removedIds = getRemovedProductIds(currentData, nextData);
  const removedCount = removedIds.length;
  if (removedCount <= 0) {
    return {
      blocked: false,
      expectedRemovedProducts,
      removedCount,
      removedIdsSample: []
    };
  }

  const expected = parseNonNegativeInteger(expectedRemovedProducts);
  const blocked = expected === null || expected !== removedCount;

  return {
    blocked,
    expectedRemovedProducts: expected,
    removedCount,
    removedIdsSample: removedIds.slice(0, STORE_DELETE_INTENT_SAMPLE_LIMIT)
  };
}

function safeCompareStrings(left, right) {
  const leftValue = Buffer.from(String(left || ""), "utf8");
  const rightValue = Buffer.from(String(right || ""), "utf8");
  const maxLength = Math.max(leftValue.length, rightValue.length, 1);
  const leftBuffer = Buffer.alloc(maxLength, 0);
  const rightBuffer = Buffer.alloc(maxLength, 0);
  leftValue.copy(leftBuffer);
  rightValue.copy(rightBuffer);
  const areEqual = crypto.timingSafeEqual(leftBuffer, rightBuffer);
  return areEqual && leftValue.length === rightValue.length;
}

function cleanupExpiredAdminSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of adminSessions.entries()) {
    if (!expiresAt || expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function createAdminSession() {
  cleanupExpiredAdminSessions();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(token, expiresAt);
  return { token, expiresAt };
}

function getBearerToken(req) {
  const header = safeString(req.headers && req.headers.authorization);
  if (!header) {
    return "";
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return "";
  }
  return safeString(match[1]);
}

function isAdminSessionValid(token) {
  cleanupExpiredAdminSessions();
  if (!token) {
    return false;
  }
  const expiresAt = adminSessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

function ensureAdminAuthorized(req, res) {
  const token = getBearerToken(req);
  if (!isAdminSessionValid(token)) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return false;
  }
  return true;
}

function revokeAdminSessions(keepToken) {
  const keep = safeString(keepToken);
  if (!keep) {
    adminSessions.clear();
    return;
  }
  for (const token of adminSessions.keys()) {
    if (token !== keep) {
      adminSessions.delete(token);
    }
  }
}

function handleHealthCheck(req, res) {
  if (req.method === "HEAD") {
    res.writeHead(200, {
      "Cache-Control": "no-store"
    });
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  sendJson(res, 200, {
    ok: true,
    timestamp: new Date().toISOString()
  });
}

function validateStoreData(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("INVALID_PAYLOAD");
  }

  if (!payload.settings || typeof payload.settings !== "object") {
    throw new Error("INVALID_PAYLOAD");
  }

  if (!Array.isArray(payload.products)) {
    throw new Error("INVALID_PAYLOAD");
  }

  if (payload.reviews !== undefined && !Array.isArray(payload.reviews)) {
    throw new Error("INVALID_PAYLOAD");
  }

  if (payload.pendingHomepageReviews !== undefined && !Array.isArray(payload.pendingHomepageReviews)) {
    throw new Error("INVALID_PAYLOAD");
  }

  for (const product of payload.products) {
    if (!product || typeof product !== "object") {
      throw new Error("INVALID_PAYLOAD");
    }
    if (product.reviews !== undefined && !Array.isArray(product.reviews)) {
      throw new Error("INVALID_PAYLOAD");
    }
    if (product.pendingReviews !== undefined && !Array.isArray(product.pendingReviews)) {
      throw new Error("INVALID_PAYLOAD");
    }
  }

  return payload;
}

async function readSeedData() {
  await fsp.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fsp.readFile(DATA_FILE, "utf8");
    return validateStoreData(JSON.parse(raw));
  } catch (error) {
    return cloneData(FALLBACK_DATA);
  }
}

async function writeDataFile(filePath, payload) {
  const validated = validateStoreData(payload);
  const tempPath = filePath + ".tmp";
  const body = JSON.stringify(validated, null, 2);

  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(tempPath, body, "utf8");
  await fsp.rename(tempPath, filePath);

  return validated;
}

class FileStoreRepository {
  constructor(filePath) {
    this.filePath = filePath;
    this.historyDir = path.join(path.dirname(filePath), "history");
  }

  async init() {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsp.mkdir(this.historyDir, { recursive: true });

    try {
      const raw = await fsp.readFile(this.filePath, "utf8");
      validateStoreData(JSON.parse(raw));
    } catch (error) {
      await writeDataFile(this.filePath, await readSeedData());
    }
  }

  async read() {
    const raw = await fsp.readFile(this.filePath, "utf8");
    return validateStoreData(JSON.parse(raw));
  }

  async write(payload, options) {
    const previousPayload = options && options.previousPayload ? validateStoreData(options.previousPayload) : null;
    if (previousPayload) {
      await this.appendHistorySnapshot(previousPayload);
    }
    return writeDataFile(this.filePath, payload);
  }

  async appendHistorySnapshot(payload) {
    const safePayload = validateStoreData(payload);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const random = crypto.randomBytes(4).toString("hex");
    const filePath = path.join(this.historyDir, "store_state_" + stamp + "_" + random + ".json");
    await fsp.writeFile(filePath, JSON.stringify(safePayload, null, 2), "utf8");

    try {
      const files = (await fsp.readdir(this.historyDir))
        .filter((name) => name.startsWith("store_state_") && name.endsWith(".json"))
        .sort()
        .reverse();
      const toDelete = files.slice(STORE_HISTORY_MAX_ROWS);
      for (const name of toDelete) {
        await fsp.unlink(path.join(this.historyDir, name)).catch(() => undefined);
      }
    } catch (error) {
      // Non-fatal cleanup.
    }
  }

  async createSnapshot(source) {
    const current = await this.read();
    await this.appendHistorySnapshot(current);
    return {
      source: safeString(source || "manual_admin") || "manual_admin",
      productsCount: getProductsCount(current)
    };
  }

  async close() {
    return;
  }
}

class PostgresStoreRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async init() {
    await this.pool.query("SELECT 1");
    await this.pool.query(
      "CREATE TABLE IF NOT EXISTS " + DB_TABLE + " ("
      + "id SMALLINT PRIMARY KEY CHECK (id = 1), "
      + "payload JSONB NOT NULL, "
      + "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
      + ")"
    );

    await this.pool.query(
      "CREATE TABLE IF NOT EXISTS " + DB_HISTORY_TABLE + " ("
      + "snapshot_id BIGSERIAL PRIMARY KEY, "
      + "payload JSONB NOT NULL, "
      + "products_count INTEGER NOT NULL DEFAULT 0, "
      + "source TEXT NOT NULL DEFAULT 'api_put', "
      + "changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
      + ")"
    );
    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS " + DB_HISTORY_TABLE + "_changed_at_idx "
      + "ON " + DB_HISTORY_TABLE + " (changed_at DESC)"
    );

    const existing = await this.pool.query(
      "SELECT id FROM " + DB_TABLE + " WHERE id = 1 LIMIT 1"
    );

    if (existing.rowCount === 0) {
      await this.write(await readSeedData());
    }
  }

  async read() {
    const result = await this.pool.query(
      "SELECT payload FROM " + DB_TABLE + " WHERE id = 1 LIMIT 1"
    );

    if (result.rowCount === 0) {
      return this.write(await readSeedData());
    }

    return normalizeDbPayload(result.rows[0].payload);
  }

  async write(payload, options) {
    const validated = validateStoreData(payload);
    const previousPayload = options && options.previousPayload ? validateStoreData(options.previousPayload) : null;
    const source = safeString(options && options.source).slice(0, 64) || "api_put";

    if (previousPayload) {
      await this.appendHistorySnapshot(previousPayload, source);
    }

    const result = await this.pool.query(
      "INSERT INTO " + DB_TABLE + " (id, payload, updated_at) "
      + "VALUES (1, $1::jsonb, NOW()) "
      + "ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW() "
      + "RETURNING payload",
      [JSON.stringify(validated)]
    );

    return normalizeDbPayload(result.rows[0].payload);
  }

  async appendHistorySnapshot(payload, source) {
    const validated = validateStoreData(payload);
    const safeSource = safeString(source).slice(0, 64) || "api_put";
    const productsCount = getProductsCount(validated);

    await this.pool.query(
      "INSERT INTO " + DB_HISTORY_TABLE + " (payload, products_count, source, changed_at) "
      + "VALUES ($1::jsonb, $2, $3, NOW())",
      [JSON.stringify(validated), productsCount, safeSource]
    );

    await this.pool.query(
      "DELETE FROM " + DB_HISTORY_TABLE + " WHERE snapshot_id IN ("
      + "SELECT snapshot_id FROM " + DB_HISTORY_TABLE + " "
      + "ORDER BY changed_at DESC, snapshot_id DESC "
      + "OFFSET $1"
      + ")",
      [STORE_HISTORY_MAX_ROWS]
    );
  }

  async createSnapshot(source) {
    const current = await this.read();
    const safeSource = safeString(source || "manual_admin").slice(0, 64) || "manual_admin";
    await this.appendHistorySnapshot(current, safeSource);
    return {
      source: safeSource,
      productsCount: getProductsCount(current)
    };
  }

  async close() {
    await this.pool.end();
  }
}

function normalizeDbPayload(rawPayload) {
  if (typeof rawPayload === "string") {
    return validateStoreData(JSON.parse(rawPayload));
  }
  return validateStoreData(rawPayload);
}

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

function isTrueLike(value) {
  const mode = String(value || "").trim().toLowerCase();
  return mode === "1" || mode === "true" || mode === "yes" || mode === "on";
}

function isForceFileStorage() {
  const forced = isTrueLike(process.env.FORCE_FILE_STORAGE);
  if (!forced) {
    return false;
  }

  if (isProduction() && !isTrueLike(process.env.ALLOW_FORCE_FILE_STORAGE_IN_PRODUCTION)) {
    console.warn("FORCE_FILE_STORAGE is ignored in production. Set ALLOW_FORCE_FILE_STORAGE_IN_PRODUCTION=true to override.");
    return false;
  }

  return true;
}

function isProduction() {
  const mode = String(process.env.NODE_ENV || "").trim().toLowerCase();
  return mode === "production";
}

function isStrictDatabaseMode() {
  if (isTrueLike(process.env.REQUIRE_DATABASE)) {
    return true;
  }
  return isProduction() && !isForceFileStorage();
}

function getSslConfig() {
  const mode = String(process.env.DB_SSL || "").trim().toLowerCase();
  if (mode === "1" || mode === "true" || mode === "yes" || mode === "require") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function buildDatabaseConfig() {
  const ssl = getSslConfig();

  if (process.env.DATABASE_URL) {
    const config = {
      connectionString: process.env.DATABASE_URL
    };
    if (ssl) {
      config.ssl = ssl;
    }
    return config;
  }

  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  };

  if (ssl) {
    config.ssl = ssl;
  }

  return config;
}

function loadPgPool() {
  try {
    return require("pg").Pool;
  } catch (error) {
    console.error("Package 'pg' is required for PostgreSQL mode.");
    throw error;
  }
}

async function createStoreRepository() {
  const strictDatabaseMode = isStrictDatabaseMode();

  if (isForceFileStorage()) {
    const repository = new FileStoreRepository(DATA_FILE);
    await repository.init();
    console.log("Storage mode: file (" + DATA_FILE + "), FORCE_FILE_STORAGE enabled");
    return repository;
  }

  if (isDatabaseConfigured()) {
    let pool = null;
    try {
      const Pool = loadPgPool();
      pool = new Pool(buildDatabaseConfig());
      const repository = new PostgresStoreRepository(pool);
      await repository.init();
      console.log("Storage mode: PostgreSQL");
      return repository;
    } catch (error) {
      console.error("PostgreSQL init failed. Reason:", error && error.message ? error.message : error);
      if (pool) {
        try {
          await pool.end();
        } catch (closeError) {
          console.error("Failed to close PostgreSQL pool after init error:", closeError);
        }
      }

      if (strictDatabaseMode) {
        throw new Error("DATABASE_INIT_FAILED_IN_STRICT_MODE");
      }

      console.warn("Fallback to file storage is enabled in non-production mode.");
    }
  }

  if (strictDatabaseMode) {
    throw new Error("DATABASE_CONFIG_REQUIRED_IN_STRICT_MODE");
  }

  const repository = new FileStoreRepository(DATA_FILE);
  await repository.init();
  console.log("Storage mode: file (" + DATA_FILE + ")");
  return repository;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let finished = false;

    const cleanup = () => {
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
    };

    const finish = (error, value) => {
      if (finished) {
        return;
      }
      finished = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve(value);
    };

    const onData = (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        finish(new Error("BODY_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = () => {
      finish(null, Buffer.concat(chunks).toString("utf8"));
    };

    const onError = (error) => {
      finish(error);
    };

    const onAborted = () => {
      finish(new Error("REQUEST_ABORTED"));
    };

    const timer = setTimeout(() => {
      finish(new Error("BODY_TIMEOUT"));
      req.destroy();
    }, REQUEST_BODY_TIMEOUT_MS);

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });
}

function runSerializedStoreMutation(task) {
  const runTask = async () => {
    return task();
  };

  const next = storeMutationQueue.then(runTask, runTask);
  storeMutationQueue = next.then(
    () => undefined,
    () => undefined
  );

  return next;
}

async function handleStoreApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const data = await storeRepository.read();
    sendStoreDataResponse(req, res, 200, getStoreDataForRequest(req, data));
    return;
  }

  if (req.method === "PUT") {
    if (!ensureAdminAuthorized(req, res)) {
      return;
    }

    const ifMatchRaw = req && req.headers ? req.headers["if-match"] : "";
    const ifMatchHeader = Array.isArray(ifMatchRaw) ? ifMatchRaw.join(",") : String(ifMatchRaw || "");
    if (!ifMatchHeader.trim()) {
      sendJson(res, 428, {
        error: "STORE_PRECONDITION_REQUIRED",
        message: "Missing If-Match header. Refresh admin data and retry."
      });
      return;
    }

    let raw;
    let parsed;
    const forceReplaceProducts = hasForceReplaceFlag(req, null);

    try {
      raw = await readRequestBody(req);
    } catch (error) {
      if (handleBodyReadFailure(res, error)) {
        return;
      }
      throw error;
    }

    try {
      parsed = JSON.parse(raw || "{}");
    } catch (error) {
      sendJson(res, 400, { error: "INVALID_JSON" });
      return;
    }

    const forceReplaceFromPayload = forceReplaceProducts || hasForceReplaceFlag(req, parsed);
    const expectedRemovedProducts = getExpectedRemovedProductsCount(req, parsed);

    try {
      const saved = await runSerializedStoreMutation(async () => {
        const currentData = await storeRepository.read();
        const currentPayloadForClient = getStoreDataForRequest(req, currentData);
        const currentEtag = buildWeakEtagFromString(JSON.stringify(currentPayloadForClient));

        if (!isIfMatchSatisfied(req, currentEtag)) {
          const mismatchError = new Error("STORE_VERSION_MISMATCH");
          mismatchError.code = "STORE_VERSION_MISMATCH";
          mismatchError.currentEtag = currentEtag;
          throw mismatchError;
        }

        const nextPayload = ensureIncomingAdminPassword(parsed, currentData);
        const shrinkGuard = getCatalogShrinkGuard(currentData, nextPayload);
        if (shrinkGuard.blocked && !forceReplaceFromPayload) {
          const guardError = new Error("CATALOG_SHRINK_BLOCKED");
          guardError.code = "CATALOG_SHRINK_BLOCKED";
          guardError.details = shrinkGuard;
          throw guardError;
        }

        const deleteIntentGuard = getCatalogDeleteIntentGuard(currentData, nextPayload, expectedRemovedProducts);
        if (deleteIntentGuard.blocked && !forceReplaceFromPayload) {
          const guardError = new Error("CATALOG_DELETE_INTENT_MISMATCH");
          guardError.code = "CATALOG_DELETE_INTENT_MISMATCH";
          guardError.details = deleteIntentGuard;
          throw guardError;
        }

        return storeRepository.write(nextPayload, {
          previousPayload: currentData,
          source: "api_put"
        });
      });

      sendStoreDataResponse(req, res, 200, getStoreDataForRequest(req, saved));
    } catch (error) {
      if (error.message === "INVALID_PAYLOAD") {
        sendJson(res, 400, { error: "INVALID_PAYLOAD" });
        return;
      }
      if (error.code === "STORE_VERSION_MISMATCH") {
        sendJson(res, 412, {
          error: "STORE_VERSION_MISMATCH",
          message: "Store data was changed in another session. Refresh admin and retry.",
          currentEtag: error.currentEtag || ""
        });
        return;
      }
      if (error.code === "CATALOG_SHRINK_BLOCKED") {
        const details = error.details || {};
        sendJson(res, 409, {
          error: "CATALOG_SHRINK_BLOCKED",
          message: "Blocked suspicious bulk product deletion. Refresh data and retry.",
          currentCount: details.currentCount || 0,
          nextCount: details.nextCount || 0,
          dropCount: details.dropCount || 0,
          dropRatio: Number.isFinite(details.dropRatio) ? details.dropRatio : 0
        });
        return;
      }
      if (error.code === "CATALOG_DELETE_INTENT_MISMATCH") {
        const details = error.details || {};
        sendJson(res, 409, {
          error: "CATALOG_DELETE_INTENT_MISMATCH",
          message: "Blocked catalog save because deletion intent does not match server state. Refresh admin and retry.",
          expectedRemovedProducts: Number.isFinite(details.expectedRemovedProducts) ? details.expectedRemovedProducts : null,
          removedCount: Number.isFinite(details.removedCount) ? details.removedCount : 0,
          removedIdsSample: Array.isArray(details.removedIdsSample) ? details.removedIdsSample : []
        });
        return;
      }
      throw error;
    }

    return;
  }

  sendText(res, 405, "Method Not Allowed");
}

async function handleAdminAuthApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  const clientIp = getClientIp(req);
  const banState = getAdminLoginBanState(clientIp);
  if (banState.blocked) {
    res.setHeader("Retry-After", String(banState.retryAfterSec));
    sendJson(res, 429, {
      error: "ADMIN_LOGIN_TEMP_BLOCKED",
      message: "Too many failed login attempts",
      retryAfterSec: banState.retryAfterSec
    });
    return;
  }

  let raw;
  let parsed;

  try {
    raw = await readRequestBody(req);
  } catch (error) {
    if (handleBodyReadFailure(res, error)) {
      return;
    }
    throw error;
  }

  try {
    parsed = JSON.parse(raw || "{}");
  } catch (error) {
    sendJson(res, 400, { error: "INVALID_JSON" });
    return;
  }

  const password = safeString(parsed && parsed.password);
  if (!password) {
    sendJson(res, 400, { error: "PASSWORD_REQUIRED" });
    return;
  }

  const currentData = await storeRepository.read();
  const currentPassword = readAdminPassword(currentData);
  if (!verifyAdminPassword(password, currentPassword)) {
    const failedState = registerFailedAdminLogin(clientIp);
    if (failedState.blocked) {
      res.setHeader("Retry-After", String(failedState.retryAfterSec));
      sendJson(res, 429, {
        error: "ADMIN_LOGIN_TEMP_BLOCKED",
        message: "Too many failed login attempts",
        retryAfterSec: failedState.retryAfterSec
      });
      return;
    }
    sendJson(res, 401, {
      error: "INVALID_CREDENTIALS",
      attemptsLeft: Math.max(0, ADMIN_BRUTE_FORCE_MAX_ATTEMPTS - failedState.attempts)
    });
    return;
  }

  if (!isAdminPasswordHash(currentPassword)) {
    try {
      await runSerializedStoreMutation(async () => {
        const latestData = await storeRepository.read();
        const latestPassword = readAdminPassword(latestData);
        if (isAdminPasswordHash(latestPassword)) {
          return;
        }
        if (!safeCompareStrings(latestPassword, password)) {
          return;
        }
        const migratedData = cloneData(validateStoreData(latestData));
        migratedData.settings.adminPassword = hashAdminPassword(password);
        await storeRepository.write(migratedData);
      });
    } catch (error) {
      console.error("Failed to migrate admin password to hashed format:", error);
    }
  }

  clearFailedAdminLogins(clientIp);
  const session = createAdminSession();
  sendJson(res, 200, {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt
  });
}

async function handleAdminPasswordApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  let raw;
  let parsed;

  try {
    raw = await readRequestBody(req);
  } catch (error) {
    if (handleBodyReadFailure(res, error)) {
      return;
    }
    throw error;
  }

  try {
    parsed = JSON.parse(raw || "{}");
  } catch (error) {
    sendJson(res, 400, { error: "INVALID_JSON" });
    return;
  }

  const newPassword = safeString((parsed && (parsed.newPassword || parsed.password)) || "");
  if (!newPassword) {
    sendJson(res, 400, { error: "PASSWORD_REQUIRED" });
    return;
  }

  if (newPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    sendJson(res, 400, { error: "PASSWORD_TOO_SHORT", minLength: MIN_ADMIN_PASSWORD_LENGTH });
    return;
  }

  if (newPassword.length > MAX_ADMIN_PASSWORD_LENGTH) {
    sendJson(res, 400, { error: "PASSWORD_TOO_LONG", maxLength: MAX_ADMIN_PASSWORD_LENGTH });
    return;
  }

  await runSerializedStoreMutation(async () => {
    const currentData = await storeRepository.read();
    const nextData = cloneData(validateStoreData(currentData));
    nextData.settings.adminPassword = hashAdminPassword(newPassword);
    await storeRepository.write(nextData);
  });

  revokeAdminSessions(getBearerToken(req));
  sendJson(res, 200, { ok: true });
}

async function handleAdminSnapshotApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  let raw = "";
  let parsed = {};
  try {
    raw = await readRequestBody(req);
  } catch (error) {
    if (handleBodyReadFailure(res, error)) {
      return;
    }
    throw error;
  }

  if (safeString(raw).trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      sendJson(res, 400, { error: "INVALID_JSON" });
      return;
    }
  }

  const safeReason = safeString(parsed && parsed.reason).slice(0, 120);
  const safeSource = safeReason ? "manual_admin" : "manual_admin";

  const snapshot = await runSerializedStoreMutation(async () => {
    if (storeRepository && typeof storeRepository.createSnapshot === "function") {
      return storeRepository.createSnapshot(safeSource);
    }

    const currentData = await storeRepository.read();
    if (storeRepository && typeof storeRepository.appendHistorySnapshot === "function") {
      await storeRepository.appendHistorySnapshot(currentData, safeSource);
    }
    return {
      source: safeSource,
      productsCount: getProductsCount(currentData)
    };
  });

  sendJson(res, 200, {
    ok: true,
    source: safeString(snapshot && snapshot.source) || safeSource,
    productsCount: Number.isFinite(Number(snapshot && snapshot.productsCount))
      ? Number(snapshot.productsCount)
      : 0
  });
}

async function handleProductReviewsApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  let raw;
  let parsed;

  try {
    raw = await readRequestBody(req);
  } catch (error) {
    if (handleBodyReadFailure(res, error)) {
      return;
    }
    throw error;
  }

  try {
    parsed = JSON.parse(raw || "{}");
  } catch (error) {
    sendJson(res, 400, { error: "INVALID_JSON" });
    return;
  }

  let incomingReview;
  try {
    incomingReview = parseIncomingProductReview(parsed);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "INVALID_REVIEW_PAYLOAD" });
    return;
  }

  try {
    verifyReviewCaptcha(incomingReview.captchaToken, incomingReview.captchaAnswer);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "CAPTCHA_INVALID" });
    return;
  }
  const clientIp = getClientIp(req);

  try {
    await runSerializedStoreMutation(async () => {
      const currentData = await storeRepository.read();
      const nextData = cloneData(validateStoreData(currentData));

      const productIndex = nextData.products.findIndex((product) => {
        return safeString(product && product.id) === incomingReview.productId;
      });

      if (productIndex < 0) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const targetProduct = Object.assign({}, nextData.products[productIndex]);
      const pendingReviews = normalizeStoredReviewList(
        targetProduct.pendingReviews,
        "ppr",
        MAX_PENDING_PRODUCT_REVIEWS_PER_PRODUCT
      );

      const newReview = normalizeStoredReview({
        id: "ppr_" + crypto.randomBytes(6).toString("hex"),
        author: incomingReview.author,
        city: incomingReview.city,
        text: incomingReview.text,
        rating: incomingReview.rating,
        photo: incomingReview.photo,
        consentProof: {
          acceptedAt: new Date().toISOString(),
          version: incomingReview.consentVersion,
          form: "product_review",
          ip: clientIp
        },
        termsProof: {
          acceptedAt: new Date().toISOString(),
          version: incomingReview.termsVersion,
          form: "product_review",
          ip: clientIp
        },
        createdAt: new Date().toISOString()
      }, "ppr");

      pendingReviews.unshift(newReview);
      targetProduct.pendingReviews = normalizeStoredReviewList(
        pendingReviews,
        "ppr",
        MAX_PENDING_PRODUCT_REVIEWS_PER_PRODUCT
      );
      nextData.products[productIndex] = targetProduct;

      await storeRepository.write(nextData);
    });
  } catch (error) {
    if (error && error.message === "PRODUCT_NOT_FOUND") {
      sendJson(res, 404, { error: "PRODUCT_NOT_FOUND" });
      return;
    }
    throw error;
  }

  sendJson(res, 202, {
    ok: true,
    productId: incomingReview.productId,
    status: "pending",
    message: "REVIEW_PENDING_MODERATION"
  });
}

async function handleReviewCaptchaApi(req, res) {
  if (req.method !== "GET") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  sendJson(res, 200, createReviewCaptchaChallenge());
}

async function handleHomepageReviewsApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  let raw;
  let parsed;

  try {
    raw = await readRequestBody(req);
  } catch (error) {
    if (handleBodyReadFailure(res, error)) {
      return;
    }
    throw error;
  }

  try {
    parsed = JSON.parse(raw || "{}");
  } catch (error) {
    sendJson(res, 400, { error: "INVALID_JSON" });
    return;
  }

  let incomingReview;
  try {
    incomingReview = parseIncomingHomepageReview(parsed);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "INVALID_REVIEW_PAYLOAD" });
    return;
  }

  try {
    verifyReviewCaptcha(incomingReview.captchaToken, incomingReview.captchaAnswer);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "CAPTCHA_INVALID" });
    return;
  }
  const clientIp = getClientIp(req);

  await runSerializedStoreMutation(async () => {
    const currentData = await storeRepository.read();
    const nextData = cloneData(validateStoreData(currentData));
    const pendingReviews = normalizeStoredReviewList(
      nextData.pendingHomepageReviews,
      "phr",
      MAX_PENDING_HOMEPAGE_REVIEWS
    );

    const newReview = normalizeStoredReview({
      id: "phr_" + crypto.randomBytes(6).toString("hex"),
      author: incomingReview.author,
      city: incomingReview.city,
      text: incomingReview.text,
      rating: incomingReview.rating,
      photo: incomingReview.photo,
      consentProof: {
        acceptedAt: new Date().toISOString(),
        version: incomingReview.consentVersion,
        form: "homepage_review",
        ip: clientIp
      },
      termsProof: {
        acceptedAt: new Date().toISOString(),
        version: incomingReview.termsVersion,
        form: "homepage_review",
        ip: clientIp
      },
      createdAt: new Date().toISOString()
    }, "phr");

    pendingReviews.unshift(newReview);
    nextData.pendingHomepageReviews = normalizeStoredReviewList(
      pendingReviews,
      "phr",
      MAX_PENDING_HOMEPAGE_REVIEWS
    );

    await storeRepository.write(nextData);
  });

  sendJson(res, 202, {
    ok: true,
    status: "pending",
    message: "REVIEW_PENDING_MODERATION"
  });
}

async function handleClientErrorsApi(req, res) {
  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  let raw;
  let parsed;

  try {
    raw = await readRequestBody(req);
  } catch (error) {
    if (handleBodyReadFailure(res, error)) {
      return;
    }
    throw error;
  }

  try {
    parsed = JSON.parse(raw || "{}");
  } catch (error) {
    sendJson(res, 400, { error: "INVALID_JSON" });
    return;
  }

  const clientIp = getClientIp(req);
  const message = safeString(parsed && parsed.message).slice(0, 500);
  const stack = safeString(parsed && parsed.stack).slice(0, 4000);
  const type = safeString(parsed && parsed.type).slice(0, 120);
  const url = safeString(parsed && parsed.url).slice(0, 500);
  const timestamp = safeString(parsed && parsed.timestamp).slice(0, 64);

  console.error("ClientError:", {
    ip: clientIp,
    type: type,
    message: message,
    url: url,
    timestamp: timestamp,
    stack: stack
  });

  sendJson(res, 202, { ok: true });
}

function normalizePublicPath(filePath) {
  return safeString(filePath).replace(/\\/g, "/").replace(/^\/+/, "");
}

function isAllowedStaticFile(filePath) {
  const normalized = normalizePublicPath(filePath);
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith(".") || normalized.includes("/.")) {
    return false;
  }
  return ALLOWED_STATIC_FILES.has(normalized);
}

function applySecurityHeaders(res) {
  if (!res || typeof res.setHeader !== "function") {
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-XSS-Protection", "0");
  if (isProduction()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
}

function getSafeFilePath(urlPathname) {
  let pathname = urlPathname;

  if (pathname === "/") {
    pathname = "/index.html";
  }

  if (pathname === "/admin") {
    pathname = "/admin/index.html";
  }

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const relativePath = pathname.replace(/^\/+/, "");
  const absolutePath = path.resolve(ROOT_DIR, relativePath);
  const relativeToRoot = path.relative(ROOT_DIR, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  if (!isAllowedStaticFile(relativeToRoot)) {
    return null;
  }

  return absolutePath;
}

async function serveStaticFile(req, res, filePath) {
  const method = String(req && req.method || "").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  try {
    const stat = await fsp.stat(filePath);

    if (stat.isDirectory()) {
      await serveStaticFile(req, res, path.join(filePath, "index.html"));
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[extension] || "application/octet-stream";
    const etag = buildWeakEtagFromStat(stat);
    const cacheControl = getStaticCacheControl(filePath);
    const headers = {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": cacheControl,
      "ETag": etag
    };

    if (isEtagMatch(req, etag)) {
      res.writeHead(304, {
        "Cache-Control": cacheControl,
        "ETag": etag
      });
      res.end();
      return;
    }

    res.writeHead(200, headers);

    if (method === "HEAD") {
      res.end();
      return;
    }

    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.on("error", reject);
      stream.on("end", resolve);
      stream.pipe(res);
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not Found");
      return;
    }

    throw error;
  }
}

async function requestHandler(req, res) {
  try {
    applySecurityHeaders(res);

    const hostHeader = req.headers.host || "localhost:" + PORT;
    const requestUrl = new URL(req.url, "http://" + hostHeader);

    if (
      requestUrl.pathname === "/health"
      || requestUrl.pathname === "/healthz"
      || requestUrl.pathname === "/_health"
      || requestUrl.pathname === "/api/health"
    ) {
      handleHealthCheck(req, res);
      return;
    }

    if (!ensureRateLimit(req, res, requestUrl.pathname)) {
      return;
    }

    if (requestUrl.pathname === "/api/store-data") {
      await handleStoreApi(req, res);
      return;
    }

    if (requestUrl.pathname === "/api/admin/auth") {
      await handleAdminAuthApi(req, res);
      return;
    }

    if (requestUrl.pathname === "/api/admin/password") {
      await handleAdminPasswordApi(req, res);
      return;
    }

    if (requestUrl.pathname === "/api/admin/snapshot") {
      await handleAdminSnapshotApi(req, res);
      return;
    }

    if (requestUrl.pathname === "/api/product-reviews") {
      await handleProductReviewsApi(req, res);
      return;
    }

    if (requestUrl.pathname === "/api/review-captcha") {
      await handleReviewCaptchaApi(req, res);
      return;
    }

    if (requestUrl.pathname === "/api/homepage-reviews") {
      await handleHomepageReviewsApi(req, res);
      return;
    }

    if (requestUrl.pathname === "/api/client-errors") {
      await handleClientErrorsApi(req, res);
      return;
    }

    const filePath = getSafeFilePath(requestUrl.pathname);
    if (!filePath) {
      sendText(res, 403, "Forbidden");
      return;
    }

    await serveStaticFile(req, res, filePath);
  } catch (error) {
    console.error("Server error:", error);
    if (!res.headersSent) {
      sendText(res, 500, "Internal Server Error");
    } else {
      try {
        res.end();
      } catch (endError) {
        console.error("Failed to finalize errored response:", endError);
      }
    }
  }
}

async function start() {
  storeRepository = await createStoreRepository();

  httpServer = http.createServer((req, res) => {
    req.setTimeout(SERVER_REQUEST_TIMEOUT_MS);
    requestHandler(req, res);
  });

  httpServer.requestTimeout = SERVER_REQUEST_TIMEOUT_MS;
  httpServer.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT_MS;
  httpServer.headersTimeout = Math.max(
    SERVER_REQUEST_TIMEOUT_MS + 1000,
    SERVER_KEEP_ALIVE_TIMEOUT_MS + 1000
  );

  httpServer.listen(PORT, HOST, () => {
    console.log("Server running at http://localhost:" + PORT);
  });
}

async function gracefulShutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log("Received " + signal + ", shutting down gracefully...");

  try {
    if (httpServer) {
      await new Promise(function (resolve) {
        httpServer.close(function () {
          resolve();
        });
      });
    }
  } catch (error) {
    console.error("Failed to stop HTTP server cleanly:", error);
  }

  try {
    if (storeRepository && typeof storeRepository.close === "function") {
      await storeRepository.close();
    }
  } catch (error) {
    console.error("Failed to close storage cleanly:", error);
  }

  process.exit(0);
}

process.on("SIGTERM", function () {
  gracefulShutdown("SIGTERM");
});

process.on("SIGINT", function () {
  gracefulShutdown("SIGINT");
});

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
