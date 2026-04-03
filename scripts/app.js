(function () {
  "use strict";

  var store = window.VeligodskyStore;
  if (!store) {
    return;
  }

  var MSK_BACKUP_NOTICE_TIMEZONE = "Europe/Moscow";
  var MSK_BACKUP_NOTICE_START_MINUTE = 15;
  var MSK_BACKUP_NOTICE_END_MINUTE = 5 * 60;
  var MAX_REVIEW_UPLOAD_FILE_SIZE = 8 * 1024 * 1024;
  var MAX_REVIEW_IMAGE_DATA_LENGTH = 650 * 1024;
  var MAX_REVIEW_IMAGE_DIMENSION = 1200;
  var REVIEW_IMAGE_QUALITY_START = 0.82;
  var REVIEW_IMAGE_QUALITY_MIN = 0.55;
  var REVIEW_SYNC_PAUSE_AFTER_INTERACTION_MS = 10 * 60 * 1000;
  var MAX_HERO_IMAGE_LENGTH = 900 * 1024;
  var REVIEWS_COLLAPSED_KEY = "veligodsky_reviews_collapsed_v1";
  var HOMEPAGE_REVIEW_DRAFT_KEY = "veligodsky_homepage_review_draft_v1";
  var PRODUCT_REVIEW_DRAFTS_KEY = "veligodsky_product_review_drafts_v1";

  var state = {
    products: [],
    homepageReviews: [],
    filteredProducts: [],
    visibleCount: 8,
    activeTab: "week",
    lastReviewInteractionAt: 0,
    productReviewPanels: {},
    homepageReviewDraft: readStoredHomepageReviewDraft(),
    reviewDrafts: readStoredProductReviewDrafts()
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
      restoreReviewDrafts();
      renderCart();
      setCurrentYear();
      initRevealObserver();
      observeRevealElements();
      startAutoSync();
      startBackupNoticeClock();
      showToast("Работаем офлайн: данные не синхронизированы с сервером.", true);
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
    restoreReviewDrafts();
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
    elements.reviewsToggleBtn = document.getElementById("reviewsToggleBtn");
    elements.reviewsContent = document.getElementById("reviewsContent");
    elements.homepageReviewForm = document.getElementById("homepageReviewForm");

    elements.headerTelegramBtn = document.getElementById("headerTelegramBtn");
    elements.consultTelegramBtn = document.getElementById("consultTelegramBtn");
    elements.footerChannelLink = document.getElementById("footerChannelLink");
    elements.footerDmLink = document.getElementById("footerDmLink");
    elements.freeShippingInline = document.getElementById("freeShippingInline");
    elements.heroBg = document.getElementById("heroBg");
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

    if (elements.reviewsToggleBtn) {
      elements.reviewsToggleBtn.addEventListener("click", toggleReviewsSection);
      applyReviewsCollapsedState(readReviewsCollapsedState(), false);
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("focusin", handleDocumentFocusIn);
    document.addEventListener("input", handleDocumentInput);
    document.addEventListener("change", handleDocumentInput);
    document.addEventListener("submit", handleDocumentSubmit);

    window.addEventListener("focus", function () {
      if (shouldPauseAutoSync()) {
        return;
      }
      refreshFromServer(false);
    });

    window.addEventListener("resize", updateHomepageReviewsNavState);

    if (elements.homepageReviewForm) {
      ensureReviewCaptcha(elements.homepageReviewForm);
    }
  }

  function readReviewsCollapsedState() {
    try {
      return localStorage.getItem(REVIEWS_COLLAPSED_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function writeReviewsCollapsedState(collapsed) {
    try {
      localStorage.setItem(REVIEWS_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch (error) {
      return;
    }
  }

  function setCollapsibleExpanded(content, expanded, animate) {
    if (!content) {
      return;
    }

    var shouldExpand = Boolean(expanded);
    var shouldAnimate = animate !== false;

    if (!shouldAnimate) {
      content.classList.toggle("is-collapsed", !shouldExpand);
      content.setAttribute("aria-hidden", shouldExpand ? "false" : "true");
      content.style.maxHeight = shouldExpand ? "none" : "0px";
      return;
    }

    if (content._collapseTransitionHandler) {
      content.removeEventListener("transitionend", content._collapseTransitionHandler);
      content._collapseTransitionHandler = null;
    }

    if (shouldExpand) {
      content.classList.remove("is-collapsed");
      content.setAttribute("aria-hidden", "false");
      content.style.maxHeight = "0px";
      content.offsetHeight;
      content.style.maxHeight = Math.max(0, content.scrollHeight) + "px";

      var openHandler = function (event) {
        if (event.target !== content || event.propertyName !== "max-height") {
          return;
        }
        content.style.maxHeight = "none";
        content.removeEventListener("transitionend", openHandler);
        content._collapseTransitionHandler = null;
      };

      content._collapseTransitionHandler = openHandler;
      content.addEventListener("transitionend", openHandler);
      return;
    }

    content.style.maxHeight = Math.max(0, content.scrollHeight) + "px";
    content.offsetHeight;
    content.classList.add("is-collapsed");
    content.setAttribute("aria-hidden", "true");
    content.style.maxHeight = "0px";
  }

  function applyReviewsCollapsedState(collapsed, animate) {
    if (!elements.reviewsContent || !elements.reviewsToggleBtn) {
      return;
    }

    var isCollapsed = Boolean(collapsed);
    setCollapsibleExpanded(elements.reviewsContent, !isCollapsed, animate);
    elements.reviewsToggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
    elements.reviewsToggleBtn.textContent = isCollapsed ? "Развернуть раздел" : "Свернуть раздел";

    if (!isCollapsed) {
      window.requestAnimationFrame(updateHomepageReviewsNavState);
    }
  }

  function toggleReviewsSection() {
    if (!elements.reviewsContent) {
      return;
    }

    var nextCollapsed = !elements.reviewsContent.classList.contains("is-collapsed");
    applyReviewsCollapsedState(nextCollapsed);
    writeReviewsCollapsedState(nextCollapsed);
  }

  async function refreshFromServer(showErrorToast) {
    captureHomepageReviewDraftFromDom();
    captureProductReviewDraftsFromDom();
    if (shouldPauseAutoSync()) {
      restoreReviewDrafts();
      return;
    }

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
    state.homepageReviews = typeof store.getHomepageReviews === "function" ? store.getHomepageReviews() : [];
    syncSettingsToUI();
    renderHomepageReviews();
    renderBrandFilter();
    renderTopSections();
    applyFilters(false);
    restoreReviewDrafts();
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
      if (shouldPauseAutoSync()) {
        return;
      }
      refreshFromServer(false);
    }, 30000);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        if (shouldPauseAutoSync()) {
          return;
        }
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

    applyHeroBackground(settings);
    applyBackupNoticeVisibility(settings);
  }

  function getSafeHeroImage(value) {
    var safe = String(value || "").trim();
    if (!safe) {
      return "";
    }

    if (safe.length > MAX_HERO_IMAGE_LENGTH) {
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

  function applyHeroBackground(settings) {
    if (!elements.heroBg) {
      return;
    }

    var heroImage = getSafeHeroImage(settings && settings.heroImage);
    if (!heroImage) {
      elements.heroBg.style.removeProperty("--hero-bg-image");
      return;
    }

    elements.heroBg.style.setProperty("--hero-bg-image", "url(" + JSON.stringify(heroImage) + ")");
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

  function buildStars(value) {
    var safeRating = Math.max(1, Math.min(5, Math.round(Number(value) || 5)));
    return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
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
      elements.homepageReviewsTrack.innerHTML = "<div class=\"empty-state\">Пока отзывов нет. Станьте первым покупателем, кто поделится впечатлением.</div>";
      updateHomepageReviewsNavState();
      return;
    }

    elements.homepageReviewsTrack.innerHTML = reviews.map(function (review) {
      var authorLine = review.city
        ? escapeHtml(review.author) + ", " + escapeHtml(review.city)
        : escapeHtml(review.author);
      var dateLabel = formatReviewDate(review.createdAt);
      var photoHtml = review.photo
        ? "<img class=\"review-photo\" src=\"" + escapeHtml(review.photo) + "\" alt=\"Фото к отзыву от " + escapeHtml(review.author) + "\">"
        : "";
      return ""
        + "<article class=\"review-card\">"
        + photoHtml
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
    initProductReviewSections();
    restoreProductReviewDrafts();
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

  function updateProductReviewToggleButton(section, expanded) {
    if (!section) {
      return;
    }
    var toggleButton = section.querySelector("[data-product-reviews-toggle]");
    if (!toggleButton) {
      return;
    }

    toggleButton.setAttribute("aria-expanded", String(Boolean(expanded)));
    toggleButton.textContent = expanded ? "Свернуть" : "Развернуть";
  }

  function applyProductReviewSectionState(section, expanded, animate) {
    if (!section) {
      return;
    }
    var content = section.querySelector("[data-product-reviews-content]");
    if (!content) {
      return;
    }

    setCollapsibleExpanded(content, Boolean(expanded), animate);
    updateProductReviewToggleButton(section, expanded);
  }

  function toggleProductReviewSection(section) {
    if (!section) {
      return;
    }
    var content = section.querySelector("[data-product-reviews-content]");
    if (!content) {
      return;
    }

    var productId = String(section.getAttribute("data-product-id") || "").trim();
    var nextExpanded = content.classList.contains("is-collapsed");
    applyProductReviewSectionState(section, nextExpanded, true);
    setProductReviewPanelState(productId, nextExpanded);
  }

  function initProductReviewSections() {
    var sections = document.querySelectorAll(".product-reviews");
    sections.forEach(function (section) {
      var productId = String(section.getAttribute("data-product-id") || "").trim();
      var expanded = isProductReviewPanelExpanded(productId);
      applyProductReviewSectionState(section, expanded, false);
    });
  }

  function buildProductReviewsBlock(product) {
    var reviews = Array.isArray(product.reviews) ? product.reviews : [];
    var isExpanded = isProductReviewPanelExpanded(product.id);
    var reviewsHtml = "";

    if (!reviews.length) {
      reviewsHtml = "<p class=\"product-review-empty\">Пока нет отзывов по этому аромату.</p>";
    } else {
      reviewsHtml = reviews.map(function (review) {
        var cityPart = review.city ? (", " + escapeHtml(review.city)) : "";
        var dateLabel = formatReviewDate(review.createdAt);
        var photoHtml = review.photo
          ? "<img class=\"product-review-photo\" src=\"" + escapeHtml(review.photo) + "\" alt=\"Фото к отзыву от " + escapeHtml(review.author) + "\">"
          : "";
        return ""
          + "<article class=\"product-review-item\">"
          + "  <div class=\"product-review-meta\">"
          + "    <strong>" + escapeHtml(review.author) + cityPart + "</strong>"
          + "    <span class=\"product-review-stars\">" + buildStars(review.rating) + "</span>"
          + "  </div>"
          + photoHtml
          + "  <p class=\"product-review-text\">" + escapeHtml(review.text) + "</p>"
          + "  <small class=\"product-review-meta\">" + escapeHtml(dateLabel) + "</small>"
          + "</article>";
      }).join("");
    }

    return ""
      + "<section class=\"product-reviews\" data-product-id=\"" + escapeHtml(product.id) + "\">"
      + "  <div class=\"product-reviews-head\">"
      + "    <strong>Отзывы покупателей</strong>"
      + "    <div class=\"product-reviews-head-right\">"
      + "      <span>Всего: " + reviews.length + "</span>"
      + "      <button class=\"btn btn-ghost product-reviews-toggle\" type=\"button\" data-product-reviews-toggle aria-expanded=\"" + (isExpanded ? "true" : "false") + "\">" + (isExpanded ? "Свернуть" : "Развернуть") + "</button>"
      + "    </div>"
      + "  </div>"
      + "  <div class=\"product-reviews-content" + (isExpanded ? "" : " is-collapsed") + "\" data-product-reviews-content aria-hidden=\"" + (isExpanded ? "false" : "true") + "\">"
      + "  <div class=\"product-reviews-list\">"
      + reviewsHtml
      + "  </div>"
      + "  <form class=\"product-review-form\" data-product-review-form data-product-id=\"" + escapeHtml(product.id) + "\">"
      + "    <div class=\"product-review-form-row\">"
      + "      <input type=\"text\" name=\"author\" maxlength=\"80\" placeholder=\"Ваше имя\" required>"
      + "      <input type=\"text\" name=\"city\" maxlength=\"80\" placeholder=\"Город (необязательно)\">"
      + "      <select name=\"rating\" aria-label=\"Оценка\">"
      + "        <option value=\"5\">5 ★</option>"
      + "        <option value=\"4\">4 ★</option>"
      + "        <option value=\"3\">3 ★</option>"
      + "        <option value=\"2\">2 ★</option>"
      + "        <option value=\"1\">1 ★</option>"
      + "      </select>"
      + "    </div>"
      + "    <textarea name=\"text\" maxlength=\"500\" placeholder=\"Напишите ваш отзыв\" required></textarea>"
      + "    <div class=\"review-form-extras\">"
      + "      <label class=\"review-upload-field\">"
      + "        <span>Фото к отзыву (необязательно)</span>"
      + "        <input type=\"file\" accept=\"image/*\" data-review-photo-input>"
      + "      </label>"
      + "      <div class=\"review-photo-preview hidden\" data-review-photo-preview-wrap>"
      + "        <img class=\"review-photo-preview-image\" data-review-photo-preview alt=\"Предпросмотр фото к отзыву\">"
      + "        <button class=\"btn btn-ghost\" type=\"button\" data-review-photo-remove>Убрать фото</button>"
      + "      </div>"
      + "      <input type=\"hidden\" name=\"photo\" value=\"\">"
      + "      <input class=\"review-honeypot\" type=\"text\" name=\"website\" tabindex=\"-1\" autocomplete=\"off\">"
      + "      <input type=\"hidden\" name=\"captchaToken\" value=\"\">"
      + "      <div class=\"review-captcha\">"
      + "        <span class=\"review-captcha-prompt\" data-captcha-prompt>Загружаем капчу...</span>"
      + "        <div class=\"review-captcha-actions\">"
      + "          <input type=\"text\" name=\"captchaAnswer\" inputmode=\"numeric\" placeholder=\"Ответ\" required>"
      + "          <button class=\"btn btn-ghost\" type=\"button\" data-captcha-refresh>Обновить</button>"
      + "        </div>"
      + "      </div>"
      + "    </div>"
      + "    <div class=\"product-review-form-footer\">"
      + "      <small class=\"product-review-note\">Ссылки в отзыве запрещены. После отправки отзыв попадёт на модерацию.</small>"
      + "      <button class=\"btn btn-outline product-review-submit\" type=\"submit\">Отправить отзыв</button>"
      + "    </div>"
      + "  </form>"
      + "  </div>"
      + "</section>";
  }

  function handleDocumentClick(event) {
    var productReviewsToggle = event.target.closest("[data-product-reviews-toggle]");
    if (productReviewsToggle) {
      var productReviewsSection = productReviewsToggle.closest(".product-reviews");
      if (productReviewsSection) {
        toggleProductReviewSection(productReviewsSection);
      }
      return;
    }

    var captchaRefreshButton = event.target.closest("[data-captcha-refresh]");
    if (captchaRefreshButton) {
      var captchaForm = captchaRefreshButton.closest("[data-homepage-review-form], [data-product-review-form]");
      if (captchaForm) {
        markReviewInteraction();
        ensureReviewCaptcha(captchaForm, true);
      }
      return;
    }

    var removeReviewPhotoButton = event.target.closest("[data-review-photo-remove]");
    if (removeReviewPhotoButton) {
      var removePhotoForm = removeReviewPhotoButton.closest("[data-homepage-review-form], [data-product-review-form]");
      if (removePhotoForm) {
        markReviewInteraction();
        clearReviewPhoto(removePhotoForm);
        persistReviewDraft(removePhotoForm);
      }
      return;
    }

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
      trackEvent("add_to_cart", {
        product_id: productId,
        volume_ml: selectedMl
      });
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

  function handleDocumentFocusIn(event) {
    var reviewForm = event.target.closest("[data-homepage-review-form], [data-product-review-form]");
    if (!reviewForm) {
      return;
    }
    markReviewInteraction();
    ensureReviewCaptcha(reviewForm);
  }

  function handleDocumentSubmit(event) {
    var homepageReviewForm = event.target.closest("[data-homepage-review-form]");
    if (homepageReviewForm) {
      event.preventDefault();
      submitHomepageReviewForm(homepageReviewForm);
      return;
    }

    var reviewForm = event.target.closest("[data-product-review-form]");
    if (!reviewForm) {
      return;
    }

    event.preventDefault();
    submitProductReviewForm(reviewForm);
  }

  function handleDocumentInput(event) {
    if (event.target.matches("[data-review-photo-input]")) {
      var photoForm = event.target.closest("[data-homepage-review-form], [data-product-review-form]");
      if (photoForm) {
        markReviewInteraction();
        processReviewPhotoInput(photoForm, event.target);
      }
      return;
    }

    var homepageReviewForm = event.target.closest("[data-homepage-review-form]");
    if (homepageReviewForm) {
      markReviewInteraction();
      saveHomepageReviewDraft(homepageReviewForm);
      return;
    }

    var reviewForm = event.target.closest("[data-product-review-form]");
    if (!reviewForm) {
      return;
    }
    markReviewInteraction();
    saveProductReviewDraft(reviewForm);
  }

  function markReviewInteraction() {
    state.lastReviewInteractionAt = Date.now();
  }

  function hasRecentReviewInteraction() {
    if (!Number.isFinite(state.lastReviewInteractionAt) || state.lastReviewInteractionAt <= 0) {
      return false;
    }
    return (Date.now() - state.lastReviewInteractionAt) < REVIEW_SYNC_PAUSE_AFTER_INTERACTION_MS;
  }

  function isEditingProductReviewForm() {
    if (!document.activeElement || typeof document.activeElement.closest !== "function") {
      return false;
    }
    return Boolean(document.activeElement.closest("[data-product-review-form]"));
  }

  function isEditingHomepageReviewForm() {
    if (!document.activeElement || typeof document.activeElement.closest !== "function") {
      return false;
    }
    return Boolean(document.activeElement.closest("[data-homepage-review-form]"));
  }

  function readStoredHomepageReviewDraft() {
    try {
      var raw = sessionStorage.getItem(HOMEPAGE_REVIEW_DRAFT_KEY);
      if (!raw) {
        return null;
      }

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      return parsed;
    } catch (error) {
      return null;
    }
  }

  function isProductReviewPanelExpanded(productId) {
    return Boolean(state.productReviewPanels && state.productReviewPanels[String(productId || "")]);
  }

  function setProductReviewPanelState(productId, expanded) {
    var safeId = String(productId || "").trim();
    if (!safeId) {
      return;
    }

    if (!state.productReviewPanels || typeof state.productReviewPanels !== "object") {
      state.productReviewPanels = {};
    }

    if (expanded) {
      state.productReviewPanels[safeId] = true;
    } else {
      delete state.productReviewPanels[safeId];
    }
  }

  function readStoredProductReviewDrafts() {
    try {
      var raw = sessionStorage.getItem(PRODUCT_REVIEW_DRAFTS_KEY);
      if (!raw) {
        return {};
      }

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      return parsed;
    } catch (error) {
      return {};
    }
  }

  function persistProductReviewDrafts() {
    try {
      if (!Object.keys(state.reviewDrafts).length) {
        sessionStorage.removeItem(PRODUCT_REVIEW_DRAFTS_KEY);
        return;
      }

      sessionStorage.setItem(PRODUCT_REVIEW_DRAFTS_KEY, JSON.stringify(state.reviewDrafts));
    } catch (error) {
      return;
    }
  }

  function hasProductReviewDrafts() {
    return Object.keys(state.reviewDrafts).length > 0;
  }

  function persistHomepageReviewDraft() {
    try {
      if (!hasHomepageReviewDraft()) {
        sessionStorage.removeItem(HOMEPAGE_REVIEW_DRAFT_KEY);
        return;
      }

      sessionStorage.setItem(HOMEPAGE_REVIEW_DRAFT_KEY, JSON.stringify(state.homepageReviewDraft));
    } catch (error) {
      return;
    }
  }

  function hasHomepageReviewDraft() {
    if (!state.homepageReviewDraft || typeof state.homepageReviewDraft !== "object") {
      return false;
    }

    return Boolean(
      String(state.homepageReviewDraft.author || "").trim()
      || String(state.homepageReviewDraft.city || "").trim()
      || String(state.homepageReviewDraft.text || "").trim()
      || String(state.homepageReviewDraft.photo || "").trim()
      || String(state.homepageReviewDraft.rating || "5") !== "5"
    );
  }

  function shouldPauseAutoSync() {
    captureHomepageReviewDraftFromDom();
    captureProductReviewDraftsFromDom();
    return isEditingHomepageReviewForm()
      || isEditingProductReviewForm()
      || hasRecentReviewInteraction()
      || hasHomepageReviewDraft()
      || hasProductReviewDrafts();
  }

  function saveHomepageReviewDraft(form) {
    if (!form) {
      return;
    }

    var authorInput = form.querySelector("[name=\"author\"]");
    var cityInput = form.querySelector("[name=\"city\"]");
    var textInput = form.querySelector("[name=\"text\"]");
    var ratingInput = form.querySelector("[name=\"rating\"]");
    var photoInput = form.querySelector("[name=\"photo\"]");

    var draft = {
      author: authorInput ? String(authorInput.value || "") : "",
      city: cityInput ? String(cityInput.value || "") : "",
      text: textInput ? String(textInput.value || "") : "",
      rating: ratingInput ? String(ratingInput.value || "5") : "5",
      photo: photoInput ? String(photoInput.value || "") : ""
    };

    var isEmpty = !draft.author.trim()
      && !draft.city.trim()
      && !draft.text.trim()
      && !draft.photo.trim()
      && draft.rating === "5";

    if (isEmpty) {
      state.homepageReviewDraft = null;
      persistHomepageReviewDraft();
      return;
    }

    state.homepageReviewDraft = draft;
    persistHomepageReviewDraft();
  }

  function captureHomepageReviewDraftFromDom() {
    var form = document.querySelector("[data-homepage-review-form]");
    if (!form) {
      return;
    }
    saveHomepageReviewDraft(form);
  }

  function restoreHomepageReviewDraft() {
    var form = document.querySelector("[data-homepage-review-form]");
    var draft = state.homepageReviewDraft;
    if (!form || !draft) {
      return;
    }

    var authorInput = form.querySelector("[name=\"author\"]");
    var cityInput = form.querySelector("[name=\"city\"]");
    var textInput = form.querySelector("[name=\"text\"]");
    var ratingInput = form.querySelector("[name=\"rating\"]");
    var photoInput = form.querySelector("[name=\"photo\"]");

    if (authorInput) {
      authorInput.value = draft.author || "";
    }
    if (cityInput) {
      cityInput.value = draft.city || "";
    }
    if (textInput) {
      textInput.value = draft.text || "";
    }
    if (ratingInput) {
      ratingInput.value = draft.rating || "5";
    }
    if (photoInput) {
      photoInput.value = draft.photo || "";
    }
    syncReviewPhotoPreview(form, draft.photo || "");
  }

  function restoreReviewDrafts() {
    restoreHomepageReviewDraft();
    restoreProductReviewDrafts();
  }

  function persistReviewDraft(form) {
    if (!form) {
      return;
    }

    if (form.matches("[data-homepage-review-form]")) {
      saveHomepageReviewDraft(form);
      return;
    }

    if (form.matches("[data-product-review-form]")) {
      saveProductReviewDraft(form);
    }
  }

  function syncReviewPhotoPreview(form, photoData) {
    if (!form) {
      return;
    }

    var wrap = form.querySelector("[data-review-photo-preview-wrap]");
    var image = form.querySelector("[data-review-photo-preview]");
    if (!wrap || !image) {
      return;
    }

    var safePhoto = String(photoData || "").trim();
    if (!safePhoto) {
      image.removeAttribute("src");
      wrap.classList.add("hidden");
      return;
    }

    image.src = safePhoto;
    wrap.classList.remove("hidden");
  }

  function clearReviewPhoto(form) {
    if (!form) {
      return;
    }

    var hiddenPhotoInput = form.querySelector("[name=\"photo\"]");
    var fileInput = form.querySelector("[data-review-photo-input]");
    if (hiddenPhotoInput) {
      hiddenPhotoInput.value = "";
    }
    if (fileInput) {
      fileInput.value = "";
    }
    syncReviewPhotoPreview(form, "");
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("REVIEW_PHOTO_READ_FAILED"));
      };
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = function () {
        reject(new Error("REVIEW_PHOTO_LOAD_FAILED"));
      };
      image.src = src;
    });
  }

  function renderToJpegDataUrl(image, maxDimension, quality) {
    var width = Number(image.naturalWidth || image.width || 0);
    var height = Number(image.naturalHeight || image.height || 0);
    if (!width || !height) {
      throw new Error("REVIEW_PHOTO_INVALID");
    }

    var ratio = Math.min(1, maxDimension / Math.max(width, height));
    var targetWidth = Math.max(1, Math.round(width * ratio));
    var targetHeight = Math.max(1, Math.round(height * ratio));
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    if (!context) {
      throw new Error("REVIEW_PHOTO_CANVAS_UNAVAILABLE");
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", quality);
  }

  async function optimizeReviewPhotoFile(file) {
    if (!file) {
      throw new Error("REVIEW_PHOTO_REQUIRED");
    }
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("REVIEW_PHOTO_INVALID_TYPE");
    }
    if (Number(file.size || 0) > MAX_REVIEW_UPLOAD_FILE_SIZE) {
      throw new Error("REVIEW_PHOTO_FILE_TOO_LARGE");
    }

    var originalDataUrl = await fileToDataUrl(file);
    var image = await loadImageElement(originalDataUrl);
    var currentDimension = MAX_REVIEW_IMAGE_DIMENSION;
    var currentQuality = REVIEW_IMAGE_QUALITY_START;
    var attempts = 0;
    var best = "";

    while (attempts < 10) {
      var candidate = renderToJpegDataUrl(image, currentDimension, currentQuality);
      best = candidate;
      if (candidate.length <= MAX_REVIEW_IMAGE_DATA_LENGTH) {
        return candidate;
      }
      currentDimension = Math.max(560, Math.round(currentDimension * 0.88));
      currentQuality = Math.max(REVIEW_IMAGE_QUALITY_MIN, Number((currentQuality - 0.06).toFixed(2)));
      attempts += 1;
    }

    if (best && best.length <= MAX_REVIEW_IMAGE_DATA_LENGTH) {
      return best;
    }

    throw new Error("REVIEW_PHOTO_FILE_TOO_LARGE");
  }

  async function processReviewPhotoInput(form, input) {
    if (!form || !input) {
      return;
    }

    var file = input.files && input.files[0];
    if (!file) {
      clearReviewPhoto(form);
      persistReviewDraft(form);
      return;
    }

    try {
      var optimized = await optimizeReviewPhotoFile(file);
      var hiddenPhotoInput = form.querySelector("[name=\"photo\"]");
      if (hiddenPhotoInput) {
        hiddenPhotoInput.value = optimized;
      }
      syncReviewPhotoPreview(form, optimized);
      persistReviewDraft(form);
    } catch (error) {
      input.value = "";
      clearReviewPhoto(form);
      persistReviewDraft(form);

      var message = String(error && error.message || "");
      if (message === "REVIEW_PHOTO_INVALID_TYPE") {
        showToast("К отзыву можно прикрепить только изображение.", true);
        return;
      }
      if (message === "REVIEW_PHOTO_FILE_TOO_LARGE") {
        showToast("Фото слишком большое. Выберите изображение поменьше.", true);
        return;
      }
      showToast("Не удалось обработать фото отзыва.", true);
    }
  }

  async function ensureReviewCaptcha(form, forceRefresh) {
    if (!form || typeof store.fetchReviewCaptcha !== "function") {
      return;
    }

    var prompt = form.querySelector("[data-captcha-prompt]");
    var tokenInput = form.querySelector("[name=\"captchaToken\"]");
    var answerInput = form.querySelector("[name=\"captchaAnswer\"]");
    if (!prompt || !tokenInput) {
      return;
    }

    if (!forceRefresh && String(tokenInput.value || "").trim()) {
      return;
    }

    prompt.textContent = "Загружаем капчу...";
    tokenInput.value = "";

    try {
      var payload = await store.fetchReviewCaptcha();
      tokenInput.value = String(payload && payload.token || "").trim();
      prompt.textContent = String(payload && payload.prompt || "Решите пример");
      if (answerInput) {
        answerInput.value = "";
      }
    } catch (error) {
      prompt.textContent = "Не удалось загрузить капчу. Нажмите «Обновить».";
    }
  }

  function saveProductReviewDraft(form) {
    if (!form) {
      return;
    }

    var productId = String(form.getAttribute("data-product-id") || "").trim();
    if (!productId) {
      return;
    }

    var authorInput = form.querySelector("[name=\"author\"]");
    var cityInput = form.querySelector("[name=\"city\"]");
    var textInput = form.querySelector("[name=\"text\"]");
    var ratingInput = form.querySelector("[name=\"rating\"]");
    var photoInput = form.querySelector("[name=\"photo\"]");

    var draft = {
      author: authorInput ? String(authorInput.value || "") : "",
      city: cityInput ? String(cityInput.value || "") : "",
      text: textInput ? String(textInput.value || "") : "",
      rating: ratingInput ? String(ratingInput.value || "5") : "5",
      photo: photoInput ? String(photoInput.value || "") : ""
    };

    var isEmpty = !draft.author.trim()
      && !draft.city.trim()
      && !draft.text.trim()
      && !draft.photo.trim()
      && draft.rating === "5";

    if (isEmpty) {
      delete state.reviewDrafts[productId];
      persistProductReviewDrafts();
      return;
    }

    state.reviewDrafts[productId] = draft;
    persistProductReviewDrafts();
  }

  function captureProductReviewDraftsFromDom() {
    var forms = document.querySelectorAll("[data-product-review-form]");
    forms.forEach(function (form) {
      saveProductReviewDraft(form);
    });
  }

  function restoreProductReviewDrafts() {
    var forms = document.querySelectorAll("[data-product-review-form]");
    forms.forEach(function (form) {
      var productId = String(form.getAttribute("data-product-id") || "").trim();
      if (!productId) {
        return;
      }

      var draft = state.reviewDrafts[productId];
      if (!draft) {
        return;
      }

      var authorInput = form.querySelector("[name=\"author\"]");
      var cityInput = form.querySelector("[name=\"city\"]");
      var textInput = form.querySelector("[name=\"text\"]");
      var ratingInput = form.querySelector("[name=\"rating\"]");
      var photoInput = form.querySelector("[name=\"photo\"]");

      if (authorInput) {
        authorInput.value = draft.author || "";
      }
      if (cityInput) {
        cityInput.value = draft.city || "";
      }
      if (textInput) {
        textInput.value = draft.text || "";
      }
      if (ratingInput) {
        ratingInput.value = draft.rating || "5";
      }
      if (photoInput) {
        photoInput.value = draft.photo || "";
      }
      syncReviewPhotoPreview(form, draft.photo || "");
      var reviewsSection = form.closest(".product-reviews");
      if (reviewsSection) {
        applyProductReviewSectionState(reviewsSection, true, false);
      }
      setProductReviewPanelState(productId, true);
      ensureReviewCaptcha(form);
    });
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
    var photo = String(formData.get("photo") || "").trim();
    var website = String(formData.get("website") || "").trim();
    var captchaToken = String(formData.get("captchaToken") || "").trim();
    var captchaAnswer = String(formData.get("captchaAnswer") || "").trim();

    if (!author || author.length < 2) {
      showToast("Укажите имя для отзыва.", true);
      return;
    }

    if (!text || text.length < 6) {
      showToast("Текст отзыва должен быть не короче 6 символов.", true);
      return;
    }

    if (!captchaToken || !captchaAnswer) {
      ensureReviewCaptcha(form, true);
      showToast("Решите капчу перед отправкой отзыва.", true);
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
        rating: rating,
        photo: photo,
        website: website,
        captchaToken: captchaToken,
        captchaAnswer: captchaAnswer
      });

      delete state.reviewDrafts[productId];
      persistProductReviewDrafts();
      form.reset();
      var ratingSelect = form.querySelector("select[name=\"rating\"]");
      if (ratingSelect) {
        ratingSelect.value = "5";
      }
      clearReviewPhoto(form);
      ensureReviewCaptcha(form, true);

      showToast("Спасибо! Отзыв отправлен на модерацию.");
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
        var validationCode = message.split(":")[1] || "";
        if (validationCode === "LINKS_NOT_ALLOWED") {
          showToast("Ссылки в отзывах запрещены.", true);
        } else if (validationCode === "CAPTCHA_REQUIRED" || validationCode === "CAPTCHA_INVALID" || validationCode === "CAPTCHA_EXPIRED" || validationCode === "CAPTCHA_TOO_FAST") {
          ensureReviewCaptcha(form, true);
          showToast("Капча не пройдена. Решите новый пример и отправьте ещё раз.", true);
        } else if (validationCode === "REVIEW_PHOTO_TOO_LARGE") {
          showToast("Фото отзыва слишком большое.", true);
        } else if (validationCode === "INVALID_REVIEW_PHOTO") {
          showToast("Фото отзыва должно быть изображением.", true);
        } else {
          showToast("Проверьте имя, оценку и текст отзыва.", true);
        }
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

  async function submitHomepageReviewForm(form) {
    if (!form) {
      return;
    }

    if (typeof store.submitHomepageReview !== "function") {
      showToast("Отправка отзывов временно недоступна.", true);
      return;
    }

    var formData = new FormData(form);
    var author = String(formData.get("author") || "").trim();
    var city = String(formData.get("city") || "").trim();
    var text = String(formData.get("text") || "").trim();
    var rating = Math.max(1, Math.min(5, Math.round(Number(formData.get("rating")) || 5)));
    var photo = String(formData.get("photo") || "").trim();
    var website = String(formData.get("website") || "").trim();
    var captchaToken = String(formData.get("captchaToken") || "").trim();
    var captchaAnswer = String(formData.get("captchaAnswer") || "").trim();

    if (!author || author.length < 2) {
      showToast("Укажите имя для отзыва.", true);
      return;
    }

    if (!text || text.length < 6) {
      showToast("Текст отзыва должен быть не короче 6 символов.", true);
      return;
    }

    if (!captchaToken || !captchaAnswer) {
      ensureReviewCaptcha(form, true);
      showToast("Решите капчу перед отправкой отзыва.", true);
      return;
    }

    var submitButton = form.querySelector("[type=\"submit\"]");
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      await store.submitHomepageReview({
        author: author,
        city: city,
        text: text,
        rating: rating,
        photo: photo,
        website: website,
        captchaToken: captchaToken,
        captchaAnswer: captchaAnswer
      });

      state.homepageReviewDraft = null;
      persistHomepageReviewDraft();
      form.reset();
      var ratingSelect = form.querySelector("select[name=\"rating\"]");
      if (ratingSelect) {
        ratingSelect.value = "5";
      }
      clearReviewPhoto(form);
      ensureReviewCaptcha(form, true);

      showToast("Спасибо! Отзыв отправлен на модерацию.");
      trackEvent("homepage_review_submit", {
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
        var homepageValidationCode = message.split(":")[1] || "";
        if (homepageValidationCode === "LINKS_NOT_ALLOWED") {
          showToast("Ссылки в отзывах запрещены.", true);
        } else if (homepageValidationCode === "CAPTCHA_REQUIRED" || homepageValidationCode === "CAPTCHA_INVALID" || homepageValidationCode === "CAPTCHA_EXPIRED" || homepageValidationCode === "CAPTCHA_TOO_FAST") {
          ensureReviewCaptcha(form, true);
          showToast("Капча не пройдена. Решите новый пример и отправьте ещё раз.", true);
        } else if (homepageValidationCode === "REVIEW_PHOTO_TOO_LARGE") {
          showToast("Фото отзыва слишком большое.", true);
        } else if (homepageValidationCode === "INVALID_REVIEW_PHOTO") {
          showToast("Фото отзыва должно быть изображением.", true);
        } else {
          showToast("Проверьте имя, оценку и текст отзыва.", true);
        }
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
      elements.cartItems.innerHTML = "<div class=\"empty-state\">Корзина пока пуста.</div>";
    } else {
      elements.cartItems.innerHTML = cart.map(function (item) {
        var lineTotal = item.price * item.qty;
        return ""
          + "<article class=\"cart-item\">"
          + "  <img src=\"" + escapeHtml(item.image) + "\" alt=\"" + escapeHtml(item.name) + "\">"
          + "  <div class=\"cart-item-main\">"
          + "    <strong>" + escapeHtml(item.name) + "</strong>"
          + "    <span>" + escapeHtml(item.brand) + " | " + item.ml + " ml</span>"
          + "    <span>" + store.formatPrice(lineTotal) + "</span>"
          + "    <div class=\"cart-item-actions\">"
          + "      <div class=\"qty-controls\">"
          + "        <button type=\"button\" data-cart-action=\"dec\" data-item-key=\"" + escapeHtml(item.itemKey) + "\">-</button>"
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
      elements.shippingStatus.textContent = "Бесплатная доставка!";
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

