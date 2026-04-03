(function () {
  "use strict";

  var DATA_KEY = "veligodsky_data_v1";
  var CART_KEY = "veligodsky_cart_v1";
  var SAMPLE_KEY = "veligodsky_sample_v1";
  var API_DATA_URL = "/api/store-data";
  var API_ADMIN_AUTH_URL = "/api/admin/auth";
  var API_ADMIN_PASSWORD_URL = "/api/admin/password";
  var API_REVIEW_CAPTCHA_URL = "/api/review-captcha";
  var API_HOMEPAGE_REVIEWS_URL = "/api/homepage-reviews";
  var API_PRODUCT_REVIEWS_URL = "/api/product-reviews";
  var ADMIN_TOKEN_KEY = "veligodsky_admin_token_v1";
  var numberFormatter = new Intl.NumberFormat("ru-RU");
  var dataCache = null;
  var syncPromise = null;
  var adminTokenMemory = "";

  var placeholderImages = [
    "https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1615634262417-6f5ba8d8f1f8?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1615634262345-4dcf59e86cdc?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1608528577891-eb055944f2e7?auto=format&fit=crop&w=900&q=80"
  ];

  var defaultSettings = {
    telegramChannel: "https://t.me/veligodsky_ls",
    telegramDM: "https://t.me/veligodsky_ls",
    freeShippingThreshold: 8000,
    storeName: "VELIGODSKY.PARFUMS",
    backupNoticeEnabled: true
  };

  var defaultHomepageReviews = [
    {
      id: "hr_001",
      author: "Анна",
      city: "Москва",
      text: "Очень приятный сервис: помогли подобрать аромат под запрос и быстро отправили заказ.",
      rating: 5,
      createdAt: "2026-03-20T12:00:00.000Z"
    },
    {
      id: "hr_002",
      author: "Денис",
      city: "Санкт-Петербург",
      text: "Брал в подарок, все пришло в срок. Упаковка аккуратная, аромат оригинальный.",
      rating: 5,
      createdAt: "2026-03-21T15:30:00.000Z"
    },
    {
      id: "hr_003",
      author: "Екатерина",
      city: "Казань",
      text: "Понравилось, что можно получить консультацию в Telegram и выбрать пробник к заказу.",
      rating: 5,
      createdAt: "2026-03-22T09:15:00.000Z"
    }
  ];

  var defaultProducts = [
    {
      id: "p_001",
      name: "Aventus",
      brand: "Creed",
      gender: "male",
      description: "Свежий цитрусово-древесный аромат с аккордом ананаса.",
      image: placeholderImages[0],
      volumes: [
        { ml: 10, price: 4200 },
        { ml: 50, price: 14900 },
        { ml: 100, price: 23900 }
      ],
      topWeek: true,
      topMonth: true
    },
    {
      id: "p_002",
      name: "Baccarat Rouge 540",
      brand: "Maison Francis Kurkdjian",
      gender: "unisex",
      description: "Амброво-древесный шлейф с шафраном и кедром.",
      image: placeholderImages[1],
      volumes: [
        { ml: 10, price: 5200 },
        { ml: 35, price: 12800 },
        { ml: 70, price: 21900 }
      ],
      topWeek: true,
      topMonth: true
    },
    {
      id: "p_003",
      name: "Tobacco Vanille",
      brand: "Tom Ford",
      gender: "unisex",
      description: "Табак, ваниль и специи в насыщенном вечернем звучании.",
      image: placeholderImages[2],
      volumes: [
        { ml: 10, price: 3900 },
        { ml: 30, price: 11900 },
        { ml: 50, price: 17400 }
      ],
      topWeek: true,
      topMonth: false
    },
    {
      id: "p_004",
      name: "Sauvage Elixir",
      brand: "Dior",
      gender: "male",
      description: "Глубокий пряный аромат с лавандой и древесными нотами.",
      image: placeholderImages[3],
      volumes: [
        { ml: 10, price: 2800 },
        { ml: 60, price: 11200 }
      ],
      topWeek: false,
      topMonth: true
    },
    {
      id: "p_005",
      name: "Coco Mademoiselle",
      brand: "Chanel",
      gender: "female",
      description: "Цитрусово-цветочный аромат с элегантной базой пачули.",
      image: placeholderImages[4],
      volumes: [
        { ml: 10, price: 2300 },
        { ml: 35, price: 8900 },
        { ml: 100, price: 17800 }
      ],
      topWeek: false,
      topMonth: false
    },
    {
      id: "p_006",
      name: "Gypsy Water",
      brand: "Byredo",
      gender: "unisex",
      description: "Легкий древесно-цитрусовый аромат с можжевельником и ванилью.",
      image: placeholderImages[0],
      volumes: [
        { ml: 10, price: 3200 },
        { ml: 50, price: 13800 },
        { ml: 100, price: 19900 }
      ],
      topWeek: true,
      topMonth: false
    },
    {
      id: "p_007",
      name: "Oud for Greatness",
      brand: "Initio",
      gender: "unisex",
      description: "Интенсивный удовый аромат с шафраном и мускусом.",
      image: placeholderImages[1],
      volumes: [
        { ml: 5, price: 3700 },
        { ml: 30, price: 14500 },
        { ml: 90, price: 28600 }
      ],
      topWeek: false,
      topMonth: true
    },
    {
      id: "p_008",
      name: "Santal 33",
      brand: "Le Labo",
      gender: "unisex",
      description: "Культовый древесный аромат с нотами сандала и кожи.",
      image: placeholderImages[2],
      volumes: [
        { ml: 10, price: 4100 },
        { ml: 50, price: 16700 },
        { ml: 100, price: 26500 }
      ],
      topWeek: false,
      topMonth: true
    },
    {
      id: "p_009",
      name: "Angels Share",
      brand: "Kilian",
      gender: "unisex",
      description: "Коньячный аккорд с корицей, дубом и пралине.",
      image: placeholderImages[3],
      volumes: [
        { ml: 10, price: 3400 },
        { ml: 50, price: 15600 }
      ],
      topWeek: true,
      topMonth: false
    },
    {
      id: "p_010",
      name: "Erba Pura",
      brand: "Xerjoff",
      gender: "unisex",
      description: "Яркий фруктовый аромат с мускусным шлейфом.",
      image: placeholderImages[4],
      volumes: [
        { ml: 10, price: 3000 },
        { ml: 50, price: 12900 },
        { ml: 100, price: 20900 }
      ],
      topWeek: false,
      topMonth: true
    }
  ];

  function uid(prefix) {
    var base = prefix || "id";
    return base + "_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now().toString(36);
  }

  function toNumber(value, fallback) {
    var num = Number(value);
    return Number.isFinite(num) ? num : (fallback || 0);
  }

  function toBoolean(value, fallback) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    if (typeof value === "string") {
      var safe = value.trim().toLowerCase();
      if (safe === "true" || safe === "1" || safe === "yes" || safe === "on") {
        return true;
      }
      if (safe === "false" || safe === "0" || safe === "no" || safe === "off") {
        return false;
      }
    }
    return Boolean(fallback);
  }

  function pickImage(value, idx) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    return placeholderImages[idx % placeholderImages.length];
  }

  function normalizeVolume(volume) {
    if (!volume || typeof volume !== "object") {
      return null;
    }
    var ml = Math.round(toNumber(volume.ml));
    var price = Math.round(toNumber(volume.price));
    if (ml <= 0 || price <= 0) {
      return null;
    }
    return {
      ml: ml,
      price: price
    };
  }

  function normalizeReview(review, options) {
    if (!review || typeof review !== "object") {
      return null;
    }

    var safeOptions = options || {};
    var author = String(review.author || review.name || "").trim();
    var text = String(review.text || review.message || "").trim();
    if (!author || !text) {
      return null;
    }

    var city = String(review.city || "").trim();
    var rating = Math.round(toNumber(review.rating, 5));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      rating = 5;
    }

    var createdAt = String(review.createdAt || "").trim();
    if (createdAt) {
      var parsedCreatedAt = new Date(createdAt);
      if (!Number.isNaN(parsedCreatedAt.getTime())) {
        createdAt = parsedCreatedAt.toISOString();
      } else {
        createdAt = "";
      }
    }
    if (!createdAt) {
      createdAt = new Date().toISOString();
    }

    var maxTextLength = Math.max(80, Math.round(toNumber(safeOptions.maxTextLength, 500)));

    return {
      id: String(review.id || uid(safeOptions.prefix || "r")),
      author: author.slice(0, 80),
      city: city.slice(0, 80),
      text: text.slice(0, maxTextLength),
      rating: rating,
      photo: String(review.photo || review.image || "").trim(),
      createdAt: createdAt
    };
  }

  function normalizeReviewList(reviews, options) {
    var safeOptions = options || {};
    var source = Array.isArray(reviews) ? reviews : [];
    var normalized = source.map(function (review) {
      return normalizeReview(review, safeOptions);
    }).filter(Boolean);

    if (safeOptions.sortByCreatedAtDesc) {
      normalized.sort(function (left, right) {
        var leftTime = new Date(left.createdAt).getTime();
        var rightTime = new Date(right.createdAt).getTime();
        return rightTime - leftTime;
      });
    }

    var maxItems = Number(safeOptions.maxItems);
    if (Number.isFinite(maxItems) && maxItems > 0 && normalized.length > maxItems) {
      normalized = normalized.slice(0, Math.round(maxItems));
    }

    return normalized;
  }

  function normalizeProduct(product, idx) {
    if (!product || typeof product !== "object") {
      return null;
    }

    var name = String(product.name || "").trim();
    var brand = String(product.brand || "").trim();
    if (!name || !brand) {
      return null;
    }

    var normalizedVolumes = Array.isArray(product.volumes)
      ? product.volumes.map(normalizeVolume).filter(Boolean)
      : [];

    if (!normalizedVolumes.length) {
      normalizedVolumes = [{ ml: 50, price: 5000 }];
    }

    var gender = String(product.gender || "unisex").toLowerCase();
    if (["male", "female", "unisex"].indexOf(gender) === -1) {
      gender = "unisex";
    }

    return {
      id: String(product.id || uid("p")),
      name: name,
      brand: brand,
      gender: gender,
      description: String(product.description || "").trim(),
      image: pickImage(product.image, idx),
      volumes: normalizedVolumes,
      reviews: normalizeReviewList(product.reviews, {
        prefix: "pr",
        maxItems: 80,
        maxTextLength: 500,
        sortByCreatedAtDesc: true
      }),
      pendingReviews: normalizeReviewList(product.pendingReviews, {
        prefix: "ppr",
        maxItems: 120,
        maxTextLength: 500,
        sortByCreatedAtDesc: true
      }),
      topWeek: Boolean(product.topWeek),
      topMonth: Boolean(product.topMonth)
    };
  }

  function getDefaultData() {
    return {
      settings: Object.assign({}, defaultSettings),
      reviews: normalizeReviewList(defaultHomepageReviews, {
        prefix: "hr",
        maxItems: 30,
        maxTextLength: 500,
        sortByCreatedAtDesc: true
      }),
      pendingHomepageReviews: [],
      products: defaultProducts.map(function (product, idx) {
        return normalizeProduct(product, idx);
      }).filter(Boolean)
    };
  }

  function normalizeData(raw) {
    var defaults = getDefaultData();
    var safe = raw && typeof raw === "object" ? raw : {};

    var settings = Object.assign({}, defaults.settings, safe.settings || {});
    settings.freeShippingThreshold = Math.max(0, Math.round(toNumber(settings.freeShippingThreshold, defaults.settings.freeShippingThreshold)));
    settings.telegramChannel = String(settings.telegramChannel || defaults.settings.telegramChannel);
    settings.telegramDM = String(settings.telegramDM || defaults.settings.telegramDM);
    if (Object.prototype.hasOwnProperty.call(settings, "adminPassword")) {
      delete settings.adminPassword;
    }
    settings.backupNoticeEnabled = toBoolean(settings.backupNoticeEnabled, defaults.settings.backupNoticeEnabled);

    var products = Array.isArray(safe.products)
      ? safe.products.map(normalizeProduct).filter(Boolean)
      : defaults.products;

    var reviews = Array.isArray(safe.reviews)
      ? normalizeReviewList(safe.reviews, {
        prefix: "hr",
        maxItems: 30,
        maxTextLength: 500,
        sortByCreatedAtDesc: true
      })
      : defaults.reviews;

    var pendingHomepageReviews = Array.isArray(safe.pendingHomepageReviews)
      ? normalizeReviewList(safe.pendingHomepageReviews, {
        prefix: "phr",
        maxItems: 120,
        maxTextLength: 500,
        sortByCreatedAtDesc: true
      })
      : [];

    return {
      settings: settings,
      products: products,
      reviews: reviews,
      pendingHomepageReviews: pendingHomepageReviews
    };
  }

  function saveData(data) {
    var normalized = normalizeData(data);
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(normalized));
    } catch (error) {
      // Keep working with in-memory cache when browser storage quota is exceeded.
    }
    dataCache = normalized;
    return normalized;
  }

  function readLocalData() {
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (!raw) {
        var defaults = getDefaultData();
        dataCache = defaults;
        return defaults;
      }
      return saveData(JSON.parse(raw));
    } catch (error) {
      var fallback = getDefaultData();
      dataCache = fallback;
      return fallback;
    }
  }

  function loadData() {
    if (dataCache) {
      return dataCache;
    }
    return readLocalData();
  }

  function canUseRemoteStore() {
    if (typeof window.fetch !== "function") {
      return false;
    }
    if (!window.location || !window.location.protocol) {
      return false;
    }
    return /^https?:$/i.test(window.location.protocol);
  }

  function getStoredAdminToken() {
    if (adminTokenMemory) {
      return adminTokenMemory;
    }

    try {
      adminTokenMemory = String(sessionStorage.getItem(ADMIN_TOKEN_KEY) || "").trim();
    } catch (error) {
      adminTokenMemory = "";
    }

    return adminTokenMemory;
  }

  function setStoredAdminToken(token) {
    adminTokenMemory = String(token || "").trim();
    try {
      if (adminTokenMemory) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, adminTokenMemory);
      } else {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    } catch (error) {
      return;
    }
  }

  function clearStoredAdminToken() {
    adminTokenMemory = "";
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch (error) {
      return;
    }
  }

  function hasAdminSession() {
    return Boolean(getStoredAdminToken());
  }

  async function loginAdmin(password) {
    var safePassword = String(password || "").trim();
    if (!safePassword) {
      throw new Error("PASSWORD_REQUIRED");
    }

    if (!canUseRemoteStore()) {
      throw new Error("REMOTE_STORE_REQUIRED");
    }

    var response = await fetch(API_ADMIN_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ password: safePassword })
    });

    if (response.status === 401) {
      clearStoredAdminToken();
      throw new Error("INVALID_CREDENTIALS");
    }

    if (response.status === 429) {
      clearStoredAdminToken();
      var retryAfterSec = 0;
      try {
        var errorPayload = await response.json();
        retryAfterSec = Math.max(0, Math.round(Number(errorPayload && errorPayload.retryAfterSec) || 0));
      } catch (error) {
        retryAfterSec = Math.max(0, Math.round(Number(response.headers.get("Retry-After")) || 0));
      }
      throw new Error("ADMIN_LOGIN_TEMP_BLOCKED:" + retryAfterSec);
    }

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    var payload = await response.json();
    var token = String(payload && payload.token || "").trim();
    if (!token) {
      throw new Error("INVALID_AUTH_RESPONSE");
    }

    setStoredAdminToken(token);
    return true;
  }

  function logoutAdmin() {
    clearStoredAdminToken();
  }

  async function changeAdminPassword(nextPassword) {
    var safePassword = String(nextPassword || "").trim();
    if (!safePassword) {
      throw new Error("PASSWORD_REQUIRED");
    }

    var adminToken = getStoredAdminToken();
    if (!adminToken) {
      throw new Error("UNAUTHORIZED");
    }

    var response = await fetch(API_ADMIN_PASSWORD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Bearer " + adminToken
      },
      body: JSON.stringify({ newPassword: safePassword })
    });

    if (response.status === 401) {
      clearStoredAdminToken();
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    return true;
  }

  async function fetchRemoteData() {
    var headers = {
      "Accept": "application/json"
    };
    var adminToken = getStoredAdminToken();
    if (adminToken) {
      headers.Authorization = "Bearer " + adminToken;
    }

    var response = await fetch(API_DATA_URL + "?ts=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      headers: headers
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    var payload = await response.json();
    return normalizeData(payload);
  }

  async function pushRemoteData(data) {
    var headers = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    var adminToken = getStoredAdminToken();
    if (adminToken) {
      headers.Authorization = "Bearer " + adminToken;
    }

    var response = await fetch(API_DATA_URL, {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(normalizeData(data))
    });

    if (response.status === 401) {
      clearStoredAdminToken();
    }

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    var payload = await response.json();
    return normalizeData(payload);
  }

  async function init() {
    loadData();

    if (!canUseRemoteStore()) {
      return loadData();
    }

    try {
      var remote = await fetchRemoteData();
      return saveData(remote);
    } catch (error) {
      return loadData();
    }
  }

  async function syncFromServer() {
    if (!canUseRemoteStore()) {
      return loadData();
    }

    if (syncPromise) {
      return syncPromise;
    }

    syncPromise = fetchRemoteData()
      .then(function (remote) {
        return saveData(remote);
      })
      .finally(function () {
        syncPromise = null;
      });

    return syncPromise;
  }

  async function commitData(nextData) {
    var normalized = saveData(nextData);

    if (!canUseRemoteStore()) {
      return normalized;
    }

    var remote = await pushRemoteData(normalized);
    return saveData(remote);
  }

  function getProducts() {
    return loadData().products;
  }

  async function saveProducts(products) {
    var data = loadData();
    var normalizedProducts = Array.isArray(products)
      ? products.map(normalizeProduct).filter(Boolean)
      : [];
    data.products = normalizedProducts;
    var saved = await commitData(data);
    return saved.products;
  }

  function getHomepageReviews() {
    var data = loadData();
    return Array.isArray(data.reviews) ? data.reviews : [];
  }

  function getPendingHomepageReviews() {
    var data = loadData();
    return Array.isArray(data.pendingHomepageReviews) ? data.pendingHomepageReviews : [];
  }

  async function saveHomepageReviews(reviews) {
    var data = loadData();
    data.reviews = normalizeReviewList(reviews, {
      prefix: "hr",
      maxItems: 30,
      maxTextLength: 500,
      sortByCreatedAtDesc: true
    });
    var saved = await commitData(data);
    return Array.isArray(saved.reviews) ? saved.reviews : [];
  }

  async function savePendingHomepageReviews(reviews) {
    var data = loadData();
    data.pendingHomepageReviews = normalizeReviewList(reviews, {
      prefix: "phr",
      maxItems: 120,
      maxTextLength: 500,
      sortByCreatedAtDesc: true
    });
    var saved = await commitData(data);
    return Array.isArray(saved.pendingHomepageReviews) ? saved.pendingHomepageReviews : [];
  }

  function applyHomepageReviewsCache(reviews) {
    var nextReviews = normalizeReviewList(reviews, {
      prefix: "hr",
      maxItems: 30,
      maxTextLength: 500,
      sortByCreatedAtDesc: true
    });

    var data = loadData();
    data.reviews = nextReviews;
    saveData(data);
    return nextReviews;
  }

  function applyProductReviewsCache(productId, reviews) {
    var safeProductId = String(productId || "").trim();
    if (!safeProductId) {
      return [];
    }

    var nextReviews = normalizeReviewList(reviews, {
      prefix: "pr",
      maxItems: 80,
      maxTextLength: 500,
      sortByCreatedAtDesc: true
    });

    var data = loadData();
    data.products = data.products.map(function (product) {
      if (String(product.id) !== safeProductId) {
        return product;
      }
      return Object.assign({}, product, {
        reviews: nextReviews
      });
    });
    saveData(data);
    return nextReviews;
  }

  async function submitProductReview(productId, reviewPayload) {
    var safeProductId = String(productId || "").trim();
    if (!safeProductId) {
      throw new Error("PRODUCT_ID_REQUIRED");
    }

    if (!canUseRemoteStore()) {
      throw new Error("REMOTE_STORE_REQUIRED");
    }

    var payload = {
      productId: safeProductId,
      author: String(reviewPayload && reviewPayload.author || "").trim(),
      city: String(reviewPayload && reviewPayload.city || "").trim(),
      text: String(reviewPayload && reviewPayload.text || "").trim(),
      rating: Math.max(1, Math.min(5, Math.round(toNumber(reviewPayload && reviewPayload.rating, 5)))),
      photo: String(reviewPayload && reviewPayload.photo || "").trim(),
      website: String(reviewPayload && reviewPayload.website || "").trim(),
      captchaToken: String(reviewPayload && reviewPayload.captchaToken || "").trim(),
      captchaAnswer: String(reviewPayload && reviewPayload.captchaAnswer || "").trim()
    };

    var response = await fetch(API_PRODUCT_REVIEWS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 429) {
      var retryAfter = Math.max(0, Math.round(Number(response.headers.get("Retry-After")) || 0));
      throw new Error("REVIEW_RATE_LIMIT:" + retryAfter);
    }

    if (response.status === 404) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (response.status === 400) {
      var validationPayload = null;
      try {
        validationPayload = await response.json();
      } catch (error) {
        validationPayload = null;
      }
      var validationCode = String(validationPayload && validationPayload.error || "INVALID_REVIEW_PAYLOAD");
      throw new Error("INVALID_REVIEW_PAYLOAD:" + validationCode);
    }

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    return response.json();
  }

  async function submitHomepageReview(reviewPayload) {
    if (!canUseRemoteStore()) {
      throw new Error("REMOTE_STORE_REQUIRED");
    }

    var payload = {
      author: String(reviewPayload && reviewPayload.author || "").trim(),
      city: String(reviewPayload && reviewPayload.city || "").trim(),
      text: String(reviewPayload && reviewPayload.text || "").trim(),
      rating: Math.max(1, Math.min(5, Math.round(toNumber(reviewPayload && reviewPayload.rating, 5)))),
      photo: String(reviewPayload && reviewPayload.photo || "").trim(),
      website: String(reviewPayload && reviewPayload.website || "").trim(),
      captchaToken: String(reviewPayload && reviewPayload.captchaToken || "").trim(),
      captchaAnswer: String(reviewPayload && reviewPayload.captchaAnswer || "").trim()
    };

    var response = await fetch(API_HOMEPAGE_REVIEWS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 429) {
      var retryAfter = Math.max(0, Math.round(Number(response.headers.get("Retry-After")) || 0));
      throw new Error("REVIEW_RATE_LIMIT:" + retryAfter);
    }

    if (response.status === 400) {
      var validationPayload = null;
      try {
        validationPayload = await response.json();
      } catch (error) {
        validationPayload = null;
      }
      var validationCode = String(validationPayload && validationPayload.error || "INVALID_REVIEW_PAYLOAD");
      throw new Error("INVALID_REVIEW_PAYLOAD:" + validationCode);
    }

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    return response.json();
  }

  async function fetchReviewCaptcha() {
    var response = await fetch(API_REVIEW_CAPTCHA_URL + "?ts=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    return response.json();
  }

  function getSettings() {
    return loadData().settings;
  }

  async function updateSettings(patch) {
    var data = loadData();
    data.settings = Object.assign({}, data.settings, patch || {});
    data.settings.freeShippingThreshold = Math.max(0, Math.round(toNumber(data.settings.freeShippingThreshold, 8000)));
    data.settings.backupNoticeEnabled = toBoolean(data.settings.backupNoticeEnabled, true);
    var saved = await commitData(data);
    return saved.settings;
  }

  function normalizeCartItem(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    var productId = String(item.productId || "").trim();
    var name = String(item.name || "").trim();
    var brand = String(item.brand || "").trim();
    var ml = Math.round(toNumber(item.ml));
    var price = Math.round(toNumber(item.price));
    var qty = Math.max(1, Math.round(toNumber(item.qty, 1)));

    if (!productId || !name || !brand || ml <= 0 || price <= 0) {
      return null;
    }

    var itemKey = String(item.itemKey || productId + "_" + ml);

    return {
      itemKey: itemKey,
      productId: productId,
      name: name,
      brand: brand,
      image: pickImage(item.image, 0),
      ml: ml,
      price: price,
      qty: qty
    };
  }

  function getCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      var normalized = parsed.map(normalizeCartItem).filter(Boolean);
      saveCart(normalized);
      return normalized;
    } catch (error) {
      return [];
    }
  }

  function saveCart(cart) {
    var safeCart = Array.isArray(cart) ? cart.map(normalizeCartItem).filter(Boolean) : [];
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(safeCart));
    } catch (error) {
      return safeCart;
    }
    return safeCart;
  }

  function addToCart(productId, ml, qty) {
    var quantity = Math.max(1, Math.round(toNumber(qty, 1)));
    var products = getProducts();
    var product = products.find(function (item) {
      return item.id === productId;
    });

    if (!product) {
      return { ok: false, message: "Товар не найден." };
    }

    var volume = product.volumes.find(function (item) {
      return Number(item.ml) === Number(ml);
    });

    if (!volume) {
      return { ok: false, message: "Выберите объем аромата." };
    }

    var cart = getCart();
    var itemKey = product.id + "_" + volume.ml;
    var existing = cart.find(function (item) {
      return item.itemKey === itemKey;
    });

    if (existing) {
      existing.qty += quantity;
    } else {
      cart.push({
        itemKey: itemKey,
        productId: product.id,
        name: product.name,
        brand: product.brand,
        image: product.image,
        ml: volume.ml,
        price: volume.price,
        qty: quantity
      });
    }

    saveCart(cart);
    return { ok: true, cart: cart };
  }

  function removeCartItem(itemKey) {
    var next = getCart().filter(function (item) {
      return item.itemKey !== itemKey;
    });
    saveCart(next);
    return next;
  }

  function setCartItemQty(itemKey, qty) {
    var quantity = Math.max(1, Math.round(toNumber(qty, 1)));
    var cart = getCart();
    var target = cart.find(function (item) {
      return item.itemKey === itemKey;
    });

    if (!target) {
      return cart;
    }

    target.qty = quantity;
    saveCart(cart);
    return cart;
  }

  function clearCart() {
    saveCart([]);
  }

  function getCartCount() {
    return getCart().reduce(function (sum, item) {
      return sum + item.qty;
    }, 0);
  }

  function getCartTotal() {
    return getCart().reduce(function (sum, item) {
      return sum + item.price * item.qty;
    }, 0);
  }

  function getSampleChoice() {
    try {
      return localStorage.getItem(SAMPLE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function saveSampleChoice(value) {
    try {
      localStorage.setItem(SAMPLE_KEY, String(value || "").trim());
    } catch (error) {
      return;
    }
  }

  function formatPrice(value) {
    var amount = Math.round(toNumber(value, 0));
    return numberFormatter.format(amount) + " ₽";
  }

  function getMinPrice(product) {
    if (!product || !Array.isArray(product.volumes) || !product.volumes.length) {
      return 0;
    }
    return Math.min.apply(null, product.volumes.map(function (item) {
      return toNumber(item.price, 0);
    }));
  }

  function getBrands(products) {
    var source = Array.isArray(products) ? products : getProducts();
    return Array.from(new Set(source.map(function (product) {
      return product.brand;
    }))).sort(function (a, b) {
      return a.localeCompare(b, "ru");
    });
  }

  function getGenderLabel(gender) {
    if (gender === "male") {
      return "Мужские";
    }
    if (gender === "female") {
      return "Женские";
    }
    return "Унисекс";
  }

  function buildTelegramOrderMessage(cart, sample, settings) {
    var safeCart = Array.isArray(cart) ? cart : getCart();
    var safeSettings = settings || getSettings();
    var total = safeCart.reduce(function (sum, item) {
      return sum + item.price * item.qty;
    }, 0);
    var lines = [];

    lines.push("Здравствуйте! Хочу оформить заказ в " + safeSettings.storeName + ".");
    lines.push("");
    lines.push("Состав заказа:");

    safeCart.forEach(function (item, index) {
      var lineTotal = item.price * item.qty;
      lines.push((index + 1) + ". " + item.name + " (" + item.brand + ") - " + item.ml + " мл x " + item.qty + " = " + formatPrice(lineTotal));
    });

    lines.push("");
    lines.push("Итого: " + formatPrice(total));

    if (total >= safeSettings.freeShippingThreshold) {
      lines.push("Доставка: Бесплатная");
    } else {
      lines.push("До бесплатной доставки: " + formatPrice(safeSettings.freeShippingThreshold - total));
    }

    var gift = String(sample || "").trim();
    lines.push("Пробник 2ml: " + (gift || "не указан"));
    lines.push("Дата заказа: " + new Date().toLocaleString("ru-RU"));

    return lines.join("\n");
  }

  function buildTelegramUrl(baseUrl, message) {
    var link = String(baseUrl || getSettings().telegramDM || "https://t.me/veligodsky_ls").trim();
    var joiner = link.indexOf("?") >= 0 ? "&" : "?";
    return link + joiner + "text=" + encodeURIComponent(String(message || ""));
  }

  window.VeligodskyStore = {
    DATA_KEY: DATA_KEY,
    CART_KEY: CART_KEY,
    SAMPLE_KEY: SAMPLE_KEY,
    API_DATA_URL: API_DATA_URL,
    API_ADMIN_AUTH_URL: API_ADMIN_AUTH_URL,
    API_ADMIN_PASSWORD_URL: API_ADMIN_PASSWORD_URL,
    API_REVIEW_CAPTCHA_URL: API_REVIEW_CAPTCHA_URL,
    API_HOMEPAGE_REVIEWS_URL: API_HOMEPAGE_REVIEWS_URL,
    API_PRODUCT_REVIEWS_URL: API_PRODUCT_REVIEWS_URL,
    init: init,
    syncFromServer: syncFromServer,
    loginAdmin: loginAdmin,
    logoutAdmin: logoutAdmin,
    hasAdminSession: hasAdminSession,
    changeAdminPassword: changeAdminPassword,
    uid: uid,
    getDefaultData: getDefaultData,
    loadData: loadData,
    saveData: saveData,
    getProducts: getProducts,
    saveProducts: saveProducts,
    getHomepageReviews: getHomepageReviews,
    getPendingHomepageReviews: getPendingHomepageReviews,
    saveHomepageReviews: saveHomepageReviews,
    savePendingHomepageReviews: savePendingHomepageReviews,
    fetchReviewCaptcha: fetchReviewCaptcha,
    submitHomepageReview: submitHomepageReview,
    submitProductReview: submitProductReview,
    getSettings: getSettings,
    updateSettings: updateSettings,
    getCart: getCart,
    saveCart: saveCart,
    addToCart: addToCart,
    removeCartItem: removeCartItem,
    setCartItemQty: setCartItemQty,
    clearCart: clearCart,
    getCartCount: getCartCount,
    getCartTotal: getCartTotal,
    getSampleChoice: getSampleChoice,
    saveSampleChoice: saveSampleChoice,
    formatPrice: formatPrice,
    getMinPrice: getMinPrice,
    getBrands: getBrands,
    getGenderLabel: getGenderLabel,
    buildTelegramOrderMessage: buildTelegramOrderMessage,
    buildTelegramUrl: buildTelegramUrl
  };
})();
