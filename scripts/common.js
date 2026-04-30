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
  var UNSYNCED_CHANGES_KEY = "veligodsky_unsynced_changes_v1";
  var REMOTE_READ_TIMEOUT_MS = 8000;
  var REMOTE_WRITE_TIMEOUT_MS = 12000;
  var REVIEW_TIMEOUT_MS = 10000;
  var numberFormatter = new Intl.NumberFormat("ru-RU");
  var dataCache = null;
  var syncPromise = null;
  var adminTokenMemory = "";
  var remoteDataEtag = "";

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
    backupNoticeEnabled: true,
    heroImage: ""
  };
  var MAX_SETTINGS_HERO_IMAGE_LENGTH = 900 * 1024;

  var defaultHomepageReviews = [
    {
      id: "hr_001",
      author: "РђРЅРЅР°",
      city: "РњРѕСЃРєРІР°",
      text: "РћС‡РµРЅСЊ РїСЂРёСЏС‚РЅС‹Р№ СЃРµСЂРІРёСЃ: РїРѕРјРѕРіР»Рё РїРѕРґРѕР±СЂР°С‚СЊ Р°СЂРѕРјР°С‚ РїРѕРґ Р·Р°РїСЂРѕСЃ Рё Р±С‹СЃС‚СЂРѕ РѕС‚РїСЂР°РІРёР»Рё Р·Р°РєР°Р·.",
      rating: 5,
      createdAt: "2026-03-20T12:00:00.000Z"
    },
    {
      id: "hr_002",
      author: "Р”РµРЅРёСЃ",
      city: "РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі",
      text: "Р‘СЂР°Р» РІ РїРѕРґР°СЂРѕРє, РІСЃРµ РїСЂРёС€Р»Рѕ РІ СЃСЂРѕРє. РЈРїР°РєРѕРІРєР° Р°РєРєСѓСЂР°С‚РЅР°СЏ, Р°СЂРѕРјР°С‚ РѕСЂРёРіРёРЅР°Р»СЊРЅС‹Р№.",
      rating: 5,
      createdAt: "2026-03-21T15:30:00.000Z"
    },
    {
      id: "hr_003",
      author: "Р•РєР°С‚РµСЂРёРЅР°",
      city: "РљР°Р·Р°РЅСЊ",
      text: "РџРѕРЅСЂР°РІРёР»РѕСЃСЊ, С‡С‚Рѕ РјРѕР¶РЅРѕ РїРѕР»СѓС‡РёС‚СЊ РєРѕРЅСЃСѓР»СЊС‚Р°С†РёСЋ РІ Telegram Рё РІС‹Р±СЂР°С‚СЊ РїСЂРѕР±РЅРёРє Рє Р·Р°РєР°Р·Сѓ.",
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
      description: "РЎРІРµР¶РёР№ С†РёС‚СЂСѓСЃРѕРІРѕ-РґСЂРµРІРµСЃРЅС‹Р№ Р°СЂРѕРјР°С‚ СЃ Р°РєРєРѕСЂРґРѕРј Р°РЅР°РЅР°СЃР°.",
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
      description: "РђРјР±СЂРѕРІРѕ-РґСЂРµРІРµСЃРЅС‹Р№ С€Р»РµР№С„ СЃ С€Р°С„СЂР°РЅРѕРј Рё РєРµРґСЂРѕРј.",
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
      description: "РўР°Р±Р°Рє, РІР°РЅРёР»СЊ Рё СЃРїРµС†РёРё РІ РЅР°СЃС‹С‰РµРЅРЅРѕРј РІРµС‡РµСЂРЅРµРј Р·РІСѓС‡Р°РЅРёРё.",
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
      description: "Р“Р»СѓР±РѕРєРёР№ РїСЂСЏРЅС‹Р№ Р°СЂРѕРјР°С‚ СЃ Р»Р°РІР°РЅРґРѕР№ Рё РґСЂРµРІРµСЃРЅС‹РјРё РЅРѕС‚Р°РјРё.",
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
      description: "Р¦РёС‚СЂСѓСЃРѕРІРѕ-С†РІРµС‚РѕС‡РЅС‹Р№ Р°СЂРѕРјР°С‚ СЃ СЌР»РµРіР°РЅС‚РЅРѕР№ Р±Р°Р·РѕР№ РїР°С‡СѓР»Рё.",
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
      description: "Р›РµРіРєРёР№ РґСЂРµРІРµСЃРЅРѕ-С†РёС‚СЂСѓСЃРѕРІС‹Р№ Р°СЂРѕРјР°С‚ СЃ РјРѕР¶Р¶РµРІРµР»СЊРЅРёРєРѕРј Рё РІР°РЅРёР»СЊСЋ.",
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
      description: "РРЅС‚РµРЅСЃРёРІРЅС‹Р№ СѓРґРѕРІС‹Р№ Р°СЂРѕРјР°С‚ СЃ С€Р°С„СЂР°РЅРѕРј Рё РјСѓСЃРєСѓСЃРѕРј.",
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
      description: "РљСѓР»СЊС‚РѕРІС‹Р№ РґСЂРµРІРµСЃРЅС‹Р№ Р°СЂРѕРјР°С‚ СЃ РЅРѕС‚Р°РјРё СЃР°РЅРґР°Р»Р° Рё РєРѕР¶Рё.",
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
      description: "РљРѕРЅСЊСЏС‡РЅС‹Р№ Р°РєРєРѕСЂРґ СЃ РєРѕСЂРёС†РµР№, РґСѓР±РѕРј Рё РїСЂР°Р»РёРЅРµ.",
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
      description: "РЇСЂРєРёР№ С„СЂСѓРєС‚РѕРІС‹Р№ Р°СЂРѕРјР°С‚ СЃ РјСѓСЃРєСѓСЃРЅС‹Рј С€Р»РµР№С„РѕРј.",
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

  function toMlNumber(value, fallback) {
    var safe = value;
    if (typeof value === "string") {
      safe = value.trim().replace(",", ".");
    }
    var num = Number(safe);
    return Number.isFinite(num) ? num : (fallback || 0);
  }

  function normalizeMlValue(value, fallback) {
    var num = toMlNumber(value, fallback || 0);
    if (!Number.isFinite(num)) {
      return fallback || 0;
    }
    return Math.round(num * 100) / 100;
  }

  function getMlKey(value) {
    return String(normalizeMlValue(value, 0));
  }

  function formatMl(value) {
    var normalized = normalizeMlValue(value, 0);
    if (normalized <= 0) {
      return "0";
    }
    if (Math.abs(normalized - Math.round(normalized)) < 1e-9) {
      return String(Math.round(normalized));
    }
    return String(normalized).replace(".", ",");
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

  function countMojibakeMarkers(value) {
    var source = String(value || "");
    if (!source) {
      return 0;
    }
    var matches = source.match(/\uFFFD|в‚|вЂ|[Ѓѓ‚…†‡€‰ЉЊЋЏђ‘’“”•–—™љњћџЎўЈҐЄІіґ№єјЅѕї]/g);
    return matches ? matches.length : 0;
  }

  function countMojibakePairs(value) {
    var source = String(value || "");
    if (!source) {
      return 0;
    }
    var matches = source.match(/(?:Р[А-Яа-яЁё]|С[А-Яа-яЁё])/g);
    return matches ? matches.length : 0;
  }

  function countCyrillicChars(value) {
    var source = String(value || "");
    if (!source) {
      return 0;
    }
    var matches = source.match(/[А-Яа-яЁё]/g);
    return matches ? matches.length : 0;
  }

  function isLikelyMojibake(value) {
    var source = String(value || "");
    if (!source) {
      return false;
    }
    if (countMojibakeMarkers(source) >= 2) {
      return true;
    }

    var pairCount = countMojibakePairs(source);
    var pairDensity = pairCount / Math.max(1, source.length);
    return pairCount >= 4 && pairDensity >= 0.12;
  }

  function toWindows1251Byte(charCode) {
    if (charCode >= 0 && charCode <= 0x7F) {
      return charCode;
    }
    if (charCode >= 0x0410 && charCode <= 0x044F) {
      return charCode - 0x350;
    }
    if (charCode === 0x0401) {
      return 0xA8;
    }
    if (charCode === 0x0451) {
      return 0xB8;
    }

    var extraMap = {
      0x0402: 0x80, 0x0403: 0x81, 0x201A: 0x82, 0x0453: 0x83, 0x201E: 0x84, 0x2026: 0x85,
      0x2020: 0x86, 0x2021: 0x87, 0x20AC: 0x88, 0x2030: 0x89, 0x0409: 0x8A, 0x2039: 0x8B,
      0x040A: 0x8C, 0x040C: 0x8D, 0x040B: 0x8E, 0x040F: 0x8F, 0x0452: 0x90, 0x2018: 0x91,
      0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
      0x2122: 0x99, 0x0459: 0x9A, 0x203A: 0x9B, 0x045A: 0x9C, 0x045C: 0x9D, 0x045B: 0x9E,
      0x045F: 0x9F, 0x00A0: 0xA0, 0x040E: 0xA1, 0x045E: 0xA2, 0x0408: 0xA3, 0x00A4: 0xA4,
      0x0490: 0xA5, 0x00A6: 0xA6, 0x00A7: 0xA7, 0x00A9: 0xA9, 0x0404: 0xAA, 0x00AB: 0xAB,
      0x00AC: 0xAC, 0x00AD: 0xAD, 0x00AE: 0xAE, 0x0407: 0xAF, 0x00B0: 0xB0, 0x00B1: 0xB1,
      0x0406: 0xB2, 0x0456: 0xB3, 0x0491: 0xB4, 0x00B5: 0xB5, 0x00B6: 0xB6, 0x00B7: 0xB7,
      0x2116: 0xB9, 0x0454: 0xBA, 0x00BB: 0xBB, 0x0458: 0xBC, 0x0405: 0xBD, 0x0455: 0xBE,
      0x0457: 0xBF
    };

    if (Object.prototype.hasOwnProperty.call(extraMap, charCode)) {
      return extraMap[charCode];
    }
    return null;
  }

  function repairMojibake(value) {
    var source = String(value || "");
    if (!source || !isLikelyMojibake(source) || typeof TextDecoder !== "function") {
      return source;
    }

    var bytes = [];
    for (var index = 0; index < source.length; index += 1) {
      var byteValue = toWindows1251Byte(source.charCodeAt(index));
      if (byteValue === null) {
        return source;
      }
      bytes.push(byteValue);
    }

    try {
      var repaired = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
      if (!repaired) {
        return source;
      }
      var sourceMarkers = countMojibakeMarkers(source);
      var repairedMarkers = countMojibakeMarkers(repaired);
      var sourcePairs = countMojibakePairs(source);
      var repairedPairs = countMojibakePairs(repaired);
      var sourceCyrillic = countCyrillicChars(source);
      var repairedCyrillic = countCyrillicChars(repaired);

      var looksCleaner = repairedMarkers < sourceMarkers || repairedPairs + 1 < sourcePairs;
      var keepsReadableCyrillic = repairedCyrillic >= Math.max(2, Math.floor(sourceCyrillic * 0.75));

      if (looksCleaner && keepsReadableCyrillic && repaired.indexOf("\uFFFD") === -1) {
        return repaired;
      }
      return source;
    } catch (error) {
      return source;
    }
  }

  function pickImage(value, idx) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    return placeholderImages[idx % placeholderImages.length];
  }

  function normalizeSettingsHeroImage(value) {
    var safe = String(value || "").trim();
    if (!safe) {
      return "";
    }

    if (safe.length > MAX_SETTINGS_HERO_IMAGE_LENGTH) {
      return "";
    }

    if (/^https?:\/\/[^\s]+$/i.test(safe)) {
      return safe;
    }

    if (/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(safe)) {
      return safe;
    }

    return "";
  }

  function normalizeVolume(volume) {
    if (!volume || typeof volume !== "object") {
      return null;
    }
    var ml = normalizeMlValue(volume.ml, 0);
    var price = Math.round(toNumber(volume.price));
    if (ml <= 0 || price <= 0) {
      return null;
    }
    return {
      ml: ml,
      price: price
    };
  }

  function normalizeBottleType(value) {
    var safe = String(value || "full").toLowerCase().trim();
    if (["decant", "tester", "full"].indexOf(safe) === -1) {
      return "full";
    }
    return safe;
  }

  function normalizeReview(review, options) {
    if (!review || typeof review !== "object") {
      return null;
    }

    var safeOptions = options || {};
    var author = repairMojibake(String(review.author || review.name || "").trim());
    var text = repairMojibake(String(review.text || review.message || "").trim());
    if (!author || !text) {
      return null;
    }

    var city = repairMojibake(String(review.city || "").trim());
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
    var consentSource = review.consentProof && typeof review.consentProof === "object"
      ? review.consentProof
      : (review.consent && typeof review.consent === "object" ? review.consent : null);
    var consentProof = null;
    if (consentSource) {
      var acceptedAtRaw = String(consentSource.acceptedAt || consentSource.createdAt || consentSource.grantedAt || "").trim();
      var acceptedAt = "";
      if (acceptedAtRaw) {
        var parsedAcceptedAt = new Date(acceptedAtRaw);
        if (!Number.isNaN(parsedAcceptedAt.getTime())) {
          acceptedAt = parsedAcceptedAt.toISOString();
        }
      }
      if (!acceptedAt) {
        acceptedAt = createdAt;
      }

      consentProof = {
        acceptedAt: acceptedAt,
        version: String(consentSource.version || "").trim().slice(0, 64),
        form: String(consentSource.form || "").trim().slice(0, 48),
        ip: String(consentSource.ip || "").trim().slice(0, 120)
      };
    }

    var next = {
      id: String(review.id || uid(safeOptions.prefix || "r")),
      author: author.slice(0, 80),
      city: city.slice(0, 80),
      text: text.slice(0, maxTextLength),
      rating: rating,
      photo: String(review.photo || review.image || "").trim(),
      createdAt: createdAt
    };

    if (consentProof) {
      next.consentProof = consentProof;
    }

    return next;
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

    var name = repairMojibake(String(product.name || "").trim());
    var brand = repairMojibake(String(product.brand || "").trim());
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

    var description = repairMojibake(String(product.description || "").trim());
    if (description.indexOf("\uFFFD") >= 0) {
      description = "";
    }

    return {
      id: String(product.id || uid("p")),
      name: name,
      brand: brand,
      gender: gender,
      bottleType: normalizeBottleType(product.bottleType),
      description: description,
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
    settings.storeName = repairMojibake(String(settings.storeName || defaults.settings.storeName));
    settings.telegramChannel = String(settings.telegramChannel || defaults.settings.telegramChannel);
    settings.telegramDM = String(settings.telegramDM || defaults.settings.telegramDM);
    if (Object.prototype.hasOwnProperty.call(settings, "adminPassword")) {
      delete settings.adminPassword;
    }
    settings.backupNoticeEnabled = toBoolean(settings.backupNoticeEnabled, defaults.settings.backupNoticeEnabled);
    settings.heroImage = normalizeSettingsHeroImage(settings.heroImage);

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

  function fetchWithTimeout(url, options, timeoutMs) {
    var safeTimeout = Math.max(1000, Math.round(toNumber(timeoutMs, REMOTE_READ_TIMEOUT_MS)));
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timerId = null;
    var requestOptions = Object.assign({}, options || {});

    if (controller) {
      requestOptions.signal = controller.signal;
      timerId = setTimeout(function () {
        controller.abort();
      }, safeTimeout);
    }

    return fetch(url, requestOptions)
      .catch(function (error) {
        if (error && error.name === "AbortError") {
          throw new Error("NETWORK_TIMEOUT");
        }
        throw error;
      })
      .finally(function () {
        if (timerId) {
          clearTimeout(timerId);
        }
      });
  }

  function parseHttpStatusFromError(error) {
    var message = String(error && error.message || "");
    var match = message.match(/HTTP\s+(\d{3})/);
    if (!match) {
      return 0;
    }
    return Math.round(Number(match[1]) || 0);
  }

  function shouldThrowCommitError(error) {
    var message = String(error && error.message || "");
    if (!message) {
      return false;
    }

    if (message.indexOf("UNAUTHORIZED") >= 0) {
      return true;
    }

    var status = parseHttpStatusFromError(error);
    if (status === 401 || status === 403 || status === 413) {
      return true;
    }

    if (status >= 400 && status < 500 && status !== 429) {
      return true;
    }

    return false;
  }

  function hasPendingUnsyncedChanges() {
    try {
      return localStorage.getItem(UNSYNCED_CHANGES_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function markPendingUnsyncedChanges() {
    try {
      localStorage.setItem(UNSYNCED_CHANGES_KEY, "1");
    } catch (error) {
      return;
    }
  }

  function clearPendingUnsyncedChanges() {
    try {
      localStorage.removeItem(UNSYNCED_CHANGES_KEY);
    } catch (error) {
      return;
    }
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

    var response = await fetchWithTimeout(API_ADMIN_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ password: safePassword })
    }, REMOTE_WRITE_TIMEOUT_MS);

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

    var response = await fetchWithTimeout(API_ADMIN_PASSWORD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Bearer " + adminToken
      },
      body: JSON.stringify({ newPassword: safePassword })
    }, REMOTE_WRITE_TIMEOUT_MS);

    if (response.status === 401) {
      clearStoredAdminToken();
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      var errorCode = "";
      try {
        var payload = await response.json();
        errorCode = String(payload && payload.error || "").trim();
      } catch (error) {
        errorCode = "";
      }

      if (errorCode) {
        throw new Error(errorCode);
      }

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
    if (remoteDataEtag) {
      headers["If-None-Match"] = remoteDataEtag;
    }

    var response = await fetchWithTimeout(API_DATA_URL, {
      method: "GET",
      cache: "no-cache",
      headers: headers
    }, REMOTE_READ_TIMEOUT_MS);

    if (response.status === 304) {
      return loadData();
    }

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    var etag = "";
    try {
      etag = String(response.headers.get("etag") || "").trim();
    } catch (error) {
      etag = "";
    }
    if (etag) {
      remoteDataEtag = etag;
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
    if (remoteDataEtag) {
      headers["If-Match"] = remoteDataEtag;
    }

    var response = await fetchWithTimeout(API_DATA_URL, {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(normalizeData(data))
    }, REMOTE_WRITE_TIMEOUT_MS);

    if (response.status === 401) {
      clearStoredAdminToken();
    }

    if (!response.ok) {
      var errorCode = "";
      try {
        var payload = await response.json();
        errorCode = String(payload && payload.error || "").trim();
      } catch (error) {
        errorCode = "";
      }

      if (errorCode) {
        throw new Error(errorCode);
      }
      throw new Error("HTTP " + response.status);
    }

    var etag = "";
    try {
      etag = String(response.headers.get("etag") || "").trim();
    } catch (error) {
      etag = "";
    }
    if (etag) {
      remoteDataEtag = etag;
    }

    var payload = await response.json();
    return normalizeData(payload);
  }

  async function tryFlushPendingUnsyncedData() {
    if (!canUseRemoteStore() || !hasPendingUnsyncedChanges()) {
      return false;
    }

    var local = loadData();
    var remote = await pushRemoteData(local);
    saveData(remote);
    clearPendingUnsyncedChanges();
    return true;
  }

  async function init() {
    loadData();

    if (!canUseRemoteStore()) {
      return loadData();
    }
    if (hasPendingUnsyncedChanges()) {
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

    syncPromise = Promise.resolve()
      .then(async function () {
        if (hasPendingUnsyncedChanges()) {
          return loadData();
        }

        var remote = await fetchRemoteData();
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

    try {
      var remote = await pushRemoteData(normalized);
      clearPendingUnsyncedChanges();
      return saveData(remote);
    } catch (error) {
      if (getStoredAdminToken()) {
        throw error;
      }
      if (shouldThrowCommitError(error)) {
        throw error;
      }
      markPendingUnsyncedChanges();
      return normalized;
    }
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
      captchaAnswer: String(reviewPayload && reviewPayload.captchaAnswer || "").trim(),
      consentAccepted: Boolean(reviewPayload && reviewPayload.consentAccepted),
      consentVersion: String(reviewPayload && reviewPayload.consentVersion || "").trim(),
      termsAccepted: Boolean(reviewPayload && reviewPayload.termsAccepted),
      termsVersion: String(reviewPayload && reviewPayload.termsVersion || "").trim()
    };

    var response = await fetchWithTimeout(API_PRODUCT_REVIEWS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    }, REVIEW_TIMEOUT_MS);

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
      captchaAnswer: String(reviewPayload && reviewPayload.captchaAnswer || "").trim(),
      consentAccepted: Boolean(reviewPayload && reviewPayload.consentAccepted),
      consentVersion: String(reviewPayload && reviewPayload.consentVersion || "").trim(),
      termsAccepted: Boolean(reviewPayload && reviewPayload.termsAccepted),
      termsVersion: String(reviewPayload && reviewPayload.termsVersion || "").trim()
    };

    var response = await fetchWithTimeout(API_HOMEPAGE_REVIEWS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    }, REVIEW_TIMEOUT_MS);

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
    var response = await fetchWithTimeout(API_REVIEW_CAPTCHA_URL + "?ts=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    }, REVIEW_TIMEOUT_MS);

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
    data.settings.heroImage = normalizeSettingsHeroImage(data.settings.heroImage);
    var saved = await commitData(data);
    return saved.settings;
  }

  function normalizeCartItem(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    var productId = String(item.productId || "").trim();
    var name = repairMojibake(String(item.name || "").trim());
    var brand = repairMojibake(String(item.brand || "").trim());
    var ml = normalizeMlValue(item.ml, 0);
    var price = Math.round(toNumber(item.price));
    var qty = Math.max(1, Math.round(toNumber(item.qty, 1)));

    if (!productId || !name || !brand || ml <= 0 || price <= 0) {
      return null;
    }

    var itemKey = String(item.itemKey || productId + "_" + getMlKey(ml));

    return {
      itemKey: itemKey,
      productId: productId,
      name: name,
      brand: brand,
      bottleType: normalizeBottleType(item.bottleType),
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
    var normalizedMl = normalizeMlValue(ml, 0);
    var products = getProducts();
    var product = products.find(function (item) {
      return item.id === productId;
    });

    if (!product) {
      return { ok: false, message: "Товар не найден." };
    }

    var volume = product.volumes.find(function (item) {
      return Math.abs(normalizeMlValue(item.ml, 0) - normalizedMl) < 0.0001;
    });

    if (!volume) {
      return { ok: false, message: "Выберите объём аромата." };
    }

    var cart = getCart();
    var itemKey = product.id + "_" + getMlKey(volume.ml);
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
        bottleType: normalizeBottleType(product.bottleType),
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
  function getBottleTypeLabel(type) {
    var safe = normalizeBottleType(type);
    if (safe === "decant") {
      return "Отливант";
    }
    if (safe === "tester") {
      return "Тестер";
    }
    return "Полноценный флакон";
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
      lines.push((index + 1) + ". " + item.name + " (" + item.brand + ", " + getBottleTypeLabel(item.bottleType) + ") - " + formatMl(item.ml) + " мл x " + item.qty + " = " + formatPrice(lineTotal));
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
    formatMl: formatMl,
    getMinPrice: getMinPrice,
    getBrands: getBrands,
    getGenderLabel: getGenderLabel,
    getBottleTypeLabel: getBottleTypeLabel,
    buildTelegramOrderMessage: buildTelegramOrderMessage,
    buildTelegramUrl: buildTelegramUrl
  };
})();

