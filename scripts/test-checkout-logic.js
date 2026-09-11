/**

 * Smoke-test checkout session creation logic (no Stripe API call).

 * Usage: node scripts/test-checkout-logic.js

 */

const { buildPricedCheckout, productPrice, productFromPrice, isHandSetDiamond, findProduct } = require("../lib/pricing");

const { PRODUCTS, SHIPPING_ZONES } = require("../lib/catalog-data");

const { chunkMetadata, joinMetadataChunks } = require("../lib/stripe-metadata");

function buildSessionMetadata(zoneId, customer, priced) {

  const fulfillmentJson = JSON.stringify(priced.fulfillment);

  const cartJson = JSON.stringify(priced.cart.items);

  const addressJson = JSON.stringify(customer.address);



  return {

    zoneId,

    customer_name: customer.name,

    customer_email: customer.email,

    ...chunkMetadata("customer_address", addressJson),

    ...chunkMetadata("fulfillment", fulfillmentJson),

    ...chunkMetadata("cart", cartJson),

  };

}



function lineItemAmount(lineItem) {

  return lineItem.price_data.unit_amount / 100;

}



function findLineItem(priced, name) {

  return priced.lineItems.find((item) => item.price_data.product_data.name === name);

}



function lineItemsTotalGbp(priced) {

  return priced.lineItems.reduce((sum, item) => sum + lineItemAmount(item), 0);

}



function assertShippingParity(zoneId, priced, zone) {

  const expectedKitShipping = zoneId === "uk" ? 0 : zone.kitShipping;

  const expectedFinishShipping = zone.finishShipping;



  if (priced.shipping.kitShipping !== expectedKitShipping) {

    console.error(

      `✗ ${zoneId} kit shipping mismatch:`,

      priced.shipping.kitShipping,

      "expected",

      expectedKitShipping

    );

    process.exit(1);

  }



  if (priced.shipping.finishShipping !== expectedFinishShipping) {

    console.error(

      `✗ ${zoneId} finish shipping mismatch:`,

      priced.shipping.finishShipping,

      "expected",

      expectedFinishShipping

    );

    process.exit(1);

  }



  const expectedTotal = priced.subtotal + priced.shipping.total;

  if (Math.abs(priced.total - expectedTotal) > 0.01) {

    console.error(`✗ ${zoneId} total mismatch:`, priced.total, "expected", expectedTotal);

    process.exit(1);

  }



  const stripeTotal = lineItemsTotalGbp(priced);

  if (Math.abs(stripeTotal - priced.total) > 0.01) {

    console.error(`✗ ${zoneId} Stripe line total mismatch:`, stripeTotal, "expected", priced.total);

    process.exit(1);

  }



  const kitLine = findLineItem(priced, "Kit shipping (outbound)");

  const finishLine = findLineItem(priced, "Finished grillz shipping");



  if (expectedKitShipping > 0) {

    if (!kitLine) {

      console.error(`✗ ${zoneId} missing kit shipping Stripe line`);

      process.exit(1);

    }

    if (lineItemAmount(kitLine) !== expectedKitShipping) {

      console.error(

        `✗ ${zoneId} kit Stripe line mismatch:`,

        lineItemAmount(kitLine),

        "expected",

        expectedKitShipping

      );

      process.exit(1);

    }

  } else if (kitLine) {

    console.error(`✗ ${zoneId} should not have kit shipping Stripe line`);

    process.exit(1);

  }



  if (!finishLine) {

    console.error(`✗ ${zoneId} missing finish shipping Stripe line`);

    process.exit(1);

  }

  if (lineItemAmount(finishLine) !== expectedFinishShipping) {

    console.error(

      `✗ ${zoneId} finish Stripe line mismatch:`,

      lineItemAmount(finishLine),

      "expected",

      expectedFinishShipping

    );

    process.exit(1);

  }

}



const customer = {

  name: "Test User",

  email: "test@example.com",

  address: {

    line1: "1 Test Street",

    line2: "",

    city: "Manchester",

    postcode: "M1 1AA",

    country: "United Kingdom",

  },

};



const ukCart = [

  { kind: "kit", kitId: "impression-kit-uk" },

  {

    kind: "grillz",

    productId: "canine",

    material: "dental-gold",

    selectedTeeth: ["11"],

    selectedTeethLabel: "Upper right canine",

  },

];



const internationalCart = [

  { kind: "kit", kitId: "impression-kit-international" },

  {

    kind: "grillz",

    productId: "canine",

    material: "sterling-silver",

    selectedTeeth: ["23"],

    selectedTeethLabel: "Upper left canine",

  },

];



const ukPriced = buildPricedCheckout({

  zoneId: "uk",

  items: ukCart,

});



const usCanadaPriced = buildPricedCheckout({

  zoneId: "us-canada",

  items: internationalCart,

});



for (const [zoneId, zone] of Object.entries(SHIPPING_ZONES)) {

  const cart = zoneId === "uk" ? ukCart : internationalCart;

  const priced = buildPricedCheckout({ zoneId, items: cart });

  assertShippingParity(zoneId, priced, zone);

}



const europeEuPriced = buildPricedCheckout({ zoneId: "europe-eu", items: internationalCart });

if (europeEuPriced.shipping.kitShipping === europeEuPriced.shipping.finishShipping) {

  console.error("✗ europe-eu kit and finish shipping should differ");

  process.exit(1);

}



const irelandPriced = buildPricedCheckout({ zoneId: "ireland", items: internationalCart });

if (!findLineItem(irelandPriced, "Kit shipping (outbound)") || !findLineItem(irelandPriced, "Finished grillz shipping")) {

  console.error("✗ ireland should have separate kit and finish shipping Stripe lines");

  process.exit(1);

}



const metadata = buildSessionMetadata("uk", customer, ukPriced);

const addressRoundTrip = joinMetadataChunks(metadata, "customer_address");



if (!ukPriced.lineItems.length) {

  console.error("✗ No line items generated for UK checkout");

  process.exit(1);

}



if (!addressRoundTrip.includes("Manchester")) {

  console.error("✗ Address metadata round-trip failed");

  process.exit(1);

}



const top4Bottom4 = findProduct("top-4-bottom-4");
const top6Bottom6 = findProduct("top-6-bottom-6");
const top8Bottom8 = findProduct("top-8-bottom-8");
const plain8 = findProduct("plain-8");

if (PRODUCTS.some((product) => product.id === "canines-with-bar")) {
  console.error("✗ canines-with-bar should be removed from PRODUCTS");
  process.exit(1);
}

if (top4Bottom4.toothRule !== "both-arch-contiguous") {
  console.error("✗ 4 on 4 should use both-arch-contiguous tooth rule:", top4Bottom4.toothRule);
  process.exit(1);
}

if (productFromPrice(top4Bottom4) !== 340) {
  console.error("✗ 4 on 4 sterling from-price mismatch:", productFromPrice(top4Bottom4), "expected 340");
  process.exit(1);
}

if (productFromPrice(top6Bottom6) !== 490) {
  console.error("✗ 6 on 6 sterling from-price mismatch:", productFromPrice(top6Bottom6), "expected 490");
  process.exit(1);
}

if (productFromPrice(top8Bottom8) !== 550) {
  console.error("✗ 8 on 8 sterling from-price mismatch:", productFromPrice(top8Bottom8), "expected 550");
  process.exit(1);
}

if (productFromPrice(plain8) !== 330) {
  console.error("✗ 8 set sterling from-price mismatch:", productFromPrice(plain8), "expected 330");
  process.exit(1);
}

if (productPrice(plain8, "dental-gold") !== 350) {
  console.error("✗ 8 set dental-gold price mismatch:", productPrice(plain8, "dental-gold"), "expected 350");
  process.exit(1);
}

if (productPrice(plain8, "argentium-silver") !== 350) {
  console.error("✗ 8 set argentium-silver price mismatch:", productPrice(plain8, "argentium-silver"), "expected 350");
  process.exit(1);
}

if (productPrice(plain8, "9ct-yellow-gold") !== 995) {
  console.error("✗ 8 set 9ct price mismatch:", productPrice(plain8, "9ct-yellow-gold"), "expected 995");
  process.exit(1);
}

if (productPrice(plain8, "14ct-yellow-gold") !== 1285) {
  console.error("✗ 8 set 14ct price mismatch:", productPrice(plain8, "14ct-yellow-gold"), "expected 1285");
  process.exit(1);
}

for (const product of PRODUCTS) {
  if (isHandSetDiamond(product)) continue;
  const fromPrice = productFromPrice(product);
  const sterlingPrice = productPrice(product, "sterling-silver");
  if (fromPrice !== sterlingPrice) {
    console.error("✗ Shop/product sterling parity failed for", product.id, fromPrice, "vs", sterlingPrice);
    process.exit(1);
  }
}

const diamondCanine = findProduct("diamond-canine");
if (productFromPrice(diamondCanine) !== 330) {
  console.error("✗ diamond-canine from-price mismatch:", productFromPrice(diamondCanine), "expected 330");
  process.exit(1);
}

if (productPrice(diamondCanine, "sterling-silver", "moissanite") !== 370) {
  console.error(
    "✗ diamond-canine moissanite price mismatch:",
    productPrice(diamondCanine, "sterling-silver", "moissanite"),
    "expected 370"
  );
  process.exit(1);
}

const diamondCheckout = buildPricedCheckout({
  zoneId: "uk",
  items: [
    { kind: "kit", kitId: "impression-kit-uk" },
    {
      kind: "grillz",
      productId: "diamond-canine",
      material: "9ct-yellow-gold",
      stone: "moissanite",
      selectedTeeth: ["UR3"],
      selectedTeethLabel: "Upper right canine",
    },
  ],
});

const diamondGrillzLine = diamondCheckout.fulfillment.find((line) => line.kind === "grillz");
if (!diamondGrillzLine || diamondGrillzLine.amountGbp !== 620) {
  console.error("✗ diamond-canine 9ct moissanite checkout mismatch:", diamondGrillzLine?.amountGbp, "expected 620");
  process.exit(1);
}

if (diamondGrillzLine.stoneLabel !== "Moissanite") {
  console.error("✗ diamond-canine fulfillment missing stone label:", diamondGrillzLine.stoneLabel);
  process.exit(1);
}

const defaultStoneCheckout = buildPricedCheckout({
  zoneId: "uk",
  items: [
    { kind: "kit", kitId: "impression-kit-uk" },
    {
      kind: "grillz",
      productId: "diamond-canine",
      material: "sterling-silver",
      selectedTeeth: ["UR3"],
      selectedTeethLabel: "Upper right canine",
    },
  ],
});

const defaultStoneGrillz = defaultStoneCheckout.cart.items.find((item) => item.kind === "grillz");
const defaultStoneLine = defaultStoneCheckout.fulfillment.find((line) => line.kind === "grillz");
if (!defaultStoneLine || defaultStoneLine.amountGbp !== 330) {
  console.error("✗ diamond-canine default stone checkout mismatch:", defaultStoneLine?.amountGbp, "expected 330");
  process.exit(1);
}

if (defaultStoneGrillz?.stone !== "cubic-zirconia") {
  console.error("✗ diamond-canine cart should default stone to cubic-zirconia");
  process.exit(1);
}

const dualArchCheckout = buildPricedCheckout({
  zoneId: "uk",
  items: [
    { kind: "kit", kitId: "impression-kit-uk" },
    {
      kind: "grillz",
      productId: "top-6-bottom-6",
      material: "sterling-silver",
      selectedTeeth: [],
      selectedTeethLabel: "Upper & lower front 6",
    },
  ],
});

const grillzLine = dualArchCheckout.fulfillment.find((line) => line.kind === "grillz");
if (!grillzLine || grillzLine.amountGbp !== 490) {
  console.error("✗ Checkout grillz line for 6 on 6 mismatch:", grillzLine?.amountGbp, "expected 490");
  process.exit(1);
}

const fourOnFourCheckout = buildPricedCheckout({
  zoneId: "uk",
  items: [
    { kind: "kit", kitId: "impression-kit-uk" },
    {
      kind: "grillz",
      productId: "top-4-bottom-4",
      material: "sterling-silver",
      selectedTeeth: ["UR3", "UR2", "UR1", "UL1", "LR3", "LR2", "LR1", "LL1"],
      selectedTeethLabel: "C, L, CI, CI, C, L, CI, CI",
    },
  ],
});

const fourOnFourGrillzLine = fourOnFourCheckout.fulfillment.find((line) => line.kind === "grillz");
if (!fourOnFourGrillzLine || fourOnFourGrillzLine.amountGbp !== 340) {
  console.error("✗ Checkout grillz line for 4 on 4 mismatch:", fourOnFourGrillzLine?.amountGbp, "expected 340");
  process.exit(1);
}

const plain8Checkout = buildPricedCheckout({
  zoneId: "uk",
  items: [
    { kind: "kit", kitId: "impression-kit-uk" },
    {
      kind: "grillz",
      productId: "plain-8",
      material: "dental-gold",
      selectedTeeth: ["UR4", "UR3", "UR2", "UR1", "UL1", "UL2", "UL3", "UL4"],
      selectedTeethLabel: "Upper front 8",
    },
  ],
});

const plain8GrillzLine = plain8Checkout.fulfillment.find((line) => line.kind === "grillz");
if (!plain8GrillzLine || plain8GrillzLine.amountGbp !== 350) {
  console.error("✗ Checkout grillz line for 8 set dental-gold mismatch:", plain8GrillzLine?.amountGbp, "expected 350");
  process.exit(1);
}

console.log("✓ buildPricedCheckout produced", ukPriced.lineItems.length, "UK line items");
console.log("✓ Customer address stored in metadata");
console.log("✓ UK total GBP:", ukPriced.total);
console.log("✓ Shipping parity for", Object.keys(SHIPPING_ZONES).length, "zones (checkout + Stripe line items)");
console.log("✓ europe-eu split rates: kit", europeEuPriced.shipping.kitShipping, "/ finish", europeEuPriced.shipping.finishShipping);
console.log("✓ US & Canada kit shipping:", usCanadaPriced.shipping.kitShipping);
console.log("✓ US & Canada finish shipping:", usCanadaPriced.shipping.finishShipping);
console.log("✓ US & Canada total GBP:", usCanadaPriced.total);
console.log("✓ 4 on 4 sterling from-price:", productFromPrice(top4Bottom4));
console.log("✓ 6 on 6 sterling from-price:", productFromPrice(top6Bottom6));
console.log("✓ 8 on 8 sterling from-price:", productFromPrice(top8Bottom8));
console.log("✓ 8 set sterling from-price:", productFromPrice(plain8));
console.log("✓ 8 set dental-gold price:", productPrice(plain8, "dental-gold"));
console.log("✓ 8 set argentium-silver price:", productPrice(plain8, "argentium-silver"));
console.log("✓ Sterling shop/product parity for non-diamond grillz SKUs");
console.log("✓ diamond-canine from-price:", productFromPrice(diamondCanine));
console.log("✓ diamond-canine moissanite price:", productPrice(diamondCanine, "sterling-silver", "moissanite"));
console.log("✓ diamond-canine checkout with stone:", diamondGrillzLine.amountGbp);


