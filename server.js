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
const MAX_BODY_SIZE = 30 * 1024 * 1024;
const ADMIN_SESSION_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.ADMIN_SESSION_TTL_MS || 24 * 60 * 60 * 1000));
const MIN_ADMIN_PASSWORD_LENGTH = 6;
const MAX_ADMIN_PASSWORD_LENGTH = 128;
const ADMIN_BRUTE_FORCE_MAX_ATTEMPTS = Math.max(1, Number(process.env.ADMIN_BRUTE_FORCE_MAX_ATTEMPTS || 5));
const ADMIN_BRUTE_FORCE_WINDOW_MS = Math.max(60 * 1000, Number(process.env.ADMIN_BRUTE_FORCE_WINDOW_MS || 15 * 60 * 1000));
const ADMIN_BRUTE_FORCE_BLOCK_MS = Math.max(60 * 1000, Number(process.env.ADMIN_BRUTE_FORCE_BLOCK_MS || 15 * 60 * 1000));
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 1000;

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
  clientErrors: {
    name: "client_errors",
    max: 30,
    windowMs: 60 * 1000,
    message: "Too many client error reports"
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

const FALLBACK_DATA = {
  settings: {
    telegramChannel: "https://t.me/veligodsky_ls",
    telegramDM: "https://t.me/veligodsky_ls",
    freeShippingThreshold: 8000,
    adminPassword: "admin123",
    storeName: "VELIGODSKY.PARFUMS",
    backupNoticeEnabled: true
  },
  products: []
};

let storeRepository = null;
let httpServer = null;
let shuttingDown = false;
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

  if (safePath === "/api/client-errors" && safeMethod === "POST") {
    return RATE_LIMIT_RULES.clientErrors;
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
  return safe;
}

function ensureIncomingAdminPassword(payload, currentData) {
  const next = cloneData(validateStoreData(payload));
  const currentPassword = readAdminPassword(currentData);
  next.settings.adminPassword = currentPassword;
  return next;
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
  }

  async init() {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });

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

  async write(payload) {
    return writeDataFile(this.filePath, payload);
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

  async write(payload) {
    const validated = validateStoreData(payload);
    const result = await this.pool.query(
      "INSERT INTO " + DB_TABLE + " (id, payload, updated_at) "
      + "VALUES (1, $1::jsonb, NOW()) "
      + "ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW() "
      + "RETURNING payload",
      [JSON.stringify(validated)]
    );

    return normalizeDbPayload(result.rows[0].payload);
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
  return isTrueLike(process.env.FORCE_FILE_STORAGE);
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

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error("BODY_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

async function handleStoreApi(req, res) {
  if (!storeRepository) {
    sendJson(res, 503, { error: "STORE_UNAVAILABLE" });
    return;
  }

  if (req.method === "GET") {
    const data = await storeRepository.read();
    sendJson(res, 200, sanitizePublicStoreData(data));
    return;
  }

  if (req.method === "PUT") {
    if (!ensureAdminAuthorized(req, res)) {
      return;
    }

    let raw;
    let parsed;

    try {
      raw = await readRequestBody(req);
    } catch (error) {
      if (error.message === "BODY_TOO_LARGE") {
        sendJson(res, 413, { error: "PAYLOAD_TOO_LARGE" });
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
      const currentData = await storeRepository.read();
      const nextPayload = ensureIncomingAdminPassword(parsed, currentData);
      const saved = await storeRepository.write(nextPayload);

      sendJson(res, 200, sanitizePublicStoreData(saved));
    } catch (error) {
      if (error.message === "INVALID_PAYLOAD") {
        sendJson(res, 400, { error: "INVALID_PAYLOAD" });
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
    if (error.message === "BODY_TOO_LARGE") {
      sendJson(res, 413, { error: "PAYLOAD_TOO_LARGE" });
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
  if (!safeCompareStrings(password, currentPassword)) {
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
    if (error.message === "BODY_TOO_LARGE") {
      sendJson(res, 413, { error: "PAYLOAD_TOO_LARGE" });
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

  const currentData = await storeRepository.read();
  const nextData = cloneData(validateStoreData(currentData));
  nextData.settings.adminPassword = newPassword;
  await storeRepository.write(nextData);

  revokeAdminSessions(getBearerToken(req));
  sendJson(res, 200, { ok: true });
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
    if (error.message === "BODY_TOO_LARGE") {
      sendJson(res, 413, { error: "PAYLOAD_TOO_LARGE" });
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

  return absolutePath;
}

async function serveStaticFile(res, filePath) {
  try {
    const stat = await fsp.stat(filePath);

    if (stat.isDirectory()) {
      await serveStaticFile(res, path.join(filePath, "index.html"));
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[extension] || "application/octet-stream";
    const body = await fsp.readFile(filePath);

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": body.length
    });
    res.end(body);
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

    if (requestUrl.pathname === "/api/client-errors") {
      await handleClientErrorsApi(req, res);
      return;
    }

    const filePath = getSafeFilePath(requestUrl.pathname);
    if (!filePath) {
      sendText(res, 403, "Forbidden");
      return;
    }

    await serveStaticFile(res, filePath);
  } catch (error) {
    console.error("Server error:", error);
    sendText(res, 500, "Internal Server Error");
  }
}

async function start() {
  storeRepository = await createStoreRepository();

  httpServer = http.createServer((req, res) => {
    requestHandler(req, res);
  });

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
