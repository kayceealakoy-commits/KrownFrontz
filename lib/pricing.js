const {
  SHIPPING_ZONES,
  MATERIAL_OPTIONS,
  MATERIAL_ID_ALIASES,
  STONE_OPTIONS,
  HAND_SET_DIAMOND_PRICES,
  IMPRESSION_KITS,
  ACCESSORIES,
  PRODUCT_ID_ALIASES,
  PRODUCTS,
  BASE_TIERS,
  PRECIOUS_SINGLE_9CT,
  PRECIOUS_SINGLE_14CT,
  DUAL_ARCH_4ON4_IDS,
  DUAL_ARCH_6ON6_IDS,
  DUAL_ARCH_8ON8_IDS,
} = require("./catalog-data");

const MATERIAL_LABELS = Object.fromEntries(MATERIAL_OPTIONS.map((m) => [m.id, m.label]));
const STONE_LABELS = Object.fromEntries(STONE_OPTIONS.map((s) => [s.id, s.label]));
const DEFAULT_STONE_ID = "cubic-zirconia";

const DUAL_ARCH_STERLING_BASE = {
  "4on4": 340,
  "6on6": 490,
};

function getShippingZone(zoneId) {
  return SHIPPING_ZONES[zoneId] || SHIPPING_ZONES["rest-of-world"];
}

function findKit(id) {
  return IMPRESSION_KITS.find((k) => k.id === id) || null;
}

function findAccessory(id) {
  return ACCESSORIES.find((a) => a.id === id) || null;
}

function resolveProductId(id) {
  return PRODUCT_ID_ALIASES[id] || id;
}

function findProduct(id) {
  const resolved = resolveProductId(id);
  return PRODUCTS.find((x) => x.id === resolved) || null;
}

function defaultMaterialForProduct(product) {
  if (product.finish === "silver") return "sterling-silver";
  return "dental-gold";
}

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

function productDisplayName(product) {
  return product.displayName || product.name || product.id;
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

function cartHasGrillz(cart) {
  return cart.items.some((item) => item.kind === "grillz");
}

function cartHasKit(region, cart) {
  return cart.items.some((item) => {
    if (item.kind !== "kit") return false;
    const kit = findKit(item.kitId);
    if (!region) return Boolean(kit);
    return kit?.region === region;
  });
}

function cartHasAccessory(cart) {
  return cart.items.some((item) => item.kind === "accessory");
}

function cartHasPostalRepolish(cart) {
  return cart.items.some((item) => item.kind === "service" && item.fulfillment === "postal");
}

function cartNeedsFinishShipping(cart) {
  return cartHasGrillz(cart) || cartHasAccessory(cart) || cartHasPostalRepolish(cart);
}

function getKitCartLines(cart) {
  return cart.items.filter((item) => item.kind === "kit");
}

function syncKitToCountry(zoneId, cart) {
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

  return {
    swapped: true,
    cart: {
      items: [
        ...cart.items.filter((item) => item.kind !== "kit"),
        {
          id: currentKitLine.id,
          kind: "kit",
          kitId: targetKit.id,
          price: targetKit.price,
        },
      ],
    },
    kitName: targetKit.displayName,
  };
}

function computeCheckoutShipping(zoneId, cart) {
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

function gbpToPence(amount) {
  return Math.round(amount * 100);
}

function stripeLineItem(name, description, amountGbp, quantity = 1) {
  return {
    quantity,
    price_data: {
      currency: "gbp",
      unit_amount: gbpToPence(amountGbp),
      product_data: {
        name,
        description: description || undefined,
      },
    },
  };
}

function normalizeCartItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error("Cart is empty.");
  }

  return items.map((item) => {
    if (item.kind === "grillz") {
      if (!item.productId) throw new Error("Grillz line is missing productId.");
      const product = findProduct(item.productId);
      if (!product) throw new Error(`Unknown product: ${item.productId}`);
      const material = resolveMaterialId(item.material, product);
      if (!material) throw new Error(`Invalid material for ${item.productId}.`);
      const stone = isHandSetDiamond(product)
        ? resolveStoneId(item.stone)
        : undefined;
      return {
        kind: "grillz",
        productId: product.id,
        material,
        ...(stone ? { stone } : {}),
        selectedTeeth: Array.isArray(item.selectedTeeth) ? item.selectedTeeth : [],
        selectedTeethLabel: item.selectedTeethLabel || "",
      };
    }

    if (item.kind === "kit") {
      if (!item.kitId) throw new Error("Kit line is missing kitId.");
      const kit = findKit(item.kitId);
      if (!kit) throw new Error(`Unknown kit: ${item.kitId}`);
      return { kind: "kit", kitId: kit.id };
    }

    if (item.kind === "accessory") {
      if (!item.accessoryId) throw new Error("Accessory line is missing accessoryId.");
      const accessory = findAccessory(item.accessoryId);
      if (!accessory || accessory.kind !== "accessory") {
        throw new Error(`Unknown accessory: ${item.accessoryId}`);
      }
      return { kind: "accessory", accessoryId: accessory.id };
    }

    if (item.kind === "service") {
      if (!item.serviceId) throw new Error("Service line is missing serviceId.");
      const service = findAccessory(item.serviceId);
      if (!service || service.kind !== "service") {
        throw new Error(`Unknown service: ${item.serviceId}`);
      }
      const fulfillment = item.fulfillment === "dropoff" ? "dropoff" : "postal";
      return { kind: "service", serviceId: service.id, fulfillment };
    }

    if (item.kind === "giftcard") {
      const giftCard = findAccessory(item.accessoryId || "gift-card");
      if (!giftCard || giftCard.kind !== "giftcard") {
        throw new Error("Unknown gift card.");
      }
      const amounts = giftCard.amounts || [giftCard.price];
      const amount = Number(item.amount);
      if (!amounts.includes(amount)) {
        throw new Error("Invalid gift card amount.");
      }
      return { kind: "giftcard", accessoryId: giftCard.id, amount };
    }

    throw new Error("Unsupported cart line type.");
  });
}

function buildPricedCheckout({ zoneId, items }) {
  if (!SHIPPING_ZONES[zoneId]) {
    throw new Error("Invalid shipping zone.");
  }

  const normalizedItems = normalizeCartItems(items);
  let cart = { items: normalizedItems };
  const syncResult = syncKitToCountry(zoneId, cart);
  cart = syncResult.cart;

  if (cartHasGrillz(cart) && !cartHasKit(null, cart)) {
    throw new Error("Postal grillz orders require an impression kit in the cart.");
  }

  const shipping = computeCheckoutShipping(zoneId, cart);
  const lineItems = [];
  const fulfillment = [];

  for (const item of cart.items) {
    if (item.kind === "grillz") {
      const product = findProduct(item.productId);
      const materialLabel = MATERIAL_LABELS[item.material] || item.material;
      const stoneLabel = item.stone ? STONE_LABELS[item.stone] || item.stone : "";
      const teethLabel = item.selectedTeethLabel || item.selectedTeeth.join(", ") || "Teeth not specified";
      const amount = productPrice(product, item.material, item.stone);
      const description = [materialLabel, stoneLabel, teethLabel].filter(Boolean).join(" · ");
      lineItems.push(stripeLineItem(productDisplayName(product), description, amount));
      fulfillment.push({
        kind: "grillz",
        productId: product.id,
        productName: productDisplayName(product),
        material: item.material,
        materialLabel,
        ...(item.stone ? { stone: item.stone, stoneLabel } : {}),
        teethLabel,
        amountGbp: amount,
      });
      continue;
    }

    if (item.kind === "kit") {
      const kit = findKit(item.kitId);
      lineItems.push(stripeLineItem(kit.displayName, "Impression kit materials", kit.price));
      fulfillment.push({
        kind: "kit",
        kitId: kit.id,
        kitName: kit.displayName,
        amountGbp: kit.price,
      });
      continue;
    }

    if (item.kind === "accessory") {
      const accessory = findAccessory(item.accessoryId);
      lineItems.push(stripeLineItem(accessory.displayName, "Accessory", accessory.price));
      fulfillment.push({
        kind: "accessory",
        accessoryId: accessory.id,
        accessoryName: accessory.displayName,
        amountGbp: accessory.price,
      });
      continue;
    }

    if (item.kind === "service") {
      const service = findAccessory(item.serviceId);
      const fulfillmentLabel =
        item.fulfillment === "dropoff" ? "Drop off in person" : "Post your set — return address emailed after payment";
      lineItems.push(stripeLineItem(service.displayName, fulfillmentLabel, service.price));
      fulfillment.push({
        kind: "service",
        serviceId: service.id,
        serviceName: service.displayName,
        fulfillment: item.fulfillment,
        amountGbp: service.price,
      });
      continue;
    }

    if (item.kind === "giftcard") {
      const giftCard = findAccessory(item.accessoryId);
      const amount = item.amount;
      lineItems.push(
        stripeLineItem(
          `${giftCard.displayName} — £${amount}`,
          "Gift card (email delivery)",
          amount
        )
      );
      fulfillment.push({
        kind: "giftcard",
        accessoryId: giftCard.id,
        giftCardName: giftCard.displayName,
        amountGbp: amount,
        note: "Manual: email gift code to customer",
      });
    }
  }

  if (shipping.kitShipping > 0) {
    const zone = getShippingZone(zoneId);
    lineItems.push(
      stripeLineItem("Kit shipping (outbound)", zone.label, shipping.kitShipping)
    );
  }

  if (shipping.finishShipping > 0) {
    const zone = getShippingZone(zoneId);
    lineItems.push(
      stripeLineItem("Outbound shipping", zone.label, shipping.finishShipping)
    );
  }

  const subtotal = fulfillment.reduce((sum, line) => sum + line.amountGbp, 0);
  const total = subtotal + shipping.total;

  return {
    cart,
    syncResult,
    shipping,
    lineItems,
    fulfillment,
    subtotal,
    total,
  };
}

module.exports = {
  SHIPPING_ZONES,
  MATERIAL_LABELS,
  STONE_LABELS,
  buildPricedCheckout,
  computeCheckoutShipping,
  syncKitToCountry,
  productDisplayName,
  productPrice,
  productFromPrice,
  isHandSetDiamond,
  findProduct,
  findKit,
  findAccessory,
};
