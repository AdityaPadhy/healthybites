(function () {
  var config = {};
  var allItems = [];
  var translations = {};
  var cart = {};
  var lang = 'en';
  var serviceClosed = false;
  var ordersClosed = false;

  async function init() {
    try {
      var results = await Promise.all([
        fetch('data/config.json'),
        fetch('data/items.json'),
        fetch('data/translations.json'),
      ]);
      config = await results[0].json();
      allItems = await results[1].json();
      translations = await results[2].json();
    } catch (e) {
      document.getElementById('grid').innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:#c0392b;">Failed to load data. Please try refreshing.</p>';
      return;
    }

    lang = localStorage.getItem('hb-lang') || config.defaultLanguage || 'en';

    applyConfig();
    buildLangSwitcher();
    applyServiceStatus();
    applyDeliveryInfo();
    applyOrderSchedule();
    renderItems(allItems);
    setupFilters(allItems);
    setupSearch();
    setupLightbox();
    setupCart();
    setupDetailModal();
    applyTranslations();

    document.getElementById('footerWa').href = 'https://wa.me/' + config.whatsappNumber;
    document.getElementById('footerYear').textContent = new Date().getFullYear();
    document.getElementById('footerBrand').textContent = config.siteName || 'Healthy Bites';
  }

  // ===== I18N =====

  function t(key) {
    var strings = translations[lang] || translations['en'] || {};
    return strings[key] || (translations['en'] && translations['en'][key]) || key;
  }

  function localized(item, field) {
    if (lang !== 'en' && item[field + '_' + lang]) return item[field + '_' + lang];
    return item[field] || '';
  }

  function localizedConfig(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj['en'] || '';
  }

  function buildLangSwitcher() {
    var langs = config.languages || ['en'];
    if (langs.length <= 1) return;

    var container = document.getElementById('langSwitcher');
    container.innerHTML = langs.map(function (l) {
      return '<button class="lang-btn' + (l === lang ? ' active' : '') + '" data-lang="' + l + '">' + l + '</button>';
    }).join('');

    container.addEventListener('click', function (e) {
      var btn = e.target.closest('.lang-btn');
      if (!btn || btn.dataset.lang === lang) return;
      lang = btn.dataset.lang;
      localStorage.setItem('hb-lang', lang);
      container.querySelectorAll('.lang-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.lang === lang); });
      renderItems(getFilteredItems());
      setupFilters(allItems);
      applyTranslations();
      applyServiceStatus();
      updateScheduleStatus();
      renderCart();
    });
  }

  function applyTranslations() {
    setText('searchInput', 'placeholder', t('searchPlaceholder'));
    setText('footerTagline', 'text', t('footerOrder'));
    setText('footerWaText', 'text', t('contactWhatsApp'));
    setText('drawerTitle', 'text', t('yourOrder'));
    setText('drawerOrderText', 'text', t('orderVia'));
    setText('disclaimerSummary', 'text', t('disclaimer'));
    setText('disclaimerText1', 'text', t('disclaimerText1'));
    setText('disclaimerText2', 'text', t('disclaimerText2'));
    setText('emptyStateText', 'text', t('noResults'));

    var tagline = localizedConfig(config.tagline);
    if (tagline) document.getElementById('tagline').textContent = tagline;

    // Delivery info
    var info = config.deliveryInfo;
    if (info && info.message) {
      var noteEl = document.getElementById('drawerDeliveryNote');
      if (noteEl) noteEl.textContent = localizedConfig(info.message);
    }

    // Payment note
    if (config.paymentInfo && config.paymentInfo.note) {
      var payEl = document.getElementById('drawerPaymentNote');
      if (payEl) payEl.textContent = localizedConfig(config.paymentInfo.note);
    }

    // Footer rights
    var rightsEl = document.querySelector('.footer-copy');
    if (rightsEl) {
      rightsEl.innerHTML = '&copy; ' + new Date().getFullYear() + ' ' + escH(config.siteName || 'Healthy Bites') + '. ' + t('allRights');
    }
  }

  function setText(id, type, val) {
    var el = document.getElementById(id);
    if (!el) return;
    if (type === 'placeholder') el.placeholder = val;
    else el.textContent = val;
  }

  // ===== CONFIG =====

  function applyConfig() {
    document.getElementById('siteName').textContent = config.siteName || 'Healthy Bites';
    document.getElementById('tagline').textContent = localizedConfig(config.tagline);
    document.title = config.siteName || 'Healthy Bites';
    if (config.logo) {
      var logoEl = document.querySelector('.logo-img');
      if (logoEl) logoEl.src = config.logo;
    }
  }

  function applyServiceStatus() {
    var status = config.serviceStatus;
    if (!status || status.open !== false) return;

    serviceClosed = true;
    document.body.classList.add('service-closed');
    var banner = document.getElementById('serviceBanner');
    document.getElementById('serviceBannerMsg').textContent = localizedConfig(status.message) || t('serviceClosed');
    banner.hidden = false;
  }

  function applyDeliveryInfo() {
    var info = config.deliveryInfo;
    if (!info || !info.areas || !info.areas.length) return;

    var bar = document.getElementById('deliveryBar');
    document.getElementById('deliveryAreas').textContent = info.areas.join(' · ');

    var minEl = document.getElementById('deliveryMin');
    if (info.minOrder) {
      var currency = config.currency || '€';
      minEl.textContent = 'Min: ' + currency + info.minOrder;
    }

    bar.hidden = false;

    var select = document.getElementById('deliveryAreaSelect');
    if (select.options.length <= 1) {
      info.areas.forEach(function (area) {
        var opt = document.createElement('option');
        opt.value = area;
        opt.textContent = area;
        select.appendChild(opt);
      });
    }
  }

  // ===== ORDER SCHEDULE =====

  function applyOrderSchedule() {
    var sched = config.orderSchedule;
    if (!sched) return;

    var bar = document.getElementById('scheduleBar');
    bar.hidden = false;

    updateScheduleStatus();
    setInterval(updateScheduleStatus, 60000);
  }

  function getNowInTimezone() {
    var tz = (config.orderSchedule && config.orderSchedule.timezone) || 'Europe/Brussels';
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false
      }).formatToParts(new Date());
      var h = 0, m = 0;
      parts.forEach(function (p) {
        if (p.type === 'hour') h = parseInt(p.value, 10);
        if (p.type === 'minute') m = parseInt(p.value, 10);
      });
      return { hours: h, minutes: m };
    } catch (e) {
      var now = new Date();
      return { hours: now.getHours(), minutes: now.getMinutes() };
    }
  }

  function updateScheduleStatus() {
    var sched = config.orderSchedule;
    if (!sched) return;

    var now = getNowInTimezone();
    var cutoff = sched.cutoffHour || 17;
    var window = sched.deliveryWindow || '17:00 – 21:00';
    var cutoffStr = (cutoff < 10 ? '0' : '') + cutoff + ':00';

    var bar = document.getElementById('scheduleBar');
    var statusEl = document.getElementById('scheduleStatus');
    var countdownEl = document.getElementById('scheduleCountdown');

    var isOpen = now.hours < cutoff;

    if (isOpen) {
      ordersClosed = false;
      bar.classList.remove('closed-bar');

      var minsLeft = (cutoff - now.hours - 1) * 60 + (60 - now.minutes);
      var hLeft = Math.floor(minsLeft / 60);
      var mLeft = minsLeft % 60;
      var timeLeft = hLeft > 0 ? hLeft + 'h ' + mLeft + 'min' : mLeft + ' min';

      statusEl.innerHTML =
        '<span class="schedule-dot open"></span>' +
        t('orderBefore').replace('{time}', cutoffStr);
      countdownEl.textContent = t('deliveryTonight').replace('{window}', window) + ' · ' + timeLeft + ' left';
    } else {
      ordersClosed = true;
      bar.classList.add('closed-bar');

      statusEl.innerHTML =
        '<span class="schedule-dot closed"></span>' +
        t('ordersClosed').replace('{time}', cutoffStr);
      countdownEl.textContent = t('deliveryWindow') + ': ' + window;
    }

    // Disable ordering UI when past cutoff
    if (ordersClosed && !serviceClosed) {
      document.querySelectorAll('.add-btn').forEach(function (btn) {
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
      });
    }
  }

  // ===== RENDERING =====

  function renderItems(items) {
    var grid = document.getElementById('grid');
    var empty = document.getElementById('emptyState');

    if (items.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    grid.innerHTML = items.map(cardHTML).join('');
  }

  function badgeClass(label) {
    var slug = label.toLowerCase().replace(/[\s]+/g, '-').replace(/[^a-z0-9-]/g, '');
    var known = ['new', 'bestseller', 'vegan', 'gluten-free', 'high-protein', 'sugar-free', 'organic'];
    return known.indexOf(slug) !== -1 ? 'badge-' + slug : 'badge-default';
  }

  function cardHTML(item) {
    var firstImg = (item.images && item.images[0]) || '';
    var imgCount = (item.images && item.images.length) || 0;
    var currency = config.currency || '€';
    var isUnavailable = item.available === false;
    var name = localized(item, 'name');
    var desc = localized(item, 'description');
    var cat = localized(item, 'category');

    var badgesHTML = '';
    if (item.badges && item.badges.length && !isUnavailable) {
      badgesHTML = '<div class="card-badges">' +
        item.badges.map(function (b) {
          return '<span class="card-badge ' + badgeClass(b) + '">' + escH(b) + '</span>';
        }).join('') +
        '</div>';
    }

    var countBadge = imgCount > 1
      ? '<span class="card-img-count">1/' + imgCount + '</span>'
      : '';

    var unavailBadge = isUnavailable
      ? '<span class="unavailable-badge">' + t('unavailable') + '</span>'
      : '';

    var addButton = (!isUnavailable && !serviceClosed && !ordersClosed)
      ? '<button class="add-btn" data-action="add" data-id="' + esc(item.id) + '" title="' + esc(t('addToOrder')) + '">+</button>'
      : '';

    return (
      '<article class="card' + (isUnavailable ? ' unavailable' : '') + '" data-item-id="' + esc(item.id) + '">' +
        '<div class="card-img-wrap">' +
          '<img src="' + esc(firstImg) + '" alt="' + esc(name) + '" loading="lazy">' +
          badgesHTML +
          countBadge +
          unavailBadge +
        '</div>' +
        '<div class="card-body">' +
          '<span class="card-category">' + escH(cat) + '</span>' +
          '<h2 class="card-name">' + escH(name) + '</h2>' +
          '<p class="card-desc">' + escH(desc) + '</p>' +
          '<span class="card-desc-more">' + t('readMore') + '</span>' +
          '<div class="card-footer">' +
            '<span class="card-price">' + currency + item.price.toFixed(2) + '</span>' +
            addButton +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  // ===== DETAIL MODAL =====

  function setupDetailModal() {
    var overlay = document.getElementById('detailModal');
    var closeBtn = document.getElementById('detailClose');

    document.getElementById('grid').addEventListener('click', function (e) {
      var addBtn = e.target.closest('[data-action="add"]');
      if (addBtn) {
        e.stopPropagation();
        addToCart(addBtn.dataset.id);
        return;
      }

      var card = e.target.closest('.card');
      if (card) {
        openDetail(card.dataset.itemId);
      }
    });

    closeBtn.addEventListener('click', closeDetail);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeDetail();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) closeDetail();
    });
  }

  function openDetail(itemId) {
    var item = allItems.find(function (i) { return i.id === itemId; });
    if (!item) return;

    var overlay = document.getElementById('detailModal');
    var carouselEl = document.getElementById('modalCarousel');
    var bodyEl = document.getElementById('modalBody');
    var currency = config.currency || '€';
    var isUnavailable = item.available === false;
    var name = localized(item, 'name');

    // Carousel
    var images = item.images || [];
    var slides = images.map(function (src) {
      return '<div class="modal-carousel-slide"><img src="' + esc(src) + '" alt="' + esc(name) + '"></div>';
    }).join('');

    var dots = images.length > 1
      ? '<div class="carousel-dots">' + images.map(function (_, i) {
          return '<button class="carousel-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i + '"></button>';
        }).join('') + '</div>'
      : '';

    var arrows = images.length > 1
      ? '<button class="carousel-btn prev">&#8249;</button><button class="carousel-btn next">&#8250;</button>'
      : '';

    carouselEl.innerHTML = '<div class="modal-carousel-track">' + slides + '</div>' + arrows + dots;
    if (images.length > 1) setupModalCarousel(carouselEl);

    // Badges
    var badgesHTML = '';
    if (item.badges && item.badges.length) {
      badgesHTML = '<div class="info-pills" style="margin-bottom:12px">' +
        item.badges.map(function (b) {
          return '<span class="card-badge ' + badgeClass(b) + '" style="font-size:0.7rem;padding:3px 10px">' + escH(b) + '</span>';
        }).join('') +
        '</div>';
    }

    // Share
    var shareHTML =
      '<div class="modal-actions">' +
        '<button class="share-btn" data-action="share-wa">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>' +
          t('shareWhatsApp') +
        '</button>' +
        '<button class="share-btn" data-action="share-copy">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
          t('copyLink') +
        '</button>' +
      '</div>';

    // Ingredients
    var ingredients = localized(item, 'ingredients');
    var ingredientsHTML = '';
    if (ingredients && ingredients.length) {
      ingredientsHTML =
        '<div class="modal-info-section">' +
          '<div class="modal-info-title">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' +
            t('ingredients') +
          '</div>' +
          '<div class="info-pills">' +
            ingredients.map(function (ing) {
              return '<span class="info-pill">' + escH(ing) + '</span>';
            }).join('') +
          '</div>' +
        '</div>';
    }

    // Stats
    var qty = localized(item, 'quantity');
    var cal = localized(item, 'calories');
    var statsHTML = '';
    if (qty || cal) {
      var statCards = '';
      if (qty) statCards += '<div class="info-stat"><div class="info-stat-label">' + t('quantity') + '</div><div class="info-stat-value">' + escH(qty) + '</div></div>';
      if (cal) statCards += '<div class="info-stat"><div class="info-stat-label">' + t('calories') + '</div><div class="info-stat-value">' + escH(cal) + '</div></div>';
      statsHTML = '<div class="modal-info-section"><div class="info-row">' + statCards + '</div></div>';
    }

    // Allergy
    var allergy = localized(item, 'allergyInfo');
    var allergyHTML = '';
    if (allergy && allergy.length) {
      allergyHTML =
        '<div class="modal-info-section">' +
          '<div class="modal-info-title">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
            t('allergyInfo') +
          '</div>' +
          '<ul class="allergy-list">' +
            allergy.map(function (a) { return '<li>' + escH(a) + '</li>'; }).join('') +
          '</ul>' +
        '</div>';
    }

    // Order button
    var orderBtn = '';
    if (isUnavailable) {
      orderBtn = '<div style="text-align:center;padding:14px;color:#c0392b;font-weight:600;background:#fdf0ef;border-radius:8px;margin-top:20px">' + t('currentlyUnavailable') + '</div>';
    } else if (!serviceClosed && !ordersClosed) {
      orderBtn =
        '<a class="modal-order-btn" data-action="add-from-modal" href="#">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>' +
          t('addToOrder') + ' (' + currency + item.price.toFixed(2) + ')' +
        '</a>';
    }

    bodyEl.innerHTML =
      '<span class="modal-category">' + escH(localized(item, 'category')) + '</span>' +
      '<h2 class="modal-name">' + escH(name) + '</h2>' +
      badgesHTML +
      '<div class="modal-price">' + currency + item.price.toFixed(2) + '</div>' +
      '<p class="modal-desc">' + escH(localized(item, 'description')) + '</p>' +
      shareHTML +
      statsHTML +
      ingredientsHTML +
      allergyHTML +
      orderBtn;

    bodyEl.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var action = btn.dataset.action;
        if (action === 'add-from-modal') {
          addToCart(item.id);
          closeDetail();
          openCartDrawer();
        } else if (action === 'share-wa') {
          shareViaWhatsApp(item);
        } else if (action === 'share-copy') {
          copyItemLink(item);
        }
      });
    });

    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    document.getElementById('detailModal').hidden = true;
    document.body.style.overflow = '';
  }

  function setupModalCarousel(el) {
    var track = el.querySelector('.modal-carousel-track');
    var slides = el.querySelectorAll('.modal-carousel-slide');
    var dots = el.querySelectorAll('.carousel-dot');
    var prevBtn = el.querySelector('.carousel-btn.prev');
    var nextBtn = el.querySelector('.carousel-btn.next');
    var current = 0;

    function goTo(index) {
      current = (index + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + current * 100 + '%)';
      dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () { goTo(parseInt(dot.dataset.index, 10)); });
    });

    var startX = 0, deltaX = 0;
    el.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; deltaX = 0; }, { passive: true });
    el.addEventListener('touchmove', function (e) { deltaX = e.touches[0].clientX - startX; }, { passive: true });
    el.addEventListener('touchend', function () { if (Math.abs(deltaX) > 40) goTo(deltaX < 0 ? current + 1 : current - 1); });
  }

  // ===== SHARING =====

  function shareViaWhatsApp(item) {
    var currency = config.currency || '€';
    var text = t('checkOut')
      .replace('{name}', localized(item, 'name'))
      .replace('{currency}', currency)
      .replace('{price}', item.price.toFixed(2))
      .replace('{brand}', config.siteName || 'Healthy Bites');
    text += '\n' + location.href.split('?')[0] + '?item=' + item.id;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  function copyItemLink(item) {
    var url = location.href.split('?')[0] + '?item=' + item.id;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { showToast(t('linkCopied')); });
    } else {
      showToast(url);
    }
  }

  function showToast(msg) {
    var existing = document.querySelector('.share-toast');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'share-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2500);
  }

  // ===== CART =====

  function setupCart() {
    document.getElementById('cartBtn').addEventListener('click', function () {
      if (serviceClosed || ordersClosed) return;
      toggleCartDrawer();
    });
    document.getElementById('drawerClose').addEventListener('click', closeCartDrawer);
    document.getElementById('drawerOverlay').addEventListener('click', closeCartDrawer);

    document.getElementById('drawerBody').addEventListener('click', function (e) {
      var btn = e.target.closest('.qty-btn');
      if (!btn) return;
      var id = btn.dataset.id;
      var action = btn.dataset.qtyAction;
      if (action === 'inc') cart[id] = (cart[id] || 0) + 1;
      else if (action === 'dec') { cart[id] = (cart[id] || 0) - 1; if (cart[id] <= 0) delete cart[id]; }
      renderCart();
    });

    var params = new URLSearchParams(location.search);
    var itemParam = params.get('item');
    if (itemParam) setTimeout(function () { openDetail(itemParam); }, 300);
  }

  function addToCart(itemId) {
    if (serviceClosed || ordersClosed) return;
    cart[itemId] = (cart[itemId] || 0) + 1;
    renderCart();

    var btn = document.querySelector('.add-btn[data-id="' + itemId + '"]');
    if (btn) {
      btn.classList.add('added');
      btn.textContent = '✓';
      setTimeout(function () { btn.classList.remove('added'); btn.textContent = '+'; }, 800);
    }
  }

  function renderCart() {
    var body = document.getElementById('drawerBody');
    var footer = document.getElementById('drawerFooter');
    var countEl = document.getElementById('cartCount');
    var totalEl = document.getElementById('drawerTotal');
    var orderBtn = document.getElementById('drawerOrderBtn');
    var currency = config.currency || '€';

    var ids = Object.keys(cart);
    var totalQty = 0;
    var totalPrice = 0;
    ids.forEach(function (id) { totalQty += cart[id]; });

    if (totalQty > 0) { countEl.textContent = totalQty; countEl.classList.add('visible'); }
    else { countEl.classList.remove('visible'); }

    if (ids.length === 0) {
      body.innerHTML = '<p class="drawer-empty">' + t('cartEmpty') + '</p>';
      footer.hidden = true;
      return;
    }

    var html = '';
    ids.forEach(function (id) {
      var item = allItems.find(function (i) { return i.id === id; });
      if (!item) return;
      var qty = cart[id];
      var lineTotal = item.price * qty;
      totalPrice += lineTotal;
      var img = (item.images && item.images[0]) || '';

      html +=
        '<div class="cart-item">' +
          '<img class="cart-item-img" src="' + esc(img) + '" alt="' + esc(localized(item, 'name')) + '">' +
          '<div class="cart-item-info">' +
            '<div class="cart-item-name">' + escH(localized(item, 'name')) + '</div>' +
            '<div class="cart-item-price">' + currency + lineTotal.toFixed(2) + '</div>' +
          '</div>' +
          '<div class="cart-item-qty">' +
            '<button class="qty-btn" data-id="' + esc(id) + '" data-qty-action="dec">−</button>' +
            '<span class="qty-value">' + qty + '</span>' +
            '<button class="qty-btn" data-id="' + esc(id) + '" data-qty-action="inc">+</button>' +
          '</div>' +
        '</div>';
    });

    body.innerHTML = html;
    totalEl.textContent = currency + totalPrice.toFixed(2);
    footer.hidden = false;

    // Delivery
    var deliverySection = document.getElementById('drawerDelivery');
    var deliveryInfo = config.deliveryInfo;
    if (deliveryInfo && deliveryInfo.areas && deliveryInfo.areas.length) {
      deliverySection.hidden = false;
      var noteEl = document.getElementById('drawerDeliveryNote');
      if (noteEl && deliveryInfo.message) noteEl.textContent = localizedConfig(deliveryInfo.message);
    }

    // Payment note
    var paymentNote = document.getElementById('drawerPaymentNote');
    if (config.paymentInfo && config.paymentInfo.note) {
      paymentNote.textContent = localizedConfig(config.paymentInfo.note);
      paymentNote.hidden = false;
    }

    // Min order warning
    var minWarning = document.getElementById('drawerMinWarning');
    var minOrder = deliveryInfo && deliveryInfo.minOrder ? deliveryInfo.minOrder : 0;
    if (minOrder && totalPrice < minOrder) {
      minWarning.textContent = t('minOrderWarning')
        .replace('{currency}', currency)
        .replace('{amount}', minOrder.toFixed(2))
        .replace('{remaining}', (minOrder - totalPrice).toFixed(2));
      minWarning.hidden = false;
      orderBtn.classList.add('disabled');
    } else {
      minWarning.hidden = true;
      orderBtn.classList.remove('disabled');
    }

    orderBtn.href = '#';
    orderBtn.onclick = function (e) {
      e.preventDefault();
      if (orderBtn.classList.contains('disabled')) return;
      placeOrder(totalPrice);
    };
  }

  function generateOrderId() {
    var now = new Date();
    var datePart = '' + now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    var rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return 'HB-' + datePart + '-' + rand;
  }

  function placeOrder(totalPrice) {
    var orderId = generateOrderId();
    var waUrl = buildWhatsAppOrderLink(totalPrice, orderId);

    window.open(waUrl, '_blank');

    cart = {};
    renderCart();
    closeCartDrawer();

    showOrderConfirmation(orderId);
  }

  function showOrderConfirmation(orderId) {
    var overlay = document.createElement('div');
    overlay.className = 'order-confirm-overlay';
    overlay.innerHTML =
      '<div class="order-confirm">' +
        '<div class="order-confirm-icon">✓</div>' +
        '<h3>' + t('orderPlaced') + '</h3>' +
        '<p class="order-confirm-id">' + t('orderId') + ': <strong>' + orderId + '</strong></p>' +
        '<p class="order-confirm-msg">' + t('orderConfirmMsg') + '</p>' +
        '<button class="order-confirm-btn" id="orderConfirmClose">' + t('orderConfirmClose') + '</button>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#orderConfirmClose').addEventListener('click', function () {
      overlay.remove();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  function buildWhatsAppOrderLink(totalPrice, orderId) {
    var currency = config.currency || '€';
    var lines = [t('orderIntro')];
    lines.push(t('orderId') + ': ' + orderId);
    lines.push('');
    Object.keys(cart).forEach(function (id) {
      var item = allItems.find(function (i) { return i.id === id; });
      if (!item) return;
      var qty = cart[id];
      lines.push('• ' + localized(item, 'name') + ' x' + qty + ' — ' + currency + (item.price * qty).toFixed(2));
    });
    lines.push('');
    lines.push(t('total') + ': ' + currency + totalPrice.toFixed(2));

    var areaSelect = document.getElementById('deliveryAreaSelect');
    if (areaSelect && areaSelect.value) {
      lines.push(t('deliveryArea') + ': ' + areaSelect.value);
    }
    if (config.paymentInfo && config.paymentInfo.methods) {
      lines.push('');
      lines.push(t('payment') + ': ' + config.paymentInfo.methods.join(' / '));
    }
    return 'https://wa.me/' + config.whatsappNumber + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function toggleCartDrawer() {
    var drawer = document.getElementById('cartDrawer');
    drawer.classList.contains('open') ? closeCartDrawer() : openCartDrawer();
  }

  function openCartDrawer() {
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('drawerOverlay').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeCartDrawer() {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').hidden = true;
    if (document.getElementById('detailModal').hidden) document.body.style.overflow = '';
  }

  // ===== FILTERS =====

  function setupFilters(items) {
    var container = document.getElementById('filters');
    var categories = [t('filterAll')];
    var catMap = {};
    catMap[t('filterAll')] = 'All';

    items.forEach(function (item) {
      var cat = localized(item, 'category');
      if (cat && categories.indexOf(cat) === -1) {
        categories.push(cat);
        catMap[cat] = item.category;
      }
    });

    container.innerHTML = categories.map(function (cat, i) {
      return '<button class="filter-pill' + (i === 0 ? ' active' : '') + '" data-category="' + esc(catMap[cat] || cat) + '">' + escH(cat) + '</button>';
    }).join('');

    container.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-pill');
      if (!btn) return;
      container.querySelectorAll('.filter-pill').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      renderItems(getFilteredItems());
    });
  }

  function setupSearch() {
    var input = document.getElementById('searchInput');
    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { renderItems(getFilteredItems()); }, 200);
    });
  }

  function getFilteredItems() {
    var activeFilter = document.querySelector('.filter-pill.active');
    var category = activeFilter ? activeFilter.dataset.category : 'All';
    var query = document.getElementById('searchInput').value.toLowerCase().trim();

    return allItems.filter(function (item) {
      var matchCat = category === 'All' || item.category === category;
      var name = localized(item, 'name').toLowerCase();
      var desc = localized(item, 'description').toLowerCase();
      var matchSearch = !query || name.indexOf(query) !== -1 || desc.indexOf(query) !== -1;
      return matchCat && matchSearch;
    });
  }

  // ===== LIGHTBOX =====

  function setupLightbox() {
    var lightbox = document.getElementById('lightbox');
    var img = document.getElementById('lightboxImg');
    var closeBtn = document.getElementById('lightboxClose');

    document.addEventListener('click', function (e) {
      var slideImg = e.target.closest('.modal-carousel-slide img');
      if (slideImg) { img.src = slideImg.src; lightbox.hidden = false; }
    });

    closeBtn.addEventListener('click', closeLB);
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLB(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lightbox.hidden) closeLB(); });

    function closeLB() { lightbox.hidden = true; img.src = ''; }
  }

  // ===== HELPERS =====

  function escH(str) {
    if (Array.isArray(str)) return str.map(escH);
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  init();
})();
