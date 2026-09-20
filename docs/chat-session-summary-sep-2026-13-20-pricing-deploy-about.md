# Krown Frontz — Chat Session Summary (Sep 13–20, 2026)

Follow-up to [`chat-session-summary-sep-2026-12-evening-layout-gift-accessories.md`](chat-session-summary-sep-2026-12-evening-layout-gift-accessories.md). Focus: dental gold / argentium pricing vs 9ct and sterling, SKU price overrides, GitHub push vs Netlify live, then Client cam / About / contact / FAQs.

## Problems raised

1. **Dental gold** on diamond pieces (e.g. Diamond Window Canine & Inlay) showed the same price as **9ct yellow/white gold**. User wanted dental gold to match **argentium**.
2. After that fix, dental gold and argentium still **matched sterling** on iced/diamond SKUs. User wanted those two **£10 above sterling**.
3. Requested SKU prices:
   - **6 on 6:** first £500 dental/argentium, then **£480 sterling / £490 dental & argentium**
   - **6 set:** **£295** dental/argentium
   - **8 set:** **£340** dental/argentium
   - **4 on 4:** **£330 sterling / £340 dental & argentium**
4. Commit + push to GitHub requested (succeeded).
5. **Netlify live** did not show local price changes after GitHub push; later a dashboard/old deploy rolled production back to `main.js?v=kitlink1`.
6. Remove a specific **Client cam** photo (black top-and-bottom grillz at a “City centre” bus stop).
7. On phone, **Krown Frontz Journey** heading sat too close to the divider above it.
8. Mobile dropdown: label **Journey** → **About**.
9. Footer contact should read **Email:** / **Instagram:** with `krownfrontz@gmail.com` and `@krownfrontz`.
10. How it works heading **Questions** → **FAQs**.

## Decisions

| Choice | Outcome |
|--------|---------|
| Dental gold vs 9ct | Hand-set diamond table: dental gold copies **argentium**, not K9 9ct. Generator maps dental gold to Sterling/Silver like argentium, then +£10 vs sterling |
| Dental/argentium vs sterling (where they matched) | Diamond `HAND_SET_DIAMOND_PRICES` dental + argentium = sterling **+ £10**. Vampire Canines was cheaper than sterling; set `pricingPremiumBase: 125` vs sterling **115** |
| Other SKUs that already sat above sterling | Left alone (plain 6/8 later overridden by user) |
| 6 on 6 / 4 on 4 / 6 set / 8 set | Product-level `pricingSterlingBase` / `pricingPremiumBase` so 9ct/14ct dual-arch math is not rewritten |
| GitHub vs Netlify | Push to `origin/main` does **not** publish krownfrontz.com. Production is CLI `npx netlify deploy --prod` from `krown-frontz`. Publishing an **old** Netlify deploy restores `kitlink1` |
| Journey menu | Mobile drawer only: **About** → `journey.html`. Desktop nav unchanged |
| Email copy | Keep full address `krownfrontz@gmail.com` (user wrote “krownfrontz@gmail”) |

## Pricing — dental gold, argentium, sterling

### Diamond / iced (`HAND_SET_DIAMOND_PRICES`)

In [`main.js`](../main.js) and [`lib/catalog-data.js`](../lib/catalog-data.js):

- First pass: dental gold blocks matched argentium (not 9ct).
- Second pass: dental gold and argentium each **+£10** vs the sterling row for every stone.

[`scripts/build-diamond-price-matrix.py`](../scripts/build-diamond-price-matrix.py): dental gold sources K9 Sterling/Silver (same as argentium); then adds **£10** for `argentium-silver` and `dental-gold`.

Plain grillz already used premium tiers in `tierPrice()` (dental/argentium together). 8-tooth special-case **350** remains for SKUs that do not set `pricingPremiumBase`.

### SKU overrides (product objects)

| Product | id | Sterling | Dental gold / argentium |
|---------|-----|----------|-------------------------|
| 6 set | `plain-6` | 275 (tier) | `pricingPremiumBase: 295` |
| 8 set | `plain-8` | 330 (tier) | `pricingPremiumBase: 340` |
| 4 on 4 | `top-4-bottom-4` | `pricingSterlingBase: 330` | `pricingPremiumBase: 340` |
| 6 on 6 | `top-6-bottom-6` | `pricingSterlingBase: 480` | `pricingPremiumBase: 490` |
| Vampire Canines | `vampire-canines` | `pricingSterlingBase: 115` | `pricingPremiumBase: 125` |

`DUAL_ARCH_STERLING_BASE["6on6"]` stayed **490** so **6 on 6 open face** is not pulled down with the plain 6 on 6.

Tests in [`scripts/test-checkout-logic.js`](../scripts/test-checkout-logic.js): diamond dental = argentium = sterling+10; 6/8 set and 4/6 on 6 assertions updated.

## Git

- Commit **`4687d98`** on `main`: pricing (dental/argentium, 4/6/8-set) plus tooth-chart layout (`styles.css`, `tooth-picker.js` — hide back molars, stretch/center grid).
- Pushed to `https://github.com/kayceealakoy-commits/KrownFrontz.git` (`2b16a38..4687d98`).
- Left untracked: `scripts/__pycache__/`.
- Later About/FAQs/Client cam work was **local after that commit** unless committed separately.

## Netlify / live

- Live domain: `https://krownfrontz.com` (site `krown-frontz`, id `16614ce3-2f9d-4954-9f64-91fd4cdbecde`).
- After GitHub push, production still served **`main.js?v=kitlink1`** (not in current repo). GitHub is not continuous-deploy for this site.
- CLI production deploys from this folder:
  - `6aa7304b3dd492b23f55a7f6` — first pricing publish (`dentalgold6`); later overwritten by an older snapshot.
  - `6aa7328ff0b74ed2428b76d1` — republish with cache `pricesep14`; verified live `main.js` had 6 set 295, 8 set 340, 4 on 4 330/340, 6 on 6 480/490.
- **Do not Publish an older deploy** in the dashboard; that restored `kitlink1`.
- Future live updates: `npx netlify deploy --prod` from `krown-frontz`, or connect the GitHub repo for auto-deploy.

`npm install` on deploy runs `postinstall` → `sync-pricing` → rewrites [`lib/catalog-data.js`](../lib/catalog-data.js) from `main.js`.

## Client cam, About, contact, FAQs (Sep 20)

Implemented from plan `journey_menu_and_cam`:

1. Removed **`look-18.jpg`** (black bus-stop grillz) from `CLIENT_LOOKS` in [`main.js`](../main.js); deleted [`assets/clients/look-18.jpg`](../assets/clients/look-18.jpg).
2. Mobile (`max-width: 900px`) in [`styles.css`](../styles.css): `.journey-panel-body { padding-top: 32px; }`, `.journey-page { padding-top: 80px; }`.
3. Every page mobile drawer: **About** → `journey.html`. [`journey.html`](../journey.html) drawer uses `aria-current="page"`; footer Help “Journey” → “About”. Desktop `.nav-links` unchanged.
4. Footer Contact (pages with that column): `Email: krownfrontz@gmail.com` and `Instagram: @krownfrontz`.
5. [`how-it-works.html`](../how-it-works.html): heading **FAQs**.
6. Cache: HTML `styles.css` / `main.js` query **`?v=about1`**.

Not deployed to Netlify unless asked after this landing.

## Cache-bust reference (end of session)

| Asset / bundle | Query |
|----------------|--------|
| HTML CSS/JS after About/FAQs pass | `?v=about1` |
| Prior pricing live check | `main.js?v=pricesep14` (then About pass bumped to `about1`) |
| Rolled-back live (avoid) | `main.js?v=kitlink1` |

Always hard-refresh after CSS/JS changes. Live only updates after a **production** Netlify deploy of this folder.

## Out of scope / open

- Connect GitHub → Netlify continuous deploy so `git push origin main` goes live
- Commit + push the Sep 20 About / Client cam / FAQs edits if they are still uncommitted
- Higher-res gift-card master, impression-kit product photos (from prior session)

## Quick reference

| Task | Place |
|------|--------|
| Diamond dental/argentium prices | `HAND_SET_DIAMOND_PRICES` in `main.js` + `lib/catalog-data.js`; generator `scripts/build-diamond-price-matrix.py` |
| 6/8 set, 4 on 4, 6 on 6, vampire | `pricingSterlingBase` / `pricingPremiumBase` on those products |
| Client cam list | `CLIENT_LOOKS` in `main.js` |
| Mobile Journey heading gap | `.journey-panel-body` in `styles.css` `@media (max-width: 900px)` |
| Mobile About link | `.nav-drawer-links` on all HTML pages |
| FAQs title | `how-it-works.html` `#faq-heading` |
| Publish live | `npx netlify deploy --prod` from `krown-frontz` |
| Prior session (layout / gift / accessories) | [`chat-session-summary-sep-2026-12-evening-layout-gift-accessories.md`](chat-session-summary-sep-2026-12-evening-layout-gift-accessories.md) |
