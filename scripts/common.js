(function () {
  "use strict";

  var DATA_KEY = "veligodsky_data_v1";
  var CART_KEY = "veligodsky_cart_v1";
  var SAMPLE_KEY = "veligodsky_sample_v1";
  var API_DATA_URL = "/api/store-data";
  var numberFormatter = new Intl.NumberFormat("ru-RU");
  var dataCache = null;
  var syncPromise = null;

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
    adminPassword: "admin123",
    storeName: "VELIGODSKY.PARFUMS"
  };

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
      topWeek: Boolean(product.topWeek),
      topMonth: Boolean(product.topMonth)
    };
  }

  function getDefaultData() {
    return {
      settings: Object.assign({}, defaultSettings),
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
    settings.adminPassword = String(settings.adminPassword || defaults.settings.adminPassword);

    var products = Array.isArray(safe.products)
      ? safe.products.map(normalizeProduct).filter(Boolean)
      : defaults.products;

    return {
      settings: settings,
      products: products
    };
  }

  function saveData(data) {
    var normalized = normalizeData(data);
    localStorage.setItem(DATA_KEY, JSON.stringify(normalized));
    dataCache = normalized;
    return normalized;
  }

  function readLocalData() {
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (!raw) {
        return saveData(getDefaultData());
      }
      return saveData(JSON.parse(raw));
    } catch (error) {
      return saveData(getDefaultData());
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

  async function fetchRemoteData() {
    var response = await fetch(API_DATA_URL + "?ts=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    var payload = await response.json();
    return normalizeData(payload);
  }

  async function pushRemoteData(data) {
    var response = await fetch(API_DATA_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(normalizeData(data))
    });

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

  function getSettings() {
    return loadData().settings;
  }

  async function updateSettings(patch) {
    var data = loadData();
    data.settings = Object.assign({}, data.settings, patch || {});
    data.settings.freeShippingThreshold = Math.max(0, Math.round(toNumber(data.settings.freeShippingThreshold, 8000)));
    data.settings.adminPassword = String(data.settings.adminPassword || "admin123");
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
    localStorage.setItem(CART_KEY, JSON.stringify(safeCart));
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
    return localStorage.getItem(SAMPLE_KEY) || "";
  }

  function saveSampleChoice(value) {
    localStorage.setItem(SAMPLE_KEY, String(value || "").trim());
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
    init: init,
    syncFromServer: syncFromServer,
    uid: uid,
    getDefaultData: getDefaultData,
    loadData: loadData,
    saveData: saveData,
    getProducts: getProducts,
    saveProducts: saveProducts,
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
