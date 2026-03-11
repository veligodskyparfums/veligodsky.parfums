(function () {
  "use strict";

  var store = window.VeligodskyStore;
  if (!store) {
    return;
  }

  var AUTH_KEY = "veligodsky_admin_auth";

  var state = {
    editingId: null,
    imageData: ""
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
    });

    elements.perfumeImageInput.addEventListener("change", handleImageUpload);
    elements.perfumeForm.addEventListener("submit", savePerfume);
    elements.cancelEditBtn.addEventListener("click", resetEditor);

    elements.adminProductsList.addEventListener("click", onProductListClick);
    elements.adminProductsList.addEventListener("change", onProductListChange);

    window.addEventListener("focus", function () {
      if (isAuthenticated()) {
        refreshPanelFromServer(false);
      }
    });
  }

  function checkAuth() {
    if (isAuthenticated()) {
      openPanel();
    } else {
      openLogin();
    }
  }

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === "1";
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
    resetEditor();
  }

  async function refreshPanelFromServer(showErrorToast) {
    if (typeof store.syncFromServer === "function") {
      try {
        await store.syncFromServer();
      } catch (error) {
        if (showErrorToast) {
          showToast("Не удалось обновить данные с сервера.", true);
        }
      }
    }
    refreshPanel();
  }

  async function onLogin(event) {
    event.preventDefault();
    if (typeof store.syncFromServer === "function") {
      try {
        await store.syncFromServer();
      } catch (error) {
        showToast("Сервер недоступен, вход по локальным данным.", true);
      }
    }
    var inputPassword = String(elements.passwordInput.value || "").trim();
    var currentPassword = store.getSettings().adminPassword;

    if (inputPassword !== currentPassword) {
      showToast("Неверный пароль.", true);
      return;
    }

    sessionStorage.setItem(AUTH_KEY, "1");
    openPanel();
    showToast("Вход выполнен");
  }

  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    openLogin();
  }

  function fillSettingsForm() {
    var settings = store.getSettings();
    elements.telegramChannelInput.value = settings.telegramChannel;
    elements.telegramDmInput.value = settings.telegramDM;
    elements.freeShippingInput.value = String(settings.freeShippingThreshold);
    elements.adminPasswordNewInput.value = "";
  }

  async function saveSettings(event) {
    event.preventDefault();

    var channel = String(elements.telegramChannelInput.value || "").trim();
    var dm = String(elements.telegramDmInput.value || "").trim();
    var freeShippingThreshold = Math.max(0, Math.round(Number(elements.freeShippingInput.value) || 0));
    var newAdminPassword = String(elements.adminPasswordNewInput.value || "").trim();

    var patch = {
      telegramChannel: channel,
      telegramDM: dm,
      freeShippingThreshold: freeShippingThreshold
    };

    if (newAdminPassword) {
      patch.adminPassword = newAdminPassword;
    }

    try {
      await store.updateSettings(patch);
      elements.adminPasswordNewInput.value = "";
      showToast("Настройки сохранены");
    } catch (error) {
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

  function handleImageUpload() {
    var file = elements.perfumeImageInput.files && elements.perfumeImageInput.files[0];
    if (!file) {
      return;
    }

    if (!String(file.type).startsWith("image/")) {
      showToast("Выберите файл изображения.", true);
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      state.imageData = String(reader.result || "");
      setPreviewImage(state.imageData);
    };
    reader.readAsDataURL(file);
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
      showToast("Не удалось сохранить товар на сервер.", true);
    }
  }

  function resetEditor() {
    state.editingId = null;
    state.imageData = "";

    elements.editorTitle.textContent = "Добавить парфюм";
    elements.perfumeIdInput.value = "";
    elements.perfumeForm.reset();

    elements.volumesContainer.innerHTML = "";
    appendVolumeRow({ ml: "", price: "" });

    setPreviewImage("");
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
