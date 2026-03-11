(function () {
  "use strict";

  var store = window.VeligodskyStore;
  if (!store) {
    return;
  }

  var state = {
    products: [],
    filteredProducts: [],
    visibleCount: 8,
    activeTab: "week"
  };

  var elements = {};
  var revealObserver = null;
  var toastTimer = null;
  var syncIntervalId = null;

  document.addEventListener("DOMContentLoaded", function () {
    init().catch(function () {
      state.products = store.getProducts();
      bindEvents();
      syncSettingsToUI();
      renderBrandFilter();
      renderTopSections();
      applyFilters(true);
      renderCart();
      setCurrentYear();
      initRevealObserver();
      observeRevealElements();
      startAutoSync();
      showToast("Работаем офлайн: данные не синхронизированы с сервером.", true);
    });
  });

  async function init() {
    cacheElements();
    if (typeof store.init === "function") {
      await store.init();
    }
    state.products = store.getProducts();

    bindEvents();
    syncSettingsToUI();
    renderBrandFilter();
    renderTopSections();
    applyFilters(true);
    renderCart();
    setCurrentYear();
    initRevealObserver();
    observeRevealElements();
    startAutoSync();
  }

  function cacheElements() {
    elements.body = document.body;
    elements.menuToggle = document.getElementById("menuToggle");
    elements.nav = document.getElementById("siteNav");
    elements.cartTrigger = document.getElementById("cartTrigger");
    elements.cartCount = document.getElementById("cartCount");
    elements.cartSidebar = document.getElementById("cartSidebar");
    elements.cartOverlay = document.getElementById("cartOverlay");
    elements.cartCloseBtn = document.getElementById("cartCloseBtn");
    elements.cartItems = document.getElementById("cartItems");
    elements.cartTotal = document.getElementById("cartTotal");
    elements.shippingStatus = document.getElementById("shippingStatus");
    elements.sampleInput = document.getElementById("sampleInput");
    elements.checkoutBtn = document.getElementById("checkoutBtn");
    elements.toast = document.getElementById("toast");

    elements.searchInput = document.getElementById("searchInput");
    elements.genderFilter = document.getElementById("genderFilter");
    elements.brandFilter = document.getElementById("brandFilter");
    elements.priceMin = document.getElementById("priceMin");
    elements.priceMax = document.getElementById("priceMax");
    elements.resetFiltersBtn = document.getElementById("resetFiltersBtn");
    elements.catalogGrid = document.getElementById("catalogGrid");
    elements.showMoreBtn = document.getElementById("showMoreBtn");

    elements.tabButtons = Array.prototype.slice.call(document.querySelectorAll(".tab-btn"));
    elements.weekPanel = document.getElementById("topWeekPanel");
    elements.monthPanel = document.getElementById("topMonthPanel");
    elements.weekSlider = document.getElementById("topWeekSlider");
    elements.monthSlider = document.getElementById("topMonthSlider");

    elements.headerTelegramBtn = document.getElementById("headerTelegramBtn");
    elements.consultTelegramBtn = document.getElementById("consultTelegramBtn");
    elements.footerChannelLink = document.getElementById("footerChannelLink");
    elements.footerDmLink = document.getElementById("footerDmLink");
    elements.freeShippingInline = document.getElementById("freeShippingInline");
    elements.yearNow = document.getElementById("yearNow");
  }

  function bindEvents() {
    if (elements.menuToggle) {
      elements.menuToggle.addEventListener("click", toggleMenu);
    }

    if (elements.nav) {
      elements.nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
          closeMenu();
        }
      });
    }

    if (elements.cartTrigger) {
      elements.cartTrigger.addEventListener("click", openCart);
    }

    if (elements.cartOverlay) {
      elements.cartOverlay.addEventListener("click", closeCart);
    }

    if (elements.cartCloseBtn) {
      elements.cartCloseBtn.addEventListener("click", closeCart);
    }

    elements.tabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var tab = button.dataset.tab;
        switchTopTab(tab);
      });
    });

    [elements.searchInput, elements.genderFilter, elements.brandFilter, elements.priceMin, elements.priceMax].forEach(function (field) {
      if (!field) {
        return;
      }
      field.addEventListener("input", function () {
        applyFilters(true);
      });
      field.addEventListener("change", function () {
        applyFilters(true);
      });
    });

    if (elements.resetFiltersBtn) {
      elements.resetFiltersBtn.addEventListener("click", resetFilters);
    }

    if (elements.showMoreBtn) {
      elements.showMoreBtn.addEventListener("click", function () {
        state.visibleCount += 4;
        renderCatalog();
      });
    }

    if (elements.sampleInput) {
      elements.sampleInput.value = store.getSampleChoice();
      elements.sampleInput.addEventListener("input", function () {
        store.saveSampleChoice(elements.sampleInput.value);
      });
    }

    if (elements.checkoutBtn) {
      elements.checkoutBtn.addEventListener("click", checkoutOrder);
    }

    document.addEventListener("click", handleDocumentClick);

    window.addEventListener("focus", function () {
      refreshFromServer(false);
    });
  }

  async function refreshFromServer(showErrorToast) {
    if (typeof store.syncFromServer === "function") {
      try {
        await store.syncFromServer();
      } catch (error) {
        if (showErrorToast) {
          showToast("Не удалось обновить данные с сервера.", true);
        }
      }
    }

    state.products = store.getProducts();
    syncSettingsToUI();
    renderBrandFilter();
    renderTopSections();
    applyFilters(false);
    renderCart();
  }

  function startAutoSync() {
    if (typeof store.syncFromServer !== "function") {
      return;
    }

    if (syncIntervalId) {
      clearInterval(syncIntervalId);
    }

    syncIntervalId = setInterval(function () {
      refreshFromServer(false);
    }, 30000);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        refreshFromServer(false);
      }
    });
  }

  function syncSettingsToUI() {
    var settings = store.getSettings();

    if (elements.headerTelegramBtn) {
      elements.headerTelegramBtn.href = settings.telegramDM;
    }
    if (elements.consultTelegramBtn) {
      elements.consultTelegramBtn.href = settings.telegramDM;
    }
    if (elements.footerChannelLink) {
      elements.footerChannelLink.href = settings.telegramChannel;
    }
    if (elements.footerDmLink) {
      elements.footerDmLink.href = settings.telegramDM;
    }
    if (elements.freeShippingInline) {
      elements.freeShippingInline.textContent = store.formatPrice(settings.freeShippingThreshold);
    }
  }

  function setCurrentYear() {
    if (elements.yearNow) {
      elements.yearNow.textContent = String(new Date().getFullYear());
    }
  }

  function toggleMenu() {
    var isOpen = elements.body.classList.toggle("menu-open");
    elements.menuToggle.setAttribute("aria-expanded", String(isOpen));
  }

  function closeMenu() {
    elements.body.classList.remove("menu-open");
    if (elements.menuToggle) {
      elements.menuToggle.setAttribute("aria-expanded", "false");
    }
  }

  function openCart() {
    elements.cartSidebar.classList.add("is-open");
    elements.cartOverlay.classList.add("is-open");
    elements.body.style.overflow = "hidden";
  }

  function closeCart() {
    elements.cartSidebar.classList.remove("is-open");
    elements.cartOverlay.classList.remove("is-open");
    elements.body.style.overflow = "";
  }

  function renderBrandFilter() {
    if (!elements.brandFilter) {
      return;
    }

    var selected = elements.brandFilter.value || "all";
    var brands = store.getBrands(state.products);

    var options = ["<option value=\"all\">Все бренды</option>"];
    brands.forEach(function (brand) {
      options.push("<option value=\"" + escapeHtml(brand) + "\">" + escapeHtml(brand) + "</option>");
    });

    elements.brandFilter.innerHTML = options.join("");

    var hasSelected = brands.some(function (brand) {
      return brand === selected;
    });

    elements.brandFilter.value = hasSelected ? selected : "all";
  }

  function renderTopSections() {
    var weekProducts = state.products.filter(function (product) {
      return product.topWeek;
    });
    var monthProducts = state.products.filter(function (product) {
      return product.topMonth;
    });

    renderTopSlider(elements.weekSlider, weekProducts, "week");
    renderTopSlider(elements.monthSlider, monthProducts, "month");

    switchTopTab(state.activeTab);
  }

  function renderTopSlider(container, products, mode) {
    if (!container) {
      return;
    }

    if (!products.length) {
      container.innerHTML = "<div class=\"empty-state\">Список топ-ароматов пока пуст. Добавьте отметки в админ-панели.</div>";
      return;
    }

    container.innerHTML = products.map(function (product) {
      return buildProductCard(product, {
        showTopBadge: true,
        compact: true,
        mode: mode
      });
    }).join("");

    observeRevealElements();
  }

  function switchTopTab(tab) {
    state.activeTab = tab === "month" ? "month" : "week";

    elements.tabButtons.forEach(function (button) {
      var active = button.dataset.tab === state.activeTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });

    if (elements.weekPanel) {
      elements.weekPanel.classList.toggle("is-active", state.activeTab === "week");
    }
    if (elements.monthPanel) {
      elements.monthPanel.classList.toggle("is-active", state.activeTab === "month");
    }
  }

  function applyFilters(resetVisibleCount) {
    if (resetVisibleCount) {
      state.visibleCount = 8;
    }

    var query = String(elements.searchInput.value || "").trim().toLowerCase();
    var gender = elements.genderFilter.value || "all";
    var brand = elements.brandFilter.value || "all";
    var minPrice = Number(elements.priceMin.value);
    var maxPrice = Number(elements.priceMax.value);

    var hasMin = Number.isFinite(minPrice) && minPrice > 0;
    var hasMax = Number.isFinite(maxPrice) && maxPrice > 0;

    state.filteredProducts = state.products.filter(function (product) {
      var queryMatch = !query
        || product.name.toLowerCase().indexOf(query) >= 0
        || product.brand.toLowerCase().indexOf(query) >= 0;

      var genderMatch = gender === "all" || product.gender === gender;
      var brandMatch = brand === "all" || product.brand === brand;

      var priceMatch = product.volumes.some(function (volume) {
        if (hasMin && volume.price < minPrice) {
          return false;
        }
        if (hasMax && volume.price > maxPrice) {
          return false;
        }
        return true;
      });

      return queryMatch && genderMatch && brandMatch && priceMatch;
    });

    renderCatalog();
  }

  function resetFilters() {
    elements.searchInput.value = "";
    elements.genderFilter.value = "all";
    elements.brandFilter.value = "all";
    elements.priceMin.value = "";
    elements.priceMax.value = "";
    applyFilters(true);
  }

  function renderCatalog() {
    if (!elements.catalogGrid) {
      return;
    }

    if (!state.filteredProducts.length) {
      elements.catalogGrid.innerHTML = "<div class=\"empty-state\">По заданным фильтрам ароматы не найдены.</div>";
      elements.showMoreBtn.classList.add("hidden");
      return;
    }

    var items = state.filteredProducts.slice(0, state.visibleCount);

    elements.catalogGrid.innerHTML = items.map(function (product) {
      return buildProductCard(product, {
        showTopBadge: product.topWeek || product.topMonth,
        compact: false,
        mode: "catalog"
      });
    }).join("");

    var hasMore = state.visibleCount < state.filteredProducts.length;
    elements.showMoreBtn.classList.toggle("hidden", !hasMore);
    observeRevealElements();
  }

  function buildProductCard(product, config) {
    var minPrice = store.getMinPrice(product);
    var volumeOptions = product.volumes.map(function (volume) {
      return "<option value=\"" + volume.ml + "\">" + volume.ml + " ml - " + store.formatPrice(volume.price) + "</option>";
    }).join("");

    var topLabel = "";
    if (config.showTopBadge) {
      topLabel = "<span class=\"top-badge\">🔥 ТОП</span>";
    }

    var cardClasses = "product-card reveal";
    if (config.compact) {
      cardClasses += " product-card--compact";
    }

    return ""
      + "<article class=\"" + cardClasses + "\" data-product-id=\"" + escapeHtml(product.id) + "\" data-mode=\"" + escapeHtml(config.mode) + "\">"
      + "  <div class=\"product-image-wrap\">"
      + "    <img src=\"" + escapeHtml(product.image) + "\" alt=\"" + escapeHtml(product.name) + "\">"
      + topLabel
      + "  </div>"
      + "  <div class=\"product-content\">"
      + "    <div>"
      + "      <h3 class=\"product-name\">" + escapeHtml(product.name) + "</h3>"
      + "      <p class=\"product-brand\">" + escapeHtml(product.brand) + " • " + store.getGenderLabel(product.gender) + "</p>"
      + "      <p class=\"product-description\">" + escapeHtml(product.description || "Оригинальный аромат из коллекции магазина.") + "</p>"
      + "    </div>"
      + "    <div class=\"volume-line\">"
      + "      <span>Цена от:</span>"
      + "      <strong>" + store.formatPrice(minPrice) + "</strong>"
      + "    </div>"
      + "    <label class=\"field\">"
      + "      <span>Объём</span>"
      + "      <select class=\"volume-select\">"
      + volumeOptions
      + "      </select>"
      + "    </label>"
      + "    <button class=\"btn btn-primary add-to-cart-btn\" type=\"button\">В корзину</button>"
      + "  </div>"
      + "</article>";
  }

  function handleDocumentClick(event) {
    var addBtn = event.target.closest(".add-to-cart-btn");
    if (addBtn) {
      var card = addBtn.closest("[data-product-id]");
      if (!card) {
        return;
      }
      var productId = card.dataset.productId;
      var select = card.querySelector(".volume-select");
      var selectedMl = select ? Number(select.value) : NaN;
      var result = store.addToCart(productId, selectedMl, 1);

      if (!result.ok) {
        showToast(result.message || "Не удалось добавить товар.", true);
        return;
      }

      renderCart();
      showToast("Товар добавлен в корзину");
      return;
    }

    var cartActionButton = event.target.closest("[data-cart-action]");
    if (cartActionButton) {
      var action = cartActionButton.dataset.cartAction;
      var itemKey = cartActionButton.dataset.itemKey;
      processCartAction(action, itemKey);
      return;
    }
  }

  function processCartAction(action, itemKey) {
    var cart = store.getCart();
    var item = cart.find(function (entry) {
      return entry.itemKey === itemKey;
    });

    if (!item) {
      return;
    }

    if (action === "inc") {
      store.setCartItemQty(itemKey, item.qty + 1);
    }

    if (action === "dec") {
      if (item.qty <= 1) {
        store.removeCartItem(itemKey);
      } else {
        store.setCartItemQty(itemKey, item.qty - 1);
      }
    }

    if (action === "remove") {
      store.removeCartItem(itemKey);
    }

    renderCart();
  }

  function renderCart() {
    var cart = store.getCart();
    var settings = store.getSettings();
    var total = cart.reduce(function (sum, item) {
      return sum + item.price * item.qty;
    }, 0);

    if (!cart.length) {
      elements.cartItems.innerHTML = "<div class=\"empty-state\">Корзина пока пуста.</div>";
    } else {
      elements.cartItems.innerHTML = cart.map(function (item) {
        var lineTotal = item.price * item.qty;
        return ""
          + "<article class=\"cart-item\">"
          + "  <img src=\"" + escapeHtml(item.image) + "\" alt=\"" + escapeHtml(item.name) + "\">"
          + "  <div class=\"cart-item-main\">"
          + "    <strong>" + escapeHtml(item.name) + "</strong>"
          + "    <span>" + escapeHtml(item.brand) + " • " + item.ml + " ml</span>"
          + "    <span>" + store.formatPrice(lineTotal) + "</span>"
          + "    <div class=\"cart-item-actions\">"
          + "      <div class=\"qty-controls\">"
          + "        <button type=\"button\" data-cart-action=\"dec\" data-item-key=\"" + escapeHtml(item.itemKey) + "\">−</button>"
          + "        <span>" + item.qty + "</span>"
          + "        <button type=\"button\" data-cart-action=\"inc\" data-item-key=\"" + escapeHtml(item.itemKey) + "\">+</button>"
          + "      </div>"
          + "      <button class=\"remove-btn\" type=\"button\" data-cart-action=\"remove\" data-item-key=\"" + escapeHtml(item.itemKey) + "\">Удалить</button>"
          + "    </div>"
          + "  </div>"
          + "</article>";
      }).join("");
    }

    elements.cartCount.textContent = String(store.getCartCount());
    elements.cartTotal.textContent = store.formatPrice(total);

    if (total >= settings.freeShippingThreshold) {
      elements.shippingStatus.textContent = "✅ Бесплатная доставка!";
      elements.shippingStatus.classList.add("success");
    } else {
      var left = settings.freeShippingThreshold - total;
      elements.shippingStatus.textContent = "До бесплатной доставки осталось " + store.formatPrice(left);
      elements.shippingStatus.classList.remove("success");
    }
  }

  function checkoutOrder() {
    var cart = store.getCart();
    if (!cart.length) {
      showToast("Добавьте хотя бы один товар в корзину.", true);
      return;
    }

    var settings = store.getSettings();
    var sample = elements.sampleInput ? elements.sampleInput.value : "";
    var message = store.buildTelegramOrderMessage(cart, sample, settings);
    var tgUrl = store.buildTelegramUrl(settings.telegramDM, message);

    window.location.href = tgUrl;
  }

  function initRevealObserver() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(function (node) {
        node.classList.add("is-visible");
      });
      return;
    }

    revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px"
    });
  }

  function observeRevealElements() {
    if (!revealObserver) {
      return;
    }

    document.querySelectorAll(".reveal:not(.is-visible)").forEach(function (item) {
      revealObserver.observe(item);
    });
  }

  function showToast(message, isError) {
    if (!elements.toast) {
      return;
    }

    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    elements.toast.classList.toggle("error", Boolean(isError));

    toastTimer = setTimeout(function () {
      elements.toast.classList.remove("show", "error");
    }, 2200);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
