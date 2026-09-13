/** Shipping zones — keep in sync with shipping.html tables.
 *  Kit outbound: Royal Mail International Tracked, small parcel up to 500g (online, Aug 2026) + buffer.
 *  Finished grillz: Royal Mail International Tracked, small parcel up to 250g (online, Aug 2026) + buffer.
 *  UK finished grillz: Royal Mail Tracked 48 with Signature (online £5.25). */
const SHIPPING_ZONES = {
  uk: {
    label: "United Kingdom",
    kitFee: 20,
    kitShipping: 0,
    finishShipping: 6.99,
    kitLabel: "Mould kit (UK, all-in)",
  },
  ireland: {
    label: "Ireland",
    kitFee: 10,
    kitShipping: 9.99,
    finishShipping: 9.99,
    kitLabel: "Mould kit materials",
  },
  "europe-eu": {
    label: "Europe (EU)",
    kitFee: 10,
    kitShipping: 12.99,
    finishShipping: 10.99,
    kitLabel: "Mould kit materials",
  },
  "europe-non-eu": {
    label: "Europe (non-EU)",
    kitFee: 10,
    kitShipping: 14.99,
    finishShipping: 13.99,
    kitLabel: "Mould kit materials",
  },
  "us-canada": {
    label: "United States & Canada",
    kitFee: 10,
    kitShipping: 15.99,
    finishShipping: 13.99,
    kitLabel: "Mould kit materials",
  },
  "australia-nz": {
    label: "Australia & New Zealand",
    kitFee: 10,
    kitShipping: 17.99,
    finishShipping: 16.99,
    kitLabel: "Mould kit materials",
  },
  "middle-east": {
    label: "Middle East",
    kitFee: 10,
    kitShipping: 18.99,
    finishShipping: 15.99,
    kitLabel: "Mould kit materials",
  },
  asia: {
    label: "Asia",
    kitFee: 10,
    kitShipping: 16.99,
    finishShipping: 13.99,
    kitLabel: "Mould kit materials",
  },
  africa: {
    label: "Africa",
    kitFee: 10,
    kitShipping: 18.99,
    finishShipping: 15.99,
    kitLabel: "Mould kit materials",
  },
  "south-america": {
    label: "South & Central America",
    kitFee: 10,
    kitShipping: 18.99,
    finishShipping: 15.99,
    kitLabel: "Mould kit materials",
  },
  "rest-of-world": {
    label: "Rest of World",
    kitFee: 10,
    kitShipping: 19.99,
    finishShipping: 15.99,
    kitLabel: "Mould kit materials",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CURRENCY_STORAGE_KEY = "kf-currency";
const FX_RATES_STORAGE_KEY = "kf-fx-rates";
const FX_CACHE_MS = 24 * 60 * 60 * 1000;
const FX_API_URL = "https://api.frankfurter.app/latest?from=GBP&to=USD,EUR,CAD,AUD";

const SUPPORTED_CURRENCIES = {
  GBP: { code: "GBP", locale: "en-GB" },
  USD: { code: "USD", locale: "en-US" },
  EUR: { code: "EUR", locale: "de-DE" },
  CAD: { code: "CAD", locale: "en-CA" },
  AUD: { code: "AUD", locale: "en-AU" },
};

const FALLBACK_FX_RATES = {
  USD: 1.27,
  EUR: 1.17,
  CAD: 1.73,
  AUD: 1.94,
};

let fxRates = { ...FALLBACK_FX_RATES };
let selectedCurrency = "GBP";
let checkoutUpdateSummary = null;

function loadSelectedCurrency() {
  const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
  if (saved && SUPPORTED_CURRENCIES[saved]) {
    selectedCurrency = saved;
  }
}

function getSelectedCurrency() {
  return selectedCurrency;
}

function setSelectedCurrency(code) {
  const upper = code.toUpperCase();
  if (!SUPPORTED_CURRENCIES[upper]) return;
  selectedCurrency = upper;
  localStorage.setItem(CURRENCY_STORAGE_KEY, upper);
}

function readFxCache() {
  const raw = localStorage.getItem(FX_RATES_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.rates || !parsed?.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeFxCache(rates) {
  localStorage.setItem(
    FX_RATES_STORAGE_KEY,
    JSON.stringify({ rates, fetchedAt: Date.now() })
  );
  fxRates = { ...rates };
}

function isFxCacheFresh(cache) {
  return cache && Date.now() - cache.fetchedAt < FX_CACHE_MS;
}

async function fetchExchangeRates() {
  loadSelectedCurrency();
  const cache = readFxCache();
  if (isFxCacheFresh(cache)) {
    fxRates = { ...cache.rates };
    return;
  }
  try {
    const res = await fetch(FX_API_URL);
    if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
    const data = await res.json();
    if (!data?.rates) throw new Error("FX response missing rates");
    writeFxCache(data.rates);
  } catch {
    if (cache?.rates) {
      fxRates = { ...cache.rates };
    } else {
      fxRates = { ...FALLBACK_FX_RATES };
    }
  }
}

function convertFromGbp(amountGbp) {
  if (selectedCurrency === "GBP") return amountGbp;
  const rate = fxRates[selectedCurrency];
  if (!rate) return amountGbp;
  return amountGbp * rate;
}

function formatMoney(amountGbp) {
  const converted = convertFromGbp(amountGbp);
  const cfg = SUPPORTED_CURRENCIES[selectedCurrency];
  const formatted = new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);
  return formatted.replace(/\.00$/, "");
}

function money(amountGbp) {
  return `from ${formatMoney(amountGbp)}`;
}

function formatPrice(amountGbp) {
  return formatMoney(amountGbp);
}

function applyStaticPrices() {
  document.querySelectorAll("[data-price-gbp]").forEach((el) => {
    const amount = parseFloat(el.dataset.priceGbp);
    if (Number.isFinite(amount)) {
      el.textContent = formatMoney(amount);
    }
  });
}

function updateCurrencyDisclaimer() {
  const checkoutSummary = document.querySelector(".checkout-layout .summary");
  let disclaimer = document.getElementById("currency-disclaimer");

  if (selectedCurrency === "GBP") {
    if (disclaimer) disclaimer.hidden = true;
    return;
  }

  if (!disclaimer && checkoutSummary) {
    disclaimer = document.createElement("p");
    disclaimer.id = "currency-disclaimer";
    disclaimer.className = "currency-disclaimer";
    const lede = checkoutSummary.querySelector(".lede");
    if (lede) {
      checkoutSummary.insertBefore(disclaimer, lede);
    } else {
      checkoutSummary.appendChild(disclaimer);
    }
  }

  if (disclaimer) {
    disclaimer.hidden = false;
    disclaimer.textContent = `Prices shown in ${selectedCurrency}. Charged in GBP at checkout.`;
  }
}

function refreshCurrencyDisplay() {
  applyStaticPrices();
  if (document.getElementById("shop-grid")) {
    fillShop();
  }
  if (document.getElementById("product-gallery")) {
    fillProduct();
  }
  if (checkoutUpdateSummary) {
    checkoutUpdateSummary();
  }
  if (document.getElementById("book-design-panel")) {
    renderBookDesignPanel();
  }
  updateCurrencyDisclaimer();
}

function initCurrencySelector() {
  const cartLink = document.querySelector(".nav .cart-link");
  if (!cartLink || document.getElementById("currency-select")) return;

  const actions = document.createElement("div");
  actions.className = "nav-actions";

  const select = document.createElement("select");
  select.id = "currency-select";
  select.className = "currency-select";
  select.setAttribute("aria-label", "Currency");

  Object.keys(SUPPORTED_CURRENCIES).forEach((code) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = code;
    select.appendChild(opt);
  });
  select.value = selectedCurrency;

  cartLink.parentNode.insertBefore(actions, cartLink);
  actions.appendChild(select);
  actions.appendChild(cartLink);

  select.addEventListener("change", () => {
    setSelectedCurrency(select.value);
    refreshCurrencyDisplay();
    document.dispatchEvent(new CustomEvent("kf-currency-change"));
  });
}

function getShippingZone(zoneId) {
  return SHIPPING_ZONES[zoneId] || SHIPPING_ZONES["rest-of-world"];
}

const STYLE_CATEGORIES = [
  { id: "basics", name: "Basics", desc: "Single caps and multi-tooth plain sets." },
  { id: "bar", name: "Bar", desc: "Two canine caps connected by a front bar." },
  { id: "window", name: "Window", desc: "Cut-out windows showing your natural tooth." },
  { id: "heart", name: "Heart", desc: "Heart-shaped window cuts." },
  { id: "star", name: "Star", desc: "Star cut-out designs. Single tooth or abstract 2-tooth." },
  { id: "vampire", name: "Vampire", desc: "Pointed canines. Sharp statement." },
  { id: "diamond", name: "Diamond", desc: "Diamond-dust and hand-set diamond grillz." },
  { id: "accessories", name: "Accessories", desc: "Gift cards, mould kits, care, and finishing services." },
];

const TEETH_FILTERS = ["all", "1", "2", "4", "6", "8", "12", "16"];

const STYLE_LABELS = Object.fromEntries(STYLE_CATEGORIES.map((c) => [c.id, c.name]));

const MATERIAL_OPTIONS = [
  { id: "dental-gold", label: "Dental Gold" },
  { id: "sterling-silver", label: "Sterling Silver" },
  { id: "argentium-silver", label: "Argentium Silver" },
  { id: "9ct-yellow-gold", label: "9ct Yellow Gold" },
  { id: "9ct-white-gold", label: "9ct White Gold" },
  { id: "14ct-yellow-gold", label: "14ct Yellow Gold" },
  { id: "14ct-white-gold", label: "14ct White Gold" },
];

const MATERIAL_LABELS = Object.fromEntries(MATERIAL_OPTIONS.map((m) => [m.id, m.label]));

/** Maps removed material ids from older sessions to current options */
const MATERIAL_ID_ALIASES = {
  "18ct-yellow-gold": "14ct-yellow-gold",
  "18ct-white-gold": "14ct-white-gold",
};

const STONE_OPTIONS = [
  { id: "cubic-zirconia", label: "Cubic Zirconia" },
  { id: "moissanite", label: "Moissanite" },
  { id: "vvs-lab-diamonds", label: "VVS Lab Diamonds" },
  { id: "vs-natural-diamonds", label: "VS Natural Diamonds" },
];

const STONE_LABELS = Object.fromEntries(STONE_OPTIONS.map((s) => [s.id, s.label]));

const DEFAULT_STONE_ID = "cubic-zirconia";

const HAND_SET_DIAMOND_PRICES = {
  "diamond-canine": {
    "sterling-silver": {
      "cubic-zirconia": 330,
      "moissanite": 370,
      "vvs-lab-diamonds": 770,
      "vs-natural-diamonds": 1020
    },
    "argentium-silver": {
      "cubic-zirconia": 330,
      "moissanite": 370,
      "vvs-lab-diamonds": 770,
      "vs-natural-diamonds": 1020
    },
    "dental-gold": {
      "cubic-zirconia": 570,
      "moissanite": 620,
      "vvs-lab-diamonds": 995,
      "vs-natural-diamonds": 1250
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 570,
      "moissanite": 620,
      "vvs-lab-diamonds": 995,
      "vs-natural-diamonds": 1250
    },
    "9ct-white-gold": {
      "cubic-zirconia": 570,
      "moissanite": 620,
      "vvs-lab-diamonds": 995,
      "vs-natural-diamonds": 1250
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 945,
      "moissanite": 995,
      "vvs-lab-diamonds": 1370,
      "vs-natural-diamonds": 1630
    },
    "14ct-white-gold": {
      "cubic-zirconia": 945,
      "moissanite": 1020,
      "vvs-lab-diamonds": 1370,
      "vs-natural-diamonds": 1630
    }
  },
  "diamond-lateral": {
    "sterling-silver": {
      "cubic-zirconia": 260,
      "moissanite": 295,
      "vvs-lab-diamonds": 570,
      "vs-natural-diamonds": 770
    },
    "argentium-silver": {
      "cubic-zirconia": 260,
      "moissanite": 295,
      "vvs-lab-diamonds": 570,
      "vs-natural-diamonds": 770
    },
    "dental-gold": {
      "cubic-zirconia": 450,
      "moissanite": 520,
      "vvs-lab-diamonds": 770,
      "vs-natural-diamonds": 950
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 450,
      "moissanite": 520,
      "vvs-lab-diamonds": 770,
      "vs-natural-diamonds": 950
    },
    "9ct-white-gold": {
      "cubic-zirconia": 450,
      "moissanite": 520,
      "vvs-lab-diamonds": 770,
      "vs-natural-diamonds": 950
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 770,
      "moissanite": 870,
      "vvs-lab-diamonds": 1070,
      "vs-natural-diamonds": 1270
    },
    "14ct-white-gold": {
      "cubic-zirconia": 770,
      "moissanite": 870,
      "vvs-lab-diamonds": 1070,
      "vs-natural-diamonds": 1270
    }
  },
  "diamond-heart-canine": {
    "sterling-silver": {
      "cubic-zirconia": 290,
      "moissanite": 330,
      "vvs-lab-diamonds": 620,
      "vs-natural-diamonds": 750
    },
    "argentium-silver": {
      "cubic-zirconia": 290,
      "moissanite": 330,
      "vvs-lab-diamonds": 620,
      "vs-natural-diamonds": 750
    },
    "dental-gold": {
      "cubic-zirconia": 480,
      "moissanite": 520,
      "vvs-lab-diamonds": 720,
      "vs-natural-diamonds": 970
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 480,
      "moissanite": 520,
      "vvs-lab-diamonds": 720,
      "vs-natural-diamonds": 970
    },
    "9ct-white-gold": {
      "cubic-zirconia": 480,
      "moissanite": 520,
      "vvs-lab-diamonds": 720,
      "vs-natural-diamonds": 970
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 870,
      "moissanite": 945,
      "vvs-lab-diamonds": 1220,
      "vs-natural-diamonds": 1370
    },
    "14ct-white-gold": {
      "cubic-zirconia": 870,
      "moissanite": 945,
      "vvs-lab-diamonds": 1220,
      "vs-natural-diamonds": 1370
    }
  },
  "diamond-window-canine": {
    "sterling-silver": {
      "cubic-zirconia": 230,
      "moissanite": 270,
      "vvs-lab-diamonds": 410,
      "vs-natural-diamonds": 540
    },
    "argentium-silver": {
      "cubic-zirconia": 230,
      "moissanite": 270,
      "vvs-lab-diamonds": 410,
      "vs-natural-diamonds": 540
    },
    "dental-gold": {
      "cubic-zirconia": 380,
      "moissanite": 445,
      "vvs-lab-diamonds": 595,
      "vs-natural-diamonds": 720
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 380,
      "moissanite": 445,
      "vvs-lab-diamonds": 595,
      "vs-natural-diamonds": 720
    },
    "9ct-white-gold": {
      "cubic-zirconia": 380,
      "moissanite": 445,
      "vvs-lab-diamonds": 595,
      "vs-natural-diamonds": 720
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 680,
      "moissanite": 720,
      "vvs-lab-diamonds": 895,
      "vs-natural-diamonds": 1020
    },
    "14ct-white-gold": {
      "cubic-zirconia": 680,
      "moissanite": 720,
      "vvs-lab-diamonds": 895,
      "vs-natural-diamonds": 1020
    }
  },
  "diamond-canine-canine": {
    "sterling-silver": {
      "cubic-zirconia": 600,
      "moissanite": 695,
      "vvs-lab-diamonds": 1495,
      "vs-natural-diamonds": 1995
    },
    "argentium-silver": {
      "cubic-zirconia": 600,
      "moissanite": 695,
      "vvs-lab-diamonds": 1495,
      "vs-natural-diamonds": 1995
    },
    "dental-gold": {
      "cubic-zirconia": 1070,
      "moissanite": 1170,
      "vvs-lab-diamonds": 1970,
      "vs-natural-diamonds": 2470
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 1070,
      "moissanite": 1170,
      "vvs-lab-diamonds": 1970,
      "vs-natural-diamonds": 2470
    },
    "9ct-white-gold": {
      "cubic-zirconia": 1070,
      "moissanite": 1170,
      "vvs-lab-diamonds": 1970,
      "vs-natural-diamonds": 2470
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 1820,
      "moissanite": 1920,
      "vvs-lab-diamonds": 2720,
      "vs-natural-diamonds": 3220
    },
    "14ct-white-gold": {
      "cubic-zirconia": 1820,
      "moissanite": 1920,
      "vvs-lab-diamonds": 2720,
      "vs-natural-diamonds": 3220
    }
  },
  "diamond-lateral-lateral": {
    "sterling-silver": {
      "cubic-zirconia": 460,
      "moissanite": 520,
      "vvs-lab-diamonds": 1095,
      "vs-natural-diamonds": 1830
    },
    "argentium-silver": {
      "cubic-zirconia": 460,
      "moissanite": 520,
      "vvs-lab-diamonds": 1095,
      "vs-natural-diamonds": 1830
    },
    "dental-gold": {
      "cubic-zirconia": 840,
      "moissanite": 920,
      "vvs-lab-diamonds": 1470,
      "vs-natural-diamonds": 2220
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 840,
      "moissanite": 920,
      "vvs-lab-diamonds": 1470,
      "vs-natural-diamonds": 2220
    },
    "9ct-white-gold": {
      "cubic-zirconia": 840,
      "moissanite": 920,
      "vvs-lab-diamonds": 1470,
      "vs-natural-diamonds": 2220
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 1470,
      "moissanite": 1570,
      "vvs-lab-diamonds": 2100,
      "vs-natural-diamonds": 2845
    },
    "14ct-white-gold": {
      "cubic-zirconia": 1470,
      "moissanite": 1570,
      "vvs-lab-diamonds": 2100,
      "vs-natural-diamonds": 2845
    }
  },
  "diamond-lateral-canine": {
    "sterling-silver": {
      "cubic-zirconia": 530,
      "moissanite": 610,
      "vvs-lab-diamonds": 1295,
      "vs-natural-diamonds": 1720
    },
    "argentium-silver": {
      "cubic-zirconia": 530,
      "moissanite": 610,
      "vvs-lab-diamonds": 1295,
      "vs-natural-diamonds": 1720
    },
    "dental-gold": {
      "cubic-zirconia": 950,
      "moissanite": 1030,
      "vvs-lab-diamonds": 1720,
      "vs-natural-diamonds": 2145
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 950,
      "moissanite": 1030,
      "vvs-lab-diamonds": 1720,
      "vs-natural-diamonds": 2145
    },
    "9ct-white-gold": {
      "cubic-zirconia": 950,
      "moissanite": 1030,
      "vvs-lab-diamonds": 1720,
      "vs-natural-diamonds": 2145
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 1645,
      "moissanite": 1745,
      "vvs-lab-diamonds": 2395,
      "vs-natural-diamonds": 2830
    },
    "14ct-white-gold": {
      "cubic-zirconia": 1645,
      "moissanite": 1745,
      "vvs-lab-diamonds": 2395,
      "vs-natural-diamonds": 2830
    }
  },
  "diamond-window-canine-inlay": {
    "sterling-silver": {
      "cubic-zirconia": 245,
      "moissanite": 290,
      "vvs-lab-diamonds": 490,
      "vs-natural-diamonds": 645
    },
    "argentium-silver": {
      "cubic-zirconia": 245,
      "moissanite": 290,
      "vvs-lab-diamonds": 490,
      "vs-natural-diamonds": 645
    },
    "dental-gold": {
      "cubic-zirconia": 530,
      "moissanite": 590,
      "vvs-lab-diamonds": 790,
      "vs-natural-diamonds": 945
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 530,
      "moissanite": 590,
      "vvs-lab-diamonds": 790,
      "vs-natural-diamonds": 945
    },
    "9ct-white-gold": {
      "cubic-zirconia": 530,
      "moissanite": 590,
      "vvs-lab-diamonds": 790,
      "vs-natural-diamonds": 945
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 1010,
      "moissanite": 1120,
      "vvs-lab-diamonds": 1270,
      "vs-natural-diamonds": 1470
    },
    "14ct-white-gold": {
      "cubic-zirconia": 1010,
      "moissanite": 1120,
      "vvs-lab-diamonds": 1270,
      "vs-natural-diamonds": 1470
    }
  },
  "diamond-window-lateral-canine": {
    "sterling-silver": {
      "cubic-zirconia": 320,
      "moissanite": 370,
      "vvs-lab-diamonds": 670,
      "vs-natural-diamonds": 890
    },
    "argentium-silver": {
      "cubic-zirconia": 320,
      "moissanite": 370,
      "vvs-lab-diamonds": 670,
      "vs-natural-diamonds": 890
    },
    "dental-gold": {
      "cubic-zirconia": 645,
      "moissanite": 695,
      "vvs-lab-diamonds": 1010,
      "vs-natural-diamonds": 1230
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 645,
      "moissanite": 695,
      "vvs-lab-diamonds": 1010,
      "vs-natural-diamonds": 1230
    },
    "9ct-white-gold": {
      "cubic-zirconia": 645,
      "moissanite": 695,
      "vvs-lab-diamonds": 1010,
      "vs-natural-diamonds": 1230
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 1195,
      "moissanite": 1270,
      "vvs-lab-diamonds": 1570,
      "vs-natural-diamonds": 1770
    },
    "14ct-white-gold": {
      "cubic-zirconia": 1195,
      "moissanite": 1270,
      "vvs-lab-diamonds": 1570,
      "vs-natural-diamonds": 1770
    }
  },
  "window-canine-diamond-inlay": {
    "sterling-silver": {
      "cubic-zirconia": 190,
      "moissanite": 220,
      "vvs-lab-diamonds": 270,
      "vs-natural-diamonds": 320
    },
    "argentium-silver": {
      "cubic-zirconia": 190,
      "moissanite": 220,
      "vvs-lab-diamonds": 270,
      "vs-natural-diamonds": 320
    },
    "dental-gold": {
      "cubic-zirconia": 270,
      "moissanite": 320,
      "vvs-lab-diamonds": 370,
      "vs-natural-diamonds": 420
    },
    "9ct-yellow-gold": {
      "cubic-zirconia": 270,
      "moissanite": 320,
      "vvs-lab-diamonds": 370,
      "vs-natural-diamonds": 420
    },
    "9ct-white-gold": {
      "cubic-zirconia": 270,
      "moissanite": 320,
      "vvs-lab-diamonds": 370,
      "vs-natural-diamonds": 420
    },
    "14ct-yellow-gold": {
      "cubic-zirconia": 470,
      "moissanite": 520,
      "vvs-lab-diamonds": 570,
      "vs-natural-diamonds": 620
    },
    "14ct-white-gold": {
      "cubic-zirconia": 470,
      "moissanite": 520,
      "vvs-lab-diamonds": 570,
      "vs-natural-diamonds": 620
    }
  }
};


function resolveMaterialId(materialId, product) {
  if (!materialId) return null;
  if (MATERIAL_LABELS[materialId]) return materialId;
  if (MATERIAL_ID_ALIASES[materialId]) return MATERIAL_ID_ALIASES[materialId];
  return product ? defaultMaterialForProduct(product) : null;
}

function resolveStoneId(stoneId) {
  if (!stoneId) return DEFAULT_STONE_ID;
  if (STONE_LABELS[stoneId]) return stoneId;
  return DEFAULT_STONE_ID;
}

const ORDER_STORAGE_KEY = "kf-order";
const SHIPPING_COUNTRY_STORAGE_KEY = "kf-shipping-country";
const PRODUCT_DRAFT_KEY = "kf-product-draft";
const BOOKING_FLOW_KEY = "kf-booking-flow";
const IMPRESSION_KIT_INSTRUCTIONS_URL = "https://www.youtube.com/watch?v=REPLACE_ME";

const KIT_SHARED_INCLUDES = [
  "2 dental trays",
  "2 blue dental putty",
  "2 white dental putty",
  "1 silicone dispenser",
];

const IMPRESSION_KITS = [
  {
    id: "impression-kit-uk",
    kind: "kit",
    displayName: "Impression Kit (UK)",
    price: 20,
    region: "uk",
    image: "assets/products/impression-kit-uk.webp?v=1",
    blurb:
      "Take your impressions at home. Includes materials for 2 attempts and a prepaid UK return form.",
    includes: [...KIT_SHARED_INCLUDES, "Return postage form (UK only)"],
    returnNote: null,
  },
  {
    id: "impression-kit-international",
    kind: "kit",
    region: "international",
    displayName: "Impression Kit (International)",
    price: 10,
    image: "assets/products/impression-kit-international.webp?v=1",
    blurb:
      "Take your impressions at home. Includes materials for 2 attempts. International clients find their own way to return the kit to us, using the return address found on the postage.",
    includes: [...KIT_SHARED_INCLUDES],
    returnNote:
      "Return postage is not prepaid. International clients find their own way to return the impression kit to us, using the return address found on the postage.",
  },
];

const ACCESSORIES = [
  {
    id: "gift-card",
    kind: "giftcard",
    displayName: "Krown Frontz Gift Card",
    price: 50,
    amounts: [50, 100, 150, 200, 250, 300, 350, 400],
    image: "assets/products/gift-card.png?v=giftcard11",
    imageAlt: "Krown Frontz gift card",
    blurb:
      "Hard to gift a specific style? A Krown Frontz gift card lets them choose their own custom grillz and accessories. After payment we’ll email you a code to pass on and they can use it toward a postal order, or as a deposit on an in-person appointment. Any remaining balance is settled when they come in.",
  },
  {
    id: "polish-cloth",
    kind: "accessory",
    displayName: "Jewellery polishing cloth",
    price: 3,
    image: "assets/products/polish-cloth.webp?v=1",
    imageAlt: "Black jewellery polishing cloth",
    blurb:
      "Soft jewellery cloth for keeping your grillz bright between wears. Wipe gently after use to clear fingerprints and surface dullness — keep one with your set so a quick polish is always to hand. Best paired with a grillz case.",
  },
  {
    id: "grillz-case",
    kind: "accessory",
    displayName: "Grillz case",
    price: 5,
    image: "assets/products/grillz-case.webp?v=2",
    imageAlt: "Protective grillz case",
    blurb:
      "A compact protective case so you never lose your set. Shields your grillz from scratches and knocks at home or on the go — drop them in when you’re not wearing them, and keep your polishing cloth alongside.",
  },
  {
    id: "repolish-service",
    kind: "service",
    displayName: "Grillz repolishing",
    price: 15,
    image: "assets/products/repolish-service.webp?v=3",
    imageAlt: "Krown Frontz grillz packaged for repolishing",
    blurb:
      "Send your set back for a professional polish. Post them to us (we email the studio return address after payment) or drop off in Manchester and pick them up when ready.",
  },
];

function createLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findKit(id) {
  return IMPRESSION_KITS.find((k) => k.id === id) || null;
}

function findAccessory(id) {
  return ACCESSORIES.find((a) => a.id === id) || null;
}

function isKitCatalogItem(item) {
  return item?.kind === "kit";
}

function findCatalogItem(id) {
  return findKit(id) || findAccessory(id) || findProduct(id);
}

function kitDisplayPrice(kit) {
  return formatMoney(kit.price);
}

function getCartRaw() {
  const raw = sessionStorage.getItem(ORDER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function migrateLegacyCart(raw) {
  if (!raw) return { items: [] };
  if (Array.isArray(raw.items)) {
    return {
      items: raw.items.map((item) => {
        if (item.kind !== "grillz") return item;
        const product = findProduct(item.productId);
        if (isHandSetDiamond(product) && !item.stone) {
          return { ...item, stone: DEFAULT_STONE_ID };
        }
        return item;
      }),
    };
  }
  if (raw.product) {
    const product = findProduct(raw.product.id);
    return {
      items: [
        {
          id: createLineId(),
          kind: "grillz",
          productId: raw.product.id,
          material: raw.material,
          ...(isHandSetDiamond(product) ? { stone: DEFAULT_STONE_ID } : {}),
          piecePrice: raw.piecePrice,
          arch: raw.arch || "",
          selectedTeeth: raw.selectedTeeth || [],
          selectedTeethLabel: raw.selectedTeethLabel || "",
        },
      ],
    };
  }
  return { items: [] };
}

function getCart() {
  return migrateLegacyCart(getCartRaw());
}

function saveCart(cart) {
  sessionStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(cart));
  initCartLinks();
}

function getCartCount() {
  return getCart().items.length;
}

function cartHasGrillz(cart = getCart()) {
  return cart.items.some((item) => item.kind === "grillz");
}

function cartHasKit(region, cart = getCart()) {
  return cart.items.some((item) => {
    if (item.kind !== "kit") return false;
    const kit = findKit(item.kitId);
    if (!region) return Boolean(kit);
    return kit?.region === region;
  });
}

function cartHasAccessory(cart = getCart()) {
  return cart.items.some((item) => item.kind === "accessory");
}

function cartHasPostalRepolish(cart = getCart()) {
  return cart.items.some((item) => item.kind === "service" && item.fulfillment === "postal");
}

function cartNeedsFinishShipping(cart = getCart()) {
  return cartHasGrillz(cart) || cartHasAccessory(cart) || cartHasPostalRepolish(cart);
}

function addGrillzToCart(selection) {
  const cart = getCart();
  const line = {
    id: createLineId(),
    kind: "grillz",
    productId: selection.product.id,
    material: selection.material,
    piecePrice: selection.piecePrice,
    arch: selection.arch || "",
    selectedTeeth: selection.selectedTeeth || [],
    selectedTeethLabel: selection.selectedTeethLabel || "",
  };
  if (isHandSetDiamond(selection.product)) {
    line.stone = resolveStoneId(selection.stone);
  }
  cart.items.push(line);
  saveCart(cart);
}

function addKitToCart(kitId) {
  const kit = findKit(kitId);
  if (!kit) return false;
  const cart = getCart();
  if (cart.items.some((item) => item.kind === "kit" && item.kitId === kitId)) {
    return false;
  }
  cart.items.push({
    id: createLineId(),
    kind: "kit",
    kitId: kit.id,
    price: kit.price,
  });
  saveCart(cart);
  return true;
}

function addAccessoryToCart(accessoryId) {
  const accessory = findAccessory(accessoryId);
  if (!accessory || accessory.kind !== "accessory") return false;
  const cart = getCart();
  if (cart.items.some((item) => item.kind === "accessory" && item.accessoryId === accessoryId)) {
    return false;
  }
  cart.items.push({
    id: createLineId(),
    kind: "accessory",
    accessoryId: accessory.id,
    price: accessory.price,
  });
  saveCart(cart);
  return true;
}

function addServiceToCart(serviceId, fulfillment) {
  const service = findAccessory(serviceId);
  if (!service || service.kind !== "service") return false;
  const mode = fulfillment === "dropoff" ? "dropoff" : "postal";
  const cart = getCart();
  cart.items = cart.items.filter((item) => !(item.kind === "service" && item.serviceId === serviceId));
  cart.items.push({
    id: createLineId(),
    kind: "service",
    serviceId: service.id,
    price: service.price,
    fulfillment: mode,
  });
  saveCart(cart);
  return true;
}

function addGiftCardToCart(amount) {
  const giftCard = findAccessory("gift-card");
  if (!giftCard || giftCard.kind !== "giftcard") return false;
  const amounts = giftCard.amounts || [giftCard.price];
  const value = Number(amount);
  if (!amounts.includes(value)) return false;
  const cart = getCart();
  cart.items = cart.items.filter((item) => item.kind !== "giftcard");
  cart.items.push({
    id: createLineId(),
    kind: "giftcard",
    accessoryId: giftCard.id,
    price: value,
  });
  saveCart(cart);
  return true;
}

function removeCartItem(lineId) {
  const cart = getCart();
  cart.items = cart.items.filter((item) => item.id !== lineId);
  saveCart(cart);
}

function getProductDraft() {
  const raw = sessionStorage.getItem(PRODUCT_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveProductDraft(draft) {
  sessionStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify(draft));
}

function getGrillzCartLines(cart = getCart()) {
  return cart.items.filter((item) => item.kind === "grillz");
}

function getKitCartLines(cart = getCart()) {
  return cart.items.filter((item) => item.kind === "kit");
}

function cartLineSubtotal(cart = getCart()) {
  return cart.items.reduce((sum, item) => {
    if (item.kind === "grillz") return sum + (item.piecePrice || 0);
    if (
      item.kind === "kit" ||
      item.kind === "accessory" ||
      item.kind === "service" ||
      item.kind === "giftcard"
    ) {
      return sum + (item.price || 0);
    }
    return sum;
  }, 0);
}

function computeCheckoutShipping(zoneId, cart = getCart()) {
  const zone = getShippingZone(zoneId);
  const isUk = zoneId === "uk";
  let kitShipping = 0;
  let finishShipping = 0;

  if (!isUk && cartHasKit("international", cart)) {
    kitShipping = zone.kitShipping;
  }
  if (cartNeedsFinishShipping(cart)) {
    finishShipping = zone.finishShipping;
  }

  return { zoneId, isUk, kitShipping, finishShipping, total: kitShipping + finishShipping };
}

function syncKitToCountry(zoneId, cart = getCart()) {
  if (!getKitCartLines(cart).length) {
    return { swapped: false, cart };
  }

  const isUk = zoneId === "uk";
  const targetKitId = isUk ? "impression-kit-uk" : "impression-kit-international";
  const currentKitLine = getKitCartLines(cart)[0];
  const currentKit = findKit(currentKitLine.kitId);

  if (currentKit?.id === targetKitId) {
    return { swapped: false, cart };
  }

  const targetKit = findKit(targetKitId);
  if (!targetKit) {
    return { swapped: false, cart };
  }

  const updatedCart = {
    items: [
      ...cart.items.filter((item) => item.kind !== "kit"),
      {
        id: createLineId(),
        kind: "kit",
        kitId: targetKit.id,
        price: targetKit.price,
      },
    ],
  };
  saveCart(updatedCart);
  return { swapped: true, cart: updatedCart, kitName: targetKit.displayName };
}

/** Legacy product URLs — maps old ids to K9-style named skus */
const PRODUCT_ID_ALIASES = {
  "basic-1": "canine",
  "basic-1-gold": "canine",
  "basic-2": "lateral",
  "basic-2-silver": "lateral",
  "basic-4": "plain-4",
  "basic-4-gold": "plain-4",
  "bar-4": "plain-4",
  "bar-6": "plain-6",
  "classic-6-gold": "plain-6",
  "bar-8": "plain-8",
  "bar-8-gold": "plain-8",
  "bar-12": "top-6-bottom-6",
  "full-gold": "top-8-bottom-8",
  "window-4": "open-face-4",
  "window-4-gold": "open-face-4",
  "window-6": "open-face-6",
  "open-silver": "open-face-6",
  "window-8": "window-set-8",
  "window-8-silver": "window-set-8",
  "window-12": "open-face-6-on-6",
  "window-16": "open-face-8-on-8",
  "top-4": "plain-4",
  "bottom-4": "plain-4",
  "top-6": "plain-6",
  "bottom-6": "plain-6",
  "top-8": "plain-8",
  "bottom-8": "plain-8",
  "heart-2": "heart-canine",
  "heart-2-gold": "heart-canine",
  "heart-4": "heart-canine-bar",
  "heart-4-gold": "heart-canine-bar",
  "vampire-2": "vampire-canines",
  "vampire-2-gold": "vampire-canines",
  "vampire-4": "vampire-canine-lateral-2",
  fangs: "vampire-canine-lateral-2",
  "diamond-4": "diamond-dust-4",
  "dust-4": "diamond-dust-4",
};

const PRODUCTS = [
  {
    id: "canine",
    displayName: "Canine",
    price: 90,
    compareAt: 115,
    image: "assets/products/canine.webp?v=castzoom1",
    imageAlt: "Canine grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "1",
    toothRule: "single-canine",
    blurb: "Single canine cap. Custom-fitted.",
  },
  {
    id: "lateral",
    displayName: "Lateral",
    price: 95,
    compareAt: 115,
    image: "assets/products/lateral.webp?v=castzoom1",
    imageAlt: "Lateral grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "1",
    toothRule: "single-lateral",
    blurb: "Single lateral cap. Clean everyday look.",
  },
  {
    id: "central",
    displayName: "Central",
    price: 95,
    compareAt: 115,
    image: "assets/products/central.webp?v=castzoom1",
    imageAlt: "Central incisor grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "1",
    toothRule: "single-central",
    blurb: "Single central cap. Minimal statement.",
  },
  {
    id: "canine-canine",
    displayName: "2 x canines",
    price: 110,
    compareAt: 150,
    image: "assets/products/canine-canine.webp?v=castzoom1",
    imageAlt: "Canine pair grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "2",
    toothRule: "arch-canines",
    blurb: "Symmetric pair on upper or lower canines.",
  },
  {
    id: "lateral-lateral",
    displayName: "2 x Lateral",
    price: 110,
    compareAt: 140,
    image: "assets/products/lateral-lateral.webp?v=castzoom1",
    imageAlt: "Lateral pair grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "2",
    toothRule: "arch-laterals",
    blurb: "Both laterals on upper or lower teeth. Clean double cap.",
  },
  {
    id: "canine-lateral-2x",
    displayName: "2 x Canine & Lateral",
    price: 175,
    compareAt: 225,
    image: "assets/products/canine-lateral-2x.webp?v=castzoom1",
    imageAlt: "2 x canine and lateral grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "4",
    toothRule: "both-side-canine-lateral",
    blurb: "Canine and lateral caps on two sides.",
  },
  {
    id: "lateral-canine",
    displayName: "Lateral & Canine",
    price: 110,
    compareAt: 140,
    image: "assets/products/lateral-canine.webp?v=castzoom1",
    imageAlt: "Lateral and canine grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "2",
    toothRule: "lateral-canine-cross",
    blurb: "Lateral and canine caps — adjacent or opposite sides.",
  },
  {
    id: "canine-window",
    displayName: "Canine & Window",
    price: 110,
    compareAt: 135,
    pricingPremiumPerTooth: 5,
    image: "assets/products/canine-window.webp?v=castzoom1",
    imageAlt: "Canine and window grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "2",
    toothRule: "canine-bar-pair",
    blurb: "Solid canine cap with window cut-out on the lateral.",
  },
  {
    id: "plain-4",
    displayName: "4 set",
    price: 350,
    compareAt: 410,
    image: "assets/products/plain-4.webp?v=castzoom1",
    imageAlt: "4 set grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "4",
    toothRule: "contiguous-front",
    blurb: "Four contiguous front teeth. Choose upper or lower teeth on the model below.",
  },
  {
    id: "canines-4",
    displayName: "4 x Canine",
    price: 220,
    compareAt: 280,
    image: "assets/products/canines-4.webp?v=castzoom1",
    imageAlt: "4 canine grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "4",
    toothRule: "both-arch-canines",
    blurb: "All four canines. Upper and lower, left and right.",
  },
  {
    id: "laterals-4",
    displayName: "4 x Lateral",
    price: 220,
    compareAt: 280,
    image: "assets/products/laterals-4.webp?v=castzoom1",
    imageAlt: "4 lateral grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "4",
    toothRule: "both-arch-laterals",
    blurb: "All four laterals. Upper and lower, left and right.",
  },
  {
    id: "centrals-4",
    displayName: "4 x Central",
    price: 220,
    compareAt: 280,
    image: "assets/products/centrals-4.webp?v=castzoom1",
    imageAlt: "4 central grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "4",
    toothRule: "both-arch-centrals",
    blurb: "All four centrals. Upper and lower, left and right.",
  },
  {
    id: "plain-6",
    displayName: "6 set",
    price: 450,
    compareAt: 520,
    image: "assets/products/plain-6.webp?v=castzoom1",
    imageAlt: "6 set grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "6",
    toothRule: "contiguous-front",
    blurb: "Six contiguous front teeth. Choose upper or lower teeth on the model below.",
  },
  {
    id: "plain-8",
    displayName: "8 set",
    price: 580,
    compareAt: 650,
    image: "assets/products/plain-8.webp?v=castzoom1",
    imageAlt: "8 set grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "8",
    toothRule: "contiguous-front",
    blurb: "Full front eight. Choose upper or lower teeth on the model below.",
  },
  {
    id: "top-4-bottom-4",
    displayName: "4 on 4",
    price: 680,
    compareAt: 780,
    image: "assets/products/top-4-bottom-4.webp?v=castzoom1",
    imageAlt: "Top 4 bottom 4 plain grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "8",
    toothRule: "both-arch-contiguous",
    chartMode: "both",
    blurb: "Four contiguous teeth on top and bottom. Plain set.",
  },
  {
    id: "top-6-bottom-6",
    displayName: "6 on 6",
    price: 900,
    compareAt: 1050,
    image: "assets/products/top-6-bottom-6.webp?v=castzoom1",
    imageAlt: "Top 6 bottom 6 plain grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "12",
    toothRule: "both-arch-contiguous",
    chartMode: "both",
    blurb: "Six contiguous teeth on top and bottom. Plain full smile.",
  },
  {
    id: "top-8-bottom-8",
    displayName: "8 on 8",
    price: 1200,
    compareAt: 1350,
    image: "assets/products/top-8-bottom-8.webp?v=castzoom1",
    imageAlt: "Top 8 bottom 8 plain grillz on dental model",
    finish: "gold",
    style: "basics",
    teeth: "16",
    toothRule: "both-arch-contiguous",
    chartMode: "both",
    blurb: "Eight contiguous teeth on top and bottom. Maximum plain set.",
  },
  {
    id: "window-canine-bar",
    displayName: "Window Canine & Inlay",
    price: 115,
    compareAt: 135,
    image: "assets/products/window-canine-bar.webp?v=castzoom1",
    imageAlt: "Window canine and inlay grillz on dental model",
    finish: "gold",
    style: "bar",
    teeth: "2",
    toothRule: "canine-bar-pair",
    blurb: "Window canine with inlay on the lateral.",
  },
  {
    id: "canine-bar",
    displayName: "Canine & Inlay",
    price: 110,
    compareAt: 135,
    pricingPremiumPerTooth: 5,
    image: "assets/products/canine-bar.webp?v=castzoom1",
    imageAlt: "Canine and inlay grillz on dental model",
    finish: "gold",
    style: "bar",
    teeth: "2",
    toothRule: "canine-bar-pair",
    blurb: "Solid canine cap linked to a lateral inlay.",
  },
  {
    id: "heart-canine-bar",
    displayName: "Heart Canine & Inlay",
    price: 295,
    compareAt: 335,
    pricingPremiumPerTooth: 20,
    image: "assets/products/heart-canine-bar.webp?v=castzoom1",
    imageAlt: "Heart canine and inlay grillz on dental model",
    finish: "gold",
    style: "bar",
    teeth: "2",
    toothRule: "canine-bar-pair",
    blurb: "Heart window canine with lateral inlay.",
  },
  {
    id: "canines-bar-2x",
    displayName: "2 x Canine & Inlay",
    price: 235,
    compareAt: 265,
    pricingSterlingBase: 225,
    pricingPremiumBase: 235,
    pricingPremiumPerTooth: 0,
    image: "assets/products/canines-bar-2x.webp?v=castzoom1",
    imageAlt: "Lower canine and inlay grillz on dental model",
    finish: "gold",
    style: "bar",
    teeth: "6",
    chartMode: "lower",
    toothRule: "contiguous-front",
    blurb: "Lower canines connected by an inlay across the front four.",
  },
  {
    id: "window-canine",
    displayName: "Window Canine",
    price: 105,
    compareAt: 125,
    image: "assets/products/window-canine.webp?v=castzoom1",
    imageAlt: "Window canine grillz on dental model",
    finish: "gold",
    style: "window",
    teeth: "1",
    toothRule: "single-canine",
    blurb: "Cut-out window on the canine.",
  },
  {
    id: "window-lateral",
    displayName: "Window Lateral",
    price: 105,
    compareAt: 125,
    image: "assets/products/window-lateral.webp?v=castzoom1",
    imageAlt: "Window lateral grillz on dental model",
    finish: "gold",
    style: "window",
    teeth: "1",
    toothRule: "single-lateral",
    blurb: "Cut-out window on the lateral.",
  },
  {
    id: "window-canine-lateral-2",
    displayName: "Window Canine & Window Lateral",
    price: 245,
    compareAt: 285,
    image: "assets/products/window-canine-lateral-2.webp?v=castzoom1",
    imageAlt: "Window canine and window lateral grillz on dental model",
    finish: "gold",
    style: "window",
    teeth: "2",
    toothRule: "canine-lateral-pair",
    blurb: "Window cuts on canine and lateral pair.",
  },
  {
    id: "open-face-4",
    displayName: "4 set open face",
    price: 240,
    compareAt: 280,
    image: "assets/products/open-face-4.webp?v=castzoom1",
    imageAlt: "4 set open face grillz on dental model",
    finish: "gold",
    style: "window",
    teeth: "4",
    toothRule: "contiguous-front",
    blurb: "Cut-out windows on the front four.",
  },
  {
    id: "open-face-6",
    displayName: "6 set open face",
    price: 280,
    compareAt: 320,
    image: "assets/products/open-face-6.webp?v=castzoom1",
    imageAlt: "6 set open face grillz on dental model",
    finish: "silver",
    style: "window",
    teeth: "6",
    toothRule: "contiguous-front",
    blurb: "Open face frame. Natural tooth shows through.",
  },
  {
    id: "window-set-8",
    displayName: "8 set open face",
    price: 580,
    compareAt: 640,
    pricingSterlingBase: 305,
    image: "assets/products/window-set-8.webp?v=castzoom1",
    imageAlt: "8 set open face grillz on dental model",
    finish: "silver",
    style: "window",
    teeth: "8",
    toothRule: "contiguous-front",
    blurb: "Full window set. Thin cut-out frames.",
  },
  {
    id: "open-face-6-on-6",
    displayName: "6 on 6 open face",
    price: 560,
    compareAt: 640,
    pricingSterlingBase: 460,
    image: "assets/products/open-face-6-on-6.webp?v=castzoom1",
    imageAlt: "6 on 6 open face grillz on dental model",
    finish: "silver",
    style: "window",
    teeth: "12",
    toothRule: "both-arch-contiguous",
    chartMode: "both",
    blurb: "Open face frames on upper and lower. Six contiguous teeth.",
  },
  {
    id: "open-face-8-on-8",
    displayName: "8 on 8 open face",
    price: 1160,
    compareAt: 1280,
    pricingPremiumPerTooth: 5,
    image: "assets/products/open-face-8-on-8.webp?v=castzoom1",
    imageAlt: "8 on 8 open face grillz on dental model",
    finish: "silver",
    style: "window",
    teeth: "16",
    toothRule: "both-arch-contiguous",
    chartMode: "both",
    blurb: "Full open face set. Eight contiguous teeth on top and bottom.",
  },
  {
    id: "heart-canine",
    displayName: "Heart Canine",
    price: 165,
    compareAt: 195,
    image: "assets/products/heart-canine.webp?v=castzoom1",
    imageAlt: "Heart window canine grillz on dental model",
    finish: "gold",
    style: "heart",
    teeth: "1",
    toothRule: "single-canine",
    blurb: "Heart-shaped window on the canine.",
  },
  {
    id: "heart-lateral",
    displayName: "Heart Lateral",
    price: 165,
    compareAt: 195,
    image: "assets/products/heart-lateral.webp?v=castzoom1",
    imageAlt: "Heart window lateral grillz on dental model",
    finish: "gold",
    style: "heart",
    teeth: "1",
    toothRule: "single-lateral",
    blurb: "Heart-shaped window on the lateral.",
  },
  {
    id: "star-canine",
    displayName: "Star Canine",
    price: 165,
    compareAt: 195,
    image: "assets/products/star-canine.webp?v=castzoom1",
    imageAlt: "Star cut-out canine grillz on dental model",
    finish: "gold",
    style: "star",
    teeth: "1",
    toothRule: "single-canine",
    blurb: "Star cut-out on the canine.",
  },
  {
    id: "star-lateral",
    displayName: "Star Lateral",
    price: 165,
    compareAt: 195,
    image: "assets/products/star-lateral.webp?v=castzoom1",
    imageAlt: "Star cut-out lateral grillz on dental model",
    finish: "gold",
    style: "star",
    teeth: "1",
    toothRule: "single-lateral",
    blurb: "Star cut-out on the lateral.",
  },
  {
    id: "vampire-canines",
    displayName: "Vampire Canines",
    price: 175,
    compareAt: 210,
    pricingSterlingBase: 115,
    image: "assets/products/vampire-canines.webp?v=castzoom1",
    imageAlt: "Vampire canine grillz on dental model",
    finish: "gold",
    style: "vampire",
    teeth: "2",
    toothRule: "arch-canines",
    blurb: "Pointed vampire canines. Sharp pair.",
  },
  {
    id: "vampire-canine-lateral-2",
    displayName: "Vampire Canine & Lateral",
    price: 245,
    compareAt: 285,
    pricingPremiumPerTooth: 5,
    image: "assets/products/vampire-canine-lateral-2.webp?v=castzoom1",
    imageAlt: "Vampire canine and lateral grillz on dental model",
    finish: "gold",
    style: "vampire",
    teeth: "2",
    toothRule: "canine-lateral-pair",
    blurb: "Extended canines with lateral caps.",
  },
  {
    id: "dust-canine",
    displayName: "Diamond-dust Canine",
    price: 120,
    compareAt: 145,
    image: "assets/products/dust-canine.webp?v=castzoom1",
    imageAlt: "Diamond-dust canine grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "1",
    toothRule: "single-canine",
    blurb: "Micro-cut dust finish on a single canine.",
  },
  {
    id: "dust-lateral",
    displayName: "Diamond-dust Lateral",
    price: 125,
    compareAt: 145,
    image: "assets/products/dust-lateral.webp?v=castzoom1",
    imageAlt: "Diamond-dust lateral grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "1",
    toothRule: "single-lateral",
    blurb: "Micro-cut dust finish on a single lateral.",
  },
  {
    id: "dust-central",
    displayName: "Diamond-dust Central",
    price: 125,
    compareAt: 145,
    image: "assets/products/dust-central.webp?v=castzoom1",
    imageAlt: "Diamond-dust central grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "1",
    toothRule: "single-central",
    blurb: "Micro-cut dust finish on a single central.",
  },
  {
    id: "dust-canine-pair",
    displayName: "2 x Diamond-dust Canine",
    price: 150,
    compareAt: 190,
    image: "assets/products/dust-canine-pair.webp?v=castzoom1",
    imageAlt: "Diamond-dust canine pair grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "2",
    toothRule: "arch-canines",
    blurb: "Dust finish on both canines on upper or lower teeth.",
  },
  {
    id: "dust-lateral-pair",
    displayName: "2 x Diamond-dust Lateral",
    price: 150,
    compareAt: 180,
    image: "assets/products/dust-lateral-pair.webp?v=castzoom1",
    imageAlt: "Diamond-dust lateral pair grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "2",
    toothRule: "arch-laterals",
    blurb: "Dust finish on both laterals on upper or lower teeth.",
  },
  {
    id: "dust-central-pair",
    displayName: "2 x Diamond-dust Central",
    price: 150,
    compareAt: 180,
    image: "assets/products/dust-central-pair.webp?v=castzoom1",
    imageAlt: "Diamond-dust central pair grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "2",
    toothRule: "arch-centrals",
    blurb: "Dust finish on both centrals on upper or lower teeth.",
  },
  {
    id: "dust-canines-4",
    displayName: "4 x Diamond-dust Canine",
    price: 280,
    compareAt: 340,
    image: "assets/products/dust-canines-4.webp?v=castzoom1",
    imageAlt: "Diamond-dust 4 canine grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "4",
    toothRule: "both-arch-canines",
    blurb: "Dust finish on all four canines.",
  },
  {
    id: "dust-laterals-4",
    displayName: "4 x Diamond-dust Lateral",
    price: 280,
    compareAt: 340,
    image: "assets/products/dust-laterals-4.webp?v=castzoom1",
    imageAlt: "Diamond-dust 4 lateral grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "4",
    toothRule: "both-arch-laterals",
    blurb: "Dust finish on all four laterals.",
  },
  {
    id: "dust-centrals-4",
    displayName: "4 x Diamond-dust Central",
    price: 280,
    compareAt: 340,
    image: "assets/products/dust-centrals-4.webp?v=castzoom1",
    imageAlt: "Diamond-dust 4 central grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "4",
    toothRule: "both-arch-centrals",
    blurb: "Dust finish on all four centrals.",
  },
  {
    id: "diamond-dust-4",
    displayName: "4 x Diamond-dust set",
    price: 320,
    compareAt: 380,
    image: "assets/products/diamond-dust-4.webp?v=castzoom1",
    imageAlt: "Diamond-dust 4-tooth grillz on dental model",
    finish: "gold",
    style: "diamond",
    teeth: "4",
    toothRule: "contiguous-front",
    blurb: "Micro-cut dust finish. Glitter without stones.",
  },
  {
    id: "diamond-canine",
    displayName: "Diamond Canine",
    price: 360,
    compareAt: 420,
    image: "assets/products/diamond-canine.webp?v=castzoom1",
    imageAlt: "Diamond canine grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "1",
    toothRule: "single-canine",
    blurb: "Hand-set stones on a single canine cap.",
  },
  {
    id: "diamond-lateral",
    displayName: "Diamond Lateral",
    price: 290,
    compareAt: 340,
    image: "assets/products/diamond-lateral.webp?v=castzoom1",
    imageAlt: "Diamond lateral grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "1",
    toothRule: "single-lateral",
    blurb: "Hand-set stones on a single lateral cap.",
  },
  {
    id: "diamond-heart-canine",
    displayName: "Diamond Heart Canine",
    price: 320,
    compareAt: 375,
    image: "assets/products/diamond-heart-canine.webp?v=castzoom1",
    imageAlt: "Diamond heart canine grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "1",
    toothRule: "single-canine",
    blurb: "Heart window canine with hand-set stones.",
  },
  {
    id: "diamond-window-canine",
    displayName: "Diamond Window Canine",
    price: 260,
    compareAt: 305,
    image: "assets/products/diamond-window-canine.webp?v=castzoom1",
    imageAlt: "Diamond window canine grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "1",
    toothRule: "single-canine",
    blurb: "Window canine with hand-set stones.",
  },
  {
    id: "diamond-canine-canine",
    displayName: "2 x Diamond Canine",
    price: 630,
    compareAt: 720,
    image: "assets/products/diamond-canine-canine.webp?v=castzoom1",
    imageAlt: "Diamond canine pair grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "2",
    toothRule: "arch-canines",
    blurb: "Hand-set stones on both canines on upper or lower teeth.",
  },
  {
    id: "diamond-lateral-lateral",
    displayName: "2 x Diamond Lateral",
    price: 490,
    compareAt: 560,
    image: "assets/products/diamond-lateral-lateral.webp?v=castzoom1",
    imageAlt: "Diamond lateral pair grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "2",
    toothRule: "arch-laterals",
    blurb: "Hand-set stones on both laterals on upper or lower teeth.",
  },
  {
    id: "diamond-lateral-canine",
    displayName: "Diamond Lateral & Canine",
    price: 560,
    compareAt: 640,
    image: "assets/products/diamond-lateral-canine.webp?v=castzoom1",
    imageAlt: "Diamond lateral and canine grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "2",
    toothRule: "canine-lateral-pair",
    blurb: "Hand-set stones on canine and lateral pair.",
  },
  {
    id: "diamond-window-canine-inlay",
    displayName: "Diamond Window Canine & Inlay",
    price: 275,
    compareAt: 320,
    image: "assets/products/diamond-window-canine-inlay.webp?v=castzoom1",
    imageAlt: "Diamond window canine and inlay grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "2",
    toothRule: "canine-bar-pair",
    blurb: "Window canine with diamond-set lateral inlay.",
  },
  {
    id: "diamond-window-lateral-canine",
    displayName: "Diamond Window Lateral & Canine",
    price: 350,
    compareAt: 405,
    image: "assets/products/diamond-window-lateral-canine.webp?v=castzoom1",
    imageAlt: "Diamond window lateral and canine grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "2",
    toothRule: "canine-lateral-pair",
    blurb: "Window cuts with hand-set stones on canine and lateral.",
  },
  {
    id: "window-canine-diamond-inlay",
    displayName: "Window Canine & Diamond Inlay",
    price: 220,
    compareAt: 260,
    image: "assets/products/window-canine-diamond-inlay.webp?v=castzoom1",
    imageAlt: "Window canine and diamond inlay grillz on dental model",
    finish: "iced",
    style: "diamond",
    teeth: "2",
    toothRule: "canine-bar-pair",
    blurb: "Window canine with diamond-set lateral inlay.",
  },

];

const CLIENT_LOOKS = [
  { src: "assets/clients/look-01.jpg", alt: "Client wearing custom silver grillz on two upper teeth" },
  { src: "assets/clients/look-02.jpg", alt: "Client wearing gold caps with green enamel inlay" },
  { src: "assets/clients/look-03.jpg", alt: "Client wearing custom silver wavy grillz design" },
  { src: "assets/clients/look-04.jpg", alt: "Client wearing silver grillz with organic cutout pattern" },
  { src: "assets/clients/look-05.jpg", alt: "Client wearing silver caps on upper canine teeth" },
  { src: "assets/clients/look-06.jpg", alt: "Client wearing gold heart frame and solid gold cap" },
  { src: "assets/clients/look-07.jpg", alt: "Client wearing black custom top and bottom grillz" },
  { src: "assets/clients/look-08.jpg", alt: "Client wearing silver liquid-style grillz design" },
  { src: "assets/clients/look-09.jpg", alt: "Client wearing deep-cut silver bottom grillz" },
  { src: "assets/clients/look-10.jpg", alt: "Client wearing silver tooth cap under purple studio lighting" },
  { src: "assets/clients/look-11.jpg", alt: "Client wearing gold heart-shaped tooth gem" },
  { src: "assets/clients/look-12.jpg", alt: "Client wearing silver cap on upper canine tooth" },
  { src: "assets/clients/look-13.jpg", alt: "Client wearing two polished silver upper tooth caps" },
  { src: "assets/clients/look-14.jpg", alt: "Client wearing gold star tooth gem" },
  { src: "assets/clients/look-15.jpg", alt: "Client wearing polished silver cap on upper tooth" },
  { src: "assets/clients/look-16.jpg", alt: "Client wearing silver caps and fang-style bottom grillz" },
  { src: "assets/clients/look-17.jpg", alt: "Client wearing custom silver grillz set" },
  { src: "assets/clients/look-18.jpg", alt: "Client wearing custom gold grillz set" },
  { src: "assets/clients/look-19.jpg", alt: "Client wearing custom silver tooth jewelry" },
  { src: "assets/clients/look-20.jpg", alt: "Client wearing custom grillz close-up" },
  { src: "assets/clients/look-21.jpg", alt: "Client wearing custom silver caps" },
  { src: "assets/clients/look-22.jpg", alt: "Client wearing custom gold tooth caps" },
  { src: "assets/clients/look-23.jpg", alt: "Client wearing custom iced grillz set" },
  { src: "assets/clients/look-24.jpg", alt: "Client wearing custom open-face grillz" },
  { src: "assets/clients/look-25.jpg", alt: "Client wearing custom window-style grillz" },
  { src: "assets/clients/look-26.jpg", alt: "Client wearing custom full grillz set" },
  { src: "assets/clients/look-27.jpg", alt: "Client wearing custom handmade grillz" },
];

const BASE_TIERS = {
  sterling: { 1: 55, 2: 100, 4: 190, 6: 275, 8: 330, 16: 550 },
  premium: { 1: 60, 2: 110, 4: 200, 6: 300, 8: 385, 16: 590 },
};

const PRECIOUS_SINGLE_9CT = 155;
const PRECIOUS_SINGLE_14CT = 200;

const DUAL_ARCH_4ON4_IDS = new Set(["top-4-bottom-4"]);
const DUAL_ARCH_6ON6_IDS = new Set(["top-6-bottom-6", "open-face-6-on-6"]);
const DUAL_ARCH_8ON8_IDS = new Set(["top-8-bottom-8", "open-face-8-on-8"]);

const DUAL_ARCH_STERLING_BASE = {
  "4on4": 340,
  "6on6": 490,
};

const PRESET_TEETH_6ON6 = [
  "UR3", "UR2", "UR1", "UL1", "UL2", "UL3",
  "LR3", "LR2", "LR1", "LL1", "LL2", "LL3",
];

const PRESET_TEETH_8ON8 = [
  "UR4", "UR3", "UR2", "UR1", "UL1", "UL2", "UL3", "UL4",
  "LR4", "LR3", "LR2", "LR1", "LL1", "LL2", "LL3", "LL4",
];

const PRESET_TEETH_4_CANINES = ["UR3", "UL3", "LR3", "LL3"];
const PRESET_TEETH_4_LATERALS = ["UR2", "UL2", "LR2", "LL2"];
const PRESET_TEETH_4_CENTRALS = ["UR1", "UL1", "LR1", "LL1"];
const PRESET_TEETH_LOWER_CANINE_BAR = ["LL3", "LL2", "LL1", "LR1", "LR2", "LR3"];

const PRESET_4_CANINES_IDS = new Set(["canines-4", "dust-canines-4"]);
const PRESET_4_LATERALS_IDS = new Set(["laterals-4", "dust-laterals-4"]);
const PRESET_4_CENTRALS_IDS = new Set(["centrals-4", "dust-centrals-4"]);
const PRESET_LOWER_CANINE_BAR_IDS = new Set(["canines-bar-2x"]);

function isPresetTeethProduct(product) {
  return (
    DUAL_ARCH_6ON6_IDS.has(product?.id) ||
    DUAL_ARCH_8ON8_IDS.has(product?.id) ||
    PRESET_4_CANINES_IDS.has(product?.id) ||
    PRESET_4_LATERALS_IDS.has(product?.id) ||
    PRESET_4_CENTRALS_IDS.has(product?.id) ||
    PRESET_LOWER_CANINE_BAR_IDS.has(product?.id)
  );
}

function presetTeethForProduct(product) {
  if (DUAL_ARCH_6ON6_IDS.has(product?.id)) return [...PRESET_TEETH_6ON6];
  if (DUAL_ARCH_8ON8_IDS.has(product?.id)) return [...PRESET_TEETH_8ON8];
  if (PRESET_4_CANINES_IDS.has(product?.id)) return [...PRESET_TEETH_4_CANINES];
  if (PRESET_4_LATERALS_IDS.has(product?.id)) return [...PRESET_TEETH_4_LATERALS];
  if (PRESET_4_CENTRALS_IDS.has(product?.id)) return [...PRESET_TEETH_4_CENTRALS];
  if (PRESET_LOWER_CANINE_BAR_IDS.has(product?.id)) return [...PRESET_TEETH_LOWER_CANINE_BAR];
  return [];
}

function presetTeethSummaryLabel(product) {
  if (DUAL_ARCH_6ON6_IDS.has(product?.id)) return "Upper & lower front 6";
  if (DUAL_ARCH_8ON8_IDS.has(product?.id)) return "Upper & lower front 8";
  if (PRESET_4_CANINES_IDS.has(product?.id)) return "All four canines";
  if (PRESET_4_LATERALS_IDS.has(product?.id)) return "All four laterals";
  if (PRESET_4_CENTRALS_IDS.has(product?.id)) return "All four centrals";
  if (PRESET_LOWER_CANINE_BAR_IDS.has(product?.id)) {
    return "Lower canines with inlay across front four";
  }
  return "";
}

function presetToothSelection(product) {
  if (!isPresetTeethProduct(product)) return null;
  const arch = PRESET_LOWER_CANINE_BAR_IDS.has(product?.id) ? "Lower" : "Both";
  return {
    selectedTeeth: presetTeethForProduct(product),
    selectedTeethLabel: presetTeethSummaryLabel(product),
    arch,
  };
}

function roundPrice(amount) {
  return Math.round(amount / 5) * 5;
}

function isHandSetDiamond(product) {
  if (product.pricingMode === "fixed") return true;
  if (product.style !== "diamond" || product.finish !== "iced") return false;
  return !product.id.startsWith("dust-") && product.id !== "diamond-dust-4";
}

function isDiamondDust(product) {
  if (product.pricingMode === "diamond-dust") return true;
  return product.id.startsWith("dust-") || product.id === "diamond-dust-4";
}

function tierPrice(materialId, tierKey) {
  if (materialId === "sterling-silver") return BASE_TIERS.sterling[tierKey];
  if (materialId === "argentium-silver" || materialId === "dental-gold") {
    if (tierKey === 8) return 350;
    return BASE_TIERS.premium[tierKey];
  }
  if (materialId.startsWith("9ct")) {
    if (tierKey === 1) return PRECIOUS_SINGLE_9CT;
    return roundPrice(BASE_TIERS.premium[tierKey] * (PRECIOUS_SINGLE_9CT / 60));
  }
  if (materialId.startsWith("14ct")) {
    if (tierKey === 1) return PRECIOUS_SINGLE_14CT;
    return roundPrice(BASE_TIERS.premium[tierKey] * (PRECIOUS_SINGLE_14CT / 60));
  }
  return BASE_TIERS.premium[tierKey];
}

function dualArchBasePrice(sterlingBaseKey, perArchTier, materialId) {
  const sterlingBase = DUAL_ARCH_STERLING_BASE[sterlingBaseKey];
  const oldSterlingRef = tierPrice("sterling-silver", perArchTier) * 2;
  const oldMaterialRef = tierPrice(materialId, perArchTier) * 2;
  return roundPrice(sterlingBase * (oldMaterialRef / oldSterlingRef));
}

function handSetDiamondPrice(product, materialId, stoneId) {
  const material = resolveMaterialId(materialId, product) || defaultMaterialForProduct(product);
  const stone = resolveStoneId(stoneId);
  const byProduct = HAND_SET_DIAMOND_PRICES[product.id];
  const byMaterial = byProduct?.[material];
  const price = byMaterial?.[stone];
  if (price != null) return price;
  return byProduct?.["sterling-silver"]?.[DEFAULT_STONE_ID] ?? product.price;
}

function productBasePrice(product, materialId) {
  if (isHandSetDiamond(product)) {
    return handSetDiamondPrice(product, materialId, DEFAULT_STONE_ID);
  }
  if (materialId === "sterling-silver" && product.pricingSterlingBase != null) {
    return product.pricingSterlingBase;
  }
  if (
    (materialId === "dental-gold" || materialId === "argentium-silver") &&
    product.pricingPremiumBase != null
  ) {
    return product.pricingPremiumBase;
  }

  if (DUAL_ARCH_4ON4_IDS.has(product.id)) {
    return dualArchBasePrice("4on4", 4, materialId);
  }
  if (DUAL_ARCH_6ON6_IDS.has(product.id)) {
    return dualArchBasePrice("6on6", 6, materialId);
  }
  if (DUAL_ARCH_8ON8_IDS.has(product.id)) {
    return tierPrice(materialId, 16);
  }

  const teeth = parseInt(product.teeth, 10);
  return tierPrice(materialId, teeth);
}

function designPremiumPerTooth(product) {
  if (product.pricingPremiumPerTooth != null) return product.pricingPremiumPerTooth;
  if (isDiamondDust(product) || isHandSetDiamond(product)) return 0;
  if (product.style === "window" || product.style === "bar") return 10;
  if (product.style === "heart" || product.style === "star") return 15;
  return 0;
}

function diamondDustPremiumPerTooth(product) {
  const teeth = parseInt(product.teeth, 10);
  return teeth <= 2 ? 20 : 15;
}

function productPrice(product, materialId, stoneId) {
  const material = resolveMaterialId(materialId, product) || defaultMaterialForProduct(product);
  if (isHandSetDiamond(product)) {
    return handSetDiamondPrice(product, material, stoneId);
  }

  let total = productBasePrice(product, material);
  const teeth = parseInt(product.teeth, 10);

  if (isDiamondDust(product)) {
    return total + diamondDustPremiumPerTooth(product) * teeth;
  }

  return total + designPremiumPerTooth(product) * teeth;
}

function productFromPrice(product) {
  if (!isHandSetDiamond(product)) {
    return productPrice(product, "sterling-silver");
  }
  const byProduct = HAND_SET_DIAMOND_PRICES[product.id];
  if (!byProduct) return productPrice(product, "sterling-silver", DEFAULT_STONE_ID);
  let min = Infinity;
  for (const byMaterial of Object.values(byProduct)) {
    for (const price of Object.values(byMaterial)) {
      if (price < min) min = price;
    }
  }
  return min === Infinity ? productPrice(product, "sterling-silver", DEFAULT_STONE_ID) : min;
}

function productDisplayName(p) {
  return p.displayName || p.name || p.id;
}

function productMediaHtml(p, { placeholderLabel = "Preview" } = {}) {
  const alt = p.imageAlt || productDisplayName(p);
  if (p.image) {
    return `<img src="${p.image}" alt="${alt}" loading="lazy" />`;
  }
  const hint =
    p.style ||
    (p.kind === "kit"
      ? "kit"
      : p.kind === "accessory"
        ? "accessory"
        : p.kind === "service"
          ? "service"
          : p.kind === "giftcard"
            ? "giftcard"
            : "");
  const styleHint = hint ? ` data-hint="${hint}"` : "";
  return `<div class="product-preview-placeholder"${styleHint} role="img" aria-label="${alt}">${placeholderLabel}</div>`;
}

function productPriceHtml(p) {
  return `<span class="price-current">${money(productFromPrice(p))}</span>`;
}

function updateProductPriceDisplay(priceEl, product, materialId, stoneId) {
  if (!priceEl) return;
  priceEl.textContent = formatPrice(productPrice(product, materialId, stoneId));
}

function resolveProductId(id) {
  return PRODUCT_ID_ALIASES[id] || id;
}

function findProduct(id) {
  const resolved = resolveProductId(id);
  return PRODUCTS.find((x) => x.id === resolved) || PRODUCTS[0];
}

function galleryFinishForMaterial(materialId, productFinish) {
  if (productFinish === "iced") return "iced";
  if (materialId === "sterling-silver" || materialId === "argentium-silver") return "silver";
  return "gold";
}

function updateProductGallery(gallery, materialId, product) {
  if (!gallery) return;
  const alt = product.imageAlt || productDisplayName(product);
  if (product.image) {
    gallery.className = "gallery product-gallery--image";
    gallery.innerHTML = `<img src="${product.image}" alt="${alt}" />`;
    return;
  }
  const finish = galleryFinishForMaterial(materialId, product.finish);
  gallery.className = `gallery product-image ${finish}`;
  gallery.textContent = MATERIAL_LABELS[materialId] || finish;
}

function productCard(p) {
  const title = productDisplayName(p);
  const bookingQuery = isBookingFlowActive() ? "&for=booking" : "";
  return `<a class="product-card product-card--named" href="product.html?id=${p.id}${bookingQuery}" aria-label="${title}">
    <div class="product-card-media">${productMediaHtml(p)}</div>
    <div class="product-card-footer">
      <h3 class="product-card-name">${title}</h3>
      <p class="product-card-prices">${productPriceHtml(p)}</p>
    </div>
  </a>`;
}

function productsForStyle(style) {
  if (style === "all") return PRODUCTS;
  return PRODUCTS.filter((p) => p.style === style);
}

function availableTeethCounts(style) {
  if (style === "accessories") return ["all"];
  const counts = new Set(productsForStyle(style).map((p) => p.teeth));
  return TEETH_FILTERS.filter((count) => count === "all" || counts.has(count));
}

function normalizeShopFilters({ style, teeth }) {
  const hasStyle =
    style === "all" ||
    style === "accessories" ||
    PRODUCTS.some((p) => p.style === style);
  const validStyle = hasStyle ? style : "all";
  const available = availableTeethCounts(validStyle);
  return {
    style: validStyle,
    teeth: available.includes(teeth) ? teeth : "all",
  };
}

function getShopFilters() {
  const params = new URLSearchParams(location.search);
  return normalizeShopFilters({
    style: params.get("style") || "all",
    teeth: params.get("teeth") || "all",
  });
}

function shopUrl({ style = "all", teeth = "all" } = {}) {
  const params = new URLSearchParams();
  if (style !== "all") params.set("style", style);
  if (teeth !== "all") params.set("teeth", teeth);
  if (isBookingFlowActive()) params.set("for", "booking");
  const query = params.toString();
  return query ? `shop.html?${query}` : "shop.html";
}

function initStyleFilters() {
  const el = document.getElementById("style-filters");
  if (!el) return;
  const { style: activeStyle, teeth: activeTeeth } = getShopFilters();
  const items = [
    { id: "all", name: "All" },
    ...STYLE_CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
  ];
  el.innerHTML = items
    .map((item) => {
      const teethForLink = availableTeethCounts(item.id).includes(activeTeeth)
        ? activeTeeth
        : "all";
      return `<a class="filter${item.id === activeStyle ? " active" : ""}" data-style="${item.id}" href="${shopUrl({ style: item.id, teeth: teethForLink })}">${item.name}</a>`;
    })
    .join("");
}

function initTeethFilters() {
  const el = document.getElementById("teeth-filters");
  if (!el) return;
  const { style: activeStyle, teeth: activeTeeth } = getShopFilters();
  const teethLabel = el.previousElementSibling;
  if (activeStyle === "accessories") {
    el.innerHTML = "";
    el.hidden = true;
    if (teethLabel?.classList?.contains("filter-label")) teethLabel.hidden = true;
    return;
  }
  el.hidden = false;
  if (teethLabel?.classList?.contains("filter-label")) teethLabel.hidden = false;
  const labels = { all: "All teeth", "1": "1 tooth", "2": "2 teeth", "4": "4 teeth", "6": "6 teeth", "8": "8 teeth", "12": "12 teeth", "16": "16 teeth" };
  el.innerHTML = availableTeethCounts(activeStyle)
    .map(
      (count) =>
        `<a class="filter${count === activeTeeth ? " active" : ""}" data-teeth="${count}" href="${shopUrl({ style: activeStyle, teeth: count })}">${labels[count]}</a>`
    )
    .join("");
}

function clientSlideHtml(look, index) {
  const media = look.src
    ? `<img src="${look.src}" alt="${look.alt}" loading="${index === 0 ? "eager" : "lazy"}" />`
    : `<div class="client-placeholder" role="img" aria-label="${look.alt}">Client look ${index + 1}</div>`;
  return `<article class="client-slide${index === 0 ? " is-active" : ""}" data-index="${index}" role="group" aria-roledescription="slide" aria-label="${index + 1} of ${CLIENT_LOOKS.length}">
    ${media}
  </article>`;
}

function initClientCatalogue() {
  const track = document.getElementById("client-track");
  const dotsEl = document.getElementById("client-dots");
  const carousel = document.getElementById("client-carousel");
  const prevBtn = document.getElementById("client-prev");
  const nextBtn = document.getElementById("client-next");
  const progressBar = document.getElementById("client-progress-bar");
  if (!track || !dotsEl || !carousel) return;

  track.innerHTML = CLIENT_LOOKS.map(clientSlideHtml).join("");
  dotsEl.innerHTML = CLIENT_LOOKS.map(
    (_, i) =>
      `<button type="button" class="client-dot${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0}" aria-label="Show look ${i + 1}" data-index="${i}"></button>`
  ).join("");

  let index = 0;
  let timer = null;
  const intervalMs = 4000;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function restartProgress() {
    if (!progressBar) return;
    progressBar.classList.remove("is-running");
    void progressBar.offsetWidth;
    if (!prefersReducedMotion) {
      progressBar.classList.add("is-running");
    }
  }

  function goTo(next) {
    const slides = track.querySelectorAll(".client-slide");
    const dots = dotsEl.querySelectorAll(".client-dot");
    if (!slides.length) return;
    index = ((next % slides.length) + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
    dots.forEach((dot, i) => {
      const on = i === index;
      dot.classList.toggle("is-active", on);
      dot.setAttribute("aria-selected", on ? "true" : "false");
    });
    restartProgress();
  }

  function next() {
    goTo(index + 1);
  }

  function prev() {
    goTo(index - 1);
  }

  function start() {
    if (prefersReducedMotion) return;
    stop();
    restartProgress();
    timer = setInterval(next, intervalMs);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  prevBtn?.addEventListener("click", () => {
    prev();
    start();
  });
  nextBtn?.addEventListener("click", () => {
    next();
    start();
  });
  dotsEl.addEventListener("click", (e) => {
    const dot = e.target.closest(".client-dot");
    if (!dot) return;
    goTo(Number(dot.dataset.index));
    start();
  });

  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
      start();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
      start();
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;
  carousel.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    },
    { passive: true }
  );
  carousel.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) next();
      else prev();
      start();
    },
    { passive: true }
  );

  if (!carousel.hasAttribute("tabindex")) carousel.setAttribute("tabindex", "0");
  start();
}

const BESTSELLER_IDS = [
  "impression-kit-uk",
  "repolish-service",
  "canine-canine",
  "canine-window",
  "canine-bar",
  "star-canine",
  "heart-canine",
];

function bestsellerCard(item) {
  if (!item) return "";
  if (item.kind === "kit") return kitCard(item);
  if (item.kind === "accessory" || item.kind === "service" || item.kind === "giftcard") {
    return accessoryCard(item);
  }
  return productCard(item);
}

function initBestsellers() {
  const viewport = document.getElementById("bestsellers-viewport");
  const track = document.getElementById("bestsellers-track");
  const prevBtn = document.getElementById("bestsellers-prev");
  const nextBtn = document.getElementById("bestsellers-next");
  if (!viewport || !track) return;

  const products = BESTSELLER_IDS.map((id) => {
    const kit = findKit(id);
    if (kit) return kit;
    const accessory = findAccessory(id);
    if (accessory) return accessory;
    const resolved = resolveProductId(id);
    return PRODUCTS.find((p) => p.id === resolved) || null;
  }).filter(Boolean);

  if (!products.length) return;

  const cardsHtml = products.map(bestsellerCard).join("");
  const duplicateHtml = products
    .map((p) => bestsellerCard(p).replace("<a ", '<a aria-hidden="true" tabindex="-1" '))
    .join("");
  track.innerHTML = cardsHtml + duplicateHtml;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let rafId = 0;
  let paused = false;
  let resumeTimer = null;
  let scrollPos = 0;
  const speed = 1.15;
  const resumeDelayMs = 2800;

  function halfWidth() {
    return track.scrollWidth / 2;
  }

  function setAutoScrolling(active) {
    viewport.classList.toggle("is-auto-scrolling", active);
  }

  function syncScrollPos() {
    scrollPos = viewport.scrollLeft;
  }

  function loopScroll() {
    if (!paused) {
      setAutoScrolling(true);
      scrollPos += speed;
      const half = halfWidth();
      if (half > 0 && scrollPos >= half) {
        scrollPos -= half;
      }
      viewport.scrollLeft = scrollPos;
    } else {
      setAutoScrolling(false);
    }
    rafId = requestAnimationFrame(loopScroll);
  }

  function pause() {
    paused = true;
    setAutoScrolling(false);
    syncScrollPos();
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = null;
  }

  function scheduleResume() {
    if (prefersReducedMotion) return;
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      syncScrollPos();
      paused = false;
      setAutoScrolling(true);
    }, resumeDelayMs);
  }

  function stepSize() {
    const card = track.querySelector(".product-card");
    if (!card) return 300;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap) || 20;
    return card.offsetWidth + gap;
  }

  function normalizeLoop() {
    const half = halfWidth();
    if (half <= 0) return;
    if (viewport.scrollLeft >= half) viewport.scrollLeft -= half;
    if (viewport.scrollLeft < 0) viewport.scrollLeft += half;
    syncScrollPos();
  }

  function scrollByCards(direction) {
    pause();
    const delta = direction * stepSize();
    try {
      viewport.scrollBy({ left: delta, behavior: "smooth" });
    } catch (_) {
      viewport.scrollLeft += delta;
    }
    setTimeout(() => {
      normalizeLoop();
      syncScrollPos();
    }, 400);
    scheduleResume();
  }

  prevBtn?.addEventListener("click", () => scrollByCards(-1));
  nextBtn?.addEventListener("click", () => scrollByCards(1));

  ["focusin"].forEach((eventName) => {
    viewport.addEventListener(
      eventName,
      () => {
        pause();
        scheduleResume();
      },
      { passive: true }
    );
  });

  viewport.addEventListener(
    "touchstart",
    () => {
      pause();
    },
    { passive: true }
  );
  viewport.addEventListener(
    "touchend",
    () => {
      syncScrollPos();
      scheduleResume();
    },
    { passive: true }
  );
  viewport.addEventListener(
    "touchcancel",
    () => {
      syncScrollPos();
      scheduleResume();
    },
    { passive: true }
  );

  viewport.addEventListener(
    "wheel",
    (e) => {
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      e.preventDefault();
      pause();
      viewport.scrollLeft += delta;
      normalizeLoop();
      syncScrollPos();
      scheduleResume();
    },
    { passive: false }
  );

  viewport.addEventListener("focusout", (e) => {
    if (!viewport.contains(e.relatedTarget)) scheduleResume();
  });

  let dragStartX = 0;
  let dragScrollLeft = 0;
  let dragging = false;
  let dragMoved = false;
  let activePointerId = null;
  const dragThresholdPx = 10;

  viewport.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    if (e.button != null && e.button !== 0) return;
    pause();
    dragging = true;
    dragMoved = false;
    activePointerId = e.pointerId;
    dragStartX = e.clientX;
    dragScrollLeft = viewport.scrollLeft;
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    const delta = e.clientX - dragStartX;
    if (!dragMoved) {
      if (Math.abs(delta) < dragThresholdPx) return;
      dragMoved = true;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture?.(e.pointerId);
    }
    viewport.scrollLeft = dragScrollLeft - delta;
  });

  function endDrag(e) {
    if (!dragging) return;
    if (activePointerId != null && e.pointerId !== activePointerId) return;
    const wasDrag = dragMoved;
    dragging = false;
    activePointerId = null;
    viewport.classList.remove("is-dragging");
    try {
      viewport.releasePointerCapture?.(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    normalizeLoop();
    syncScrollPos();
    scheduleResume();
    // Keep wasDrag until after the click event; clear on the next frame.
    if (wasDrag) {
      requestAnimationFrame(() => {
        dragMoved = false;
      });
    }
  }

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener(
    "click",
    (e) => {
      if (!dragMoved) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  if (!prefersReducedMotion) {
    syncScrollPos();
    setAutoScrolling(true);
    rafId = requestAnimationFrame(loopScroll);
  }

  window.addEventListener(
    "beforeunload",
    () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (resumeTimer) clearTimeout(resumeTimer);
    },
    { once: true }
  );
}

function initScrollReveal() {
  const nodes = document.querySelectorAll("[data-reveal]");
  if (!nodes.length) return;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    nodes.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  nodes.forEach((el) => observer.observe(el));
}

function initNavDrawer() {
  const toggle = document.getElementById("nav-toggle");
  const drawer = document.getElementById("nav-drawer");
  if (!toggle || !drawer) return;

  function setOpen(open) {
    drawer.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  toggle.addEventListener("click", () => {
    setOpen(drawer.hidden);
  });

  drawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) setOpen(false);
  });

  document.addEventListener("click", (e) => {
    if (drawer.hidden) return;
    if (drawer.contains(e.target) || toggle.contains(e.target)) return;
    setOpen(false);
  });

  const desktopMq = window.matchMedia("(min-width: 901px)");
  function closeOnDesktop(e) {
    if (e.matches) setOpen(false);
  }
  if (desktopMq.addEventListener) {
    desktopMq.addEventListener("change", closeOnDesktop);
  } else if (desktopMq.addListener) {
    desktopMq.addListener(closeOnDesktop);
  }
}

function fillShop() {
  const grid = document.getElementById("shop-grid");
  if (!grid) return;
  const { style, teeth } = getShopFilters();
  if (style === "accessories") {
    grid.innerHTML = [
      ...IMPRESSION_KITS.map(kitCard),
      ...ACCESSORIES.map(accessoryCard),
    ].join("");
  } else {
    let list = PRODUCTS;
    if (style !== "all") list = list.filter((p) => p.style === style);
    if (teeth !== "all") list = list.filter((p) => p.teeth === teeth);
    if (!list.length) {
      grid.innerHTML =
        '<p class="shop-empty">No styles match these filters. <a href="shop.html">View all styles</a>.</p>';
    } else {
      grid.innerHTML = list.map(productCard).join("");
    }
  }
  document.querySelectorAll(".filter[data-style]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.style === style);
  });
  document.querySelectorAll(".filter[data-teeth]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.teeth === teeth);
  });
}

function defaultMaterialForProduct(p) {
  if (p.finish === "silver") return "sterling-silver";
  return "dental-gold";
}

function formatSelectedTeethLabel(selectedTeeth, selectedTeethLabel, product) {
  if (product && isPresetTeethProduct(product)) {
    return presetTeethSummaryLabel(product);
  }
  if (selectedTeethLabel) return selectedTeethLabel;
  if (selectedTeeth?.length && typeof ToothPicker !== "undefined") {
    return ToothPicker.formatLabels(selectedTeeth);
  }
  if (selectedTeeth?.length) return selectedTeeth.join(", ");
  return "Teeth not selected";
}

function getProductSelections() {
  const grillz = getGrillzCartLines()[0];
  if (grillz) {
    return {
      product: findProduct(grillz.productId),
      material: grillz.material,
      stone: grillz.stone,
      piecePrice: grillz.piecePrice,
      arch: grillz.arch,
      selectedTeeth: grillz.selectedTeeth,
      selectedTeethLabel: grillz.selectedTeethLabel,
    };
  }

  const draft = getProductDraft();
  if (!draft?.productId) return null;
  const product = findProduct(draft.productId);
  return {
    product,
    material: draft.material,
    stone: draft.stone,
    piecePrice:
      draft.piecePrice ??
      productPrice(product, draft.material, draft.stone),
    arch: draft.arch || "",
    selectedTeeth: draft.selectedTeeth || [],
    selectedTeethLabel: draft.selectedTeethLabel || "",
  };
}

function hasBookingDesignIntent() {
  return new URLSearchParams(location.search).get("design") === "1";
}

function isBookingFlowActive() {
  if (new URLSearchParams(location.search).get("for") === "booking") return true;
  return sessionStorage.getItem(BOOKING_FLOW_KEY) === "1";
}

function initBookingFlow() {
  if (new URLSearchParams(location.search).get("for") === "booking") {
    sessionStorage.setItem(BOOKING_FLOW_KEY, "1");
  }
}

function getBookingSelections() {
  const grillz = getGrillzCartLines()[0];
  if (grillz) {
    return {
      product: findProduct(grillz.productId),
      material: grillz.material,
      stone: grillz.stone,
      piecePrice: grillz.piecePrice,
      arch: grillz.arch,
      selectedTeeth: grillz.selectedTeeth,
      selectedTeethLabel: grillz.selectedTeethLabel,
    };
  }

  if (!hasBookingDesignIntent() && !isBookingFlowActive()) return null;

  const draft = getProductDraft();
  if (!draft?.productId) return null;
  const product = findProduct(draft.productId);
  return {
    product,
    material: draft.material,
    stone: draft.stone,
    piecePrice:
      draft.piecePrice ??
      productPrice(product, draft.material, draft.stone),
    arch: draft.arch || "",
    selectedTeeth: draft.selectedTeeth || [],
    selectedTeethLabel: draft.selectedTeethLabel || "",
  };
}

function saveProductSelections(order) {
  const cart = getCart();
  const existing = cart.items.findIndex((item) => item.kind === "grillz");
  const line = {
    id: existing >= 0 ? cart.items[existing].id : createLineId(),
    kind: "grillz",
    productId: order.product.id,
    material: order.material,
    piecePrice: order.piecePrice,
    arch: order.arch || "",
    selectedTeeth: order.selectedTeeth || [],
    selectedTeethLabel: order.selectedTeethLabel || "",
  };
  if (isHandSetDiamond(order.product)) {
    line.stone = resolveStoneId(order.stone);
  }
  if (existing >= 0) cart.items[existing] = line;
  else cart.items.push(line);
  saveCart(cart);
}

function hasOrder() {
  return cartHasGrillz();
}

function initCartLinks() {
  const count = getCartCount();
  document.querySelectorAll(".cart-link").forEach((link) => {
    link.textContent = `Cart (${count})`;
  });
}

function getSelectedArch(product) {
  const p = product;
  if (!p) return "";
  const draft = getProductDraft();
  const sel =
    typeof ToothPicker !== "undefined"
      ? ToothPicker.getSelection()?.selectedTeeth || draft?.selectedTeeth || []
      : draft?.selectedTeeth || [];
  if (typeof ToothPicker !== "undefined") {
    const derived = ToothPicker.deriveArchLabel(sel);
    if (derived) return derived;
    const mode = ToothPicker.getChartMode(p);
    if (mode === "upper") return "Upper";
    if (mode === "lower") return "Lower";
  }
  return "";
}

function initMaterialSelect() {
  const select = document.getElementById("material-select");
  if (!select) return;
  select.innerHTML = MATERIAL_OPTIONS.map(
    (m) => `<option value="${m.id}">${m.label}</option>`
  ).join("");
}

function initStoneSelect() {
  const select = document.getElementById("stone-select");
  if (!select) return;
  select.innerHTML = STONE_OPTIONS.map(
    (s) => `<option value="${s.id}">${s.label}</option>`
  ).join("");
}

function syncHandSetDiamondUi(product) {
  const showStone = isHandSetDiamond(product);
  document.querySelectorAll(".hand-set-diamond-only").forEach((el) => {
    el.hidden = !showStone;
  });
  const priceNote = document.querySelector(".price-note.grillz-only");
  if (priceNote) {
    priceNote.textContent = showStone
      ? "Price updates with material and stone."
      : "Price updates with material.";
  }
}

function getSelectedStone(product, draft, sameProduct) {
  if (!isHandSetDiamond(product)) return undefined;
  const stoneSelect = document.getElementById("stone-select");
  if (stoneSelect?.value) return resolveStoneId(stoneSelect.value);
  if (sameProduct && draft?.stone) return resolveStoneId(draft.stone);
  return DEFAULT_STONE_ID;
}

function refreshGrillzProductPrice(product) {
  const price = document.getElementById("product-price");
  const materialSelect = document.getElementById("material-select");
  const draft = getProductDraft();
  const sameProduct = draft?.productId === product.id;
  const material = materialSelect?.value || defaultMaterialForProduct(product);
  const stone = getSelectedStone(product, draft, sameProduct);
  updateProductPriceDisplay(price, product, material, stone);
}

function persistProductPageSelections(product) {
  const resolved = findProduct(product.id);
  const materialSelect = document.getElementById("material-select");
  const preset = presetToothSelection(resolved);
  const toothSelection =
    preset ||
    (typeof ToothPicker !== "undefined" && document.getElementById("tooth-picker")
      ? ToothPicker.getSelection()
      : { selectedTeeth: [], selectedTeethLabel: "" });
  const arch = preset?.arch || getSelectedArch(resolved);
  const material = materialSelect?.value || defaultMaterialForProduct(resolved);
  const draft = getProductDraft();
  const stone = getSelectedStone(resolved, draft, draft?.productId === resolved.id);

  saveProductDraft({
    productId: resolved.id,
    material,
    ...(stone ? { stone } : {}),
    piecePrice: productPrice(resolved, material, stone),
    arch,
    selectedTeeth: toothSelection.selectedTeeth,
    selectedTeethLabel: toothSelection.selectedTeethLabel,
  });
}

function buildGrillzSelection(product) {
  const resolved = findProduct(product.id);
  const materialSelect = document.getElementById("material-select");
  const material = materialSelect?.value || defaultMaterialForProduct(resolved);
  const draft = getProductDraft();
  const stone = getSelectedStone(resolved, draft, draft?.productId === resolved.id);
  const preset = presetToothSelection(resolved);
  if (preset) {
    return {
      product: resolved,
      material,
      ...(stone ? { stone } : {}),
      piecePrice: productPrice(resolved, material, stone),
      arch: preset.arch,
      selectedTeeth: preset.selectedTeeth,
      selectedTeethLabel: preset.selectedTeethLabel,
    };
  }

  const toothSelection =
    typeof ToothPicker !== "undefined" && document.getElementById("tooth-picker")
      ? ToothPicker.getSelection()
      : { selectedTeeth: [], selectedTeethLabel: "" };

  return {
    product: resolved,
    material,
    ...(stone ? { stone } : {}),
    piecePrice: productPrice(resolved, material, stone),
    arch: getSelectedArch(resolved),
    selectedTeeth: toothSelection.selectedTeeth,
    selectedTeethLabel: toothSelection.selectedTeethLabel,
  };
}

function setProductMode(mode) {
  document.querySelectorAll(".grillz-only").forEach((el) => {
    el.hidden = mode !== "grillz";
  });
  document.querySelectorAll(".kit-only").forEach((el) => {
    el.hidden = mode !== "kit";
  });
  document.querySelectorAll(".accessory-only").forEach((el) => {
    el.hidden = mode !== "accessory";
  });
  document.querySelectorAll(".giftcard-only").forEach((el) => {
    el.hidden = mode !== "giftcard";
  });
  document.querySelectorAll(".service-only").forEach((el) => {
    el.hidden = mode !== "service";
  });
}

function setGrillzProductUiVisible(visible) {
  setProductMode(visible ? "grillz" : "kit");
}

function renderKitContents(kit) {
  const list = document.getElementById("kit-contents-list");
  const attempts = document.getElementById("kit-attempts-note");
  const returnNote = document.getElementById("kit-return-note");
  if (attempts) {
    attempts.textContent = "Includes enough materials for 2 attempts.";
  }
  if (list) {
    list.innerHTML = kit.includes.map((item) => `<li>${item}</li>`).join("");
  }
  if (returnNote) {
    if (kit.returnNote) {
      returnNote.hidden = false;
      returnNote.textContent = kit.returnNote;
    } else {
      returnNote.hidden = true;
      returnNote.textContent = "";
    }
  }
}

function fillKitProduct(kit) {
  const title = document.getElementById("product-title");
  const price = document.getElementById("product-price");
  const blurb = document.getElementById("product-blurb");
  const gallery = document.getElementById("product-gallery");
  const eyebrow = document.getElementById("product-eyebrow");

  setProductMode("kit");
  if (eyebrow) eyebrow.textContent = "Accessories";
  if (title) title.textContent = kit.displayName;
  if (price) price.textContent = kitDisplayPrice(kit);
  if (blurb) blurb.textContent = kit.blurb;
  if (gallery) {
    if (kit.image) {
      gallery.className = "gallery product-gallery--image";
      gallery.innerHTML = `<img src="${kit.image}" alt="${kit.displayName}" />`;
    } else {
      gallery.className = "gallery product-image gold";
      gallery.textContent = "Impression kit";
    }
  }
  renderKitContents(kit);
  initKitAddToCart(kit);
}

function fillAccessoryProduct(accessory) {
  const title = document.getElementById("product-title");
  const price = document.getElementById("product-price");
  const blurb = document.getElementById("product-blurb");
  const gallery = document.getElementById("product-gallery");
  const eyebrow = document.getElementById("product-eyebrow");

  setProductMode("accessory");
  if (eyebrow) eyebrow.textContent = "Accessories";
  if (title) title.textContent = accessory.displayName;
  if (price) price.textContent = formatMoney(accessory.price);
  if (blurb) blurb.textContent = accessory.blurb;
  if (gallery) {
    if (accessory.image) {
      gallery.className = "gallery product-gallery--image";
      gallery.innerHTML = `<img src="${accessory.image}" alt="${accessory.imageAlt || accessory.displayName}" />`;
    } else {
      gallery.className = "gallery product-image gold";
      gallery.textContent = accessory.displayName;
    }
  }
  initAccessoryAddToCart(accessory);
}

function fillGiftCardProduct(giftCard) {
  const title = document.getElementById("product-title");
  const price = document.getElementById("product-price");
  const blurb = document.getElementById("product-blurb");
  const gallery = document.getElementById("product-gallery");
  const eyebrow = document.getElementById("product-eyebrow");
  const amountSelect = document.getElementById("gift-card-amount");
  const amounts = giftCard.amounts || [giftCard.price];

  setProductMode("giftcard");
  const bookCta = document.querySelector('.cta-row a[href*="book.html"]');
  if (bookCta) bookCta.hidden = true;
  if (eyebrow) eyebrow.textContent = "Accessories";
  if (title) title.textContent = giftCard.displayName;
  if (blurb) blurb.textContent = giftCard.blurb;
  if (gallery) {
    if (giftCard.image) {
      gallery.className = "gallery product-gallery--image product-gallery--giftcard";
      gallery.innerHTML = `<img src="${giftCard.image}" alt="${giftCard.imageAlt || giftCard.displayName}" />`;
    } else {
      gallery.className = "gallery product-image gold";
      gallery.textContent = giftCard.displayName;
    }
  }
  if (amountSelect) {
    amountSelect.innerHTML = amounts
      .map((amount) => `<option value="${amount}">${formatMoney(amount)}</option>`)
      .join("");
    amountSelect.value = String(giftCard.price);
    if (!amountSelect.dataset.bound) {
      amountSelect.dataset.bound = "true";
      amountSelect.addEventListener("change", () => {
        if (price) price.textContent = formatMoney(Number(amountSelect.value));
      });
    }
  }
  if (price) price.textContent = formatMoney(Number(amountSelect?.value) || giftCard.price);
  initGiftCardAddToCart(giftCard);
}

function fillServiceProduct(service) {
  const title = document.getElementById("product-title");
  const price = document.getElementById("product-price");
  const blurb = document.getElementById("product-blurb");
  const gallery = document.getElementById("product-gallery");
  const eyebrow = document.getElementById("product-eyebrow");

  setProductMode("service");
  if (eyebrow) eyebrow.textContent = "Accessories";
  if (title) title.textContent = service.displayName;
  if (price) price.textContent = formatMoney(service.price);
  if (blurb) blurb.textContent = service.blurb;
  if (gallery) {
    if (service.image) {
      gallery.className = "gallery product-gallery--image product-gallery--service";
      gallery.innerHTML = `<img src="${service.image}" alt="${service.imageAlt || service.displayName}" />`;
    } else {
      gallery.className = "gallery product-image gold";
      gallery.textContent = "Repolish";
    }
  }
  initServiceAddToCart(service);
}

function fillGrillzProduct(p) {
  const title = document.getElementById("product-title");
  const price = document.getElementById("product-price");
  const blurb = document.getElementById("product-blurb");
  const gallery = document.getElementById("product-gallery");
  const materialSelect = document.getElementById("material-select");
  const stoneSelect = document.getElementById("stone-select");
  const eyebrow = document.getElementById("product-eyebrow");

  setProductMode("grillz");
  syncHandSetDiamondUi(p);
  if (eyebrow) {
    eyebrow.textContent = STYLE_LABELS[p.style] || p.style || "Grillz";
  }

  const displayTitle = productDisplayName(p);
  if (title) title.textContent = displayTitle;

  const draft = getProductDraft();
  const sameProduct = draft?.productId === p.id;

  let material = "sterling-silver";
  if (sameProduct && draft.material) {
    material = resolveMaterialId(draft.material, p) || material;
  }

  let stone = DEFAULT_STONE_ID;
  if (isHandSetDiamond(p)) {
    stone = getSelectedStone(p, draft, sameProduct);
    initStoneSelect();
    if (stoneSelect) {
      stoneSelect.value = stone;
      if (!stoneSelect.dataset.bound) {
        stoneSelect.dataset.bound = "true";
        stoneSelect.addEventListener("change", () => {
          refreshGrillzProductPrice(p);
          persistProductPageSelections(p);
        });
      }
    }
  }

  if (price) updateProductPriceDisplay(price, p, material, stone);
  if (blurb) blurb.textContent = p.blurb;

  if (typeof ToothPicker !== "undefined" && document.getElementById("tooth-picker")) {
    const preset = presetToothSelection(p);
    ToothPicker.init(p, {
      selectedTeeth: preset
        ? preset.selectedTeeth
        : sameProduct
          ? draft.selectedTeeth || []
          : [],
      selectedTeethLabel: preset?.selectedTeethLabel || "",
      readOnly: Boolean(preset),
      onChange: preset ? null : () => persistProductPageSelections(p),
    });
  }

  if (materialSelect) {
    materialSelect.value = material;
    if (!materialSelect.dataset.bound) {
      materialSelect.dataset.bound = "true";
      materialSelect.addEventListener("change", () => {
        updateProductGallery(gallery, materialSelect.value, p);
        refreshGrillzProductPrice(p);
        persistProductPageSelections(p);
      });
    }
  }

  updateProductGallery(gallery, material, p);
  persistProductPageSelections(p);
  initGrillzAddToCart(p);
}

function fillProduct() {
  const rawId = new URLSearchParams(location.search).get("id") || PRODUCTS[0].id;
  const kit = findKit(rawId);
  if (kit) {
    fillKitProduct(kit);
    return;
  }
  const accessory = findAccessory(rawId);
  if (accessory) {
    if (accessory.kind === "service") {
      fillServiceProduct(accessory);
    } else if (accessory.kind === "giftcard") {
      fillGiftCardProduct(accessory);
    } else {
      fillAccessoryProduct(accessory);
    }
    return;
  }
  fillGrillzProduct(findProduct(rawId));
}

function initGrillzAddToCart(product) {
  const cta = document.getElementById("add-to-cart-btn");
  if (!cta || cta.dataset.bound) return;
  cta.dataset.bound = "true";
  cta.addEventListener("click", () => {
    const selection = buildGrillzSelection(product);
    if (typeof ToothPicker !== "undefined" && !isPresetTeethProduct(product)) {
      const result = ToothPicker.validate(
        product,
        selection.arch,
        selection.selectedTeeth
      );
      if (!result.ok) {
        toast(result.message);
        return;
      }
    }
    addGrillzToCart(selection);
    toast("Added to cart.");
  });
}

function initKitAddToCart(kit) {
  const cta = document.getElementById("add-to-cart-btn");
  if (!cta || cta.dataset.bound) return;
  cta.dataset.bound = "true";
  cta.addEventListener("click", () => {
    const added = addKitToCart(kit.id);
    toast(added ? "Added to cart." : "This kit is already in your cart.");
  });
}

function initAccessoryAddToCart(accessory) {
  const cta = document.getElementById("add-to-cart-btn");
  if (!cta || cta.dataset.bound) return;
  cta.dataset.bound = "true";
  cta.addEventListener("click", () => {
    const added = addAccessoryToCart(accessory.id);
    toast(added ? "Added to cart." : "This item is already in your cart.");
  });
}

function initServiceAddToCart(service) {
  const cta = document.getElementById("add-to-cart-btn");
  if (!cta || cta.dataset.bound) return;
  cta.dataset.bound = "true";
  cta.addEventListener("click", () => {
    const selected = document.querySelector('input[name="repolish-fulfillment"]:checked');
    const fulfillment = selected?.value === "dropoff" ? "dropoff" : "postal";
    addServiceToCart(service.id, fulfillment);
    toast(
      fulfillment === "dropoff"
        ? "Added to cart — DM @krownfrontz to arrange drop-off."
        : "Added to cart — we’ll email the studio return address after payment."
    );
  });
}

function initGiftCardAddToCart(giftCard) {
  const cta = document.getElementById("add-to-cart-btn");
  if (!cta || cta.dataset.bound) return;
  cta.dataset.bound = "true";
  cta.addEventListener("click", () => {
    const amountSelect = document.getElementById("gift-card-amount");
    const amount = Number(amountSelect?.value) || giftCard.price;
    const added = addGiftCardToCart(amount);
    toast(
      added
        ? "Added to cart — we’ll email your gift code after payment."
        : "Could not add this gift card amount."
    );
  });
}

function kitCard(kit) {
  const bookingQuery = isBookingFlowActive() ? "&for=booking" : "";
  return `<a class="product-card product-card--named product-card--kit" href="product.html?id=${kit.id}${bookingQuery}" aria-label="${kit.displayName}">
    <div class="product-card-media">${productMediaHtml(kit, { placeholderLabel: "Kit" })}</div>
    <div class="product-card-footer">
      <h3 class="product-card-name">${kit.displayName}</h3>
      <p class="product-card-prices"><span class="price-current">${kitDisplayPrice(kit)}</span></p>
    </div>
  </a>`;
}

function accessoryCard(item) {
  const bookingQuery = isBookingFlowActive() ? "&for=booking" : "";
  const label =
    item.kind === "service" ? "Service" : item.kind === "giftcard" ? "Gift" : "Care";
  const priceLabel =
    item.kind === "giftcard" ? `From ${formatMoney(item.price)}` : formatMoney(item.price);
  const cardClass =
    item.kind === "giftcard"
      ? "product-card product-card--named product-card--giftcard"
      : item.kind === "service"
        ? "product-card product-card--named product-card--service"
        : "product-card product-card--named";
  return `<a class="${cardClass}" href="product.html?id=${item.id}${bookingQuery}" aria-label="${item.displayName}">
    <div class="product-card-media">${productMediaHtml(item, { placeholderLabel: label })}</div>
    <div class="product-card-footer">
      <h3 class="product-card-name">${item.displayName}</h3>
      <p class="product-card-prices"><span class="price-current">${priceLabel}</span></p>
    </div>
  </a>`;
}

function renderCartLineHtml(item) {
  if (item.kind === "kit") {
    const kit = findKit(item.kitId);
    const name = escapeHtml(kit ? kit.displayName : "Impression kit");
    return `<div class="cart-line" data-line-id="${escapeHtml(item.id)}">
      <div class="cart-line-main">
        <strong>${name}</strong>
      </div>
      <div class="cart-line-meta">
        <span>${formatMoney(item.price)}</span>
        <button type="button" class="cart-line-remove" data-remove-line="${escapeHtml(item.id)}" aria-label="Remove ${name}">Remove</button>
      </div>
    </div>`;
  }

  if (item.kind === "accessory") {
    const accessory = findAccessory(item.accessoryId);
    const name = escapeHtml(accessory ? accessory.displayName : "Accessory");
    return `<div class="cart-line" data-line-id="${escapeHtml(item.id)}">
      <div class="cart-line-main">
        <strong>${name}</strong>
      </div>
      <div class="cart-line-meta">
        <span>${formatMoney(item.price)}</span>
        <button type="button" class="cart-line-remove" data-remove-line="${escapeHtml(item.id)}" aria-label="Remove ${name}">Remove</button>
      </div>
    </div>`;
  }

  if (item.kind === "service") {
    const service = findAccessory(item.serviceId);
    const name = escapeHtml(service ? service.displayName : "Service");
    const fulfillmentLabel =
      item.fulfillment === "dropoff" ? "Drop off in person" : "Post your set";
    return `<div class="cart-line" data-line-id="${escapeHtml(item.id)}">
      <div class="cart-line-main">
        <strong>${name}</strong>
        <span class="cart-line-detail">${escapeHtml(fulfillmentLabel)}</span>
      </div>
      <div class="cart-line-meta">
        <span>${formatMoney(item.price)}</span>
        <button type="button" class="cart-line-remove" data-remove-line="${escapeHtml(item.id)}" aria-label="Remove ${name}">Remove</button>
      </div>
    </div>`;
  }

  if (item.kind === "giftcard") {
    const giftCard = findAccessory(item.accessoryId) || findAccessory("gift-card");
    const name = escapeHtml(giftCard ? giftCard.displayName : "Gift card");
    return `<div class="cart-line" data-line-id="${escapeHtml(item.id)}">
      <div class="cart-line-main">
        <strong>${name}</strong>
        <span class="cart-line-detail">Email delivery</span>
      </div>
      <div class="cart-line-meta">
        <span>${formatMoney(item.price)}</span>
        <button type="button" class="cart-line-remove" data-remove-line="${escapeHtml(item.id)}" aria-label="Remove ${name}">Remove</button>
      </div>
    </div>`;
  }

  const product = findProduct(item.productId);
  const materialLabel = escapeHtml(
    MATERIAL_LABELS[resolveMaterialId(item.material, product) || ""] ||
      MATERIAL_LABELS[defaultMaterialForProduct(product)]
  );
  const stoneLabel = item.stone ? escapeHtml(STONE_LABELS[item.stone] || item.stone) : "";
  const teethLabel = escapeHtml(
    formatSelectedTeethLabel(item.selectedTeeth, item.selectedTeethLabel, product)
  );
  const productName = escapeHtml(productDisplayName(product));

  return `<div class="cart-line" data-line-id="${escapeHtml(item.id)}">
    <div class="cart-line-main">
      <strong>${productName}</strong>
      <span class="cart-line-detail">${materialLabel}</span>
      ${stoneLabel ? `<span class="cart-line-detail">${stoneLabel}</span>` : ""}
      <span class="cart-line-detail">${teethLabel}</span>
    </div>
    <div class="cart-line-meta">
      <span>${formatMoney(item.piecePrice)}</span>
      <button type="button" class="cart-line-remove" data-remove-line="${escapeHtml(item.id)}" aria-label="Remove ${productName}">Remove</button>
    </div>
  </div>`;
}

function fillCheckout() {
  const cartLines = document.getElementById("cart-lines");
  const cartEmpty = document.getElementById("cart-empty");
  const shippingBlock = document.getElementById("checkout-shipping");
  const checkoutNotice = document.getElementById("checkout-notice");
  const kitShippingRow = document.getElementById("summary-kit-shipping-row");
  const kitShipping = document.getElementById("summary-kit-shipping");
  const finishShippingRow = document.getElementById("summary-finish-shipping-row");
  const finishShipping = document.getElementById("summary-finish-shipping");
  const total = document.getElementById("summary-total");
  const countrySelect = document.querySelector('select[name="country"]');
  const form = document.querySelector(".checkout-layout form");

  if (countrySelect) {
    const savedCountry = sessionStorage.getItem(SHIPPING_COUNTRY_STORAGE_KEY);
    if (savedCountry && SHIPPING_ZONES[savedCountry]) {
      countrySelect.value = savedCountry;
    }
  }

  function updateSummary({ showKitSwapToast = false } = {}) {
    const zoneId = countrySelect?.value || "uk";
    const syncResult = syncKitToCountry(zoneId);
    const cart = syncResult.cart;
    const hasItems = cart.items.length > 0;
    const shipping = computeCheckoutShipping(zoneId, cart);
    const subtotal = cartLineSubtotal(cart);
    const orderTotal = subtotal + shipping.total;

    if (showKitSwapToast && syncResult.swapped && syncResult.kitName) {
      toast(`Switched to ${syncResult.kitName} for your delivery address.`);
    }

    if (cartLines) {
      cartLines.innerHTML = hasItems ? cart.items.map(renderCartLineHtml).join("") : "";
    }
    if (cartEmpty) cartEmpty.hidden = hasItems;
    if (shippingBlock) shippingBlock.hidden = !hasItems;
    if (form) form.hidden = !hasItems;

    if (kitShippingRow) {
      kitShippingRow.hidden = shipping.kitShipping <= 0;
    }
    if (kitShipping) kitShipping.textContent = formatMoney(shipping.kitShipping);
    if (finishShippingRow) {
      finishShippingRow.hidden = shipping.finishShipping <= 0;
    }
    if (finishShipping) finishShipping.textContent = formatMoney(shipping.finishShipping);
    if (total) total.textContent = formatMoney(orderTotal);
    updateCurrencyDisclaimer();

    if (checkoutNotice) {
      const needsKit = cartHasGrillz(cart) && !cartHasKit(null, cart);
      checkoutNotice.hidden = !needsKit;
      if (needsKit) {
        checkoutNotice.innerHTML =
          'Postal grillz orders need an impression kit in your cart. <a href="product.html?id=impression-kit-uk">UK kit</a> · <a href="product.html?id=impression-kit-international">International kit</a>';
      }
    }
  }

  document.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove-line]");
    if (!removeBtn || !document.getElementById("cart-lines")?.contains(removeBtn)) return;
    removeCartItem(removeBtn.dataset.removeLine);
    updateSummary();
  });

  countrySelect?.addEventListener("change", () => {
    sessionStorage.setItem(SHIPPING_COUNTRY_STORAGE_KEY, countrySelect.value);
    updateSummary({ showKitSwapToast: true });
  });

  checkoutUpdateSummary = () => updateSummary();
  updateSummary();
}

function serializeCartForCheckout(cart) {
  return cart.items
    .map((item) => {
      if (item.kind === "grillz") {
        const product = findProduct(item.productId);
        const line = {
          kind: "grillz",
          productId: item.productId,
          material: item.material,
          selectedTeeth: item.selectedTeeth || [],
          selectedTeethLabel: item.selectedTeethLabel || "",
        };
        if (isHandSetDiamond(product)) {
          line.stone = resolveStoneId(item.stone);
        }
        return line;
      }
      if (item.kind === "kit") {
        return { kind: "kit", kitId: item.kitId };
      }
      if (item.kind === "accessory") {
        return { kind: "accessory", accessoryId: item.accessoryId };
      }
      if (item.kind === "service") {
        return {
          kind: "service",
          serviceId: item.serviceId,
          fulfillment: item.fulfillment === "dropoff" ? "dropoff" : "postal",
        };
      }
      if (item.kind === "giftcard") {
        return {
          kind: "giftcard",
          accessoryId: item.accessoryId || "gift-card",
          amount: item.price,
        };
      }
      return null;
    })
    .filter(Boolean);
}

async function handleCheckoutSubmit(form) {
  const countrySelect = form.querySelector('select[name="country"]');
  const zoneId = countrySelect?.value || "uk";
  const syncResult = syncKitToCountry(zoneId);
  const cart = syncResult.cart;

  if (!cart.items.length) {
    toast("Your cart is empty.");
    return;
  }

  if (cartHasGrillz(cart) && !cartHasKit(null, cart)) {
    toast("Postal grillz orders need an impression kit in your cart.");
    return;
  }

  const submitBtn = form.querySelector("#checkout-submit-btn") || form.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent || "Pay with Stripe";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Redirecting to Stripe…";
  }

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zoneId,
        customer: {
          email: form.email.value,
          first: form.first.value,
          last: form.last.value,
          address: {
            line1: form.line1.value,
            line2: form.line2.value,
            city: form.city.value,
            postcode: form.postcode.value,
            country: countrySelect?.selectedOptions[0]?.text || "",
          },
        },
        items: serializeCartForCheckout(cart),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Checkout failed.");
    }
    if (!data.url) {
      throw new Error("No checkout URL returned.");
    }
    sessionStorage.setItem(
      "kf-checkout-flags",
      JSON.stringify({
        postalRepolish: cartHasPostalRepolish(cart),
        dropoffRepolish: cart.items.some(
          (item) => item.kind === "service" && item.fulfillment === "dropoff"
        ),
        giftCard: cart.items.some((item) => item.kind === "giftcard"),
      })
    );
    window.location.href = data.url;
  } catch (error) {
    toast(error.message || "Unable to start checkout.");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

function initCheckoutSuccess() {
  if (!document.body.classList.contains("checkout-success")) return;

  const params = new URLSearchParams(location.search);
  const sessionId = params.get("session_id");
  const heading = document.querySelector(".page-title h1");
  const lede = document.querySelector(".page-title .lede");

  if (!sessionId) {
    if (heading) heading.textContent = "Order status unavailable";
    if (lede) {
      lede.textContent = "No payment reference was found. Contact us if you completed checkout.";
    }
    return;
  }

  if (lede) lede.textContent = "Verifying your payment…";

  fetch(`/api/get-checkout-session?session_id=${encodeURIComponent(sessionId)}`)
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok || !data.paid) {
        throw new Error(data.error || "Payment could not be verified.");
      }
      sessionStorage.removeItem(ORDER_STORAGE_KEY);
      initCartLinks();
      if (heading) heading.textContent = "Payment received";
      if (lede) {
        let flags = {};
        try {
          flags = JSON.parse(sessionStorage.getItem("kf-checkout-flags") || "{}");
        } catch {
          flags = {};
        }
        sessionStorage.removeItem("kf-checkout-flags");
        if (flags.postalRepolish) {
          lede.textContent =
            "Your order is confirmed. We’ll email you shortly with the studio return address so you can post your grillz for repolishing, plus next steps for any other items.";
        } else if (flags.dropoffRepolish) {
          lede.textContent =
            "Your order is confirmed. DM @krownfrontz on Instagram to arrange dropping off your set in Manchester, and we’ll email any other next steps.";
        } else if (flags.giftCard) {
          lede.textContent =
            "Your order is confirmed. We’ll email you shortly with your gift card code and next steps for any other items.";
        } else {
          lede.textContent =
            "Your order is confirmed. We will email you shortly with next steps for impressions and production.";
        }
      }
    })
    .catch((error) => {
      if (heading) heading.textContent = "We could not verify your payment";
      if (lede) {
        lede.textContent =
          error.message ||
          "If you were charged, email krownfrontz@gmail.com and we'll help locate your order.";
      }
    });
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.hidden = false;
  el.textContent = msg;
  setTimeout(() => {
    el.hidden = true;
  }, 2200);
}

async function handleSubscribeSubmit(form) {
  const honeypot = form.elements.namedItem("company");
  if (honeypot instanceof HTMLInputElement && honeypot.value.trim()) {
    toast("Thanks — you're on the list.");
    form.reset();
    return;
  }

  const emailInput = form.elements.namedItem("email");
  const consentInput = form.elements.namedItem("consent");
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!(emailInput instanceof HTMLInputElement)) return;

  const email = emailInput.value.trim();
  if (!email) {
    toast("Please enter your email address.");
    return;
  }

  if (!(consentInput instanceof HTMLInputElement) || !consentInput.checked) {
    toast("Please agree to receive marketing emails before subscribing.");
    return;
  }

  const originalLabel = submitBtn?.textContent || "Subscribe";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Subscribing…";
  }

  try {
    const response = await fetch("/api/subscribe-newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, consent: true }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast(data.error || "Could not subscribe right now. Please try again.");
      return;
    }

    toast("Thanks — you're on the list.");
    form.reset();
  } catch {
    toast("Could not subscribe right now. Please check your connection and try again.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  }
}

document.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip && chip.parentElement.classList.contains("chips")) {
    chip.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
    const order = getProductSelections();
    if (order?.product && document.getElementById("material-select")) {
      persistProductPageSelections(order.product);
    }
    if (document.getElementById("book-appointment-when")) {
      updateBookAppointmentSummary();
    }
  }
  const day = e.target.closest("#book-calendar .day:not(:disabled)");
  if (day?.dataset.date) {
    document.querySelectorAll("#book-calendar .day").forEach((d) => d.classList.remove("selected"));
    day.classList.add("selected");
    bookSelectedDate = day.dataset.date;
    updateBookAppointmentSummary();
  }
  const slot = e.target.closest("#book-time-slots [data-slot]");
  if (slot) {
    document.querySelectorAll("#book-time-slots [data-slot]").forEach((s) => s.classList.remove("selected"));
    slot.classList.add("selected");
    updateBookAppointmentSummary();
  }
});

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === "email-signup-form") {
    e.preventDefault();
    handleSubscribeSubmit(form);
    return;
  }
  if (form.dataset.mock === "true" && form.id === "book-form") {
    e.preventDefault();
    handleBookFormSubmit(form);
    return;
  }
  if (form.id === "checkout-form") {
    e.preventDefault();
    handleCheckoutSubmit(form);
    return;
  }
  if (form.dataset.mock === "true") {
    e.preventDefault();
    toast("Design preview — payment and booking are mocked.");
  }
});

const BOOK_MAX_DAYS_AHEAD = 60;
let bookCalendarMonth = null;
let bookSelectedDate = null;

function isPageReload() {
  const nav = performance.getEntriesByType("navigation")[0];
  return nav?.type === "reload";
}

function isBookPage() {
  return Boolean(
    document.getElementById("book-calendly-embed") || document.getElementById("book-calendar")
  );
}

function shouldSkipBookPrefill() {
  return isBookPage() && isPageReload();
}

function initBookPageSession() {
  if (!isBookPage()) return;
  if (!isPageReload()) return;
  sessionStorage.removeItem(BOOKING_FLOW_KEY);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isDateBookable(date) {
  const today = startOfDay(new Date());
  const max = new Date(today);
  max.setDate(max.getDate() + BOOK_MAX_DAYS_AHEAD);
  const d = startOfDay(date);
  return d >= today && d <= max;
}

function formatBookDate(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatBookDateTime(dateKey, time) {
  return `${formatBookDate(dateKey)} · ${time}`;
}

function getSelectedBookSlot() {
  const day = document.querySelector("#book-calendar .day.selected[data-date]");
  const slot = document.querySelector("#book-time-slots .chip.selected[data-slot]");
  if (!day?.dataset.date || !slot) return null;
  return { date: day.dataset.date, time: slot.textContent.trim() };
}

function updateBookAppointmentSummary() {
  const el = document.getElementById("book-appointment-when");
  if (!el) return;
  const slot = getSelectedBookSlot();
  el.textContent = slot ? formatBookDateTime(slot.date, slot.time) : "";
}

function monthHasBookableDays(year, month) {
  if (month < 0 || month > 11) return false;
  const last = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= last; day += 1) {
    if (isDateBookable(new Date(year, month, day))) return true;
  }
  return false;
}

function firstBookableDateInMonth(year, month) {
  const last = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= last; day += 1) {
    const date = new Date(year, month, day);
    if (isDateBookable(date)) return toDateKey(date);
  }
  return null;
}

function renderBookCalendar() {
  const calendar = document.getElementById("book-calendar");
  const label = document.getElementById("book-calendar-label");
  const prevBtn = document.getElementById("book-calendar-prev");
  const nextBtn = document.getElementById("book-calendar-next");
  if (!calendar || !label || !bookCalendarMonth) return;

  const year = bookCalendarMonth.getFullYear();
  const month = bookCalendarMonth.getMonth();
  label.textContent = bookCalendarMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const monthBookable = firstBookableDateInMonth(year, month);
  if (bookSelectedDate === null) {
    bookSelectedDate = monthBookable;
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  let startPad = firstDay.getDay() - 1;
  if (startPad < 0) startPad = 6;

  let html = "";

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);
    const bookable = isDateBookable(date);
    const selected = bookSelectedDate === dateKey;
    const colStart = day === 1 ? ` style="grid-column-start:${startPad + 1}"` : "";
    html += `<button type="button" class="day${selected ? " selected" : ""}"${colStart} data-date="${dateKey}"${
      bookable ? "" : " disabled"
    }>${day}</button>`;
  }

  calendar.innerHTML = html;

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;

  if (prevBtn) prevBtn.disabled = !monthHasBookableDays(prevYear, prevMonth);
  if (nextBtn) nextBtn.disabled = !monthHasBookableDays(nextYear, nextMonth);

  updateBookAppointmentSummary();
}

function initBookCalendar() {
  const calendar = document.getElementById("book-calendar");
  if (!calendar) return;

  const now = new Date();
  bookCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  bookSelectedDate = firstBookableDateInMonth(now.getFullYear(), now.getMonth());

  renderBookCalendar();

  document.getElementById("book-calendar-prev")?.addEventListener("click", () => {
    if (!bookCalendarMonth) return;
    bookCalendarMonth.setMonth(bookCalendarMonth.getMonth() - 1);
    renderBookCalendar();
  });

  document.getElementById("book-calendar-next")?.addEventListener("click", () => {
    if (!bookCalendarMonth) return;
    bookCalendarMonth.setMonth(bookCalendarMonth.getMonth() + 1);
    renderBookCalendar();
  });
}

function handleBookFormSubmit(form) {
  const slot = getSelectedBookSlot();
  if (!slot) {
    toast("Please choose a date and time.");
    return;
  }

  const email = form.querySelector('[name="email"]')?.value?.trim();
  const whenEl = document.getElementById("book-confirmation-when");
  const emailEl = document.getElementById("book-confirmation-email");
  const confirmation = document.getElementById("book-confirmation");
  const bookingSection = document.getElementById("book-booking-section");

  if (whenEl) whenEl.textContent = formatBookDateTime(slot.date, slot.time);
  if (emailEl) emailEl.textContent = email || "your email";
  if (bookingSection) bookingSection.hidden = true;
  if (confirmation) confirmation.hidden = false;

  toast("Appointment booked — check your email.");
}

function initFooterPayments() {
  if (document.getElementById("footer-payments")) return;
  const footer = document.querySelector(".footer");
  if (!footer) return;

  const notice = document.createElement("div");
  notice.id = "footer-payments";
  notice.className = "footer-payments";
  notice.innerHTML =
    "<p><strong>Payments via Stripe</strong> — debit cards, Klarna, Revolut Pay, and other methods available at checkout.</p>";
  footer.insertAdjacentElement("afterend", notice);
}

async function boot() {
  initBookPageSession();
  if (document.getElementById("book-calendly-embed")) {
    renderBookDesignPanel();
    await initBookDepositGate();
  }

  await fetchExchangeRates();
  initCurrencySelector();
  initFooterPayments();
  initBookingFlow();
  initCartLinks();
  initNavDrawer();
  initScrollReveal();
  initClientCatalogue();
  initBestsellers();
  if (document.getElementById("style-filters")) {
    initStyleFilters();
    initTeethFilters();
    fillShop();
    const grid = document.getElementById("shop-grid");
    if (grid && !grid.innerHTML.trim()) {
      grid.innerHTML =
        '<p class="shop-empty">Catalog didn’t load — hard refresh (Ctrl+F5) or check the browser console.</p>';
    }
  }
  if (document.getElementById("product-gallery")) {
    initMaterialSelect();
    fillProduct();
  }
  if (document.getElementById("cart-lines")) {
    fillCheckout();
  }
  if (document.getElementById("book-calendar")) {
    initBookCalendar();
    if (!shouldSkipBookPrefill()) {
      initBookNotesFromOrder();
      fillBookOrderSummary();
    }
  }
  initImpressionInstructionsLinks();
  applyStaticPrices();
  initCheckoutSuccess();
}

function initImpressionInstructionsLinks() {
  document.querySelectorAll("[data-impression-instructions]").forEach((link) => {
    link.href = IMPRESSION_KIT_INSTRUCTIONS_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute(
      "aria-label",
      "Watch impression kit instructions video (opens in new tab)"
    );
  });
}

function buildBookingStyleNotes(order) {
  if (!order?.product) return "";
  const teethLabel = formatSelectedTeethLabel(
    order.selectedTeeth,
    order.selectedTeethLabel,
    order.product
  );
  const resolvedMaterial = resolveMaterialId(order.material, order.product);
  const materialLabel =
    (resolvedMaterial && MATERIAL_LABELS[resolvedMaterial]) ||
    MATERIAL_LABELS[defaultMaterialForProduct(order.product)];
  const stoneLabel = order.stone ? STONE_LABELS[order.stone] || order.stone : "";
  const lines = [
    `Style: ${productDisplayName(order.product)}`,
    `Teeth: ${teethLabel}`,
  ];
  if (materialLabel) lines.push(`Material: ${materialLabel}`);
  if (stoneLabel) lines.push(`Stone: ${stoneLabel}`);
  return lines.join("\n");
}

function bookDesignPreviewHtml(order) {
  const product = order.product;
  const material = resolveMaterialId(order.material, product);
  const alt = escapeHtml(product.imageAlt || productDisplayName(product));
  if (product.image) {
    return `<div class="book-design-preview book-design-preview--image"><img src="${escapeHtml(product.image)}" alt="${alt}" /></div>`;
  }
  const finish = galleryFinishForMaterial(material, product.finish);
  const label = escapeHtml(MATERIAL_LABELS[material] || finish);
  return `<div class="book-design-preview gallery product-image ${finish}" role="img" aria-label="${alt}">${label}</div>`;
}

function renderBookDesignPanel() {
  const panel = document.getElementById("book-design-panel");
  if (!panel) return;

  const order = shouldSkipBookPrefill() ? null : getBookingSelections();
  if (!order?.product) {
    panel.innerHTML = `
      <h2>Browse styles</h2>
      <p class="book-style-helper">You can book without picking a style first, or browse the shop to choose teeth and material before your appointment.</p>
      <a class="btn btn-secondary" href="shop.html?for=booking#style-filters">Browse shop styles</a>
    `;
    return;
  }

  const resolvedMaterial = resolveMaterialId(order.material, order.product);
  const materialLabel = escapeHtml(
    (resolvedMaterial && MATERIAL_LABELS[resolvedMaterial]) ||
      MATERIAL_LABELS[defaultMaterialForProduct(order.product)]
  );
  const stoneLabel = order.stone ? escapeHtml(STONE_LABELS[order.stone] || order.stone) : "";
  const teethLabel = escapeHtml(
    formatSelectedTeethLabel(order.selectedTeeth, order.selectedTeethLabel, order.product)
  );
  const bookingQuery = isBookingFlowActive() ? "&for=booking" : "";
  const productName = escapeHtml(productDisplayName(order.product));
  const productId = escapeHtml(order.product.id);

  panel.innerHTML = `
    <h2>Your design</h2>
    ${bookDesignPreviewHtml(order)}
    <dl class="book-design-dl">
      <div><dt>Style</dt><dd>${productName}</dd></div>
      <div><dt>Material</dt><dd>${materialLabel}</dd></div>
      ${stoneLabel ? `<div><dt>Stone</dt><dd>${stoneLabel}</dd></div>` : ""}
      <div><dt>Teeth</dt><dd>${teethLabel}</dd></div>
      <div><dt>From</dt><dd>${formatPrice(order.piecePrice)}</dd></div>
    </dl>
    <p class="book-design-note">These details are added to your booking form.</p>
    <a class="btn btn-secondary" href="product.html?id=${productId}${bookingQuery}">Edit style</a>
  `;
}

const BOOKING_DEPOSIT_GBP = 10;
const BOOKING_DEPOSIT_SESSION_KEY = "kf-booking-deposit-session";

function showBookDepositGate() {
  const gate = document.getElementById("book-deposit-gate");
  const confirmed = document.getElementById("book-deposit-confirmed");
  const embed = document.getElementById("book-calendly-embed");
  if (gate) gate.hidden = false;
  if (confirmed) confirmed.hidden = true;
  if (embed) embed.hidden = true;
}

function showBookDepositConfirmed() {
  const gate = document.getElementById("book-deposit-gate");
  const confirmed = document.getElementById("book-deposit-confirmed");
  const embed = document.getElementById("book-calendly-embed");
  if (gate) gate.hidden = true;
  if (confirmed) confirmed.hidden = false;
  if (embed) embed.hidden = false;
}

async function verifyBookingDepositSession(sessionId, { redeem = false } = {}) {
  const params = new URLSearchParams({ session_id: sessionId });
  if (redeem) {
    params.set("redeem", "1");
  }
  const response = await fetch(`/api/get-checkout-session?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to verify deposit payment.");
  }
  if (!data.paid || data.type !== "booking_deposit") {
    throw new Error("Deposit payment was not completed.");
  }
  return data;
}

function cleanBookDepositReturnUrl() {
  const params = new URLSearchParams(location.search);
  params.delete("deposit_session_id");
  params.delete("deposit_cancelled");
  const qs = params.toString();
  const next = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState({}, "", next);
}

async function unlockBookCalendlyAfterDeposit(sessionId) {
  sessionStorage.setItem(BOOKING_DEPOSIT_SESSION_KEY, sessionId);
  showBookDepositConfirmed();
  initBookCalendly();
}

async function startBookingDepositCheckout() {
  const payBtn = document.getElementById("book-deposit-pay");
  if (payBtn) {
    if (!payBtn.dataset.defaultHtml) {
      payBtn.dataset.defaultHtml = payBtn.innerHTML;
    }
    payBtn.disabled = true;
    payBtn.textContent = "Redirecting to Stripe…";
  }

  try {
    const response = await fetch("/api/create-booking-deposit-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnQuery: location.search }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to start deposit checkout.");
    }
    if (!data.url) {
      throw new Error("No checkout URL returned.");
    }
    location.href = data.url;
  } catch (error) {
    toast(error.message || "Unable to start deposit checkout.");
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.innerHTML = payBtn.dataset.defaultHtml || payBtn.innerHTML;
      applyStaticPrices();
    }
  }
}

async function initBookDepositGate() {
  const embed = document.getElementById("book-calendly-embed");
  if (!embed) return;

  const payBtn = document.getElementById("book-deposit-pay");
  if (payBtn && !payBtn.dataset.bound) {
    payBtn.dataset.bound = "1";
    payBtn.addEventListener("click", startBookingDepositCheckout);
  }

  const params = new URLSearchParams(location.search);
  const returnSessionId = params.get("deposit_session_id");
  const storedSessionId = sessionStorage.getItem(BOOKING_DEPOSIT_SESSION_KEY);
  const sessionId = returnSessionId || storedSessionId;

  if (params.get("deposit_cancelled") === "1") {
    toast("Deposit checkout was cancelled.");
    cleanBookDepositReturnUrl();
  }

  if (!sessionId) {
    showBookDepositGate();
    return;
  }

  try {
    await verifyBookingDepositSession(sessionId, { redeem: Boolean(returnSessionId) });
    cleanBookDepositReturnUrl();
    await unlockBookCalendlyAfterDeposit(sessionId);
  } catch (error) {
    sessionStorage.removeItem(BOOKING_DEPOSIT_SESSION_KEY);
    showBookDepositGate();
    if (returnSessionId) {
      toast(error.message || "Deposit could not be verified.");
      cleanBookDepositReturnUrl();
    }
  }
}

const BOOK_CALENDLY_EVENT_URL =
  "https://calendly.com/krownfrontz/impression-appointment-krownfrontz";
const BOOK_CALENDLY_NOTES_ANSWER_KEYS = ["a1", "a2"];
const BOOK_CALENDLY_LOAD_TIMEOUT_MS = 5000;
const BOOK_CALENDLY_MAX_URL_LENGTH = 2000;

function buildCalendlyNotesPrefill(notes) {
  if (!notes) return {};
  return Object.fromEntries(
    BOOK_CALENDLY_NOTES_ANSWER_KEYS.map((key) => [key, notes])
  );
}

function buildBookCalendlyUrl() {
  const params = new URLSearchParams({
    hide_event_type_details: "1",
    hide_gdpr_banner: "1",
  });
  return `${BOOK_CALENDLY_EVENT_URL}?${params.toString()}`;
}

function appendCalendlyNotesToUrl(url, notes, answerKeys = BOOK_CALENDLY_NOTES_ANSWER_KEYS) {
  if (!notes) return url;
  let next = url;
  for (const key of answerKeys) {
    next += `&${key}=${encodeURIComponent(notes)}`;
  }
  return next.length <= BOOK_CALENDLY_MAX_URL_LENGTH ? next : url;
}

function showBookCalendlyFallback() {
  const fallback = document.getElementById("book-calendly-fallback");
  if (fallback) fallback.hidden = false;
}

function hideBookCalendlyFallback() {
  const fallback = document.getElementById("book-calendly-fallback");
  if (fallback) fallback.hidden = true;
}

function initBookCalendlyLoadWatch(parent) {
  let loaded = false;
  let timeoutId = null;
  let pollId = null;

  const markLoaded = () => {
    if (loaded) return;
    loaded = true;
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    if (pollId !== null) window.clearInterval(pollId);
    hideBookCalendlyFallback();
  };

  const onMessage = (event) => {
    if (event.origin !== "https://calendly.com") return;
    const data = event.data;
    if (data && typeof data === "object" && data.event === "calendly.page_height") {
      markLoaded();
    }
  };

  window.addEventListener("message", onMessage);

  const attachIframeListener = (iframe) => {
    iframe.addEventListener("load", () => {
      window.setTimeout(() => {
        if (loaded) return;
        if (iframe.offsetHeight > 100) markLoaded();
      }, 500);
    });
  };

  const iframe = parent.querySelector("iframe");
  if (iframe) {
    attachIframeListener(iframe);
  } else {
    pollId = window.setInterval(() => {
      const el = parent.querySelector("iframe");
      if (!el) return;
      window.clearInterval(pollId);
      pollId = null;
      attachIframeListener(el);
    }, 50);
  }

  timeoutId = window.setTimeout(() => {
    if (loaded) return;
    const el = parent.querySelector("iframe");
    if (el && el.offsetHeight > 100) {
      markLoaded();
      return;
    }
    showBookCalendlyFallback();
  }, BOOK_CALENDLY_LOAD_TIMEOUT_MS);
}

function initBookCalendly() {
  const parent = document.getElementById("book-calendly-embed");
  if (!parent) return;

  const order = shouldSkipBookPrefill() ? null : getBookingSelections();
  const notes = order?.product ? buildBookingStyleNotes(order) : "";
  const customAnswers = buildCalendlyNotesPrefill(notes);
  const url = appendCalendlyNotesToUrl(buildBookCalendlyUrl(), notes);
  const prefill = Object.keys(customAnswers).length
    ? { customAnswers }
    : {};

  let attempts = 0;
  const maxAttempts = Math.ceil(BOOK_CALENDLY_LOAD_TIMEOUT_MS / 50);

  const start = () => {
    if (typeof Calendly === "undefined") {
      attempts += 1;
      if (attempts >= maxAttempts) {
        showBookCalendlyFallback();
        return;
      }
      window.setTimeout(start, 50);
      return;
    }
    Calendly.initInlineWidget({
      url,
      parentElement: parent,
      resize: true,
      prefill,
    });
    initBookCalendlyLoadWatch(parent);
  };
  start();
}

function fillBookOrderSummary() {
  const summary = document.getElementById("book-order-summary");
  if (!summary) return;

  const order = getBookingSelections();
  if (!order?.product) {
    summary.hidden = true;
    return;
  }

  const productEl = document.getElementById("book-order-product");
  const materialEl = document.getElementById("book-order-material");
  const teethEl = document.getElementById("book-order-teeth");
  const resolvedMaterial = resolveMaterialId(order.material, order.product);
  const materialLabel =
    (resolvedMaterial && MATERIAL_LABELS[resolvedMaterial]) ||
    MATERIAL_LABELS[defaultMaterialForProduct(order.product)];

  if (productEl) productEl.textContent = productDisplayName(order.product);
  if (materialEl) materialEl.textContent = materialLabel;
  if (teethEl) {
    teethEl.textContent = formatSelectedTeethLabel(
      order.selectedTeeth,
      order.selectedTeethLabel,
      order.product
    );
  }
  summary.hidden = false;
}

function initBookNotesFromOrder() {
  const notes = document.querySelector('textarea[name="notes"]');
  if (!notes || notes.value.trim()) return;
  const order = getBookingSelections();
  if (!order?.product) return;
  const text = buildBookingStyleNotes(order);
  if (text) notes.value = text;
}

boot();
