"use strict";

require("dotenv").config({ quiet: true });

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "store-data.json");
const AI_DRAFTS_FILE = path.join(DATA_DIR, "product-import-drafts.json");
const DB_TABLE = "store_state";
const DB_HISTORY_TABLE = "store_state_history";
const AI_DRAFTS_DB_TABLE = "product_import_drafts";
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
const STORE_IMAGE_GUARD_MIN_BREAK_COUNT = Math.max(1, Number(process.env.STORE_IMAGE_GUARD_MIN_BREAK_COUNT || 5));
const STORE_IMAGE_GUARD_MIN_BREAK_RATIO = Math.min(0.95, Math.max(0.02, Number(process.env.STORE_IMAGE_GUARD_MIN_BREAK_RATIO || 0.08)));
const STORE_IMAGE_GUARD_SAMPLE_LIMIT = Math.max(1, Number(process.env.STORE_IMAGE_GUARD_SAMPLE_LIMIT || 8));
const RESPONSE_COMPRESSION_MIN_BYTES = Math.max(512, Number(process.env.RESPONSE_COMPRESSION_MIN_BYTES || 1400));
const RESPONSE_COMPRESSION_MAX_BYTES = Math.max(64 * 1024, Number(process.env.RESPONSE_COMPRESSION_MAX_BYTES || 4 * 1024 * 1024));
const ADMIN_CATALOG_DEFAULT_LIMIT = Math.max(1, Number(process.env.ADMIN_CATALOG_DEFAULT_LIMIT || 10));
const ADMIN_CATALOG_MAX_LIMIT = Math.max(ADMIN_CATALOG_DEFAULT_LIMIT, Number(process.env.ADMIN_CATALOG_MAX_LIMIT || 80));
const ADMIN_CATALOG_CACHE_MAX_ENTRIES = Math.max(10, Number(process.env.ADMIN_CATALOG_CACHE_MAX_ENTRIES || 40));
const PRODUCT_IMAGE_CACHE_MAX_ENTRIES = Math.max(20, Number(process.env.PRODUCT_IMAGE_CACHE_MAX_ENTRIES || 180));
const MAX_AI_DRAFT_SOURCE_LENGTH = 32;
const MAX_AI_DRAFT_SOURCE_URL_LENGTH = 1500;
const MAX_AI_DRAFT_RAW_TEXT_LENGTH = 20000;
const MAX_AI_DRAFT_TEXT_LENGTH = 6000;
const MAX_AI_DRAFT_IMAGE_LENGTH = 4 * 1024 * 1024;
const MAX_AI_DRAFT_NOTES = 40;
const MAX_AI_DRAFT_NOTE_LENGTH = 400;
const MAX_AI_DRAFT_ANALYSIS_DEPTH = 5;
const MAX_AI_DRAFT_ANALYSIS_KEYS = 80;
const MAX_AI_DRAFT_ANALYSIS_STRING_LENGTH = 800;
const MAX_AI_DRAFT_ANALYSIS_JSON_LENGTH = 20000;
const MAX_AI_DRAFT_SLUG_LENGTH = 180;
const MAX_AI_DRAFT_SEO_TITLE_LENGTH = 220;
const MAX_AI_DRAFT_SEO_DESCRIPTION_LENGTH = 320;
const MAX_AI_DRAFT_CONTENT_TEXT_LENGTH = 12000;
const MAX_AI_DRAFT_MEDIA_IMAGE_LENGTH = 4 * 1024 * 1024;
const MAX_AI_DRAFT_MEDIA_TEXT_LENGTH = 2000;
const MAX_AI_DRAFT_MEDIA_LIST_LENGTH = 12;
const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";
const TELEGRAM_WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_IMAGES_API_URL = "https://api.openai.com/v1/images/generations";
const EXTERNAL_FETCH_TIMEOUT_MS = Math.max(5 * 1000, Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS || 25 * 1000));
const MAX_TELEGRAM_ANALYSIS_IMAGE_BYTES = Math.max(256 * 1024, Number(process.env.MAX_TELEGRAM_ANALYSIS_IMAGE_BYTES || 6 * 1024 * 1024));
const OPENAI_AI_DRAFT_ANALYZE_MODEL = safeString(process.env.OPENAI_AI_DRAFT_ANALYZE_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini").slice(0, 120) || "gpt-4.1-mini";
const OPENAI_AI_DRAFT_CARD_MODEL = safeString(process.env.OPENAI_AI_DRAFT_CARD_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini").slice(0, 120) || "gpt-4.1-mini";
const OPENAI_AI_DRAFT_IMAGE_MODEL = safeString(process.env.OPENAI_AI_DRAFT_IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1").slice(0, 120) || "gpt-image-1";
const OPENAI_AI_DRAFT_READY_THRESHOLD = Math.max(0, Math.min(1, Number(process.env.OPENAI_AI_DRAFT_READY_THRESHOLD || 0.8) || 0.8));
const OPENAI_AI_DRAFT_IMAGE_TIMEOUT_MS = Math.max(20 * 1000, Number(process.env.OPENAI_AI_DRAFT_IMAGE_TIMEOUT_MS || 90 * 1000));
const DEFAULT_AI_IMAGE_GENERATION = Object.freeze({
  background: "black",
  backgroundHex: "#050505",
  style: "luxury perfume product photo"
});

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
  telegramWebhook: {
    name: "telegram_webhook",
    max: 120,
    windowMs: 60 * 1000,
    message: "Too many Telegram webhook requests"
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
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src https://mc.yandex.ru",
  "form-action 'self'"
].join("; ");

const ALLOWED_STATIC_FILES = new Set([
  "index.html",
  "styles.css",
  "favicon.svg",
  "assets/hero-welcome-readable.jpg",
  "assets/hero-welcome-logo.jpg",
  "assets/product-placeholder.svg",
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
let aiDraftRepository = null;
let httpServer = null;
let shuttingDown = false;
let storeMutationQueue = Promise.resolve();
const adminSessions = new Map();
const rateLimitBuckets = new Map();
let rateLimitLastCleanupAt = 0;
const adminLoginFailures = new Map();
const derivedResponseCache = {
  publicCatalog: null,
  adminCatalogPages: new Map(),
  productReviews: new Map(),
  productImages: new Map()
};

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function appendVaryHeader(value, token) {
  const existing = safeString(value);
  const normalizedToken = safeString(token).trim();
  if (!normalizedToken) {
    return existing;
  }

  if (!existing) {
    return normalizedToken;
  }

  const parts = existing.split(",").map((part) => safeString(part).trim().toLowerCase()).filter(Boolean);
  if (parts.includes(normalizedToken.toLowerCase())) {
    return existing;
  }

  return existing + ", " + normalizedToken;
}

function getLruCacheEntry(cacheMap, key) {
  if (!cacheMap || typeof cacheMap.get !== "function" || !cacheMap.has(key)) {
    return null;
  }

  const value = cacheMap.get(key);
  cacheMap.delete(key);
  cacheMap.set(key, value);
  return value;
}

function setLruCacheEntry(cacheMap, key, value, maxEntries) {
  if (!cacheMap || typeof cacheMap.set !== "function") {
    return value;
  }

  if (cacheMap.has(key)) {
    cacheMap.delete(key);
  }
  cacheMap.set(key, value);

  while (cacheMap.size > maxEntries) {
    const oldestKey = cacheMap.keys().next();
    if (oldestKey.done) {
      break;
    }
    cacheMap.delete(oldestKey.value);
  }

  return value;
}

function invalidateDerivedStoreCaches() {
  derivedResponseCache.publicCatalog = null;
  derivedResponseCache.adminCatalogPages.clear();
  derivedResponseCache.productReviews.clear();
  derivedResponseCache.productImages.clear();
}

function isCompressibleContentType(contentType) {
  const safe = safeString(contentType).toLowerCase();
  if (!safe) {
    return false;
  }

  return (
    safe.startsWith("text/")
    || safe.includes("application/json")
    || safe.includes("application/javascript")
    || safe.includes("image/svg+xml")
    || safe.includes("application/xml")
  );
}

function getAcceptedEncoding(req) {
  const raw = req && req.headers ? req.headers["accept-encoding"] : "";
  const safe = Array.isArray(raw) ? raw.join(",") : safeString(raw);
  if (!safe) {
    return "";
  }
  const lower = safe.toLowerCase();
  if (lower.includes("br")) {
    return "br";
  }
  if (lower.includes("gzip")) {
    return "gzip";
  }
  return "";
}

function compressResponseBody(buffer, encoding) {
  if (!Buffer.isBuffer(buffer) || !encoding) {
    return buffer;
  }

  if (encoding === "br") {
    return zlib.brotliCompressSync(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4
      }
    });
  }

  if (encoding === "gzip") {
    return zlib.gzipSync(buffer, { level: 6 });
  }

  return buffer;
}

function writeBufferedResponse(res, statusCode, headers, body) {
  const baseHeaders = Object.assign({}, headers || {});
  const request = res && res.__request ? res.__request : null;
  const method = safeString(request && request.method).toUpperCase();

  let payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""), "utf8");
  const contentType = baseHeaders["Content-Type"] || baseHeaders["content-type"] || "";

  const canCompress = method !== "HEAD"
    && statusCode >= 200
    && statusCode !== 204
    && statusCode !== 304
    && payload.length >= RESPONSE_COMPRESSION_MIN_BYTES
    && payload.length <= RESPONSE_COMPRESSION_MAX_BYTES
    && !baseHeaders["Content-Encoding"]
    && !baseHeaders["content-encoding"]
    && isCompressibleContentType(contentType);

  if (canCompress) {
    const encoding = getAcceptedEncoding(request);
    if (encoding) {
      try {
        payload = compressResponseBody(payload, encoding);
        baseHeaders["Content-Encoding"] = encoding;
        baseHeaders.Vary = appendVaryHeader(baseHeaders.Vary, "Accept-Encoding");
      } catch (error) {
        // Compression is an optimization; fallback to plain body.
      }
    }
  }

  baseHeaders["Content-Length"] = payload.length;
  res.writeHead(statusCode, baseHeaders);

  if (method === "HEAD") {
    res.end();
    return;
  }

  res.end(payload);
}

function sendJson(res, statusCode, payload) {
  writeBufferedResponse(res, statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }, JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  writeBufferedResponse(res, statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  }, String(text || ""));
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
  sendJsonWithEtag(req, res, statusCode, payload, {
    cacheControl: "private, max-age=0, must-revalidate",
    vary: "Authorization"
  });
}

function sendPublicApiResponse(req, res, statusCode, payload, options) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const maxAge = Math.max(0, Math.round(Number(safeOptions.maxAge) || 30));
  const staleWhileRevalidate = Math.max(0, Math.round(Number(safeOptions.staleWhileRevalidate) || 120));
  const cacheControl = staleWhileRevalidate > 0
    ? "public, max-age=" + maxAge + ", stale-while-revalidate=" + staleWhileRevalidate
    : "public, max-age=" + maxAge;

  sendJsonWithEtag(req, res, statusCode, payload, {
    cacheControl,
    prebuiltBody: typeof safeOptions.prebuiltBody === "string" ? safeOptions.prebuiltBody : undefined,
    prebuiltEtag: safeString(safeOptions.prebuiltEtag) || undefined,
    vary: safeString(safeOptions.vary) || undefined
  });
}

function sendJsonWithEtag(req, res, statusCode, payload, options) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const body = typeof safeOptions.prebuiltBody === "string"
    ? safeOptions.prebuiltBody
    : JSON.stringify(payload);
  const etag = safeString(safeOptions.prebuiltEtag) || buildWeakEtagFromString(body);
  const baseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": safeString(safeOptions.cacheControl) || "no-store",
    "ETag": etag
  };
  const varyHeader = safeString(safeOptions.vary);

  if (varyHeader) {
    baseHeaders.Vary = varyHeader;
  }

  if (statusCode === 200 && (req.method === "GET" || req.method === "HEAD") && isEtagMatch(req, etag)) {
    res.writeHead(304, baseHeaders);
    res.end();
    return;
  }

  writeBufferedResponse(res, statusCode, baseHeaders, body);
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

function isJsonContentType(req) {
  const raw = req && req.headers ? req.headers["content-type"] : "";
  const header = Array.isArray(raw) ? raw.join(";") : safeString(raw);
  if (!header) {
    return false;
  }
  return header.toLowerCase().includes("application/json");
}

function ensureJsonBodyRequest(req, res) {
  if (isJsonContentType(req)) {
    return true;
  }

  sendJson(res, 415, {
    error: "UNSUPPORTED_MEDIA_TYPE",
    message: "Expected application/json"
  });
  return false;
}

function parseRequestOriginHeader(value) {
  const safeValue = safeString(value);
  if (!safeValue) {
    return "";
  }
  try {
    return new URL(safeValue).origin.toLowerCase();
  } catch (error) {
    return "";
  }
}

function getTrustedRequestOrigins(req) {
  const origins = new Set();
  const host = safeString(req && req.headers && req.headers.host).toLowerCase();
  if (host) {
    origins.add("https://" + host);
    origins.add("http://" + host);
  }

  const siteUrl = safeString(process.env.PUBLIC_SITE_URL || process.env.SITE_URL);
  const siteOrigin = parseRequestOriginHeader(siteUrl);
  if (siteOrigin) {
    origins.add(siteOrigin);
  }

  return origins;
}

function ensureTrustedMutationRequest(req, res) {
  const method = safeString(req && req.method).toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return true;
  }

  const secFetchSite = safeString(req && req.headers && req.headers["sec-fetch-site"]).toLowerCase();
  if (secFetchSite === "cross-site") {
    sendJson(res, 403, { error: "CROSS_SITE_FORBIDDEN" });
    return false;
  }

  const origin = parseRequestOriginHeader(req && req.headers && req.headers.origin);
  const referer = parseRequestOriginHeader(req && req.headers && req.headers.referer);
  if (!origin && !referer) {
    return true;
  }

  const trustedOrigins = getTrustedRequestOrigins(req);
  if (origin && trustedOrigins.has(origin)) {
    return true;
  }
  if (referer && trustedOrigins.has(referer)) {
    return true;
  }

  sendJson(res, 403, { error: "UNTRUSTED_ORIGIN" });
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

  if (safePath.startsWith("/api/admin/image-integrity") && safeMethod === "POST") {
    return RATE_LIMIT_RULES.apiWrite;
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

  if (safePath === TELEGRAM_WEBHOOK_PATH && safeMethod === "POST") {
    return RATE_LIMIT_RULES.telegramWebhook;
  }

  if (safePath === "/api/review-captcha" && safeMethod === "GET") {
    return RATE_LIMIT_RULES.reviewCaptcha;
  }

  if (safePath === "/api/store-data" && safeMethod === "PUT") {
    return RATE_LIMIT_RULES.apiWrite;
  }

  if (safePath.startsWith("/api/admin/ai-drafts") && (safeMethod === "POST" || safeMethod === "DELETE")) {
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

function transliterateCyrillicToLatin(value) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
  };

  return safeString(value)
    .toLowerCase()
    .split("")
    .map((character) => {
      return Object.prototype.hasOwnProperty.call(map, character) ? map[character] : character;
    })
    .join("");
}

function slugifyText(value) {
  return transliterateCyrillicToLatin(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_AI_DRAFT_SLUG_LENGTH);
}

function timingSafeEqualStrings(left, right) {
  const leftBuffer = Buffer.from(safeString(left), "utf8");
  const rightBuffer = Buffer.from(safeString(right), "utf8");
  if (leftBuffer.length <= 0 || rightBuffer.length <= 0 || leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
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
    safe.reviews = safe.reviews.map((review) => sanitizePublicReviewEntry(review));
  }
  safe.products = safe.products.map((product) => {
    const next = Object.assign({}, product);
    delete next.pendingReviews;
    if (Array.isArray(next.reviews)) {
      next.reviews = next.reviews.map((review) => sanitizePublicReviewEntry(review));
    }
    return next;
  });
  return safe;
}

function buildProductImageApiPath(productId) {
  const safeId = safeString(productId).slice(0, 120);
  if (!safeId) {
    return "";
  }
  return "/api/product-image/" + encodeURIComponent(safeId);
}

function isHttpImageUrl(value) {
  return /^https?:\/\//i.test(safeString(value));
}

function isDataImageUrl(value) {
  return /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.test(safeString(value));
}

function parseStaticProductImagePath(value) {
  const safe = safeString(value);
  if (!safe) {
    return "";
  }

  if (isHttpImageUrl(safe) || isDataImageUrl(safe) || /^blob:/i.test(safe) || safe.startsWith("//")) {
    return "";
  }

  if (/[<>"'`]/.test(safe) || /^[a-z]:[\\/]/i.test(safe) || safe.startsWith("\\\\")) {
    return "";
  }

  let normalized = safe.replace(/\\/g, "/");
  if (normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
    return "";
  }

  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  if (!/\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/i.test(normalized)) {
    return "";
  }

  return "/" + normalized.replace(/^\/+/, "");
}

function isProductImageApiPath(value, expectedProductId) {
  const safe = safeString(value);
  const prefix = "/api/product-image/";
  if (!safe.startsWith(prefix)) {
    return false;
  }

  if (!expectedProductId) {
    return true;
  }

  return safe === buildProductImageApiPath(expectedProductId);
}

function isRenderableProductImageValue(value, productId) {
  if (isHttpImageUrl(value) || isDataImageUrl(value)) {
    return true;
  }

  if (parseStaticProductImagePath(value)) {
    return true;
  }

  return false;
}

function normalizePersistedProductImage(rawValue, existingImage, productId, allowLegacyProxyValue) {
  const safe = safeString(rawValue).slice(0, 2 * 1024 * 1024);
  if (isHttpImageUrl(safe) || isDataImageUrl(safe)) {
    return safe;
  }

  const staticPath = parseStaticProductImagePath(safe);
  if (staticPath) {
    return staticPath;
  }

  const safeExisting = safeString(existingImage).slice(0, 2 * 1024 * 1024);
  if (isProductImageApiPath(safe, productId)) {
    if (safeExisting && !isProductImageApiPath(safeExisting, productId)) {
      return normalizePersistedProductImage(safeExisting, "", productId, false);
    }
    return allowLegacyProxyValue ? safe : "";
  }

  if (!safe && safeExisting) {
    return normalizePersistedProductImage(safeExisting, "", productId, allowLegacyProxyValue);
  }

  if (safeExisting && !isProductImageApiPath(safeExisting, productId) && !safe) {
    return normalizePersistedProductImage(safeExisting, "", productId, allowLegacyProxyValue);
  }

  if (safeExisting && (isHttpImageUrl(safeExisting) || isDataImageUrl(safeExisting) || parseStaticProductImagePath(safeExisting))) {
    return normalizePersistedProductImage(safeExisting, "", productId, allowLegacyProxyValue);
  }

  return safe;
}

function buildProductImageResponseFromValue(productId, imageValue) {
  const safeProductId = safeString(productId).slice(0, 120);
  if (!safeProductId) {
    return null;
  }

  const safeImageValue = safeString(imageValue);
  if (!safeImageValue || isProductImageApiPath(safeImageValue, safeProductId)) {
    return null;
  }

  if (isHttpImageUrl(safeImageValue)) {
    return {
      kind: "redirect",
      location: safeImageValue
    };
  }

  const staticPath = parseStaticProductImagePath(safeImageValue);
  if (staticPath) {
    return {
      kind: "redirect",
      location: staticPath
    };
  }

  const dataUrlMatch = safeImageValue.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
  if (!dataUrlMatch) {
    return null;
  }

  const contentType = safeString(dataUrlMatch[1]).toLowerCase() || "image/jpeg";
  const base64Payload = dataUrlMatch[2] || "";
  const body = Buffer.from(base64Payload, "base64");
  return {
    kind: "binary",
    contentType,
    body,
    etag: buildWeakEtagFromString(safeImageValue)
  };
}

function extractValidProductImageFromStoreData(data, productId) {
  const safeProductId = safeString(productId).slice(0, 120);
  if (!safeProductId) {
    return "";
  }

  const safeData = validateStoreData(data);
  const product = Array.isArray(safeData.products)
    ? safeData.products.find((item) => safeString(item && item.id) === safeProductId)
    : null;

  if (!product) {
    return "";
  }

  const image = normalizePersistedProductImage(product.image, "", safeProductId, false);
  if (!image || isProductImageApiPath(image, safeProductId)) {
    return "";
  }

  return isRenderableProductImageValue(image, safeProductId) ? image : "";
}

function getProductPublishedReviewsCount(product) {
  return Array.isArray(product && product.reviews) ? product.reviews.length : 0;
}

function getProductPendingReviewsCount(product) {
  return Array.isArray(product && product.pendingReviews) ? product.pendingReviews.length : 0;
}

function getProductPreviewImageUrl(product) {
  const safeProduct = product && typeof product === "object" ? product : {};
  const image = normalizePersistedProductImage(safeProduct.image, "", safeProduct.id, true);
  if (isHttpImageUrl(image)) {
    return image;
  }

  const staticPath = parseStaticProductImagePath(image);
  if (staticPath) {
    return staticPath;
  }
  return buildProductImageApiPath(safeProduct.id);
}

function buildPublicCatalogProductSummary(product) {
  const safeProduct = product && typeof product === "object" ? product : {};
  return {
    id: safeString(safeProduct.id).slice(0, 120),
    name: safeString(safeProduct.name).slice(0, 160),
    brand: safeString(safeProduct.brand).slice(0, 160),
    gender: normalizeProductGender(safeProduct.gender),
    bottleType: normalizeProductBottleType(safeProduct.bottleType),
    description: String(safeProduct.description || "").trim().slice(0, 6000),
    image: getProductPreviewImageUrl(safeProduct),
    volumes: Array.isArray(safeProduct.volumes)
      ? safeProduct.volumes.map(sanitizeProductVolume).filter(Boolean)
      : [],
    reviewsCount: getProductPublishedReviewsCount(safeProduct),
    reviewsLoaded: false,
    topWeek: Boolean(safeProduct.topWeek),
    topMonth: Boolean(safeProduct.topMonth)
  };
}

function buildAdminCatalogProductSummary(product) {
  const safeProduct = product && typeof product === "object" ? product : {};
  return {
    id: safeString(safeProduct.id).slice(0, 120),
    name: safeString(safeProduct.name).slice(0, 160),
    brand: safeString(safeProduct.brand).slice(0, 160),
    gender: normalizeProductGender(safeProduct.gender),
    bottleType: normalizeProductBottleType(safeProduct.bottleType),
    image: getProductPreviewImageUrl(safeProduct),
    volumes: Array.isArray(safeProduct.volumes)
      ? safeProduct.volumes.map(sanitizeProductVolume).filter(Boolean)
      : [],
    reviewsCount: getProductPublishedReviewsCount(safeProduct),
    pendingReviewsCount: getProductPendingReviewsCount(safeProduct),
    reviewsLoaded: false,
    pendingReviewsLoaded: false,
    detailsLoaded: false,
    topWeek: Boolean(safeProduct.topWeek),
    topMonth: Boolean(safeProduct.topMonth)
  };
}

function sanitizePublicReviewEntry(review) {
  const nextReview = Object.assign({}, review);
  delete nextReview.consentProof;
  delete nextReview.consent;
  delete nextReview.termsProof;
  delete nextReview.terms;
  return nextReview;
}

function sanitizeAdminStoreData(data) {
  const safe = cloneData(validateStoreData(data));
  if (safe.settings && Object.prototype.hasOwnProperty.call(safe.settings, "adminPassword")) {
    delete safe.settings.adminPassword;
  }
  return safe;
}

function getCachedPublicCatalogResponse(data) {
  if (derivedResponseCache.publicCatalog) {
    return derivedResponseCache.publicCatalog;
  }

  const safeData = sanitizePublicStoreData(data);
  const items = Array.isArray(safeData.products)
    ? safeData.products.map((product) => buildPublicCatalogProductSummary(product))
    : [];
  const payload = {
    ok: true,
    total: items.length,
    items
  };
  const body = JSON.stringify(payload);
  const value = {
    payload,
    body,
    etag: buildWeakEtagFromString(body)
  };
  derivedResponseCache.publicCatalog = value;
  return value;
}

function getCachedAdminCatalogPageResponse(data, options) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const normalizedQuery = normalizeCatalogSearchQuery(safeOptions.query);
  const limit = clampInteger(safeOptions.limit, 1, ADMIN_CATALOG_MAX_LIMIT, ADMIN_CATALOG_DEFAULT_LIMIT);
  const offset = clampInteger(safeOptions.offset, 0, Number.MAX_SAFE_INTEGER, 0);
  const cacheKey = normalizedQuery + "::" + offset + "::" + limit;
  const cached = getLruCacheEntry(derivedResponseCache.adminCatalogPages, cacheKey);
  if (cached) {
    return cached;
  }

  const payload = getAdminCatalogPage(data, {
    query: normalizedQuery,
    offset,
    limit
  });
  return setLruCacheEntry(derivedResponseCache.adminCatalogPages, cacheKey, payload, ADMIN_CATALOG_CACHE_MAX_ENTRIES);
}

function getCachedPublicProductReviewsResponse(data, productId) {
  const safeProductId = safeString(productId).slice(0, 120);
  if (!safeProductId) {
    return null;
  }

  const cached = getLruCacheEntry(derivedResponseCache.productReviews, safeProductId);
  if (cached) {
    return cached;
  }

  const safeData = sanitizePublicStoreData(data);
  const product = Array.isArray(safeData.products)
    ? safeData.products.find((item) => safeString(item && item.id) === safeProductId)
    : null;

  if (!product) {
    return null;
  }

  const reviews = Array.isArray(product.reviews)
    ? product.reviews.map((review) => sanitizePublicReviewEntry(review))
    : [];
  const payload = {
    ok: true,
    productId: safeProductId,
    total: reviews.length,
    reviews
  };
  const body = JSON.stringify(payload);
  return setLruCacheEntry(derivedResponseCache.productReviews, safeProductId, {
    payload,
    body,
    etag: buildWeakEtagFromString(body)
  }, ADMIN_CATALOG_CACHE_MAX_ENTRIES * 2);
}

function getCachedProductImageResponse(data, productId) {
  const safeProductId = safeString(productId).slice(0, 120);
  if (!safeProductId) {
    return null;
  }

  const cached = getLruCacheEntry(derivedResponseCache.productImages, safeProductId);
  if (cached) {
    return cached;
  }

  const safeData = validateStoreData(data);
  const product = Array.isArray(safeData.products)
    ? safeData.products.find((item) => safeString(item && item.id) === safeProductId)
    : null;

  if (!product) {
    return null;
  }

  const imageValue = normalizePersistedProductImage(product.image, "", safeProductId, true);
  const value = buildProductImageResponseFromValue(safeProductId, imageValue);
  if (!value) {
    return null;
  }

  return setLruCacheEntry(derivedResponseCache.productImages, safeProductId, value, PRODUCT_IMAGE_CACHE_MAX_ENTRIES);
}

async function getHistoricalProductImageResponse(productId) {
  const safeProductId = safeString(productId).slice(0, 120);
  if (!safeProductId || !storeRepository || typeof storeRepository.findHistoricalProductImage !== "function") {
    return null;
  }

  const historicalImage = await storeRepository.findHistoricalProductImage(safeProductId);
  if (!historicalImage) {
    return null;
  }

  const value = buildProductImageResponseFromValue(safeProductId, historicalImage);
  if (!value) {
    return null;
  }

  return setLruCacheEntry(derivedResponseCache.productImages, safeProductId, value, PRODUCT_IMAGE_CACHE_MAX_ENTRIES);
}

async function getHistoricalProductImageResponse(productId) {
  const safeProductId = safeString(productId).slice(0, 120);
  if (!safeProductId || !storeRepository || typeof storeRepository.findHistoricalProductImage !== "function") {
    return null;
  }

  const historicalImage = await storeRepository.findHistoricalProductImage(safeProductId);
  if (!historicalImage) {
    return null;
  }

  const value = buildProductImageResponseFromValue(safeProductId, historicalImage);
  if (!value) {
    return null;
  }

  return setLruCacheEntry(derivedResponseCache.productImages, safeProductId, value, PRODUCT_IMAGE_CACHE_MAX_ENTRIES);
}
async function repairSingleProductImageFromHistory(productId) {
  const safeProductId = safeString(productId).slice(0, 120);
  if (!safeProductId || !storeRepository || typeof storeRepository.findHistoricalProductImage !== "function") {
    return false;
  }

  return runSerializedStoreMutation(async () => {
    const currentData = await storeRepository.read();
    const nextData = cloneData(validateStoreData(currentData));
    const productIndex = Array.isArray(nextData.products)
      ? nextData.products.findIndex((item) => safeString(item && item.id) === safeProductId)
      : -1;

    if (productIndex < 0) {
      return false;
    }

    const currentProduct = nextData.products[productIndex];
    const currentImage = normalizePersistedProductImage(currentProduct && currentProduct.image, "", safeProductId, false);
    if (
      currentImage
      && !isProductImageApiPath(currentImage, safeProductId)
      && isRenderableProductImageValue(currentImage, safeProductId)
    ) {
      return false;
    }

    const historicalImage = await storeRepository.findHistoricalProductImage(safeProductId);
    if (
      !historicalImage
      || isProductImageApiPath(historicalImage, safeProductId)
      || !isRenderableProductImageValue(historicalImage, safeProductId)
    ) {
      return false;
    }

    nextData.products[productIndex].image = historicalImage;
    await storeRepository.write(nextData, {
      previousPayload: currentData,
      source: "image_repair_on_demand"
    });
    return true;
  });
}

async function repairBrokenProductImagesFromHistory(repository) {
  if (!repository || typeof repository.read !== "function" || typeof repository.write !== "function" || typeof repository.findHistoricalProductImage !== "function") {
    return { repaired: 0, skipped: 0 };
  }

  const currentData = await repository.read();
  const safeData = validateStoreData(currentData);
  const nextData = cloneData(safeData);
  let repaired = 0;
  let skipped = 0;

  for (const product of nextData.products) {
    const productId = safeString(product && product.id).slice(0, 120);
    if (!productId) {
      skipped += 1;
      continue;
    }

    const currentImage = normalizePersistedProductImage(product.image, "", productId, true);
    if (currentImage && !isProductImageApiPath(currentImage, productId) && isRenderableProductImageValue(currentImage, productId)) {
      continue;
    }

    const historicalImage = await repository.findHistoricalProductImage(productId);
    if (!historicalImage) {
      skipped += 1;
      continue;
    }

    product.image = historicalImage;
    repaired += 1;
  }

  if (repaired > 0) {
    await repository.write(nextData, {
      previousPayload: safeData,
      source: "product_image_auto_repair"
    });
  }

  return { repaired, skipped };
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

function hasPartialProductPayload(product) {
  return Boolean(
    product
    && typeof product === "object"
    && (
      product.detailsLoaded === false
      || product.reviewsLoaded === false
      || product.pendingReviewsLoaded === false
    )
  );
}

async function resolveRecoverableProductImage(productId, candidateImage, currentImage) {
  const safeProductId = safeString(productId).slice(0, 120);
  if (!safeProductId) {
    return "";
  }

  const normalizedCandidate = normalizePersistedProductImage(candidateImage, currentImage, safeProductId, false);
  if (
    normalizedCandidate
    && !isProductImageApiPath(normalizedCandidate, safeProductId)
    && isRenderableProductImageValue(normalizedCandidate, safeProductId)
  ) {
    return normalizedCandidate;
  }

  const normalizedCurrent = normalizePersistedProductImage(currentImage, "", safeProductId, false);
  if (
    normalizedCurrent
    && !isProductImageApiPath(normalizedCurrent, safeProductId)
    && isRenderableProductImageValue(normalizedCurrent, safeProductId)
  ) {
    return normalizedCurrent;
  }

  if (!storeRepository || typeof storeRepository.findHistoricalProductImage !== "function") {
    return "";
  }

  const historicalImage = await storeRepository.findHistoricalProductImage(safeProductId);
  if (
    historicalImage
    && !isProductImageApiPath(historicalImage, safeProductId)
    && isRenderableProductImageValue(historicalImage, safeProductId)
  ) {
    return historicalImage;
  }

  return "";
}

async function collectProductImageIntegrityReport(repository) {
  if (!repository || typeof repository.read !== "function") {
    return {
      ok: false,
      total: 0,
      broken: 0,
      recoverable: 0,
      checkedAt: new Date().toISOString(),
      brokenSample: []
    };
  }

  const currentData = await repository.read();
  const safeData = validateStoreData(currentData);
  const safeProducts = Array.isArray(safeData.products) ? safeData.products : [];
  let broken = 0;
  let recoverable = 0;
  const brokenSample = [];

  for (const product of safeProducts) {
    const productId = safeString(product && product.id).slice(0, 120);
    if (!productId) {
      continue;
    }

    const currentImage = normalizePersistedProductImage(product.image, "", productId, false);
    if (currentImage && !isProductImageApiPath(currentImage, productId) && isRenderableProductImageValue(currentImage, productId)) {
      continue;
    }

    broken += 1;
    if (brokenSample.length < STORE_IMAGE_GUARD_SAMPLE_LIMIT) {
      brokenSample.push({
        id: productId,
        name: safeString(product && product.name).slice(0, 160),
        brand: safeString(product && product.brand).slice(0, 160)
      });
    }

    if (typeof repository.findHistoricalProductImage === "function") {
      const historicalImage = await repository.findHistoricalProductImage(productId);
      if (historicalImage) {
        recoverable += 1;
      }
    }
  }

  return {
    ok: broken <= 0,
    total: safeProducts.length,
    broken,
    recoverable,
    checkedAt: new Date().toISOString(),
    brokenSample
  };
}
async function mergeIncomingStorePayloadWithCurrentData(payload, currentData) {
  const next = ensureIncomingAdminPassword(payload, currentData);
  const currentProducts = Array.isArray(currentData && currentData.products) ? currentData.products : [];
  const currentProductsById = new Map(
    currentProducts
      .map((product) => [safeString(product && product.id).slice(0, 120), product])
      .filter((entry) => entry[0])
  );

  next.products = await Promise.all(
    next.products.map(async (product) => {
      if (!product || typeof product !== "object") {
        return product;
      }

      const safeProductId = safeString(product.id).slice(0, 120);
      const currentProduct = safeProductId ? currentProductsById.get(safeProductId) || null : null;
      const looksPartial = hasPartialProductPayload(product);
      const nextProduct = looksPartial && currentProduct
        ? cloneData(currentProduct)
        : cloneData(product);

      const recoveredImage = await resolveRecoverableProductImage(
        safeProductId,
        product.image,
        currentProduct && currentProduct.image
      );

      if (recoveredImage) {
        nextProduct.image = recoveredImage;
      } else if (currentProduct && currentProduct.image !== undefined) {
        nextProduct.image = currentProduct.image;
      }

      if (Object.prototype.hasOwnProperty.call(product, "topWeek")) {
        nextProduct.topWeek = Boolean(product.topWeek);
      }
      if (Object.prototype.hasOwnProperty.call(product, "topMonth")) {
        nextProduct.topMonth = Boolean(product.topMonth);
      }

      return nextProduct;
    })
  );

  return next;
}

function getProductsCount(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.products)) {
    return 0;
  }
  return data.products.length;
}

function shouldIncludeProductsInStoreResponse(requestUrl) {
  if (!requestUrl || !requestUrl.searchParams) {
    return true;
  }
  const raw = safeString(requestUrl.searchParams.get("products")).toLowerCase();
  if (!raw) {
    return true;
  }
  return !(raw === "0" || raw === "false" || raw === "no" || raw === "off");
}

function normalizeCatalogSearchQuery(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMlNumber(value) {
  const normalized = Number(String(value || "").replace(",", "."));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return Math.round(normalized * 100) / 100;
}

function sanitizeProductVolume(rawVolume) {
  if (!rawVolume || typeof rawVolume !== "object") {
    return null;
  }

  const ml = normalizeMlNumber(rawVolume.ml);
  const price = Math.round(Number(rawVolume.price));
  if (ml === null || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return { ml, price };
}

function normalizeProductGender(value) {
  const safe = safeString(value).toLowerCase();
  if (safe === "male" || safe === "female" || safe === "unisex") {
    return safe;
  }
  return "unisex";
}

function normalizeProductBottleType(value) {
  const safe = safeString(value).toLowerCase();
  if (safe === "decant" || safe === "tester" || safe === "full") {
    return safe;
  }
  return "full";
}

function sanitizeIncomingAdminProduct(rawProduct, existingProduct) {
  if (!rawProduct || typeof rawProduct !== "object") {
    throw new Error("INVALID_PRODUCT_PAYLOAD");
  }

  const safeExisting = existingProduct && typeof existingProduct === "object" ? existingProduct : null;
  const id = safeString(rawProduct.id || (safeExisting && safeExisting.id)).slice(0, 120);
  const name = safeString(rawProduct.name).slice(0, 160);
  const brand = safeString(rawProduct.brand).slice(0, 160);
  const description = String(rawProduct.description || "").trim().slice(0, 6000);
  const rawImage = rawProduct.image !== undefined
    ? rawProduct.image
    : (safeExisting && safeExisting.image);
  const image = normalizePersistedProductImage(rawImage, safeExisting && safeExisting.image, id, Boolean(safeExisting));
  const gender = normalizeProductGender(rawProduct.gender || (safeExisting && safeExisting.gender));
  const bottleType = normalizeProductBottleType(rawProduct.bottleType || (safeExisting && safeExisting.bottleType));

  const allowLegacyProxyImage = Boolean(safeExisting) && isProductImageApiPath(image, id);
  if (!id || !name || !brand || !image || (!allowLegacyProxyImage && !isRenderableProductImageValue(image, id))) {
    throw new Error("INVALID_PRODUCT_PAYLOAD");
  }

  const rawVolumes = Array.isArray(rawProduct.volumes) ? rawProduct.volumes : [];
  const seenVolumes = new Set();
  const volumes = rawVolumes
    .map(sanitizeProductVolume)
    .filter(Boolean)
    .filter((volume) => {
      const key = String(volume.ml);
      if (seenVolumes.has(key)) {
        return false;
      }
      seenVolumes.add(key);
      return true;
    })
    .sort((left, right) => left.ml - right.ml);

  if (!volumes.length) {
    throw new Error("INVALID_PRODUCT_PAYLOAD");
  }

  const reviews = normalizeStoredReviewList(
    rawProduct.reviews !== undefined ? rawProduct.reviews : (safeExisting && safeExisting.reviews),
    "pr",
    MAX_PRODUCT_REVIEWS_PER_PRODUCT
  );
  const pendingReviews = normalizeStoredReviewList(
    rawProduct.pendingReviews !== undefined ? rawProduct.pendingReviews : (safeExisting && safeExisting.pendingReviews),
    "ppr",
    MAX_PENDING_PRODUCT_REVIEWS_PER_PRODUCT
  );

  return {
    id,
    name,
    brand,
    gender,
    bottleType,
    description,
    image,
    volumes,
    reviews,
    pendingReviews,
    topWeek: Boolean(rawProduct.topWeek),
    topMonth: Boolean(rawProduct.topMonth)
  };
}

function generateAiDraftId() {
  return "aid_" + crypto.randomBytes(8).toString("hex");
}

function normalizeAiDraftSource(value) {
  const safe = safeString(value).toLowerCase().slice(0, MAX_AI_DRAFT_SOURCE_LENGTH);
  if (safe === "telegram") {
    return "telegram";
  }
  return "manual-test";
}

function normalizeAiDraftStatus(value) {
  const safe = safeString(value).toLowerCase();
  if (safe === "needs_review") {
    return "needs_review";
  }
  if (safe === "ready_to_publish") {
    return "ready_to_publish";
  }
  if (safe === "published") {
    return "published";
  }
  if (safe === "rejected") {
    return "rejected";
  }
  return "pending";
}

function getTelegramWebhookSecret() {
  return safeString(process.env.TELEGRAM_WEBHOOK_SECRET).slice(0, 512);
}

function getTelegramPhotoMeta(post) {
  const safePost = post && typeof post === "object" ? post : null;
  const photos = safePost && Array.isArray(safePost.photo) ? safePost.photo : [];
  if (!photos.length) {
    return null;
  }

  const largest = photos.reduce((best, current) => {
    if (!best) {
      return current;
    }
    const bestArea = Math.max(0, Number(best.width) || 0) * Math.max(0, Number(best.height) || 0);
    const currentArea = Math.max(0, Number(current.width) || 0) * Math.max(0, Number(current.height) || 0);
    return currentArea >= bestArea ? current : best;
  }, null);

  if (!largest) {
    return null;
  }

  return {
    fileId: safeString(largest.file_id).slice(0, 400),
    fileUniqueId: safeString(largest.file_unique_id).slice(0, 400),
    width: Math.max(0, Number(largest.width) || 0),
    height: Math.max(0, Number(largest.height) || 0),
    fileSize: Math.max(0, Number(largest.file_size) || 0),
    variantsCount: photos.length
  };
}

function buildTelegramSourceUrl(post) {
  const safePost = post && typeof post === "object" ? post : null;
  if (!safePost) {
    return "";
  }

  const username = safeString(safePost.chat && safePost.chat.username).replace(/^@+/, "");
  const messageId = Math.max(0, Number(safePost.message_id) || 0);
  if (!username || !messageId) {
    return "";
  }

  return "https://t.me/" + username + "/" + messageId;
}

function buildTelegramDraftId(post) {
  const safePost = post && typeof post === "object" ? post : null;
  const rawChatId = safeString(safePost && safePost.chat && safePost.chat.id);
  const rawMessageId = safeString(safePost && safePost.message_id);
  const chatId = rawChatId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
  const messageId = rawMessageId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  if (!chatId || !messageId) {
    return generateAiDraftId();
  }
  return "tg_" + chatId + "_" + messageId;
}

function extractTelegramDraftSource(update) {
  const safeUpdate = update && typeof update === "object" ? update : null;
  if (!safeUpdate) {
    return null;
  }

  if (safeUpdate.channel_post && typeof safeUpdate.channel_post === "object") {
    return {
      postType: "channel_post",
      post: safeUpdate.channel_post
    };
  }

  if (safeUpdate.message && typeof safeUpdate.message === "object") {
    return {
      postType: "message",
      post: safeUpdate.message
    };
  }

  return null;
}

function buildTelegramDraftAnalysis(existingAnalysis, update, sourceInfo, photoMeta) {
  const base = existingAnalysis && typeof existingAnalysis === "object" && !Array.isArray(existingAnalysis)
    ? cloneData(existingAnalysis)
    : {};
  const safePost = sourceInfo && sourceInfo.post && typeof sourceInfo.post === "object" ? sourceInfo.post : {};
  base.telegram = {
    updateId: Math.max(0, Number(update && update.update_id) || 0),
    postType: safeString(sourceInfo && sourceInfo.postType).slice(0, 40),
    chatId: safeString(safePost.chat && safePost.chat.id).slice(0, 120),
    chatType: safeString(safePost.chat && safePost.chat.type).slice(0, 80),
    chatTitle: safeString(safePost.chat && safePost.chat.title).slice(0, 200),
    chatUsername: safeString(safePost.chat && safePost.chat.username).slice(0, 200),
    messageId: Math.max(0, Number(safePost.message_id) || 0),
    mediaGroupId: safeString(safePost.media_group_id).slice(0, 120),
    postedAtUnix: Math.max(0, Number(safePost.date) || 0),
    hasPhoto: Boolean(photoMeta && photoMeta.fileId),
    photo: photoMeta ? {
      fileId: photoMeta.fileId,
      fileUniqueId: photoMeta.fileUniqueId,
      width: photoMeta.width,
      height: photoMeta.height,
      fileSize: photoMeta.fileSize,
      variantsCount: photoMeta.variantsCount
    } : null
  };
  return base;
}

function buildTelegramAiDraftPayload(update, sourceInfo, existingDraft) {
  const safeExistingDraft = existingDraft && typeof existingDraft === "object" ? existingDraft : null;
  const safePost = sourceInfo && sourceInfo.post && typeof sourceInfo.post === "object" ? sourceInfo.post : {};
  const rawText = safeString(safePost.text || safePost.caption).slice(0, MAX_AI_DRAFT_RAW_TEXT_LENGTH);
  const photoMeta = getTelegramPhotoMeta(safePost);

  return {
    id: buildTelegramDraftId(safePost),
    source: "telegram",
    sourceUrl: buildTelegramSourceUrl(safePost),
    rawText,
    confidenceScore: 0,
    status: safeExistingDraft ? safeExistingDraft.status : "pending",
    analysis: buildTelegramDraftAnalysis(
      safeExistingDraft && safeExistingDraft.analysis,
      update,
      sourceInfo,
      photoMeta
    ),
    notes: safeExistingDraft && Array.isArray(safeExistingDraft.notes) ? safeExistingDraft.notes : [],
    image: safeExistingDraft ? safeExistingDraft.image : ""
  };
}

function getTelegramBotToken() {
  return safeString(process.env.TELEGRAM_BOT_TOKEN).slice(0, 512);
}

function getOpenAiApiKey() {
  return safeString(process.env.OPENAI_API_KEY).slice(0, 512);
}

async function fetchExternalResource(url, options) {
  const safeOptions = options && typeof options === "object" ? Object.assign({}, options) : {};
  const timeoutMs = Math.max(1000, Number(safeOptions.timeoutMs || EXTERNAL_FETCH_TIMEOUT_MS) || EXTERNAL_FETCH_TIMEOUT_MS);
  delete safeOptions.timeoutMs;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, Object.assign({}, safeOptions, {
      signal: controller.signal
    }));
  } catch (error) {
    if (error && error.name === "AbortError") {
      const timeoutError = new Error("EXTERNAL_FETCH_TIMEOUT");
      timeoutError.code = "EXTERNAL_FETCH_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTelegramFileUrl(fileId) {
  const safeFileId = safeString(fileId).slice(0, 400);
  const botToken = getTelegramBotToken();
  if (!safeFileId) {
    return null;
  }
  if (!botToken) {
    const missingTokenError = new Error("TELEGRAM_BOT_TOKEN_MISSING");
    missingTokenError.code = "TELEGRAM_BOT_TOKEN_MISSING";
    throw missingTokenError;
  }

  const response = await fetchExternalResource(
    TELEGRAM_API_BASE_URL + "/bot" + botToken + "/getFile?file_id=" + encodeURIComponent(safeFileId),
    {
      headers: {
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    const lookupError = new Error("TELEGRAM_FILE_LOOKUP_FAILED");
    lookupError.code = "TELEGRAM_FILE_LOOKUP_FAILED";
    lookupError.status = response.status;
    throw lookupError;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  const filePath = safeString(payload && payload.result && payload.result.file_path).slice(0, 1024);
  if (!filePath) {
    const missingPathError = new Error("TELEGRAM_FILE_PATH_MISSING");
    missingPathError.code = "TELEGRAM_FILE_PATH_MISSING";
    throw missingPathError;
  }

  return TELEGRAM_API_BASE_URL + "/file/bot" + botToken + "/" + filePath.replace(/^\/+/, "");
}

function guessImageContentTypeFromUrl(url) {
  const safeUrl = safeString(url).toLowerCase();
  if (safeUrl.endsWith(".png")) {
    return "image/png";
  }
  if (safeUrl.endsWith(".webp")) {
    return "image/webp";
  }
  if (safeUrl.endsWith(".gif")) {
    return "image/gif";
  }
  return "image/jpeg";
}

async function downloadImageAsDataUrl(url) {
  const safeUrl = safeString(url).slice(0, 2000);
  if (!safeUrl) {
    return null;
  }

  const response = await fetchExternalResource(safeUrl, {
    headers: {
      "Accept": "image/*,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    const downloadError = new Error("AI_DRAFT_IMAGE_DOWNLOAD_FAILED");
    downloadError.code = "AI_DRAFT_IMAGE_DOWNLOAD_FAILED";
    downloadError.status = response.status;
    throw downloadError;
  }

  const arrayBuffer = await response.arrayBuffer();
  const body = Buffer.from(arrayBuffer);
  if (!body.length) {
    return null;
  }

  if (body.length > MAX_TELEGRAM_ANALYSIS_IMAGE_BYTES) {
    const tooLargeError = new Error("AI_DRAFT_IMAGE_TOO_LARGE");
    tooLargeError.code = "AI_DRAFT_IMAGE_TOO_LARGE";
    tooLargeError.size = body.length;
    throw tooLargeError;
  }

  const headerContentType = safeString(response.headers.get("content-type")).toLowerCase();
  const contentType = headerContentType.startsWith("image/")
    ? headerContentType.split(";")[0]
    : guessImageContentTypeFromUrl(safeUrl);

  return "data:" + contentType + ";base64," + body.toString("base64");
}

function getAiDraftTelegramPhotoFileId(draft) {
  const safeDraft = draft && typeof draft === "object" ? draft : null;
  const analysis = safeDraft && safeDraft.analysis && typeof safeDraft.analysis === "object" ? safeDraft.analysis : null;
  const telegram = analysis && telegramHasContent(analysis.telegram) ? analysis.telegram : null;
  const photo = telegram && telegram.photo && typeof telegram.photo === "object" ? telegram.photo : null;
  return safeString(photo && photo.fileId).slice(0, 400);
}

function telegramHasContent(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function resolveAiDraftImageInputForAnalysis(draft) {
  const telegramFileId = getAiDraftTelegramPhotoFileId(draft);
  if (telegramFileId) {
    try {
      const telegramFileUrl = await fetchTelegramFileUrl(telegramFileId);
      const telegramImageDataUrl = await downloadImageAsDataUrl(telegramFileUrl);
      if (telegramImageDataUrl) {
        return {
          imageUrl: telegramImageDataUrl,
          source: "telegram",
          fileId: telegramFileId
        };
      }
    } catch (error) {
      console.warn("AI draft Telegram photo fetch skipped:", {
        draftId: draft && draft.id,
        code: error && error.code ? error.code : "",
        message: error && error.message ? error.message : String(error)
      });
      if (safeString(draft && draft.rawText)) {
        return null;
      }
      throw error;
    }
  }

  const directImage = safeString(draft && draft.image).slice(0, MAX_AI_DRAFT_IMAGE_LENGTH);
  if (directImage && (directImage.startsWith("data:image/") || /^https?:\/\//i.test(directImage))) {
    return {
      imageUrl: directImage,
      source: "draft"
    };
  }

  return null;
}

function buildOpenAiAiDraftAnalysisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "brand",
      "name",
      "description",
      "volumes",
      "gender",
      "bottleType",
      "notes",
      "confidenceScore"
    ],
    properties: {
      brand: {
        type: "string"
      },
      name: {
        type: "string"
      },
      description: {
        type: "string"
      },
      volumes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ml", "price"],
          properties: {
            ml: {
              type: "number"
            },
            price: {
              type: "number"
            }
          }
        }
      },
      gender: {
        type: "string",
        enum: ["male", "female", "unisex"]
      },
      bottleType: {
        type: "string",
        enum: ["decant", "tester", "full"]
      },
      notes: {
        type: "array",
        items: {
          type: "string"
        }
      },
      confidenceScore: {
        type: "number",
        minimum: 0,
        maximum: 1
      }
    }
  };
}

function buildOpenAiAiDraftAnalysisPrompt(draft) {
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const promptParts = [
    "Ты анализируешь Telegram-пост для импорта товара в luxury perfume shop.",
    "Извлекай только то, что видно в тексте и на фото, без выдумывания фактов.",
    "Верни строго JSON по заданной схеме.",
    "description пиши по-русски, кратко и премиально, 1-2 предложения без markdown.",
    "volumes включай только там, где можно определить и объём, и цену.",
    "gender используй только male, female или unisex.",
    "bottleType используй только decant, tester или full.",
    "notes — короткие замечания и сомнения, если они есть.",
    "confidenceScore — число от 0 до 1. Чем больше неопределённость, тем ниже значение.",
    "",
    "Telegram rawText:",
    safeString(safeDraft.rawText).slice(0, MAX_AI_DRAFT_RAW_TEXT_LENGTH) || "(пусто)",
    "",
    "Источник:",
    safeString(safeDraft.sourceUrl) || "(без ссылки)"
  ];

  return promptParts.join("\n");
}

function extractOpenAiOutputText(payload) {
  const directOutputText = safeString(payload && payload.output_text);
  if (directOutputText) {
    return directOutputText;
  }

  const output = Array.isArray(payload && payload.output) ? payload.output : [];
  const parts = [];

  for (const item of output) {
    const content = Array.isArray(item && item.content) ? item.content : [];
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }
      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        parts.push(contentItem.text.trim());
        continue;
      }
      if (contentItem.text && typeof contentItem.text === "object" && typeof contentItem.text.value === "string" && contentItem.text.value.trim()) {
        parts.push(contentItem.text.value.trim());
      }
    }
  }

  return parts.join("\n").trim();
}

function normalizeOpenAiAiDraftResult(rawResult) {
  const safeResult = rawResult && typeof rawResult === "object" && !Array.isArray(rawResult) ? rawResult : {};
  const rawVolumes = Array.isArray(safeResult.volumes) ? safeResult.volumes : [];
  const seenVolumes = new Set();
  const volumes = rawVolumes
    .map(sanitizeProductVolume)
    .filter(Boolean)
    .filter((volume) => {
      const key = String(volume.ml);
      if (seenVolumes.has(key)) {
        return false;
      }
      seenVolumes.add(key);
      return true;
    })
    .sort((left, right) => left.ml - right.ml);

  let confidenceScore = Number(safeResult.confidenceScore);
  if (!Number.isFinite(confidenceScore)) {
    confidenceScore = 0;
  }
  confidenceScore = Math.max(0, Math.min(1, Math.round(confidenceScore * 10000) / 10000));

  return {
    brand: safeString(safeResult.brand).trim().slice(0, MAX_AI_DRAFT_TEXT_LENGTH),
    name: safeString(safeResult.name).trim().slice(0, MAX_AI_DRAFT_TEXT_LENGTH),
    description: safeString(safeResult.description).trim().slice(0, MAX_AI_DRAFT_TEXT_LENGTH),
    volumes,
    gender: normalizeProductGender(safeResult.gender),
    bottleType: normalizeProductBottleType(safeResult.bottleType),
    notes: normalizeAiDraftNotes(safeResult.notes),
    confidenceScore
  };
}

async function requestOpenAiAiDraftAnalysis(draft) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    const missingKeyError = new Error("OPENAI_API_KEY_MISSING");
    missingKeyError.code = "OPENAI_API_KEY_MISSING";
    throw missingKeyError;
  }

  const safeDraft = draft && typeof draft === "object" ? draft : null;
  if (!safeDraft) {
    const invalidDraftError = new Error("AI_DRAFT_NOT_FOUND");
    invalidDraftError.code = "AI_DRAFT_NOT_FOUND";
    throw invalidDraftError;
  }

  const imageInput = await resolveAiDraftImageInputForAnalysis(safeDraft);
  const rawText = safeString(safeDraft.rawText).trim();
  if (!rawText && !imageInput) {
    const missingInputError = new Error("AI_DRAFT_ANALYSIS_INPUT_EMPTY");
    missingInputError.code = "AI_DRAFT_ANALYSIS_INPUT_EMPTY";
    throw missingInputError;
  }

  const prompt = buildOpenAiAiDraftAnalysisPrompt(safeDraft);
  const content = [
    {
      type: "input_text",
      text: prompt
    }
  ];

  if (imageInput && imageInput.imageUrl) {
    content.push({
      type: "input_image",
      image_url: imageInput.imageUrl
    });
  }

  const response = await fetchExternalResource(OPENAI_RESPONSES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: OPENAI_AI_DRAFT_ANALYZE_MODEL,
      input: [
        {
          role: "user",
          content
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ai_draft_analysis",
          strict: true,
          schema: buildOpenAiAiDraftAnalysisSchema()
        }
      }
    })
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const apiError = new Error("OPENAI_ANALYSIS_REQUEST_FAILED");
    apiError.code = "OPENAI_ANALYSIS_REQUEST_FAILED";
    apiError.status = response.status;
    apiError.payload = payload;
    throw apiError;
  }

  const outputText = extractOpenAiOutputText(payload);
  if (!outputText) {
    const emptyResponseError = new Error("OPENAI_ANALYSIS_EMPTY_RESPONSE");
    emptyResponseError.code = "OPENAI_ANALYSIS_EMPTY_RESPONSE";
    throw emptyResponseError;
  }

  let parsedResult = null;
  try {
    parsedResult = JSON.parse(outputText);
  } catch (error) {
    const invalidJsonError = new Error("OPENAI_ANALYSIS_INVALID_JSON");
    invalidJsonError.code = "OPENAI_ANALYSIS_INVALID_JSON";
    invalidJsonError.outputText = outputText;
    throw invalidJsonError;
  }

  return {
    model: OPENAI_AI_DRAFT_ANALYZE_MODEL,
    imageSource: imageInput ? imageInput.source : "",
    telegramFileId: imageInput && imageInput.source === "telegram" ? safeString(imageInput.fileId).slice(0, 400) : "",
    normalized: normalizeOpenAiAiDraftResult(parsedResult),
    raw: parsedResult
  };
}

function buildAiDraftFromAnalysisResult(draft, analysisResult) {
  const safeDraft = draft && typeof draft === "object" ? draft : null;
  const safeResult = analysisResult && typeof analysisResult === "object" ? analysisResult : null;
  if (!safeDraft || !safeResult || !safeResult.normalized) {
    throw new Error("INVALID_AI_DRAFT_ANALYSIS_RESULT");
  }

  const normalized = safeResult.normalized;
  const nextStatus = normalized.confidenceScore >= OPENAI_AI_DRAFT_READY_THRESHOLD
    ? "ready_to_publish"
    : "needs_review";
  const nextAnalysis = normalizeAiDraftAnalysis(
    Object.assign({}, safeDraft.analysis || {}, {
      brand: normalized.brand,
      name: normalized.name,
      description: normalized.description,
      volumes: normalized.volumes,
      gender: normalized.gender,
      bottleType: normalized.bottleType,
      notes: normalized.notes,
      confidenceScore: normalized.confidenceScore,
      openai: {
        model: safeString(safeResult.model).slice(0, 120),
        analyzedAt: normalizeIsoDate(new Date().toISOString()),
        imageSource: safeString(safeResult.imageSource).slice(0, 40),
        telegramFileId: safeString(safeResult.telegramFileId).slice(0, 400)
      }
    }),
    safeDraft.analysis
  );

  return sanitizeIncomingAiDraft(Object.assign({}, safeDraft, {
    brand: normalized.brand || safeDraft.brand,
    name: normalized.name || safeDraft.name,
    description: normalized.description || safeDraft.description,
    volumes: normalized.volumes.length ? normalized.volumes : safeDraft.volumes,
    notes: normalized.notes.length ? normalized.notes : safeDraft.notes,
    analysis: nextAnalysis,
    confidenceScore: normalized.confidenceScore,
    status: nextStatus
  }), safeDraft);
}

function normalizeAiDraftKeywordList(value, maxItems, maxItemLength) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|,/)
      : [];

  return source
    .map((item) => safeString(item).slice(0, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeAiDraftSeo(value, fallbackValue) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue)
      ? fallbackValue
      : null;
  if (!source) {
    return null;
  }

  const title = safeString(source.title || source.seoTitle).slice(0, MAX_AI_DRAFT_SEO_TITLE_LENGTH);
  const description = safeString(source.description || source.seoDescription).slice(0, MAX_AI_DRAFT_SEO_DESCRIPTION_LENGTH);
  const rawSlug = safeString(source.slug).slice(0, MAX_AI_DRAFT_SLUG_LENGTH);
  const slug = rawSlug ? slugifyText(rawSlug) : "";

  if (!title && !description && !slug) {
    return null;
  }

  return {
    title,
    description,
    slug
  };
}

function normalizeAiDraftContent(value, fallbackValue) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue)
      ? fallbackValue
      : null;
  if (!source) {
    return null;
  }

  const content = {
    shortDescription: safeString(source.shortDescription).slice(0, MAX_AI_DRAFT_TEXT_LENGTH),
    fullDescription: safeString(source.fullDescription).slice(0, MAX_AI_DRAFT_CONTENT_TEXT_LENGTH),
    fragranceNotes: normalizeAiDraftKeywordList(source.fragranceNotes || source.notes, 20, 120),
    season: normalizeAiDraftKeywordList(source.season, 8, 80),
    timeOfDay: normalizeAiDraftKeywordList(source.timeOfDay, 8, 80),
    longevity: safeString(source.longevity).slice(0, 120),
    sillage: safeString(source.sillage).slice(0, 120),
    suitableFor: safeString(source.suitableFor || source.targetAudience || source.whoFits).slice(0, 600),
    salesCopy: safeString(source.salesCopy || source.sellingText).slice(0, MAX_AI_DRAFT_CONTENT_TEXT_LENGTH)
  };

  if (
    !content.shortDescription
    && !content.fullDescription
    && !content.fragranceNotes.length
    && !content.season.length
    && !content.timeOfDay.length
    && !content.longevity
    && !content.sillage
    && !content.suitableFor
    && !content.salesCopy
  ) {
    return null;
  }

  return content;
}

function normalizeAiDraftMediaAsset(value, fallbackValue) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue)
      ? fallbackValue
      : null;
  if (!source) {
    return null;
  }

  const url = safeString(source.url || source.image || source.src).slice(0, MAX_AI_DRAFT_MEDIA_IMAGE_LENGTH);
  const alt = safeString(source.alt).slice(0, MAX_AI_DRAFT_MEDIA_TEXT_LENGTH);
  const prompt = safeString(source.prompt).slice(0, MAX_AI_DRAFT_MEDIA_TEXT_LENGTH);
  const kind = safeString(source.kind).slice(0, 60);
  const size = safeString(source.size).slice(0, 40);
  const quality = safeString(source.quality).slice(0, 40);
  const model = safeString(source.model).slice(0, 120);
  const generatedAt = source.generatedAt ? normalizeIsoDate(source.generatedAt) : "";

  if (!url && !alt && !prompt) {
    return null;
  }

  return {
    url,
    alt,
    prompt,
    kind,
    size,
    quality,
    model,
    generatedAt
  };
}

function normalizeAiDraftMediaPack(value, fallbackValue) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue)
      ? fallbackValue
      : null;
  if (!source) {
    return null;
  }

  const mediaPack = {
    catalogImage: normalizeAiDraftMediaAsset(source.catalogImage, null),
    heroImage: normalizeAiDraftMediaAsset(source.heroImage, null),
    bannerImage: normalizeAiDraftMediaAsset(source.bannerImage, null),
    thumbnail: normalizeAiDraftMediaAsset(source.thumbnail, null),
    gallery: normalizeAiDraftKeywordList(source.gallery, MAX_AI_DRAFT_MEDIA_LIST_LENGTH, MAX_AI_DRAFT_MEDIA_IMAGE_LENGTH),
    generatedAt: source.generatedAt ? normalizeIsoDate(source.generatedAt) : "",
    model: safeString(source.model).slice(0, 120)
  };

  if (
    !mediaPack.catalogImage
    && !mediaPack.heroImage
    && !mediaPack.bannerImage
    && !mediaPack.thumbnail
    && !mediaPack.gallery.length
    && !mediaPack.generatedAt
    && !mediaPack.model
  ) {
    return null;
  }

  return mediaPack;
}

function buildOpenAiAiDraftCardSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "seoTitle",
      "seoDescription",
      "slug",
      "shortDescription",
      "fullDescription",
      "fragranceNotes",
      "season",
      "timeOfDay",
      "longevity",
      "sillage",
      "suitableFor",
      "salesCopy"
    ],
    properties: {
      seoTitle: { type: "string" },
      seoDescription: { type: "string" },
      slug: { type: "string" },
      shortDescription: { type: "string" },
      fullDescription: { type: "string" },
      fragranceNotes: {
        type: "array",
        items: { type: "string" },
        maxItems: 20
      },
      season: {
        type: "array",
        items: { type: "string" },
        maxItems: 8
      },
      timeOfDay: {
        type: "array",
        items: { type: "string" },
        maxItems: 8
      },
      longevity: { type: "string" },
      sillage: { type: "string" },
      suitableFor: { type: "string" },
      salesCopy: { type: "string" }
    }
  };
}

function buildOpenAiAiDraftCardPrompt(draft) {
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const analysis = safeDraft.analysis && typeof safeDraft.analysis === "object" ? safeDraft.analysis : {};
  const promptParts = [
    "Ты создаешь премиальную AI-карточку для товара интернет-бутика оригинальной парфюмерии Veligodsky Parfums.",
    "Верни только JSON по заданной схеме. Без markdown, без комментариев.",
    "Пиши на русском языке.",
    "Используй raw text и уже выполненный анализ. Не выдумывай несоответствующие бренду факты, но можно аккуратно дополнять коммерчески уместными формулировками.",
    "Slug верни латиницей в kebab-case.",
    "SEO title до 70 символов, SEO description до 160 символов.",
    "shortDescription - короткое описание для карточки товара.",
    "fullDescription - более полное продающее описание.",
    "fragranceNotes - только ароматические ноты, массив строк.",
    "season - массив подходящих сезонов.",
    "timeOfDay - массив подходящего времени суток/ситуаций.",
    "longevity и sillage - короткие емкие характеристики.",
    "suitableFor - кому подойдет аромат.",
    "salesCopy - краткий премиальный продающий текст.",
    "",
    "Текущий черновик:",
    JSON.stringify({
      brand: safeDraft.brand,
      name: safeDraft.name,
      description: safeDraft.description,
      rawText: safeString(safeDraft.rawText).slice(0, 8000),
      sourceUrl: safeDraft.sourceUrl,
      volumes: Array.isArray(safeDraft.volumes) ? safeDraft.volumes : [],
      analysis: analysis
    }, null, 2)
  ];

  return promptParts.join("\n");
}

function normalizeOpenAiAiDraftCardResult(rawResult, draft) {
  const safeResult = rawResult && typeof rawResult === "object" && !Array.isArray(rawResult) ? rawResult : {};
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const fallbackName = safeString(safeDraft.name);
  const fallbackBrand = safeString(safeDraft.brand);
  const fallbackSlug = slugifyText([fallbackBrand, fallbackName].filter(Boolean).join(" "));

  return {
    seo: normalizeAiDraftSeo({
      title: safeResult.seoTitle,
      description: safeResult.seoDescription,
      slug: safeResult.slug || fallbackSlug
    }, {
      title: [fallbackBrand, fallbackName].filter(Boolean).join(" "),
      description: safeString(safeDraft.description),
      slug: fallbackSlug
    }),
    content: normalizeAiDraftContent({
      shortDescription: safeResult.shortDescription,
      fullDescription: safeResult.fullDescription,
      fragranceNotes: safeResult.fragranceNotes,
      season: safeResult.season,
      timeOfDay: safeResult.timeOfDay,
      longevity: safeResult.longevity,
      sillage: safeResult.sillage,
      suitableFor: safeResult.suitableFor,
      salesCopy: safeResult.salesCopy
    }, null)
  };
}

async function requestOpenAiAiDraftProductCard(draft) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    const missingKeyError = new Error("OPENAI_API_KEY_MISSING");
    missingKeyError.code = "OPENAI_API_KEY_MISSING";
    throw missingKeyError;
  }

  const safeDraft = draft && typeof draft === "object" ? draft : null;
  if (!safeDraft) {
    const invalidDraftError = new Error("AI_DRAFT_NOT_FOUND");
    invalidDraftError.code = "AI_DRAFT_NOT_FOUND";
    throw invalidDraftError;
  }

  const prompt = buildOpenAiAiDraftCardPrompt(safeDraft);
  const response = await fetchExternalResource(OPENAI_RESPONSES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: OPENAI_AI_DRAFT_CARD_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ai_draft_product_card",
          strict: true,
          schema: buildOpenAiAiDraftCardSchema()
        }
      }
    })
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const apiError = new Error("OPENAI_AI_CARD_REQUEST_FAILED");
    apiError.code = "OPENAI_AI_CARD_REQUEST_FAILED";
    apiError.status = response.status;
    apiError.payload = payload;
    throw apiError;
  }

  const outputText = extractOpenAiOutputText(payload);
  if (!outputText) {
    const emptyResponseError = new Error("OPENAI_AI_CARD_EMPTY_RESPONSE");
    emptyResponseError.code = "OPENAI_AI_CARD_EMPTY_RESPONSE";
    throw emptyResponseError;
  }

  let parsedResult = null;
  try {
    parsedResult = JSON.parse(outputText);
  } catch (error) {
    const invalidJsonError = new Error("OPENAI_AI_CARD_INVALID_JSON");
    invalidJsonError.code = "OPENAI_AI_CARD_INVALID_JSON";
    invalidJsonError.outputText = outputText;
    throw invalidJsonError;
  }

  return {
    model: OPENAI_AI_DRAFT_CARD_MODEL,
    normalized: normalizeOpenAiAiDraftCardResult(parsedResult, safeDraft),
    raw: parsedResult
  };
}

function buildAiDraftImageGenerationPrompts(draft, cardData) {
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const safeCardData = cardData && typeof cardData === "object" ? cardData : {};
  const content = safeCardData.content && typeof safeCardData.content === "object" ? safeCardData.content : {};
  const notesLine = Array.isArray(content.fragranceNotes) && content.fragranceNotes.length
    ? content.fragranceNotes.join(", ")
    : "luxury perfume";
  const scentMood = safeString(content.salesCopy || content.fullDescription || safeDraft.description).slice(0, 800);
  const brandName = [safeDraft.brand, safeDraft.name].filter(Boolean).join(" ");
  const bottleTypeLabel = getAiDraftSuggestedBottleType(safeDraft) === "tester"
    ? "tester bottle"
    : getAiDraftSuggestedBottleType(safeDraft) === "decant"
      ? "decant bottle"
      : "full-size perfume bottle";
  const shared = [
    "Luxury perfume visual for Veligodsky Parfums.",
    "Fragrance: " + (brandName || "premium fragrance") + ".",
    "Visual mood: " + (scentMood || "premium black luxury") + ".",
    "Notes and atmosphere: " + notesLine + ".",
    "Use a deep black background #050505.",
    "Avoid white backgrounds.",
    "High realism, premium materials, soft studio lighting, no cheap plastic look, no collage, no mockup frame."
  ].join(" ");

  return {
    catalogImage: {
      kind: "catalog-image",
      size: "1024x1024",
      quality: "low",
      alt: (brandName || "Perfume") + " — catalog image",
      prompt: [
        shared,
        "Create a minimal hi-tech catalog product image.",
        "Centered " + bottleTypeLabel + ".",
        "Black luxury background, subtle reflections, gentle white studio light, realistic glass and metal, clean e-commerce composition.",
        "No text overlay, no extra objects, no hands."
      ].join(" ")
    },
    heroImage: {
      kind: "hero-image",
      size: "1024x1024",
      quality: "medium",
      alt: (brandName || "Perfume") + " — hero image",
      prompt: [
        shared,
        "Create a premium artistic hero composition.",
        "Use liquid metal, black glass, obsidian stone and smoke around the fragrance bottle.",
        "Look like a luxury perfume campaign and contemporary art installation.",
        "Minimal UI space, cinematic contrast, dramatic but refined."
      ].join(" ")
    },
    bannerImage: {
      kind: "banner-image",
      size: "1024x1024",
      quality: "medium",
      alt: (brandName || "Perfume") + " — banner image",
      prompt: [
        shared,
        "Create a dark premium advertising banner image for the fragrance.",
        "Atmosphere must reflect the perfume character.",
        "Wide luxurious composition, black gradients, metallic highlights, premium brand campaign aesthetic."
      ].join(" ")
    },
    thumbnail: {
      kind: "thumbnail",
      size: "1024x1024",
      quality: "low",
      alt: (brandName || "Perfume") + " — thumbnail",
      prompt: [
        shared,
        "Create a compact thumbnail-style product visual.",
        "Centered bottle, dark luxury background, crisp silhouette, minimal details, premium catalog consistency."
      ].join(" ")
    }
  };
}

async function requestOpenAiGeneratedImageDataUrl(prompt, options) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    const missingKeyError = new Error("OPENAI_API_KEY_MISSING");
    missingKeyError.code = "OPENAI_API_KEY_MISSING";
    throw missingKeyError;
  }

  const safeOptions = options && typeof options === "object" ? options : {};
  const response = await fetchExternalResource(OPENAI_IMAGES_API_URL, {
    method: "POST",
    timeoutMs: OPENAI_AI_DRAFT_IMAGE_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: OPENAI_AI_DRAFT_IMAGE_MODEL,
      prompt: safeString(prompt).slice(0, 7000),
      size: safeString(safeOptions.size || "1024x1024").slice(0, 40) || "1024x1024",
      quality: safeString(safeOptions.quality || "low").slice(0, 40) || "low"
    })
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const apiError = new Error("OPENAI_AI_IMAGE_REQUEST_FAILED");
    apiError.code = "OPENAI_AI_IMAGE_REQUEST_FAILED";
    apiError.status = response.status;
    apiError.payload = payload;
    throw apiError;
  }

  const item = Array.isArray(payload && payload.data) ? payload.data[0] : null;
  const base64Body = safeString(item && item.b64_json);
  if (!base64Body) {
    const emptyImageError = new Error("OPENAI_AI_IMAGE_EMPTY_RESPONSE");
    emptyImageError.code = "OPENAI_AI_IMAGE_EMPTY_RESPONSE";
    throw emptyImageError;
  }

  return "data:image/png;base64," + base64Body;
}

async function requestOpenAiAiDraftMediaPack(draft, cardData) {
  const prompts = buildAiDraftImageGenerationPrompts(draft, cardData);
  const generatedAt = normalizeIsoDate(new Date().toISOString());
  const entries = Object.entries(prompts);
  const mediaPack = {
    catalogImage: null,
    heroImage: null,
    bannerImage: null,
    thumbnail: null,
    generatedAt,
    model: OPENAI_AI_DRAFT_IMAGE_MODEL,
    gallery: []
  };

  for (const [key, config] of entries) {
    const url = await requestOpenAiGeneratedImageDataUrl(config.prompt, {
      size: config.size,
      quality: config.quality
    });
    mediaPack[key] = normalizeAiDraftMediaAsset({
      url,
      alt: config.alt,
      prompt: config.prompt,
      kind: config.kind,
      size: config.size,
      quality: config.quality,
      model: OPENAI_AI_DRAFT_IMAGE_MODEL,
      generatedAt
    }, null);
    if (mediaPack[key] && mediaPack[key].url) {
      mediaPack.gallery.push(mediaPack[key].url);
    }
  }

  return normalizeAiDraftMediaPack(mediaPack, null);
}

function buildAiDraftFromProductCardResult(draft, cardData, mediaPack) {
  const safeDraft = draft && typeof draft === "object" ? draft : null;
  const safeCardData = cardData && typeof cardData === "object" ? cardData : null;
  if (!safeDraft || !safeCardData) {
    throw new Error("INVALID_AI_DRAFT_PRODUCT_CARD_RESULT");
  }

  const normalizedSeo = normalizeAiDraftSeo(safeCardData.seo, safeDraft.seo);
  const normalizedContent = normalizeAiDraftContent(safeCardData.content, safeDraft.content);
  const normalizedMediaPack = normalizeAiDraftMediaPack(mediaPack, safeDraft.mediaPack);
  const catalogImage = normalizedMediaPack && normalizedMediaPack.catalogImage && normalizedMediaPack.catalogImage.url
    ? normalizedMediaPack.catalogImage.url
    : safeDraft.image;
  const nextAnalysis = normalizeAiDraftAnalysis(
    Object.assign({}, safeDraft.analysis || {}, {
      productManager: {
        model: safeString(safeCardData.model).slice(0, 120),
        imageModel: normalizedMediaPack ? safeString(normalizedMediaPack.model).slice(0, 120) : "",
        generatedAt: normalizeIsoDate(new Date().toISOString()),
        seoReady: Boolean(normalizedSeo),
        contentReady: Boolean(normalizedContent),
        mediaReady: Boolean(
          normalizedMediaPack
          && normalizedMediaPack.catalogImage
          && normalizedMediaPack.heroImage
          && normalizedMediaPack.bannerImage
          && normalizedMediaPack.thumbnail
        )
      }
    }),
    safeDraft.analysis
  );

  return sanitizeIncomingAiDraft(Object.assign({}, safeDraft, {
    image: catalogImage,
    description: normalizedContent && normalizedContent.shortDescription
      ? normalizedContent.shortDescription
      : safeDraft.description,
    seo: normalizedSeo,
    content: normalizedContent,
    mediaPack: normalizedMediaPack,
    analysis: nextAnalysis
  }), safeDraft);
}

function normalizeAiDraftConfidenceScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(parsed * 100) / 100));
}

function normalizeAiDraftNotes(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n+/)
      : [];

  return source
    .map((note) => String(note || "").trim().slice(0, MAX_AI_DRAFT_NOTE_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_AI_DRAFT_NOTES);
}

function sanitizeAiDraftAnalysisNode(value, depth) {
  if (depth > MAX_AI_DRAFT_ANALYSIS_DEPTH) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : undefined;
  }

  if (typeof value === "string") {
    return String(value).trim().slice(0, MAX_AI_DRAFT_ANALYSIS_STRING_LENGTH);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAiDraftAnalysisNode(item, depth + 1))
      .filter((item) => item !== undefined)
      .slice(0, MAX_AI_DRAFT_ANALYSIS_KEYS);
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const entries = Object.entries(value).slice(0, MAX_AI_DRAFT_ANALYSIS_KEYS);
  const normalized = {};
  for (const [rawKey, rawValue] of entries) {
    const key = safeString(rawKey).trim().slice(0, 120);
    if (!key) {
      continue;
    }
    const safeValue = sanitizeAiDraftAnalysisNode(rawValue, depth + 1);
    if (safeValue !== undefined) {
      normalized[key] = safeValue;
    }
  }

  return normalized;
}

function normalizeAiDraftAnalysis(value, fallbackValue) {
  const source = value === undefined ? fallbackValue : value;
  if (source === undefined) {
    return null;
  }

  const normalized = sanitizeAiDraftAnalysisNode(source, 0);
  if (normalized === undefined) {
    return null;
  }

  try {
    const serialized = JSON.stringify(normalized);
    if (!serialized || serialized.length > MAX_AI_DRAFT_ANALYSIS_JSON_LENGTH) {
      return null;
    }
  } catch (error) {
    return null;
  }

  const result = normalized && typeof normalized === "object" && !Array.isArray(normalized)
    ? cloneData(normalized)
    : {};
  const existingImageGeneration = result.imageGeneration && typeof result.imageGeneration === "object" && !Array.isArray(result.imageGeneration)
    ? cloneData(result.imageGeneration)
    : {};
  result.imageGeneration = Object.assign({}, DEFAULT_AI_IMAGE_GENERATION, existingImageGeneration, {
    background: DEFAULT_AI_IMAGE_GENERATION.background,
    backgroundHex: DEFAULT_AI_IMAGE_GENERATION.backgroundHex
  });

  return result;
}

function getAiDraftSuggestedGender(draft) {
  const analysis = draft && draft.analysis && typeof draft.analysis === "object" ? draft.analysis : null;
  if (!analysis) {
    return "unisex";
  }

  return normalizeProductGender(
    analysis.gender !== undefined
      ? analysis.gender
      : analysis.genderLabel !== undefined
        ? analysis.genderLabel
        : "unisex"
  );
}

function getAiDraftSuggestedBottleType(draft) {
  const analysis = draft && draft.analysis && typeof draft.analysis === "object" ? draft.analysis : null;
  if (!analysis) {
    return "full";
  }

  return normalizeProductBottleType(
    analysis.bottleType !== undefined
      ? analysis.bottleType
      : analysis.flaconType !== undefined
        ? analysis.flaconType
        : analysis.type
  );
}

function sanitizeIncomingAiDraft(rawDraft, existingDraft) {
  if (!rawDraft || typeof rawDraft !== "object") {
    throw new Error("INVALID_AI_DRAFT_PAYLOAD");
  }

  const safeExisting = existingDraft && typeof existingDraft === "object" ? existingDraft : null;
  const id = safeString(rawDraft.id || (safeExisting && safeExisting.id) || generateAiDraftId()).slice(0, 120);
  if (!id) {
    throw new Error("INVALID_AI_DRAFT_PAYLOAD");
  }

  const rawVolumes = Array.isArray(rawDraft.volumes)
    ? rawDraft.volumes
    : (safeExisting && Array.isArray(safeExisting.volumes) ? safeExisting.volumes : []);
  const seenVolumes = new Set();
  const volumes = rawVolumes
    .map(sanitizeProductVolume)
    .filter(Boolean)
    .filter((volume) => {
      const key = String(volume.ml);
      if (seenVolumes.has(key)) {
        return false;
      }
      seenVolumes.add(key);
      return true;
    })
    .sort((left, right) => left.ml - right.ml);

  return {
    id,
    source: normalizeAiDraftSource(rawDraft.source !== undefined ? rawDraft.source : (safeExisting && safeExisting.source)),
    sourceUrl: String(rawDraft.sourceUrl !== undefined ? rawDraft.sourceUrl : (safeExisting && safeExisting.sourceUrl) || "")
      .trim()
      .slice(0, MAX_AI_DRAFT_SOURCE_URL_LENGTH),
    rawText: String(rawDraft.rawText !== undefined ? rawDraft.rawText : (safeExisting && safeExisting.rawText) || "")
      .trim()
      .slice(0, MAX_AI_DRAFT_RAW_TEXT_LENGTH),
    brand: String(rawDraft.brand !== undefined ? rawDraft.brand : (safeExisting && safeExisting.brand) || "")
      .trim()
      .slice(0, MAX_AI_DRAFT_TEXT_LENGTH),
    name: String(rawDraft.name !== undefined ? rawDraft.name : (safeExisting && safeExisting.name) || "")
      .trim()
      .slice(0, MAX_AI_DRAFT_TEXT_LENGTH),
    description: String(rawDraft.description !== undefined ? rawDraft.description : (safeExisting && safeExisting.description) || "")
      .trim()
      .slice(0, MAX_AI_DRAFT_TEXT_LENGTH),
    image: safeString(rawDraft.image !== undefined ? rawDraft.image : (safeExisting && safeExisting.image)).slice(0, MAX_AI_DRAFT_IMAGE_LENGTH),
    volumes,
    notes: normalizeAiDraftNotes(rawDraft.notes !== undefined ? rawDraft.notes : (safeExisting && safeExisting.notes)),
    seo: normalizeAiDraftSeo(
      rawDraft.seo,
      safeExisting && safeExisting.seo
    ),
    content: normalizeAiDraftContent(
      rawDraft.content,
      safeExisting && safeExisting.content
    ),
    mediaPack: normalizeAiDraftMediaPack(
      rawDraft.mediaPack,
      safeExisting && safeExisting.mediaPack
    ),
    analysis: normalizeAiDraftAnalysis(
      rawDraft.analysis,
      safeExisting && safeExisting.analysis
    ),
    confidenceScore: normalizeAiDraftConfidenceScore(
      rawDraft.confidenceScore !== undefined ? rawDraft.confidenceScore : (safeExisting && safeExisting.confidenceScore)
    ),
    status: normalizeAiDraftStatus(rawDraft.status !== undefined ? rawDraft.status : (safeExisting && safeExisting.status)),
    createdAt: normalizeIsoDate(rawDraft.createdAt || (safeExisting && safeExisting.createdAt) || new Date().toISOString()),
    updatedAt: normalizeIsoDate(new Date().toISOString())
  };
}

function normalizeStoredAiDraft(rawDraft) {
  try {
    return sanitizeIncomingAiDraft(rawDraft, rawDraft);
  } catch (error) {
    return null;
  }
}

function normalizeStoredAiDraftList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeStoredAiDraft)
    .filter(Boolean)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

function buildProductPayloadFromAiDraft(draft, products) {
  const safeDraft = draft && typeof draft === "object" ? draft : null;
  if (!safeDraft) {
    throw new Error("INVALID_AI_DRAFT_PAYLOAD");
  }

  const usedIds = new Set(
    Array.isArray(products)
      ? products.map((item) => safeString(item && item.id)).filter(Boolean)
      : []
  );

  let productId = "";
  do {
    productId = "p_" + crypto.randomBytes(8).toString("hex");
  } while (usedIds.has(productId));

  return {
    id: productId,
    name: safeDraft.name,
    brand: safeDraft.brand,
    gender: getAiDraftSuggestedGender(safeDraft),
    bottleType: getAiDraftSuggestedBottleType(safeDraft),
    description: safeDraft.description,
    image: safeDraft.image,
    volumes: Array.isArray(safeDraft.volumes) ? safeDraft.volumes : [],
    reviews: [],
    pendingReviews: [],
    topWeek: false,
    topMonth: false
  };
}

function buildAdminProductSearchIndex(product) {
  const safeProduct = product && typeof product === "object" ? product : {};
  const volumeIndex = (Array.isArray(safeProduct.volumes) ? safeProduct.volumes : [])
    .map((volume) => {
      const ml = normalizeMlNumber(volume && volume.ml);
      const price = Math.round(Number(volume && volume.price));
      if (ml === null || !Number.isFinite(price) || price <= 0) {
        return "";
      }
      return String(ml) + "ml " + String(price);
    })
    .filter(Boolean)
    .join(" ");

  return normalizeCatalogSearchQuery([
    safeProduct.name,
    safeProduct.brand,
    safeProduct.description,
    safeProduct.gender === "male" ? "мужские male men"
      : safeProduct.gender === "female" ? "женские female women"
        : "унисекс unisex",
    safeProduct.bottleType === "decant" ? "отливант decant"
      : safeProduct.bottleType === "tester" ? "тестер tester"
        : "полноценный флакон full bottle",
    volumeIndex
  ].join(" "));
}

function getAdminCatalogPage(data, options) {
  const safeData = validateStoreData(data);
  const safeOptions = options && typeof options === "object" ? options : {};
  const normalizedQuery = normalizeCatalogSearchQuery(safeOptions.query);
  const limit = clampInteger(safeOptions.limit, 1, ADMIN_CATALOG_MAX_LIMIT, ADMIN_CATALOG_DEFAULT_LIMIT);
  const offset = clampInteger(safeOptions.offset, 0, Number.MAX_SAFE_INTEGER, 0);
  const allProducts = Array.isArray(safeData.products) ? safeData.products : [];

  const filteredProducts = normalizedQuery
    ? allProducts.filter((product) => buildAdminProductSearchIndex(product).includes(normalizedQuery))
    : allProducts.slice();

  const pageItems = filteredProducts
    .slice(offset, offset + limit)
    .map((product) => buildAdminCatalogProductSummary(product));
  const hasMore = offset + pageItems.length < filteredProducts.length;

  return {
    total: allProducts.length,
    filteredTotal: filteredProducts.length,
    offset,
    limit,
    hasMore,
    nextOffset: hasMore ? offset + pageItems.length : offset + pageItems.length,
    items: pageItems
  };
}

function parseAdminProductIdFromPath(pathname) {
  const prefix = "/api/admin/products/";
  if (!safeString(pathname).startsWith(prefix)) {
    return "";
  }
  const rawPart = String(pathname || "").slice(prefix.length);
  if (!rawPart || rawPart.includes("/")) {
    return "";
  }
  try {
    return safeString(decodeURIComponent(rawPart)).slice(0, 120);
  } catch (error) {
    return "";
  }
}

function parseAdminAiDraftIdFromPath(pathname) {
  const prefix = "/api/admin/ai-drafts/";
  if (!safeString(pathname).startsWith(prefix)) {
    return "";
  }
  const rawPart = String(pathname || "").slice(prefix.length);
  if (!rawPart || rawPart.includes("/")) {
    return "";
  }
  try {
    return safeString(decodeURIComponent(rawPart)).slice(0, 120);
  } catch (error) {
    return "";
  }
}

function parseAdminAiDraftPublishIdFromPath(pathname) {
  const prefix = "/api/admin/ai-drafts/";
  const suffix = "/publish";
  if (!safeString(pathname).startsWith(prefix) || !safeString(pathname).endsWith(suffix)) {
    return "";
  }
  const rawPart = String(pathname || "").slice(prefix.length, -suffix.length);
  if (!rawPart || rawPart.includes("/")) {
    return "";
  }
  try {
    return safeString(decodeURIComponent(rawPart)).slice(0, 120);
  } catch (error) {
    return "";
  }
}

function parseAdminAiDraftAnalyzeIdFromPath(pathname) {
  const prefix = "/api/admin/ai-drafts/";
  const suffix = "/analyze";
  if (!safeString(pathname).startsWith(prefix) || !safeString(pathname).endsWith(suffix)) {
    return "";
  }
  const rawPart = String(pathname || "").slice(prefix.length, -suffix.length);
  if (!rawPart || rawPart.includes("/")) {
    return "";
  }
  try {
    return safeString(decodeURIComponent(rawPart)).slice(0, 120);
  } catch (error) {
    return "";
  }
}

function parseAdminAiDraftCreateCardIdFromPath(pathname) {
  const prefix = "/api/admin/ai-drafts/";
  const suffix = "/create-card";
  if (!safeString(pathname).startsWith(prefix) || !safeString(pathname).endsWith(suffix)) {
    return "";
  }
  const rawPart = String(pathname || "").slice(prefix.length, -suffix.length);
  if (!rawPart || rawPart.includes("/")) {
    return "";
  }
  try {
    return safeString(decodeURIComponent(rawPart)).slice(0, 120);
  } catch (error) {
    return "";
  }
}

function parsePublicProductIdFromPath(pathname) {
  const prefix = "/api/product-image/";
  if (!safeString(pathname).startsWith(prefix)) {
    return "";
  }
  const rawPart = String(pathname || "").slice(prefix.length);
  if (!rawPart || rawPart.includes("/")) {
    return "";
  }
  try {
    return safeString(decodeURIComponent(rawPart)).slice(0, 120);
  } catch (error) {
    return "";
  }
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

function getCatalogImageIntegrityGuard(currentData, nextData) {
  const safeCurrentData = validateStoreData(currentData);
  const safeNextData = validateStoreData(nextData);
  const currentProducts = Array.isArray(safeCurrentData.products)
    ? safeCurrentData.products
    : [];
  const nextProducts = Array.isArray(safeNextData.products)
    ? safeNextData.products
    : [];

  const nextProductsById = new Map();
  for (const product of nextProducts) {
    const productId = safeString(product && product.id).slice(0, 120);
    if (!productId) {
      continue;
    }
    nextProductsById.set(productId, product);
  }

  let checkedCount = 0;
  const brokenProducts = [];
  for (const currentProduct of currentProducts) {
    const productId = safeString(currentProduct && currentProduct.id).slice(0, 120);
    if (!productId || !nextProductsById.has(productId)) {
      continue;
    }

    const currentImage = normalizePersistedProductImage(currentProduct.image, "", productId, false);
    if (!currentImage || isProductImageApiPath(currentImage, productId) || !isRenderableProductImageValue(currentImage, productId)) {
      continue;
    }

    checkedCount += 1;
    const nextProduct = nextProductsById.get(productId);
    const nextImage = normalizePersistedProductImage(nextProduct && nextProduct.image, "", productId, false);
    if (nextImage && !isProductImageApiPath(nextImage, productId) && isRenderableProductImageValue(nextImage, productId)) {
      continue;
    }

    brokenProducts.push({
      id: productId,
      name: safeString(currentProduct && currentProduct.name).slice(0, 160),
      brand: safeString(currentProduct && currentProduct.brand).slice(0, 160)
    });
  }

  const brokenCount = brokenProducts.length;
  const brokenRatio = checkedCount > 0 ? brokenCount / checkedCount : 0;
  const blocked = checkedCount > 0
    && brokenCount >= STORE_IMAGE_GUARD_MIN_BREAK_COUNT
    && brokenRatio >= STORE_IMAGE_GUARD_MIN_BREAK_RATIO;

  return {
    blocked,
    checkedCount,
    brokenCount,
    brokenRatio,
    brokenProductsSample: brokenProducts.slice(0, STORE_IMAGE_GUARD_SAMPLE_LIMIT)
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

function ensureTelegramWebhookAuthorized(req, res) {
  const expectedSecret = getTelegramWebhookSecret();
  if (!expectedSecret) {
    sendJson(res, 503, {
      error: "TELEGRAM_WEBHOOK_NOT_CONFIGURED",
      message: "TELEGRAM_WEBHOOK_SECRET is not configured"
    });
    return false;
  }

  const actualSecret = safeString(req && req.headers && req.headers[TELEGRAM_WEBHOOK_SECRET_HEADER]);
  if (!timingSafeEqualStrings(actualSecret, expectedSecret)) {
    sendJson(res, 403, { error: "TELEGRAM_WEBHOOK_FORBIDDEN" });
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

async function readAiDraftSeedData() {
  await fsp.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fsp.readFile(AI_DRAFTS_FILE, "utf8");
    return normalizeStoredAiDraftList(JSON.parse(raw));
  } catch (error) {
    return [];
  }
}

async function writeAiDraftsFile(filePath, payload) {
  const validated = normalizeStoredAiDraftList(payload);
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

  async findHistoricalProductImage(productId) {
    const safeProductId = safeString(productId).slice(0, 120);
    if (!safeProductId) {
      return "";
    }

    try {
      const files = (await fsp.readdir(this.historyDir))
        .filter((name) => name.startsWith("store_state_") && name.endsWith(".json"))
        .sort()
        .reverse();

      for (const name of files) {
        try {
          const raw = await fsp.readFile(path.join(this.historyDir, name), "utf8");
          const image = extractValidProductImageFromStoreData(JSON.parse(raw), safeProductId);
          if (image) {
            return image;
          }
        } catch (error) {
          // Skip invalid snapshots and continue searching older history.
        }
      }
    } catch (error) {
      return "";
    }

    return "";
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

  async findHistoricalProductImage(productId) {
    const safeProductId = safeString(productId).slice(0, 120);
    if (!safeProductId) {
      return "";
    }

    const result = await this.pool.query(
      "SELECT payload FROM " + DB_HISTORY_TABLE + " "
      + "ORDER BY changed_at DESC, snapshot_id DESC "
      + "LIMIT $1",
      [STORE_HISTORY_MAX_ROWS]
    );

    for (const row of result.rows) {
      try {
        const image = extractValidProductImageFromStoreData(row.payload, safeProductId);
        if (image) {
          return image;
        }
      } catch (error) {
        // Skip unreadable history rows and continue.
      }
    }

    return "";
  }

  async close() {
    await this.pool.end();
  }
}

class FileAiDraftRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fsp.readFile(this.filePath, "utf8");
      normalizeStoredAiDraftList(JSON.parse(raw));
    } catch (error) {
      await writeAiDraftsFile(this.filePath, await readAiDraftSeedData());
    }
  }

  async list() {
    const raw = await fsp.readFile(this.filePath, "utf8");
    return normalizeStoredAiDraftList(JSON.parse(raw));
  }

  async getById(draftId) {
    const safeDraftId = safeString(draftId).slice(0, 120);
    if (!safeDraftId) {
      return null;
    }

    const items = await this.list();
    return items.find((item) => safeString(item && item.id) === safeDraftId) || null;
  }

  async save(draft) {
    const safeDraft = sanitizeIncomingAiDraft(draft);
    const items = await this.list();
    const nextItems = items.filter((item) => safeString(item && item.id) !== safeDraft.id);
    nextItems.unshift(safeDraft);
    await writeAiDraftsFile(this.filePath, nextItems);
    return safeDraft;
  }

  async delete(draftId) {
    const safeDraftId = safeString(draftId).slice(0, 120);
    if (!safeDraftId) {
      return false;
    }

    const items = await this.list();
    const nextItems = items.filter((item) => safeString(item && item.id) !== safeDraftId);
    if (nextItems.length === items.length) {
      return false;
    }
    await writeAiDraftsFile(this.filePath, nextItems);
    return true;
  }

  async close() {
    return;
  }
}

class PostgresAiDraftRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async init() {
    await this.pool.query("SELECT 1");
    await this.pool.query(
      "CREATE TABLE IF NOT EXISTS " + AI_DRAFTS_DB_TABLE + " ("
      + "draft_id TEXT PRIMARY KEY, "
      + "payload JSONB NOT NULL, "
      + "status TEXT NOT NULL DEFAULT 'pending', "
      + "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
      + "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
      + ")"
    );
    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS " + AI_DRAFTS_DB_TABLE + "_status_updated_at_idx "
      + "ON " + AI_DRAFTS_DB_TABLE + " (status, updated_at DESC)"
    );
  }

  async list() {
    const result = await this.pool.query(
      "SELECT payload FROM " + AI_DRAFTS_DB_TABLE + " ORDER BY updated_at DESC, draft_id DESC"
    );
    return normalizeStoredAiDraftList(result.rows.map((row) => row.payload));
  }

  async getById(draftId) {
    const safeDraftId = safeString(draftId).slice(0, 120);
    if (!safeDraftId) {
      return null;
    }

    const result = await this.pool.query(
      "SELECT payload FROM " + AI_DRAFTS_DB_TABLE + " WHERE draft_id = $1 LIMIT 1",
      [safeDraftId]
    );

    if (result.rowCount <= 0) {
      return null;
    }

    return normalizeStoredAiDraft(result.rows[0].payload);
  }

  async save(draft) {
    const safeDraft = sanitizeIncomingAiDraft(draft);
    const result = await this.pool.query(
      "INSERT INTO " + AI_DRAFTS_DB_TABLE + " (draft_id, payload, status, created_at, updated_at) "
      + "VALUES ($1, $2::jsonb, $3, $4::timestamptz, NOW()) "
      + "ON CONFLICT (draft_id) DO UPDATE SET payload = EXCLUDED.payload, status = EXCLUDED.status, updated_at = NOW() "
      + "RETURNING payload",
      [
        safeDraft.id,
        JSON.stringify(safeDraft),
        safeDraft.status,
        safeDraft.createdAt
      ]
    );

    return normalizeStoredAiDraft(result.rows[0].payload);
  }

  async delete(draftId) {
    const safeDraftId = safeString(draftId).slice(0, 120);
    if (!safeDraftId) {
      return false;
    }

    const result = await this.pool.query(
      "DELETE FROM " + AI_DRAFTS_DB_TABLE + " WHERE draft_id = $1",
      [safeDraftId]
    );
    return result.rowCount > 0;
  }

  async close() {
    await this.pool.end();
  }
}

class CachedStoreRepository {
  constructor(innerRepository) {
    this.innerRepository = innerRepository;
    this.cachedData = null;
  }

  async init() {
    await this.innerRepository.init();
  }

  async read() {
    if (this.cachedData) {
      return cloneData(this.cachedData);
    }

    const data = validateStoreData(await this.innerRepository.read());
    this.cachedData = cloneData(data);
    return cloneData(this.cachedData);
  }

  async write(payload, options) {
    const safeOptions = Object.assign({}, options || {});
    if (!safeOptions.previousPayload && this.cachedData) {
      safeOptions.previousPayload = cloneData(this.cachedData);
    }

    const saved = validateStoreData(await this.innerRepository.write(payload, safeOptions));
    this.cachedData = cloneData(saved);
    invalidateDerivedStoreCaches();
    return cloneData(this.cachedData);
  }

  async createSnapshot(source) {
    return this.innerRepository.createSnapshot(source);
  }

  async findHistoricalProductImage(productId) {
    if (!this.innerRepository || typeof this.innerRepository.findHistoricalProductImage !== "function") {
      return "";
    }
    return this.innerRepository.findHistoricalProductImage(productId);
  }

  async close() {
    await this.innerRepository.close();
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
    const repository = new CachedStoreRepository(new FileStoreRepository(DATA_FILE));
    await repository.init();
    console.log("Storage mode: file (" + DATA_FILE + "), FORCE_FILE_STORAGE enabled");
    return repository;
  }

  if (isDatabaseConfigured()) {
    let pool = null;
    try {
      const Pool = loadPgPool();
      pool = new Pool(buildDatabaseConfig());
      const repository = new CachedStoreRepository(new PostgresStoreRepository(pool));
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

  const repository = new CachedStoreRepository(new FileStoreRepository(DATA_FILE));
  await repository.init();
  console.log("Storage mode: file (" + DATA_FILE + ")");
  return repository;
}

async function createAiDraftRepository() {
  const strictDatabaseMode = isStrictDatabaseMode();

  if (isForceFileStorage()) {
    const repository = new FileAiDraftRepository(AI_DRAFTS_FILE);
    await repository.init();
    console.log("AI drafts storage mode: file (" + AI_DRAFTS_FILE + "), FORCE_FILE_STORAGE enabled");
    return repository;
  }

  if (isDatabaseConfigured()) {
    let pool = null;
    try {
      const Pool = loadPgPool();
      pool = new Pool(buildDatabaseConfig());
      const repository = new PostgresAiDraftRepository(pool);
      await repository.init();
      console.log("AI drafts storage mode: PostgreSQL");
      return repository;
    } catch (error) {
      console.error("AI drafts PostgreSQL init failed. Reason:", error && error.message ? error.message : error);
      if (pool) {
        try {
          await pool.end();
        } catch (closeError) {
          console.error("Failed to close AI drafts PostgreSQL pool after init error:", closeError);
        }
      }

      if (strictDatabaseMode) {
        throw new Error("AI_DRAFTS_DATABASE_INIT_FAILED_IN_STRICT_MODE");
      }

      console.warn("AI drafts fallback to file storage is enabled in non-production mode.");
    }
  }

  if (strictDatabaseMode) {
    throw new Error("DATABASE_CONFIG_REQUIRED_IN_STRICT_MODE");
  }

  const repository = new FileAiDraftRepository(AI_DRAFTS_FILE);
  await repository.init();
  console.log("AI drafts storage mode: file (" + AI_DRAFTS_FILE + ")");
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

async function handleStoreApi(req, res, requestUrl) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const data = await storeRepository.read();
    const includeProducts = shouldIncludeProductsInStoreResponse(requestUrl);
    const responseData = getStoreDataForRequest(req, data);
    if (!includeProducts) {
      responseData.products = [];
    }
    sendStoreDataResponse(req, res, 200, responseData);
    return;
  }

  if (req.method === "PUT") {
    if (!ensureAdminAuthorized(req, res)) {
      return;
    }
    if (!ensureJsonBodyRequest(req, res)) {
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

        const nextPayload = await mergeIncomingStorePayloadWithCurrentData(parsed, currentData);
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

        const imageIntegrityGuard = getCatalogImageIntegrityGuard(currentData, nextPayload);
        if (imageIntegrityGuard.blocked && !forceReplaceFromPayload) {
          const guardError = new Error("CATALOG_IMAGE_INTEGRITY_BLOCKED");
          guardError.code = "CATALOG_IMAGE_INTEGRITY_BLOCKED";
          guardError.details = imageIntegrityGuard;
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
      if (error.code === "CATALOG_IMAGE_INTEGRITY_BLOCKED") {
        const details = error.details || {};
        sendJson(res, 409, {
          error: "CATALOG_IMAGE_INTEGRITY_BLOCKED",
          message: "Blocked catalog save because too many product images would become unavailable. Refresh admin and retry.",
          checkedCount: Number.isFinite(details.checkedCount) ? details.checkedCount : 0,
          brokenCount: Number.isFinite(details.brokenCount) ? details.brokenCount : 0,
          brokenRatio: Number.isFinite(details.brokenRatio) ? details.brokenRatio : 0,
          brokenProductsSample: Array.isArray(details.brokenProductsSample) ? details.brokenProductsSample : []
        });
        return;
      }
      throw error;
    }

    return;
  }

  sendText(res, 405, "Method Not Allowed");
}

async function handlePublicCatalogApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  const data = await storeRepository.read();
  const cachedResponse = getCachedPublicCatalogResponse(data);

  sendPublicApiResponse(req, res, 200, cachedResponse.payload, {
    prebuiltBody: cachedResponse.body,
    prebuiltEtag: cachedResponse.etag,
    maxAge: 30,
    staleWhileRevalidate: 180
  });
}

async function handleProductImageApi(req, res, requestUrl) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  const productId = parsePublicProductIdFromPath(requestUrl && requestUrl.pathname);
  if (!productId) {
    sendJson(res, 400, { error: "INVALID_PRODUCT_ID" });
    return;
  }

  const data = await storeRepository.read();
  let imageResponse = getCachedProductImageResponse(data, productId);
  if (!imageResponse) {
    imageResponse = await getHistoricalProductImageResponse(productId);
    if (imageResponse) {
      await repairSingleProductImageFromHistory(productId).catch(() => false);
    }
  }

  if (!imageResponse) {
    res.writeHead(302, {
      "Location": "/assets/product-placeholder.svg",
      "Cache-Control": "public, max-age=300"
    });
    res.end();
    return;
  }

  if (imageResponse.kind === "redirect") {
    res.writeHead(302, {
      "Location": imageResponse.location,
      "Cache-Control": "public, max-age=3600"
    });
    res.end();
    return;
  }

  const contentType = safeString(imageResponse.contentType).toLowerCase() || "image/jpeg";
  const body = imageResponse.body;
  const etag = safeString(imageResponse.etag);

  if ((req.method === "GET" || req.method === "HEAD") && isEtagMatch(req, etag)) {
    res.writeHead(304, {
      "ETag": etag,
      "Cache-Control": "public, max-age=3600, must-revalidate",
      "Content-Type": contentType
    });
    res.end();
    return;
  }

  if (req.method === "HEAD") {
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": body.length,
      "Cache-Control": "public, max-age=3600, must-revalidate",
      "ETag": etag
    });
    res.end();
    return;
  }

  writeBufferedResponse(res, 200, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600, must-revalidate",
    "ETag": etag
  }, body);
}

async function handleAdminCatalogApi(req, res, requestUrl) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  const searchParams = requestUrl && requestUrl.searchParams ? requestUrl.searchParams : new URLSearchParams();
  const offset = parseNonNegativeInteger(searchParams.get("offset"));
  const limitRaw = parseNonNegativeInteger(searchParams.get("limit"));
  const query = String(searchParams.get("q") || "").slice(0, 200);

  const data = await storeRepository.read();
  const page = getCachedAdminCatalogPageResponse(data, {
    query,
    offset: offset === null ? 0 : offset,
    limit: limitRaw === null ? ADMIN_CATALOG_DEFAULT_LIMIT : limitRaw
  });

  sendJson(res, 200, {
    ok: true,
    total: page.total,
    filteredTotal: page.filteredTotal,
    offset: page.offset,
    limit: page.limit,
    hasMore: page.hasMore,
    nextOffset: page.nextOffset,
    items: page.items
  });
}

async function handleAdminAiDraftsApi(req, res) {
  if (!aiDraftRepository) {
    sendJson(res, 503, { error: "AI_DRAFTS_UNAVAILABLE" });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const items = await aiDraftRepository.list();
    sendJson(res, 200, {
      ok: true,
      items
    });
    return;
  }

  if (!ensureJsonBodyRequest(req, res)) {
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

  try {
    const result = await runSerializedStoreMutation(async () => {
      const incomingDraft = parsed && typeof parsed === "object" && parsed.draft ? parsed.draft : parsed;
      const incomingId = safeString(incomingDraft && incomingDraft.id).slice(0, 120);
      const existingDraft = incomingId ? await aiDraftRepository.getById(incomingId) : null;
      const nextDraft = sanitizeIncomingAiDraft(
        Object.assign({}, incomingDraft, {
          status: existingDraft && existingDraft.status === "published"
            ? "published"
            : normalizeAiDraftStatus(incomingDraft && incomingDraft.status)
        }),
        existingDraft
      );
      const created = !existingDraft;
      await aiDraftRepository.save(nextDraft);
      return {
        created,
        draft: nextDraft
      };
    });

    sendJson(res, 200, {
      ok: true,
      created: result.created,
      draft: result.draft
    });
  } catch (error) {
    if (error.message === "INVALID_AI_DRAFT_PAYLOAD") {
      sendJson(res, 400, {
        error: "INVALID_AI_DRAFT_PAYLOAD",
        message: "Invalid AI draft payload"
      });
      return;
    }
    throw error;
  }
}

async function handleAdminAiDraftByIdApi(req, res, requestUrl) {
  if (!aiDraftRepository) {
    sendJson(res, 503, { error: "AI_DRAFTS_UNAVAILABLE" });
    return;
  }

  if (req.method !== "DELETE") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  const draftId = parseAdminAiDraftIdFromPath(requestUrl && requestUrl.pathname);
  if (!draftId) {
    sendJson(res, 400, { error: "INVALID_AI_DRAFT_ID" });
    return;
  }

  const deleted = await runSerializedStoreMutation(async () => {
    return aiDraftRepository.delete(draftId);
  });

  if (!deleted) {
    sendJson(res, 404, { error: "AI_DRAFT_NOT_FOUND" });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    id: draftId
  });
}

async function handleAdminAiDraftPublishApi(req, res, requestUrl) {
  if (!storeRepository || !aiDraftRepository) {
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

  const draftId = parseAdminAiDraftPublishIdFromPath(requestUrl && requestUrl.pathname);
  if (!draftId) {
    sendJson(res, 400, { error: "INVALID_AI_DRAFT_ID" });
    return;
  }

  try {
    const result = await runSerializedStoreMutation(async () => {
      const draft = await aiDraftRepository.getById(draftId);
      if (!draft) {
        const notFoundError = new Error("AI_DRAFT_NOT_FOUND");
        notFoundError.code = "AI_DRAFT_NOT_FOUND";
        throw notFoundError;
      }

      if (draft.status === "published") {
        const conflictError = new Error("AI_DRAFT_ALREADY_PUBLISHED");
        conflictError.code = "AI_DRAFT_ALREADY_PUBLISHED";
        throw conflictError;
      }

      if (draft.status !== "ready_to_publish") {
        const statusError = new Error("AI_DRAFT_NOT_READY");
        statusError.code = "AI_DRAFT_NOT_READY";
        throw statusError;
      }

      const currentData = await storeRepository.read();
      const nextData = cloneData(validateStoreData(currentData));
      const draftProduct = buildProductPayloadFromAiDraft(draft, nextData.products);
      const nextProduct = sanitizeIncomingAdminProduct(draftProduct, null);
      nextData.products.unshift(nextProduct);

      await storeRepository.write(nextData, {
        previousPayload: currentData,
        source: "ai_draft_publish"
      });

      const nextDraft = sanitizeIncomingAiDraft(
        Object.assign({}, draft, {
          status: "published"
        }),
        draft
      );
      await aiDraftRepository.save(nextDraft);

      return {
        draft: nextDraft,
        product: nextProduct,
        total: nextData.products.length
      };
    });

    sendJson(res, 200, {
      ok: true,
      draft: result.draft,
      product: result.product,
      total: result.total
    });
  } catch (error) {
    if (error && error.code === "AI_DRAFT_NOT_FOUND") {
      sendJson(res, 404, { error: "AI_DRAFT_NOT_FOUND" });
      return;
    }
    if (error && error.code === "AI_DRAFT_ALREADY_PUBLISHED") {
      sendJson(res, 409, { error: "AI_DRAFT_ALREADY_PUBLISHED" });
      return;
    }
    if (error && error.code === "AI_DRAFT_NOT_READY") {
      sendJson(res, 409, { error: "AI_DRAFT_NOT_READY_TO_PUBLISH" });
      return;
    }
    if (error.message === "INVALID_PRODUCT_PAYLOAD" || error.message === "INVALID_AI_DRAFT_PAYLOAD") {
      sendJson(res, 400, {
        error: "AI_DRAFT_CANNOT_BE_PUBLISHED",
        message: "Draft does not contain enough product data to publish."
      });
      return;
    }
    throw error;
  }
}

async function handleAdminAiDraftAnalyzeApi(req, res, requestUrl) {
  if (!aiDraftRepository) {
    sendJson(res, 503, { error: "AI_DRAFTS_UNAVAILABLE" });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  const draftId = parseAdminAiDraftAnalyzeIdFromPath(requestUrl && requestUrl.pathname);
  if (!draftId) {
    sendJson(res, 400, { error: "INVALID_AI_DRAFT_ID" });
    return;
  }

  let draftSnapshot = null;
  try {
    draftSnapshot = await aiDraftRepository.getById(draftId);
    if (!draftSnapshot) {
      sendJson(res, 404, { error: "AI_DRAFT_NOT_FOUND" });
      return;
    }

    if (draftSnapshot.status === "published") {
      sendJson(res, 409, { error: "AI_DRAFT_ALREADY_PUBLISHED" });
      return;
    }

    const analysisResult = await requestOpenAiAiDraftAnalysis(draftSnapshot);
    const result = await runSerializedStoreMutation(async () => {
      const currentDraft = await aiDraftRepository.getById(draftId);
      if (!currentDraft) {
        const notFoundError = new Error("AI_DRAFT_NOT_FOUND");
        notFoundError.code = "AI_DRAFT_NOT_FOUND";
        throw notFoundError;
      }

      if (currentDraft.status === "published") {
        const alreadyPublishedError = new Error("AI_DRAFT_ALREADY_PUBLISHED");
        alreadyPublishedError.code = "AI_DRAFT_ALREADY_PUBLISHED";
        throw alreadyPublishedError;
      }

      if (safeString(currentDraft.updatedAt) !== safeString(draftSnapshot.updatedAt)) {
        const conflictError = new Error("AI_DRAFT_VERSION_MISMATCH");
        conflictError.code = "AI_DRAFT_VERSION_MISMATCH";
        throw conflictError;
      }

      const nextDraft = buildAiDraftFromAnalysisResult(currentDraft, analysisResult);
      await aiDraftRepository.save(nextDraft);
      return {
        draft: nextDraft
      };
    });

    sendJson(res, 200, {
      ok: true,
      draft: result.draft
    });
  } catch (error) {
    console.error("AI draft OpenAI analysis failed:", {
      draftId,
      message: error && error.message ? error.message : String(error),
      code: error && error.code ? error.code : "",
      status: error && error.status ? error.status : 0
    });

    if (error && error.code === "AI_DRAFT_NOT_FOUND") {
      sendJson(res, 404, { error: "AI_DRAFT_NOT_FOUND" });
      return;
    }
    if (error && error.code === "AI_DRAFT_ALREADY_PUBLISHED") {
      sendJson(res, 409, { error: "AI_DRAFT_ALREADY_PUBLISHED" });
      return;
    }
    if (error && error.code === "AI_DRAFT_VERSION_MISMATCH") {
      sendJson(res, 409, {
        error: "AI_DRAFT_VERSION_MISMATCH",
        message: "AI draft was changed in another session. Refresh and retry."
      });
      return;
    }
    if (error && error.code === "AI_DRAFT_ANALYSIS_INPUT_EMPTY") {
      sendJson(res, 400, {
        error: "AI_DRAFT_ANALYSIS_INPUT_EMPTY",
        message: "Draft must contain rawText or a photo before AI analysis."
      });
      return;
    }
    if (error && error.code === "OPENAI_API_KEY_MISSING") {
      sendJson(res, 503, {
        error: "OPENAI_API_KEY_MISSING",
        message: "OPENAI_API_KEY is not configured."
      });
      return;
    }
    if (error && error.code === "TELEGRAM_BOT_TOKEN_MISSING") {
      sendJson(res, 503, {
        error: "TELEGRAM_BOT_TOKEN_MISSING",
        message: "TELEGRAM_BOT_TOKEN is required to analyze Telegram photos."
      });
      return;
    }
    if (error && (error.code === "OPENAI_ANALYSIS_REQUEST_FAILED" || error.code === "OPENAI_ANALYSIS_EMPTY_RESPONSE" || error.code === "OPENAI_ANALYSIS_INVALID_JSON")) {
      sendJson(res, 502, {
        error: error.code,
        message: "OpenAI analysis request failed."
      });
      return;
    }
    if (error && (error.code === "TELEGRAM_FILE_LOOKUP_FAILED" || error.code === "TELEGRAM_FILE_PATH_MISSING" || error.code === "AI_DRAFT_IMAGE_DOWNLOAD_FAILED" || error.code === "AI_DRAFT_IMAGE_TOO_LARGE" || error.code === "EXTERNAL_FETCH_TIMEOUT")) {
      sendJson(res, 502, {
        error: error.code,
        message: "Failed to resolve Telegram photo for AI analysis."
      });
      return;
    }
    if (error && error.message === "INVALID_AI_DRAFT_ANALYSIS_RESULT") {
      sendJson(res, 500, {
        error: "INVALID_AI_DRAFT_ANALYSIS_RESULT"
      });
      return;
    }
    throw error;
  }
}

async function handleAdminAiDraftCreateCardApi(req, res, requestUrl) {
  if (!aiDraftRepository) {
    sendJson(res, 503, { error: "AI_DRAFTS_UNAVAILABLE" });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  const draftId = parseAdminAiDraftCreateCardIdFromPath(requestUrl && requestUrl.pathname);
  if (!draftId) {
    sendJson(res, 400, { error: "INVALID_AI_DRAFT_ID" });
    return;
  }

  let draftSnapshot = null;
  try {
    draftSnapshot = await aiDraftRepository.getById(draftId);
    if (!draftSnapshot) {
      sendJson(res, 404, { error: "AI_DRAFT_NOT_FOUND" });
      return;
    }

    if (draftSnapshot.status === "published") {
      sendJson(res, 409, { error: "AI_DRAFT_ALREADY_PUBLISHED" });
      return;
    }

    const analysis = draftSnapshot.analysis && typeof draftSnapshot.analysis === "object" ? draftSnapshot.analysis : null;
    if (!analysis || (!analysis.brand && !analysis.name && !analysis.description && !analysis.productManager)) {
      sendJson(res, 409, {
        error: "AI_DRAFT_ANALYSIS_REQUIRED",
        message: "Run AI analysis before generating the AI product card."
      });
      return;
    }

    const productCardData = await requestOpenAiAiDraftProductCard(draftSnapshot);
    const mediaPack = await requestOpenAiAiDraftMediaPack(draftSnapshot, productCardData.normalized);

    const result = await runSerializedStoreMutation(async () => {
      const currentDraft = await aiDraftRepository.getById(draftId);
      if (!currentDraft) {
        const notFoundError = new Error("AI_DRAFT_NOT_FOUND");
        notFoundError.code = "AI_DRAFT_NOT_FOUND";
        throw notFoundError;
      }

      if (currentDraft.status === "published") {
        const alreadyPublishedError = new Error("AI_DRAFT_ALREADY_PUBLISHED");
        alreadyPublishedError.code = "AI_DRAFT_ALREADY_PUBLISHED";
        throw alreadyPublishedError;
      }

      if (safeString(currentDraft.updatedAt) !== safeString(draftSnapshot.updatedAt)) {
        const conflictError = new Error("AI_DRAFT_VERSION_MISMATCH");
        conflictError.code = "AI_DRAFT_VERSION_MISMATCH";
        throw conflictError;
      }

      const nextDraft = buildAiDraftFromProductCardResult(
        currentDraft,
        Object.assign({}, productCardData.normalized, {
          model: productCardData.model
        }),
        mediaPack
      );
      await aiDraftRepository.save(nextDraft);
      return {
        draft: nextDraft
      };
    });

    sendJson(res, 200, {
      ok: true,
      draft: result.draft
    });
  } catch (error) {
    console.error("AI draft product manager failed:", {
      draftId,
      message: error && error.message ? error.message : String(error),
      code: error && error.code ? error.code : "",
      status: error && error.status ? error.status : 0
    });

    if (error && error.code === "AI_DRAFT_NOT_FOUND") {
      sendJson(res, 404, { error: "AI_DRAFT_NOT_FOUND" });
      return;
    }
    if (error && error.code === "AI_DRAFT_ALREADY_PUBLISHED") {
      sendJson(res, 409, { error: "AI_DRAFT_ALREADY_PUBLISHED" });
      return;
    }
    if (error && error.code === "AI_DRAFT_VERSION_MISMATCH") {
      sendJson(res, 409, {
        error: "AI_DRAFT_VERSION_MISMATCH",
        message: "AI draft was changed in another session. Refresh and retry."
      });
      return;
    }
    if (error && error.code === "OPENAI_API_KEY_MISSING") {
      sendJson(res, 503, {
        error: "OPENAI_API_KEY_MISSING",
        message: "OPENAI_API_KEY is not configured."
      });
      return;
    }
    if (error && (
      error.code === "OPENAI_AI_CARD_REQUEST_FAILED"
      || error.code === "OPENAI_AI_CARD_EMPTY_RESPONSE"
      || error.code === "OPENAI_AI_CARD_INVALID_JSON"
      || error.code === "OPENAI_AI_IMAGE_REQUEST_FAILED"
      || error.code === "OPENAI_AI_IMAGE_EMPTY_RESPONSE"
    )) {
      sendJson(res, 502, {
        error: error.code,
        message: "OpenAI AI Product Manager request failed."
      });
      return;
    }
    if (error && error.message === "INVALID_AI_DRAFT_PRODUCT_CARD_RESULT") {
      sendJson(res, 500, {
        error: "INVALID_AI_DRAFT_PRODUCT_CARD_RESULT"
      });
      return;
    }
    throw error;
  }
}

async function handleTelegramWebhookApi(req, res) {
  if (!aiDraftRepository) {
    sendJson(res, 503, { error: "AI_DRAFTS_UNAVAILABLE" });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureTelegramWebhookAuthorized(req, res)) {
    console.warn("Telegram webhook rejected: invalid or missing secret token");
    return;
  }

  if (!ensureJsonBodyRequest(req, res)) {
    return;
  }

  let raw;
  let parsed;

  try {
    raw = await readRequestBody(req);
  } catch (error) {
    if (handleBodyReadFailure(res, error)) {
      console.error("Telegram webhook body read failed:", error && error.message ? error.message : error);
      return;
    }
    console.error("Telegram webhook body read failed:", error);
    throw error;
  }

  try {
    parsed = JSON.parse(raw || "{}");
  } catch (error) {
    console.error("Telegram webhook received invalid JSON");
    sendJson(res, 400, { error: "INVALID_JSON" });
    return;
  }

  const sourceInfo = extractTelegramDraftSource(parsed);
  if (!sourceInfo) {
    sendJson(res, 200, {
      ok: true,
      ignored: true,
      reason: "UNSUPPORTED_UPDATE_TYPE"
    });
    return;
  }

  try {
    const result = await runSerializedStoreMutation(async () => {
      const draftId = buildTelegramDraftId(sourceInfo.post);
      const existingDraft = draftId ? await aiDraftRepository.getById(draftId) : null;
      const nextDraft = sanitizeIncomingAiDraft(
        buildTelegramAiDraftPayload(parsed, sourceInfo, existingDraft),
        existingDraft
      );
      const created = !existingDraft;
      await aiDraftRepository.save(nextDraft);
      return {
        created,
        draft: nextDraft
      };
    });

    const telegramInfo = result.draft && result.draft.analysis && result.draft.analysis.telegram
      ? result.draft.analysis.telegram
      : null;

    console.log("Telegram AI draft saved:", {
      draftId: result.draft && result.draft.id,
      created: result.created,
      sourceUrl: result.draft && result.draft.sourceUrl,
      hasPhoto: Boolean(telegramInfo && telegramInfo.hasPhoto),
      messageId: telegramInfo && telegramInfo.messageId
    });

    sendJson(res, 200, {
      ok: true,
      ignored: false,
      created: result.created,
      draftId: result.draft && result.draft.id,
      status: result.draft && result.draft.status
    });
  } catch (error) {
    console.error("Telegram webhook draft creation failed:", {
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : ""
    });
    throw error;
  }
}

async function handleAdminProductsApi(req, res) {
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
  if (!ensureJsonBodyRequest(req, res)) {
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

  try {
    const result = await runSerializedStoreMutation(async () => {
      const currentData = await storeRepository.read();
      const nextData = cloneData(validateStoreData(currentData));
      const incomingProduct = parsed && typeof parsed === "object" && parsed.product ? parsed.product : parsed;
      const incomingId = safeString(incomingProduct && incomingProduct.id).slice(0, 120);
      const productIndex = nextData.products.findIndex((product) => safeString(product && product.id) === incomingId);
      const existingProduct = productIndex >= 0 ? nextData.products[productIndex] : null;
      const existingProductForSanitize = existingProduct ? cloneData(existingProduct) : null;
      if (existingProductForSanitize) {
        const recoveredImage = await resolveRecoverableProductImage(
          incomingId || existingProductForSanitize.id,
          incomingProduct && incomingProduct.image,
          existingProductForSanitize.image
        );
        if (recoveredImage) {
          existingProductForSanitize.image = recoveredImage;
        }
      }
      const nextProduct = sanitizeIncomingAdminProduct(incomingProduct, existingProductForSanitize);
      const nextProductImage = normalizePersistedProductImage(nextProduct.image, "", nextProduct.id, false);
      if (!nextProductImage || isProductImageApiPath(nextProductImage, nextProduct.id) || !isRenderableProductImageValue(nextProductImage, nextProduct.id)) {
        const imageError = new Error("PRODUCT_IMAGE_UNRECOVERABLE");
        imageError.code = "PRODUCT_IMAGE_UNRECOVERABLE";
        throw imageError;
      }
      nextProduct.image = nextProductImage;
      const created = productIndex < 0;

      if (created) {
        nextData.products.unshift(nextProduct);
      } else {
        nextData.products[productIndex] = nextProduct;
      }

      await storeRepository.write(nextData, {
        previousPayload: currentData,
        source: created ? "admin_product_create" : "admin_product_update"
      });

      return {
        created,
        total: nextData.products.length,
        product: nextProduct
      };
    });

    sendJson(res, 200, {
      ok: true,
      created: result.created,
      total: result.total,
      product: result.product
    });
  } catch (error) {
    if (error && error.code === "PRODUCT_IMAGE_UNRECOVERABLE") {
      sendJson(res, 400, {
        error: "PRODUCT_IMAGE_UNRECOVERABLE",
        message: "Product image became unavailable during save. Re-upload the image or refresh product data and retry."
      });
      return;
    }
    if (error.message === "INVALID_PRODUCT_PAYLOAD") {
      sendJson(res, 400, {
        error: "INVALID_PRODUCT_PAYLOAD",
        message: "Invalid product payload"
      });
      return;
    }
    throw error;
  }
}

async function handleAdminProductByIdApi(req, res, requestUrl) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  const productId = parseAdminProductIdFromPath(requestUrl && requestUrl.pathname);
  if (!productId) {
    sendJson(res, 400, { error: "INVALID_PRODUCT_ID" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const currentData = await storeRepository.read();
    const safeData = validateStoreData(currentData);
    const product = Array.isArray(safeData.products)
      ? safeData.products.find((item) => safeString(item && item.id) === productId)
      : null;

    if (!product) {
      sendJson(res, 404, { error: "PRODUCT_NOT_FOUND" });
      return;
    }

    const responseProduct = cloneData(product);
    const recoveredImage = await resolveRecoverableProductImage(productId, responseProduct.image, "");
    if (recoveredImage) {
      responseProduct.image = recoveredImage;
    }

    sendJson(res, 200, {
      ok: true,
      product: responseProduct
    });
    return;
  }

  try {
    const result = await runSerializedStoreMutation(async () => {
      const currentData = await storeRepository.read();
      const nextData = cloneData(validateStoreData(currentData));
      const productIndex = nextData.products.findIndex((product) => safeString(product && product.id) === productId);
      if (productIndex < 0) {
        const notFoundError = new Error("PRODUCT_NOT_FOUND");
        notFoundError.code = "PRODUCT_NOT_FOUND";
        throw notFoundError;
      }

      nextData.products = nextData.products.filter((product) => safeString(product && product.id) !== productId);
      await storeRepository.write(nextData, {
        previousPayload: currentData,
        source: "admin_product_delete"
      });

      return {
        id: productId,
        total: nextData.products.length
      };
    });

    sendJson(res, 200, {
      ok: true,
      id: result.id,
      total: result.total
    });
  } catch (error) {
    if (error && error.code === "PRODUCT_NOT_FOUND") {
      sendJson(res, 404, { error: "PRODUCT_NOT_FOUND" });
      return;
    }
    throw error;
  }
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
  if (!ensureJsonBodyRequest(req, res)) {
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
  if (!ensureJsonBodyRequest(req, res)) {
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
  if (!ensureJsonBodyRequest(req, res)) {
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

async function handleAdminImageIntegrityApi(req, res, requestUrl) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (!ensureAdminAuthorized(req, res)) {
    return;
  }

  const pathname = requestUrl && requestUrl.pathname ? String(requestUrl.pathname) : "";
  const isRepairPath = pathname === "/api/admin/image-integrity/repair";

  if (req.method === "GET" && pathname === "/api/admin/image-integrity") {
    const report = await collectProductImageIntegrityReport(storeRepository);
    sendJson(res, 200, Object.assign({ ok: true }, report));
    return;
  }

  if (req.method === "POST" && isRepairPath) {
    const result = await runSerializedStoreMutation(async () => {
      if (storeRepository && typeof storeRepository.createSnapshot === "function") {
        await storeRepository.createSnapshot("pre_image_integrity_repair");
      }
      return repairBrokenProductImagesFromHistory(storeRepository);
    });
    const report = await collectProductImageIntegrityReport(storeRepository);
    sendJson(res, 200, {
      ok: true,
      repaired: Number.isFinite(result && result.repaired) ? result.repaired : 0,
      skipped: Number.isFinite(result && result.skipped) ? result.skipped : 0,
      report
    });
    return;
  }

  sendText(res, 405, "Method Not Allowed");
}

async function handleProductReviewsApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const hostHeader = req.headers.host || "localhost:" + PORT;
    const requestUrl = new URL(req.url, "http://" + hostHeader);
    const productId = safeString(requestUrl.searchParams.get("productId")).slice(0, 120);
    if (!productId) {
      sendJson(res, 400, { error: "PRODUCT_ID_REQUIRED" });
      return;
    }

    const currentData = await storeRepository.read();
    const cachedResponse = getCachedPublicProductReviewsResponse(currentData, productId);

    if (!cachedResponse) {
      sendJson(res, 404, { error: "PRODUCT_NOT_FOUND" });
      return;
    }

    sendPublicApiResponse(req, res, 200, cachedResponse.payload, {
      prebuiltBody: cachedResponse.body,
      prebuiltEtag: cachedResponse.etag,
      maxAge: 30,
      staleWhileRevalidate: 120
    });
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }
  if (!ensureJsonBodyRequest(req, res)) {
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
  if (!ensureJsonBodyRequest(req, res)) {
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
  if (!ensureJsonBodyRequest(req, res)) {
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
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("Origin-Agent-Cluster", "?1");
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

  if (pathname === "/favicon.ico") {
    pathname = "/favicon.svg";
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

    if (!ensureTrustedMutationRequest(req, res)) {
      return;
    }

    if (requestUrl.pathname === "/api/store-data") {
      await handleStoreApi(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname === "/api/catalog") {
      await handlePublicCatalogApi(req, res);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/product-image/")) {
      await handleProductImageApi(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname === "/api/admin/catalog") {
      await handleAdminCatalogApi(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname === "/api/admin/ai-drafts") {
      await handleAdminAiDraftsApi(req, res);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/admin/ai-drafts/") && requestUrl.pathname.endsWith("/analyze")) {
      await handleAdminAiDraftAnalyzeApi(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/admin/ai-drafts/") && requestUrl.pathname.endsWith("/create-card")) {
      await handleAdminAiDraftCreateCardApi(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/admin/ai-drafts/") && requestUrl.pathname.endsWith("/publish")) {
      await handleAdminAiDraftPublishApi(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/admin/ai-drafts/")) {
      await handleAdminAiDraftByIdApi(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname === "/api/admin/products") {
      await handleAdminProductsApi(req, res);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/admin/products/")) {
      await handleAdminProductByIdApi(req, res, requestUrl);
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

    if (
      requestUrl.pathname === "/api/admin/image-integrity"
      || requestUrl.pathname === "/api/admin/image-integrity/repair"
    ) {
      await handleAdminImageIntegrityApi(req, res, requestUrl);
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

    if (requestUrl.pathname === TELEGRAM_WEBHOOK_PATH) {
      await handleTelegramWebhookApi(req, res);
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
  try {
    const repairResult = await repairBrokenProductImagesFromHistory(storeRepository);
    if (repairResult && repairResult.repaired > 0) {
      console.log("Recovered product images from history:", repairResult.repaired);
    }
  } catch (error) {
    console.warn("Product image history repair skipped:", error && error.message ? error.message : error);
  }
  aiDraftRepository = await createAiDraftRepository();

  httpServer = http.createServer((req, res) => {
    res.__request = req;
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

  try {
    if (aiDraftRepository && typeof aiDraftRepository.close === "function") {
      await aiDraftRepository.close();
    }
  } catch (error) {
    console.error("Failed to close AI drafts storage cleanly:", error);
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
