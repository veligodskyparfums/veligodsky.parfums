"use strict";

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "store-data.json");
const DB_TABLE = "store_state";
const MAX_BODY_SIZE = 30 * 1024 * 1024;

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
      console.error("PostgreSQL init failed. Fallback to file storage. Reason:", error && error.message ? error.message : error);
      if (pool) {
        try {
          await pool.end();
        } catch (closeError) {
          console.error("Failed to close PostgreSQL pool after init error:", closeError);
        }
      }
    }
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
    sendJson(res, 200, data);
    return;
  }

  if (req.method === "PUT") {
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
      const saved = await storeRepository.write(parsed);
      sendJson(res, 200, saved);
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

    if (requestUrl.pathname === "/api/store-data") {
      await handleStoreApi(req, res);
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
