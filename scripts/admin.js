(function () {
  "use strict";

  var store = window.VeligodskyStore;
  if (!store) {
    return;
  }

  var AUTH_KEY = "veligodsky_admin_auth";
  var EDITOR_DRAFT_KEY = "veligodsky_admin_editor_draft_v1";
  var EDITOR_DRAFT_FALLBACK_KEY = "veligodsky_admin_editor_draft_v1_session";
  var MAX_UPLOAD_FILE_SIZE = 12 * 1024 * 1024;
  var MAX_IMAGE_DATA_LENGTH = 900 * 1024;
  var MAX_IMAGE_DIMENSION = 1200;
  var MIN_IMAGE_DIMENSION = 500;
  var IMAGE_QUALITY_START = 0.82;
  var IMAGE_QUALITY_MIN = 0.5;

  var state = {
    editingId: null,
    imageData: "",
    draftMemory: null
  };

  var elements = {};
  var toastTimer = null;

  document.addEventListener("DOMContentLoaded", function () {
    init().catch(function () {
      openLogin();
      showToast("Не удалось загрузить данные сервера. Проверьте подключение.", true);
    });
  });

  async function init() {
    cacheElements();
    bindEvents();
    if (typeof store.init === "function") {
      await store.init();
    }
    checkAuth();
  }

  function cacheElements() {
    elements.loginView = document.getElementById("adminLoginView");
    elements.panelView = document.getElementById("adminPanelView");
    elements.loginForm = document.getElementById("adminLoginForm");
    elements.passwordInput = document.getElementById("adminPasswordInput");
    elements.logoutBtn = document.getElementById("adminLogoutBtn");

    elements.settingsForm = document.getElementById("settingsForm");
    elements.telegramChannelInput = document.getElementById("telegramChannelInput");
    elements.telegramDmInput = document.getElementById("telegramDmInput");
    elements.freeShippingInput = document.getElementById("freeShippingInput");
    elements.adminPasswordNewInput = document.getElementById("adminPasswordNewInput");
    elements.backupNoticeEnabledInput = document.getElementById("backupNoticeEnabledInput");

    elements.perfumeForm = document.getElementById("perfumeForm");
    elements.editorTitle = document.getElementById("editorTitle");
    elements.perfumeIdInput = document.getElementById("perfumeIdInput");
    elements.perfumeNameInput = document.getElementById("perfumeNameInput");
    elements.perfumeBrandInput = document.getElementById("perfumeBrandInput");
    elements.perfumeGenderInput = document.getElementById("perfumeGenderInput");
    elements.perfumeDescriptionInput = document.getElementById("perfumeDescriptionInput");
    elements.perfumeImageInput = document.getElementById("perfumeImageInput");
    elements.perfumeImagePreview = document.getElementById("perfumeImagePreview");
    elements.topWeekInput = document.getElementById("topWeekInput");
    elements.topMonthInput = document.getElementById("topMonthInput");
    elements.addVolumeBtn = document.getElementById("addVolumeBtn");
    elements.volumesContainer = document.getElementById("volumesContainer");
    elements.cancelEditBtn = document.getElementById("cancelEditBtn");

    elements.adminProductsList = document.getElementById("adminProductsList");
    elements.toast = document.getElementById("adminToast");
  }

  function bindEvents() {
    elements.loginForm.addEventListener("submit", onLogin);
    elements.logoutBtn.addEventListener("click", logout);

    elements.settingsForm.addEventListener("submit", saveSettings);

    elements.addVolumeBtn.addEventListener("click", function () {
      appendVolumeRow();
      saveEditorDraftFromForm();
    });

    elements.volumesContainer.addEventListener("click", function (event) {
      var removeButton = event.target.closest(".remove-volume-btn");
      if (!removeButton) {
        return;
      }
      var row = removeButton.closest(".volume-row");
      if (!row) {
        return;
      }
      row.remove();
      if (!elements.volumesContainer.children.length) {
        appendVolumeRow();
      }
      saveEditorDraftFromForm();
    });

    elements.perfumeImageInput.addEventListener("change", handleImageUpload);
    elements.perfumeForm.addEventListener("submit", savePerfume);
    elements.cancelEditBtn.addEventListener("click", resetEditor);
    elements.perfumeForm.addEventListener("input", saveEditorDraftFromForm);
    elements.perfumeForm.addEventListener("change", saveEditorDraftFromForm);

    elements.adminProductsList.addEventListener("click", onProductListClick);
    elements.adminProductsList.addEventListener("change", onProductListChange);
    elements.volumesContainer.addEventListener("input", saveEditorDraftFromForm);
    elements.volumesContainer.addEventListener("change", saveEditorDraftFromForm);

    window.addEventListener("focus", function () {
      if (isAuthenticated()) {
        saveEditorDraftFromForm();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        saveEditorDraftFromForm();
      }
    });

    window.addEventListener("beforeunload", saveEditorDraftFromForm);
  }

  function checkAuth() {
    if (isAuthenticated()) {
      openPanel();
    } else {
      openLogin();
    }
  }

  function isAuthenticated() {
    if (sessionStorage.getItem(AUTH_KEY) !== "1") {
      return false;
    }
    if (typeof store.hasAdminSession === "function") {
      return store.hasAdminSession();
    }
    return true;
  }

  function openPanel() {
    elements.loginView.classList.add("hidden");
    elements.panelView.classList.remove("hidden");
    refreshPanelFromServer(false);
  }

  function openLogin() {
    elements.panelView.classList.add("hidden");
    elements.loginView.classList.remove("hidden");
    elements.passwordInput.value = "";
    elements.passwordInput.focus();
  }

  function refreshPanel() {
    fillSettingsForm();
    renderProducts();
    if (!restoreEditorFromDraft()) {
      resetEditor({ keepDraft: true });
    }
  }

  async function refreshPanelFromServer(showErrorToast) {
    saveEditorDraftFromForm();
    if (typeof store.syncFromServer === "function") {
      try {
        await store.syncFromServer();
      } catch (error) {
        if (String(error && error.message || "").indexOf("401") >= 0) {
          logout();
          showToast("Сессия администратора истекла. Войдите снова.", true);
          return;
        }
        if (showErrorToast) {
          showToast("Не удалось обновить данные с сервера.", true);
        }
      }
    }
    refreshPanel();
  }

  async function onLogin(event) {
    event.preventDefault();
    var inputPassword = String(elements.passwordInput.value || "").trim();
    if (!inputPassword) {
      showToast("Введите пароль.", true);
      return;
    }

    if (typeof store.loginAdmin !== "function") {
      showToast("Обновите scripts/common.js на сервере.", true);
      return;
    }

    try {
      await store.loginAdmin(inputPassword);
    } catch (error) {
      if (String(error && error.message || "").indexOf("INVALID_CREDENTIALS") >= 0) {
        showToast("Неверный пароль.", true);
        return;
      }
      if (String(error && error.message || "").indexOf("HTTP") >= 0) {
        showToast("Сервер входа недоступен. Проверьте деплой.", true);
        return;
      }
      showToast("Неверный пароль.", true);
      return;
    }

    sessionStorage.setItem(AUTH_KEY, "1");
    openPanel();
    showToast("Вход выполнен");
  }

  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    if (typeof store.logoutAdmin === "function") {
      store.logoutAdmin();
    }
    openLogin();
  }

  function fillSettingsForm() {
    var settings = store.getSettings();
    elements.telegramChannelInput.value = settings.telegramChannel;
    elements.telegramDmInput.value = settings.telegramDM;
    elements.freeShippingInput.value = String(settings.freeShippingThreshold);
    if (elements.backupNoticeEnabledInput) {
      elements.backupNoticeEnabledInput.checked = Boolean(settings.backupNoticeEnabled);
    }
    elements.adminPasswordNewInput.value = "";
  }

  async function saveSettings(event) {
    event.preventDefault();

    var channel = String(elements.telegramChannelInput.value || "").trim();
    var dm = String(elements.telegramDmInput.value || "").trim();
    var freeShippingThreshold = Math.max(0, Math.round(Number(elements.freeShippingInput.value) || 0));
    var newAdminPassword = String(elements.adminPasswordNewInput.value || "").trim();
    var backupNoticeEnabled = elements.backupNoticeEnabledInput
      ? Boolean(elements.backupNoticeEnabledInput.checked)
      : true;

    var patch = {
      telegramChannel: channel,
      telegramDM: dm,
      freeShippingThreshold: freeShippingThreshold,
      backupNoticeEnabled: backupNoticeEnabled
    };

    try {
      await store.updateSettings(patch);

      if (newAdminPassword) {
        if (typeof store.changeAdminPassword !== "function") {
          throw new Error("PASSWORD_ENDPOINT_UNAVAILABLE");
        }
        await store.changeAdminPassword(newAdminPassword);
      }

      elements.adminPasswordNewInput.value = "";
      showToast(newAdminPassword ? "Настройки и пароль сохранены" : "Настройки сохранены");
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось сохранить настройки на сервер.", true);
    }
  }

  function createVolumeRow(volume) {
    var data = volume || { ml: "", price: "" };
    var row = document.createElement("div");
    row.className = "volume-row";
    row.innerHTML = ""
      + "<label class=\"field\">"
      + "  <span>Объём, ml</span>"
      + "  <input class=\"volume-ml\" type=\"number\" min=\"1\" required value=\"" + escapeHtml(data.ml) + "\">"
      + "</label>"
      + "<label class=\"field\">"
      + "  <span>Цена, ₽</span>"
      + "  <input class=\"volume-price\" type=\"number\" min=\"1\" required value=\"" + escapeHtml(data.price) + "\">"
      + "</label>"
      + "<button type=\"button\" class=\"btn btn-ghost remove-volume-btn\">Удалить</button>";

    return row;
  }

  function appendVolumeRow(volume) {
    elements.volumesContainer.appendChild(createVolumeRow(volume));
  }

  function collectVolumes() {
    var rows = Array.prototype.slice.call(elements.volumesContainer.querySelectorAll(".volume-row"));
    var volumes = rows.map(function (row) {
      var mlInput = row.querySelector(".volume-ml");
      var priceInput = row.querySelector(".volume-price");
      var ml = Math.round(Number(mlInput.value));
      var price = Math.round(Number(priceInput.value));

      if (!Number.isFinite(ml) || ml <= 0 || !Number.isFinite(price) || price <= 0) {
        return null;
      }

      return {
        ml: ml,
        price: price
      };
    }).filter(Boolean);

    volumes.sort(function (a, b) {
      return a.ml - b.ml;
    });

    var uniqueMap = new Map();
    volumes.forEach(function (item) {
      uniqueMap.set(item.ml, item);
    });

    return Array.from(uniqueMap.values());
  }

  function cloneDraft(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function readEditorDraft() {
    var raw = "";
    try {
      raw = localStorage.getItem(EDITOR_DRAFT_KEY) || "";
    } catch (error) {
      raw = "";
    }

    if (!raw) {
      try {
        raw = sessionStorage.getItem(EDITOR_DRAFT_FALLBACK_KEY) || "";
      } catch (error) {
        raw = "";
      }
    }

    if (!raw) {
      return state.draftMemory ? cloneDraft(state.draftMemory) : null;
    }

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      var safeVolumes = Array.isArray(parsed.volumes)
        ? parsed.volumes.map(function (volume) {
          if (!volume || typeof volume !== "object") {
            return null;
          }
          return {
            ml: String(volume.ml || ""),
            price: String(volume.price || "")
          };
        }).filter(Boolean)
        : [];

      var safeDraft = {
        editingId: String(parsed.editingId || ""),
        name: String(parsed.name || ""),
        brand: String(parsed.brand || ""),
        gender: String(parsed.gender || "unisex"),
        description: String(parsed.description || ""),
        topWeek: Boolean(parsed.topWeek),
        topMonth: Boolean(parsed.topMonth),
        imageData: String(parsed.imageData || ""),
        volumes: safeVolumes
      };
      state.draftMemory = cloneDraft(safeDraft);
      return safeDraft;
    } catch (error) {
      return state.draftMemory ? cloneDraft(state.draftMemory) : null;
    }
  }

  function writeEditorDraft(draft) {
    state.draftMemory = cloneDraft(draft);
    var serialized = "";
    try {
      serialized = JSON.stringify(draft);
    } catch (error) {
      return;
    }

    var stored = false;
    try {
      localStorage.setItem(EDITOR_DRAFT_KEY, serialized);
      stored = true;
    } catch (error) {
      stored = false;
    }

    if (stored) {
      try {
        sessionStorage.removeItem(EDITOR_DRAFT_FALLBACK_KEY);
      } catch (error) {
        return;
      }
      return;
    }

    try {
      sessionStorage.setItem(EDITOR_DRAFT_FALLBACK_KEY, serialized);
    } catch (error) {
      return;
    }
  }

  function clearEditorDraft() {
    state.draftMemory = null;
    try {
      localStorage.removeItem(EDITOR_DRAFT_KEY);
    } catch (error) {
      // ignore
    }

    try {
      sessionStorage.removeItem(EDITOR_DRAFT_FALLBACK_KEY);
    } catch (error) {
      // ignore
    }
  }

  function getCurrentDraftVolumes() {
    return Array.prototype.slice.call(elements.volumesContainer.querySelectorAll(".volume-row")).map(function (row) {
      var mlInput = row.querySelector(".volume-ml");
      var priceInput = row.querySelector(".volume-price");
      return {
        ml: String((mlInput && mlInput.value) || ""),
        price: String((priceInput && priceInput.value) || "")
      };
    });
  }

  function getCurrentEditorDraft() {
    return {
      editingId: String(elements.perfumeIdInput.value || ""),
      name: String(elements.perfumeNameInput.value || ""),
      brand: String(elements.perfumeBrandInput.value || ""),
      gender: String(elements.perfumeGenderInput.value || "unisex"),
      description: String(elements.perfumeDescriptionInput.value || ""),
      topWeek: Boolean(elements.topWeekInput.checked),
      topMonth: Boolean(elements.topMonthInput.checked),
      imageData: String(state.imageData || ""),
      volumes: getCurrentDraftVolumes()
    };
  }

  function isEditorDraftMeaningful(draft) {
    if (!draft || typeof draft !== "object") {
      return false;
    }

    if (String(draft.editingId || "").trim()) {
      return true;
    }

    if (String(draft.name || "").trim() || String(draft.brand || "").trim() || String(draft.description || "").trim()) {
      return true;
    }

    if (Boolean(draft.topWeek) || Boolean(draft.topMonth)) {
      return true;
    }

    if (String(draft.imageData || "").trim()) {
      return true;
    }

    return Array.isArray(draft.volumes) && draft.volumes.some(function (volume) {
      return String((volume && volume.ml) || "").trim() || String((volume && volume.price) || "").trim();
    });
  }

  function saveEditorDraftFromForm() {
    if (!elements.panelView || elements.panelView.classList.contains("hidden")) {
      return;
    }

    var draft = getCurrentEditorDraft();
    if (!isEditorDraftMeaningful(draft)) {
      clearEditorDraft();
      return;
    }

    writeEditorDraft(draft);
  }

  function applyEditorDraft(draft) {
    if (!draft) {
      return;
    }

    var gender = String(draft.gender || "unisex");
    if (["male", "female", "unisex"].indexOf(gender) === -1) {
      gender = "unisex";
    }

    state.editingId = String(draft.editingId || "") || null;
    state.imageData = String(draft.imageData || "");

    elements.editorTitle.textContent = state.editingId ? "Редактировать парфюм" : "Добавить парфюм";
    elements.perfumeIdInput.value = state.editingId || "";
    elements.perfumeNameInput.value = String(draft.name || "");
    elements.perfumeBrandInput.value = String(draft.brand || "");
    elements.perfumeGenderInput.value = gender;
    elements.perfumeDescriptionInput.value = String(draft.description || "");
    elements.topWeekInput.checked = Boolean(draft.topWeek);
    elements.topMonthInput.checked = Boolean(draft.topMonth);
    elements.perfumeImageInput.value = "";

    setPreviewImage(state.imageData);

    elements.volumesContainer.innerHTML = "";
    var volumes = Array.isArray(draft.volumes) && draft.volumes.length
      ? draft.volumes
      : [{ ml: "", price: "" }];

    volumes.forEach(function (volume) {
      appendVolumeRow({
        ml: String(volume.ml || ""),
        price: String(volume.price || "")
      });
    });
  }

  function restoreEditorFromDraft() {
    var draft = readEditorDraft();
    if (!draft || !isEditorDraftMeaningful(draft)) {
      clearEditorDraft();
      return false;
    }

    applyEditorDraft(draft);
    return true;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("FILE_READ_ERROR"));
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
        reject(new Error("IMAGE_DECODE_ERROR"));
      };
      image.src = src;
    });
  }

  function renderToJpegDataUrl(image, maxDimension, quality) {
    var width = Number(image.naturalWidth || image.width || 0);
    var height = Number(image.naturalHeight || image.height || 0);
    if (!width || !height) {
      throw new Error("IMAGE_SIZE_ERROR");
    }

    var scale = Math.min(1, maxDimension / Math.max(width, height));
    var targetWidth = Math.max(1, Math.round(width * scale));
    var targetHeight = Math.max(1, Math.round(height * scale));

    var canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    var context = canvas.getContext("2d");
    if (!context) {
      throw new Error("CANVAS_NOT_SUPPORTED");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", quality);
  }

  async function optimizeImageForStore(file) {
    var originalDataUrl = await readFileAsDataUrl(file);
    if (originalDataUrl.length <= MAX_IMAGE_DATA_LENGTH) {
      return originalDataUrl;
    }

    var image = await loadImageElement(originalDataUrl);
    var currentDimension = MAX_IMAGE_DIMENSION;
    var currentQuality = IMAGE_QUALITY_START;
    var best = originalDataUrl;

    for (var attempt = 0; attempt < 6; attempt += 1) {
      var candidate = renderToJpegDataUrl(image, currentDimension, currentQuality);
      best = candidate;

      if (candidate.length <= MAX_IMAGE_DATA_LENGTH) {
        return candidate;
      }

      currentDimension = Math.max(MIN_IMAGE_DIMENSION, Math.round(currentDimension * 0.82));
      currentQuality = Math.max(IMAGE_QUALITY_MIN, currentQuality - 0.08);
    }

    return best;
  }

  async function handleImageUpload() {
    var file = elements.perfumeImageInput.files && elements.perfumeImageInput.files[0];
    if (!file) {
      return;
    }

    var fileType = String(file.type || "").toLowerCase();
    if (!String(fileType).startsWith("image/")) {
      showToast("Выберите файл изображения.", true);
      elements.perfumeImageInput.value = "";
      return;
    }

    if (fileType.indexOf("heic") >= 0 || fileType.indexOf("heif") >= 0) {
      showToast("Формат HEIC/HEIF не поддерживается. Сохраните фото как JPG/PNG.", true);
      elements.perfumeImageInput.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      showToast("Фото больше 12 МБ. Выберите файл поменьше.", true);
      elements.perfumeImageInput.value = "";
      return;
    }

    var previousImageData = String(state.imageData || "");
    try {
      var optimized = await optimizeImageForStore(file);
      if (!optimized || optimized.length > MAX_IMAGE_DATA_LENGTH) {
        throw new Error("IMAGE_TOO_LARGE");
      }

      state.imageData = optimized;
      setPreviewImage(state.imageData);
      saveEditorDraftFromForm();
      showToast("Фото загружено");
    } catch (error) {
      state.imageData = previousImageData;
      setPreviewImage(previousImageData);
      elements.perfumeImageInput.value = "";
      saveEditorDraftFromForm();
      if (error && error.message === "IMAGE_TOO_LARGE") {
        showToast("Фото слишком тяжелое. Попробуйте другое изображение.", true);
        return;
      }
      showToast("Не удалось обработать фото. Используйте JPG или PNG.", true);
    }
  }

  function setPreviewImage(src) {
    var value = String(src || "").trim();
    if (!value) {
      elements.perfumeImagePreview.removeAttribute("src");
      elements.perfumeImagePreview.classList.add("hidden");
      return;
    }
    elements.perfumeImagePreview.src = value;
    elements.perfumeImagePreview.classList.remove("hidden");
  }

  async function savePerfume(event) {
    event.preventDefault();

    var id = String(elements.perfumeIdInput.value || "").trim();
    var name = String(elements.perfumeNameInput.value || "").trim();
    var brand = String(elements.perfumeBrandInput.value || "").trim();
    var gender = String(elements.perfumeGenderInput.value || "unisex");
    var description = String(elements.perfumeDescriptionInput.value || "").trim();
    var volumes = collectVolumes();

    if (!name || !brand) {
      showToast("Заполните название и бренд.", true);
      return;
    }

    if (!volumes.length) {
      showToast("Добавьте хотя бы один объём и цену.", true);
      return;
    }

    var products = store.getProducts();
    var existing = products.find(function (item) {
      return item.id === id;
    });

    var image = state.imageData || (existing && existing.image) || store.getDefaultData().products[0].image;
    if (String(image).indexOf("data:image/") === 0 && String(image).length > MAX_IMAGE_DATA_LENGTH) {
      showToast("Слишком тяжелое фото. Выберите другое изображение.", true);
      return;
    }

    var payload = {
      id: id || store.uid("p"),
      name: name,
      brand: brand,
      gender: gender,
      description: description,
      image: image,
      volumes: volumes,
      topWeek: elements.topWeekInput.checked,
      topMonth: elements.topMonthInput.checked
    };

    try {
      if (existing) {
        var next = products.map(function (item) {
          return item.id === existing.id ? payload : item;
        });
        await store.saveProducts(next);
        showToast("Товар обновлён");
      } else {
        products.unshift(payload);
        await store.saveProducts(products);
        showToast("Товар добавлен");
      }

      renderProducts();
      resetEditor();
    } catch (error) {
      if (String(error && error.message || "").indexOf("413") >= 0) {
        showToast("Фото слишком тяжелое для сервера. Уменьшите размер.", true);
        return;
      }
      showToast("Не удалось сохранить товар на сервер.", true);
    }
  }

  function resetEditor(options) {
    var keepDraft = options && options.keepDraft;

    state.editingId = null;
    state.imageData = "";

    elements.editorTitle.textContent = "Добавить парфюм";
    elements.perfumeIdInput.value = "";
    elements.perfumeForm.reset();

    elements.volumesContainer.innerHTML = "";
    appendVolumeRow({ ml: "", price: "" });

    setPreviewImage("");

    if (!keepDraft) {
      clearEditorDraft();
    }
  }

  function startEdit(productId) {
    var product = store.getProducts().find(function (item) {
      return item.id === productId;
    });

    if (!product) {
      return;
    }

    state.editingId = product.id;
    state.imageData = product.image;

    elements.editorTitle.textContent = "Редактировать парфюм";
    elements.perfumeIdInput.value = product.id;
    elements.perfumeNameInput.value = product.name;
    elements.perfumeBrandInput.value = product.brand;
    elements.perfumeGenderInput.value = product.gender;
    elements.perfumeDescriptionInput.value = product.description || "";
    elements.topWeekInput.checked = Boolean(product.topWeek);
    elements.topMonthInput.checked = Boolean(product.topMonth);
    elements.perfumeImageInput.value = "";

    setPreviewImage(product.image);

    elements.volumesContainer.innerHTML = "";
    product.volumes.forEach(function (volume) {
      appendVolumeRow({ ml: volume.ml, price: volume.price });
    });

    saveEditorDraftFromForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(productId) {
    var products = store.getProducts();
    var target = products.find(function (item) {
      return item.id === productId;
    });

    if (!target) {
      return;
    }

    var ok = window.confirm("Удалить аромат \"" + target.name + "\"?");
    if (!ok) {
      return;
    }

    var next = products.filter(function (item) {
      return item.id !== productId;
    });

    try {
      await store.saveProducts(next);

      var cart = store.getCart().filter(function (item) {
        return item.productId !== productId;
      });
      store.saveCart(cart);

      renderProducts();
      showToast("Товар удалён");

      if (state.editingId === productId) {
        resetEditor();
      }
    } catch (error) {
      showToast("Не удалось удалить товар на сервере.", true);
    }
  }

  function onProductListClick(event) {
    var actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    var action = actionButton.dataset.action;
    var id = actionButton.dataset.id;

    if (action === "edit") {
      startEdit(id);
    }

    if (action === "delete") {
      deleteProduct(id);
    }
  }

  async function onProductListChange(event) {
    var toggle = event.target.closest("[data-toggle]");
    if (!toggle) {
      return;
    }

    var id = toggle.dataset.id;
    var mode = toggle.dataset.toggle;
    var checked = Boolean(toggle.checked);

    var products = store.getProducts();
    var next = products.map(function (item) {
      if (item.id !== id) {
        return item;
      }
      if (mode === "week") {
        item.topWeek = checked;
      }
      if (mode === "month") {
        item.topMonth = checked;
      }
      return item;
    });

    try {
      await store.saveProducts(next);
      showToast("Топ-статус обновлён");
    } catch (error) {
      showToast("Не удалось обновить топ-статус на сервере.", true);
      toggle.checked = !checked;
    }
  }

  function renderProducts() {
    var products = store.getProducts();

    if (!products.length) {
      elements.adminProductsList.innerHTML = "<div class=\"empty-state\">Каталог пуст. Добавьте первый аромат.</div>";
      return;
    }

    elements.adminProductsList.innerHTML = products.map(function (product) {
      var volumesLine = product.volumes.map(function (volume) {
        return volume.ml + "ml - " + store.formatPrice(volume.price);
      }).join(" | ");

      return ""
        + "<article class=\"admin-product-card\">"
        + "  <img src=\"" + escapeHtml(product.image) + "\" alt=\"" + escapeHtml(product.name) + "\">"
        + "  <div class=\"admin-product-body\">"
        + "    <div class=\"admin-product-head\">"
        + "      <div class=\"admin-product-title\">"
        + "        <strong>" + escapeHtml(product.name) + "</strong>"
        + "        <span>" + escapeHtml(product.brand) + " • " + store.getGenderLabel(product.gender) + "</span>"
        + "      </div>"
        + "      <div class=\"admin-product-actions\">"
        + "        <button class=\"btn btn-ghost\" type=\"button\" data-action=\"edit\" data-id=\"" + escapeHtml(product.id) + "\">Редактировать</button>"
        + "        <button class=\"btn btn-ghost\" type=\"button\" data-action=\"delete\" data-id=\"" + escapeHtml(product.id) + "\">Удалить</button>"
        + "      </div>"
        + "    </div>"
        + "    <p class=\"meta-line\">" + escapeHtml(volumesLine) + "</p>"
        + "    <div class=\"admin-product-actions\">"
        + "      <label class=\"toggle-inline\"><input type=\"checkbox\" data-toggle=\"week\" data-id=\"" + escapeHtml(product.id) + "\" " + (product.topWeek ? "checked" : "") + ">Топ недели</label>"
        + "      <label class=\"toggle-inline\"><input type=\"checkbox\" data-toggle=\"month\" data-id=\"" + escapeHtml(product.id) + "\" " + (product.topMonth ? "checked" : "") + ">Топ месяца</label>"
        + "    </div>"
        + "  </div>"
        + "</article>";
    }).join("");
  }

  function showToast(message, isError) {
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
