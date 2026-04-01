(function () {
  "use strict";

  var store = window.VeligodskyStore;
  if (!store) {
    return;
  }

  var MSK_BACKUP_NOTICE_TIMEZONE = "Europe/Moscow";
  var MSK_BACKUP_NOTICE_START_MINUTE = 15;
  var MSK_BACKUP_NOTICE_END_MINUTE = 5 * 60;

  var state = {
    products: [],
    homepageReviews: [],
    filteredProducts: [],
    visibleCount: 8,
    activeTab: "week"
  };

  var elements = {};
  var revealObserver = null;
  var toastTimer = null;
  var syncIntervalId = null;
  var backupNoticeTimerId = null;
  var moscowTimeFormatter = null;

  document.addEventListener("DOMContentLoaded", function () {
    init().catch(function () {
      state.products = store.getProducts();
      state.homepageReviews = typeof store.getHomepageReviews === "function" ? store.getHomepageReviews() : [];
      bindEvents();
      syncSettingsToUI();
      renderHomepageReviews();
      renderBrandFilter();
      renderTopSections();
      applyFilters(true);
      renderCart();
      setCurrentYear();
      initRevealObserver();
      observeRevealElements();
      startAutoSync();
      startBackupNoticeClock();
      showToast("Р Р°Р±РѕС‚Р°РµРј РѕС„Р»Р°Р№РЅ: РґР°РЅРЅС‹Рµ РЅРµ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅС‹ СЃ СЃРµСЂРІРµСЂРѕРј.", true);
    });
  });

  async function init() {
    cacheElements();
    if (typeof store.init === "function") {
      await store.init();
    }
    state.products = store.getProducts();
    state.homepageReviews = typeof store.getHomepageReviews === "function" ? store.getHomepageReviews() : [];

    bindEvents();
    syncSettingsToUI();
    renderHomepageReviews();
    renderBrandFilter();
    renderTopSections();
    applyFilters(true);
    renderCart();
    setCurrentYear();
    initRevealObserver();
    observeRevealElements();
    startAutoSync();
    startBackupNoticeClock();
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
    elements.homepageReviewsTrack = document.getElementById("homepageReviewsTrack");
    elements.homepageReviewsPrev = document.getElementById("homepageReviewsPrev");
    elements.homepageReviewsNext = document.getElementById("homepageReviewsNext");

    elements.headerTelegramBtn = document.getElementById("headerTelegramBtn");
    elements.consultTelegramBtn = document.getElementById("consultTelegramBtn");
    elements.footerChannelLink = document.getElementById("footerChannelLink");
    elements.footerDmLink = document.getElementById("footerDmLink");
    elements.freeShippingInline = document.getElementById("freeShippingInline");
    elements.backupNotice = document.getElementById("backupNotice");
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

    if (elements.homepageReviewsPrev) {
      elements.homepageReviewsPrev.addEventListener("click", function () {
        scrollHomepageReviews(-1);
      });
    }

    if (elements.homepageReviewsNext) {
      elements.homepageReviewsNext.addEventListener("click", function () {
        scrollHomepageReviews(1);
      });
    }

    if (elements.homepageReviewsTrack) {
      elements.homepageReviewsTrack.addEventListener("scroll", updateHomepageReviewsNavState);
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("submit", handleDocumentSubmit);

    window.addEventListener("focus", function () {
      refreshFromServer(false);
    });

    window.addEventListener("resize", updateHomepageReviewsNavState);
  }

  async function refreshFromServer(showErrorToast) {
    if (typeof store.syncFromServer === "function") {
      try {
        await store.syncFromServer();
      } catch (error) {
        if (showErrorToast) {
          showToast("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РґР°РЅРЅС‹Рµ СЃ СЃРµСЂРІРµСЂР°.", true);
        }
      }
    }

    state.products = store.getProducts();
    state.homepageReviews = typeof store.getHomepageReviews === "function" ? store.getHomepageReviews() : [];
    syncSettingsToUI();
    renderHomepageReviews();
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

    applyBackupNoticeVisibility(settings);
  }

  function getMoscowTimeFormatter() {
    if (!moscowTimeFormatter) {
      moscowTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
        timeZone: MSK_BACKUP_NOTICE_TIMEZONE,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    return moscowTimeFormatter;
  }

  function getMoscowMinutesOfDay(date) {
    try {
      var parts = getMoscowTimeFormatter().formatToParts(date || new Date());
      var hourPart = parts.find(function (part) {
        return part.type === "hour";
      });
      var minutePart = parts.find(function (part) {
        return part.type === "minute";
      });

      var hours = Number(hourPart && hourPart.value);
      var minutes = Number(minutePart && minutePart.value);

      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return 0;
      }

      return (hours * 60) + minutes;
    } catch (error) {
      var localDate = date || new Date();
      return (localDate.getHours() * 60) + localDate.getMinutes();
    }
  }

  function isBackupNoticeScheduleActive(date) {
    var minutesOfDay = getMoscowMinutesOfDay(date);
    return minutesOfDay >= MSK_BACKUP_NOTICE_START_MINUTE && minutesOfDay < MSK_BACKUP_NOTICE_END_MINUTE;
  }

  function applyBackupNoticeVisibility(settings) {
    if (!elements.backupNotice) {
      return;
    }

    var isEnabled = Boolean(settings && settings.backupNoticeEnabled);
    var isVisible = isEnabled && isBackupNoticeScheduleActive(new Date());
    elements.backupNotice.classList.toggle("is-active", isVisible);
    elements.backupNotice.setAttribute("aria-hidden", isVisible ? "false" : "true");
  }

  function startBackupNoticeClock() {
    if (backupNoticeTimerId) {
      clearInterval(backupNoticeTimerId);
    }

    backupNoticeTimerId = setInterval(function () {
      applyBackupNoticeVisibility(store.getSettings());
    }, 30000);
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

    var options = ["<option value=\"all\">Р’СЃРµ Р±СЂРµРЅРґС‹</option>"];
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
      container.innerHTML = "<div class=\"empty-state\">РЎРїРёСЃРѕРє С‚РѕРї-Р°СЂРѕРјР°С‚РѕРІ РїРѕРєР° РїСѓСЃС‚. Р”РѕР±Р°РІСЊС‚Рµ РѕС‚РјРµС‚РєРё РІ Р°РґРјРёРЅ-РїР°РЅРµР»Рё.</div>";
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

  function buildStars(value) {
    var safeRating = Math.max(1, Math.min(5, Math.round(Number(value) || 5)));
    return "в…".repeat(safeRating) + "в†".repeat(5 - safeRating);
  }

  function formatReviewDate(value) {
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function renderHomepageReviews() {
    if (!elements.homepageReviewsTrack) {
      return;
    }

    var reviews = Array.isArray(state.homepageReviews) ? state.homepageReviews : [];
    if (!reviews.length) {
      elements.homepageReviewsTrack.innerHTML = "<div class=\"empty-state\">РџРѕРєР° РѕС‚Р·С‹РІРѕРІ РЅРµС‚. РЎС‚Р°РЅСЊС‚Рµ РїРµСЂРІС‹Рј РїРѕРєСѓРїР°С‚РµР»РµРј, РєС‚Рѕ РїРѕРґРµР»РёС‚СЃСЏ РІРїРµС‡Р°С‚Р»РµРЅРёРµРј.</div>";
      updateHomepageReviewsNavState();
      return;
    }

    elements.homepageReviewsTrack.innerHTML = reviews.map(function (review) {
      var authorLine = review.city
        ? escapeHtml(review.author) + ", " + escapeHtml(review.city)
        : escapeHtml(review.author);
      var dateLabel = formatReviewDate(review.createdAt);
      return ""
        + "<article class=\"review-card\">"
        + "  <div class=\"review-head\">"
        + "    <strong>" + authorLine + "</strong>"
        + "    <span>" + buildStars(review.rating) + "</span>"
        + "  </div>"
        + "  <p>" + escapeHtml(review.text) + "</p>"
        + "  <small class=\"review-date\">" + escapeHtml(dateLabel) + "</small>"
        + "</article>";
    }).join("");

    updateHomepageReviewsNavState();
  }

  function scrollHomepageReviews(direction) {
    if (!elements.homepageReviewsTrack) {
      return;
    }

    var step = Math.max(220, Math.round(elements.homepageReviewsTrack.clientWidth * 0.9));
    elements.homepageReviewsTrack.scrollBy({
      left: step * (direction < 0 ? -1 : 1),
      behavior: "smooth"
    });
  }

  function updateHomepageReviewsNavState() {
    if (!elements.homepageReviewsTrack || !elements.homepageReviewsPrev || !elements.homepageReviewsNext) {
      return;
    }

    var track = elements.homepageReviewsTrack;
    var maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    var current = Math.max(0, Math.round(track.scrollLeft));
    var canGoPrev = current > 4;
    var canGoNext = current < (maxScrollLeft - 4);

    elements.homepageReviewsPrev.disabled = !canGoPrev;
    elements.homepageReviewsNext.disabled = !canGoNext;
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
      elements.catalogGrid.innerHTML = "<div class=\"empty-state\">РџРѕ Р·Р°РґР°РЅРЅС‹Рј С„РёР»СЊС‚СЂР°Рј Р°СЂРѕРјР°С‚С‹ РЅРµ РЅР°Р№РґРµРЅС‹.</div>";
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
    var reviewsHtml = config.compact ? "" : buildProductReviewsBlock(product);

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
      + reviewsHtml
      + "  </div>"
      + "</article>";
  }

  function buildProductReviewsBlock(product) {
    var reviews = Array.isArray(product.reviews) ? product.reviews : [];
    var reviewsHtml = "";

    if (!reviews.length) {
      reviewsHtml = "<p class=\"product-review-empty\">Пока нет отзывов по этому аромату.</p>";
    } else {
      reviewsHtml = reviews.map(function (review) {
        var cityPart = review.city ? (", " + escapeHtml(review.city)) : "";
        var dateLabel = formatReviewDate(review.createdAt);
        return ""
          + "<article class=\"product-review-item\">"
          + "  <div class=\"product-review-meta\">"
          + "    <strong>" + escapeHtml(review.author) + cityPart + "</strong>"
          + "    <span class=\"product-review-stars\">" + buildStars(review.rating) + "</span>"
          + "  </div>"
          + "  <p class=\"product-review-text\">" + escapeHtml(review.text) + "</p>"
          + "  <small class=\"product-review-meta\">" + escapeHtml(dateLabel) + "</small>"
          + "</article>";
      }).join("");
    }

    return ""
      + "<section class=\"product-reviews\">"
      + "  <div class=\"product-reviews-head\">"
      + "    <strong>Отзывы покупателей</strong>"
      + "    <span>Всего: " + reviews.length + "</span>"
      + "  </div>"
      + "  <div class=\"product-reviews-list\">"
      + reviewsHtml
      + "  </div>"
      + "  <form class=\"product-review-form\" data-product-review-form data-product-id=\"" + escapeHtml(product.id) + "\">"
      + "    <div class=\"product-review-form-row\">"
      + "      <input type=\"text\" name=\"author\" maxlength=\"80\" placeholder=\"Ваше имя\" required>"
      + "      <select name=\"rating\" aria-label=\"Оценка\">"
      + "        <option value=\"5\">5 ★</option>"
      + "        <option value=\"4\">4 ★</option>"
      + "        <option value=\"3\">3 ★</option>"
      + "        <option value=\"2\">2 ★</option>"
      + "        <option value=\"1\">1 ★</option>"
      + "      </select>"
      + "    </div>"
      + "    <input type=\"text\" name=\"city\" maxlength=\"80\" placeholder=\"Город (необязательно)\">"
      + "    <textarea name=\"text\" maxlength=\"500\" placeholder=\"Напишите ваш отзыв\" required></textarea>"
      + "    <button class=\"btn btn-outline product-review-submit\" type=\"submit\">Оставить отзыв</button>"
      + "  </form>"
      + "</section>";
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
        showToast(result.message || "РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ С‚РѕРІР°СЂ.", true);
        return;
      }

      renderCart();
      trackEvent("add_to_cart", {
        product_id: productId,
        volume_ml: selectedMl
      });
      showToast("РўРѕРІР°СЂ РґРѕР±Р°РІР»РµРЅ РІ РєРѕСЂР·РёРЅСѓ");
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

  function handleDocumentSubmit(event) {
    var reviewForm = event.target.closest("[data-product-review-form]");
    if (!reviewForm) {
      return;
    }

    event.preventDefault();
    submitProductReviewForm(reviewForm);
  }

  async function submitProductReviewForm(form) {
    if (!form) {
      return;
    }

    if (typeof store.submitProductReview !== "function") {
      showToast("Отправка отзывов временно недоступна.", true);
      return;
    }

    var productId = String(form.getAttribute("data-product-id") || "").trim();
    var formData = new FormData(form);
    var author = String(formData.get("author") || "").trim();
    var city = String(formData.get("city") || "").trim();
    var text = String(formData.get("text") || "").trim();
    var rating = Math.max(1, Math.min(5, Math.round(Number(formData.get("rating")) || 5)));

    if (!author || author.length < 2) {
      showToast("Укажите имя для отзыва.", true);
      return;
    }

    if (!text || text.length < 6) {
      showToast("Текст отзыва должен быть не короче 6 символов.", true);
      return;
    }

    var submitButton = form.querySelector("[type=\"submit\"]");
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      await store.submitProductReview(productId, {
        author: author,
        city: city,
        text: text,
        rating: rating
      });

      state.products = store.getProducts();
      renderTopSections();
      applyFilters(false);

      form.reset();
      var ratingSelect = form.querySelector("select[name=\"rating\"]");
      if (ratingSelect) {
        ratingSelect.value = "5";
      }

      showToast("Спасибо! Отзыв опубликован.");
      trackEvent("product_review_submit", {
        product_id: productId,
        rating: rating
      });
    } catch (error) {
      var message = String(error && error.message || "");
      if (message.indexOf("REVIEW_RATE_LIMIT:") === 0) {
        var waitSeconds = Math.max(0, Math.round(Number(message.split(":")[1]) || 0));
        if (waitSeconds > 0) {
          showToast("Слишком часто отправляете отзывы. Подождите " + waitSeconds + " сек.", true);
        } else {
          showToast("Слишком часто отправляете отзывы. Попробуйте чуть позже.", true);
        }
        return;
      }

      if (message.indexOf("INVALID_REVIEW_PAYLOAD:") === 0) {
        showToast("Проверьте имя, оценку и текст отзыва.", true);
        return;
      }

      if (message.indexOf("PRODUCT_NOT_FOUND") >= 0) {
        showToast("Товар не найден. Обновите страницу.", true);
        return;
      }

      showToast("Не удалось отправить отзыв. Попробуйте позже.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
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
      elements.cartItems.innerHTML = "<div class=\"empty-state\">РљРѕСЂР·РёРЅР° РїРѕРєР° РїСѓСЃС‚Р°.</div>";
    } else {
      elements.cartItems.innerHTML = cart.map(function (item) {
        var lineTotal = item.price * item.qty;
        return ""
          + "<article class=\"cart-item\">"
          + "  <img src=\"" + escapeHtml(item.image) + "\" alt=\"" + escapeHtml(item.name) + "\">"
          + "  <div class=\"cart-item-main\">"
          + "    <strong>" + escapeHtml(item.name) + "</strong>"
          + "    <span>" + escapeHtml(item.brand) + " вЂў " + item.ml + " ml</span>"
          + "    <span>" + store.formatPrice(lineTotal) + "</span>"
          + "    <div class=\"cart-item-actions\">"
          + "      <div class=\"qty-controls\">"
          + "        <button type=\"button\" data-cart-action=\"dec\" data-item-key=\"" + escapeHtml(item.itemKey) + "\">в€’</button>"
          + "        <span>" + item.qty + "</span>"
          + "        <button type=\"button\" data-cart-action=\"inc\" data-item-key=\"" + escapeHtml(item.itemKey) + "\">+</button>"
          + "      </div>"
          + "      <button class=\"remove-btn\" type=\"button\" data-cart-action=\"remove\" data-item-key=\"" + escapeHtml(item.itemKey) + "\">РЈРґР°Р»РёС‚СЊ</button>"
          + "    </div>"
          + "  </div>"
          + "</article>";
      }).join("");
    }

    elements.cartCount.textContent = String(store.getCartCount());
    elements.cartTotal.textContent = store.formatPrice(total);

    if (total >= settings.freeShippingThreshold) {
      elements.shippingStatus.textContent = "вњ… Р‘РµСЃРїР»Р°С‚РЅР°СЏ РґРѕСЃС‚Р°РІРєР°!";
      elements.shippingStatus.classList.add("success");
    } else {
      var left = settings.freeShippingThreshold - total;
      elements.shippingStatus.textContent = "Р”Рѕ Р±РµСЃРїР»Р°С‚РЅРѕР№ РґРѕСЃС‚Р°РІРєРё РѕСЃС‚Р°Р»РѕСЃСЊ " + store.formatPrice(left);
      elements.shippingStatus.classList.remove("success");
    }
  }

  function checkoutOrder() {
    var cart = store.getCart();
    if (!cart.length) {
      showToast("Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С‚РѕРІР°СЂ РІ РєРѕСЂР·РёРЅСѓ.", true);
      return;
    }

    var settings = store.getSettings();
    var sample = elements.sampleInput ? elements.sampleInput.value : "";
    var message = store.buildTelegramOrderMessage(cart, sample, settings);
    var tgUrl = store.buildTelegramUrl(settings.telegramDM, message);
    trackEvent("checkout_start", {
      items_count: cart.length,
      total: store.getCartTotal()
    });

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

  function trackEvent(name, params) {
    if (window.VeligodskyAnalytics && typeof window.VeligodskyAnalytics.trackEvent === "function") {
      window.VeligodskyAnalytics.trackEvent(name, params || {});
    }
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

