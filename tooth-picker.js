/** Interactive front-8 tooth chart for product configuration */
const ToothPicker = (function () {
  const ARCHES = {
    upper: { prefix: ["UR", "UL"], label: "Upper" },
    lower: { prefix: ["LR", "LL"], label: "Lower" },
  };

  const POSITION_NAMES = {
    1: "central",
    2: "lateral",
    3: "canine",
    4: "1st premolar",
    5: "2nd premolar",
    6: "1st molar",
    7: "2nd molar",
    8: "3rd molar",
  };

  const POSITION_ABBR = {
    1: "CI",
    2: "L",
    3: "C",
    4: "P1",
    5: "P2",
    6: "M1",
    7: "M2",
    8: "M3",
  };

  const SIDE_NAMES = { UR: "right", UL: "left", LR: "right", LL: "left" };

  const TOOTH_POSITIONS = {};
  const UPPER_ORDER = [];
  const LOWER_ORDER = [];

  for (const side of ["UR", "UL"]) {
    const start = side === "UR" ? 8 : 1;
    const end = side === "UR" ? 1 : 8;
    const step = side === "UR" ? -1 : 1;
    for (let n = start; side === "UR" ? n >= end : n <= end; n += step) {
      const id = `${side}${n}`;
      const archWord = "Upper";
      const sideWord = SIDE_NAMES[side];
      TOOTH_POSITIONS[id] = {
        id,
        arch: "upper",
        side,
        position: n,
        label: `${archWord} ${sideWord} ${POSITION_NAMES[n]}`,
      };
      UPPER_ORDER.push(id);
    }
  }

  for (const side of ["LR", "LL"]) {
    const start = side === "LR" ? 8 : 1;
    const end = side === "LR" ? 1 : 8;
    const step = side === "LR" ? -1 : 1;
    for (let n = start; side === "LR" ? n >= end : n <= end; n += step) {
      const id = `${side}${n}`;
      const archWord = "Lower";
      const sideWord = SIDE_NAMES[side];
      TOOTH_POSITIONS[id] = {
        id,
        arch: "lower",
        side,
        position: n,
        label: `${archWord} ${sideWord} ${POSITION_NAMES[n]}`,
      };
      LOWER_ORDER.push(id);
    }
  }

  const SINGLE_CANINE_IDS = ["canine", "window-canine", "heart-canine", "star-canine", "dust-canine"];
  const SINGLE_LATERAL_IDS = ["lateral", "window-lateral", "heart-lateral", "star-lateral", "dust-lateral"];
  const SINGLE_CENTRAL_IDS = ["central", "dust-central"];
  const ARCH_CANINES_IDS = ["vampire-canines"];
  const CANINE_LATERAL_PAIR_IDS = ["window-canine-lateral-2", "vampire-canine-lateral-2"];
  const CANINE_BAR_PAIR_IDS = ["window-canine-bar", "canine-bar", "canine-window", "heart-canine-bar"];

  let state = {
    product: null,
    selected: [],
    onChange: null,
    readOnly: false,
    summaryLabel: "",
  };

  function getToothRule(product) {
    if (product?.toothRule) return product.toothRule;
    const id = product?.id || "";
    if (SINGLE_CANINE_IDS.includes(id)) return "single-canine";
    if (SINGLE_LATERAL_IDS.includes(id)) return "single-lateral";
    if (SINGLE_CENTRAL_IDS.includes(id)) return "single-central";
    if (ARCH_CANINES_IDS.includes(id)) return "arch-canines";
    if (CANINE_LATERAL_PAIR_IDS.includes(id)) return "canine-lateral-pair";
    if (CANINE_BAR_PAIR_IDS.includes(id)) return "canine-bar-pair";
    if (id === "bar-12") return "both-arch-contiguous";
    return "contiguous-front";
  }

  function requiredCount(product) {
    const rule = getToothRule(product);
    const n = parseInt(product?.teeth || "1", 10);
    if (rule === "flexible") return 1;
    return n;
  }

  function perArchCount(product) {
    const n = parseInt(product?.teeth || "12", 10);
    return n / 2;
  }

  function helperText(product) {
    if (state.readOnly) {
      if (state.summaryLabel) return state.summaryLabel;
      const rule = getToothRule(product);
      if (rule === "both-arch-canines") {
        return "Includes all four canines — upper and lower, left and right.";
      }
      if (rule === "both-arch-laterals") {
        return "Includes all four laterals — upper and lower, left and right.";
      }
      if (rule === "both-arch-centrals") {
        return "Includes all four centrals — upper and lower, left and right.";
      }
      const perArch = perArchCount(product);
      const n = requiredCount(product);
      return `Includes ${perArch} contiguous front teeth on the upper and ${perArch} on the lower (${n} total).`;
    }
    const rule = getToothRule(product);
    const n = requiredCount(product);
    const mode = getChartMode(product);
    if (rule === "single-canine") return "Select 1 canine — upper or lower canine, left or right.";
    if (rule === "single-lateral") return "Select 1 lateral — upper or lower lateral, left or right.";
    if (rule === "single-central") return "Select 1 central — upper or lower central, left or right.";
    if (rule === "arch-canines") return "Select both canines on upper or lower teeth (click either canine).";
    if (rule === "arch-laterals") return "Select both laterals on upper or lower teeth (click either lateral).";
    if (rule === "arch-centrals") return "Select both centrals on upper or lower teeth (click either central).";
    if (rule === "both-arch-canines") return "Select all four canines (click any canine).";
    if (rule === "both-arch-laterals") return "Select all four laterals (click any lateral).";
    if (rule === "both-arch-centrals") return "Select all four centrals (click any central).";
    if (rule === "canine-lateral-pair") return "Select a canine and its adjacent lateral on the same side.";
    if (rule === "both-side-canine-lateral") {
      return "Select canine and lateral on two sides — any upper/lower teeth combination.";
    }
    if (rule === "lateral-canine-cross") {
      return "Select a lateral and a canine — same side or opposite sides.";
    }
    if (rule === "canine-bar-pair") {
      return "Select canine and lateral (inlay) on the upper, same side.";
    }
    if (rule === "both-arch-contiguous") {
      const perArch = perArchCount(product);
      return `Select ${perArch} contiguous teeth on the upper and ${perArch} on the lower (${n} total).`;
    }
    if (rule === "flexible") return "Select the teeth for your custom piece.";
    if (rule === "contiguous-front" && mode === "lower") {
      return `Select ${n} contiguous front teeth on the lower.`;
    }
    if (rule === "contiguous-front" && mode === "upper") {
      return `Select ${n} contiguous front teeth on the upper.`;
    }
    return `Select ${n} contiguous front teeth on upper or lower teeth.`;
  }

  function needsArchSelector() {
    return false;
  }

  function getChartMode(product) {
    if (product?.chartMode) return product.chartMode;
    const id = product?.id || "";
    const rule = getToothRule(product);
    if (id === "bar-12") return "both";
    if (rule === "canine-bar-pair") return "upper";
    if (product?.style === "bar") return "lower";
    return "both";
  }

  function requiredPositionForRule(rule) {
    if (rule === "single-canine") return 3;
    if (rule === "single-lateral") return 2;
    if (rule === "single-central") return 1;
    return null;
  }

  function isCanineLateralPosition(position) {
    return position === 2 || position === 3;
  }

  function isBackMolar(id) {
    const position = TOOTH_POSITIONS[id]?.position;
    return position === 7 || position === 8;
  }

  function isToothVisibleInChart(id, product) {
    if (isBackMolar(id)) return false;
    const mode = getChartMode(product);
    if (mode === "both") return true;
    if (mode === "upper") return toothArch(id) === "upper";
    return toothArch(id) === "lower";
  }

  function isToothSelectable(id, product) {
    if (!isToothVisibleInChart(id, product)) return false;
    const rule = getToothRule(product);
    const reqPos = requiredPositionForRule(rule);
    if (reqPos !== null) return TOOTH_POSITIONS[id].position === reqPos;
    if (rule === "canine-lateral-pair" || rule === "canine-bar-pair") {
      return isCanineLateralPosition(TOOTH_POSITIONS[id].position);
    }
    if (
      rule === "both-side-canine-lateral" ||
      rule === "lateral-canine-cross"
    ) {
      return isCanineLateralPosition(TOOTH_POSITIONS[id].position);
    }
    if (rule === "arch-canines") return TOOTH_POSITIONS[id].position === 3;
    if (rule === "arch-laterals") return TOOTH_POSITIONS[id].position === 2;
    if (rule === "arch-centrals") return TOOTH_POSITIONS[id].position === 1;
    if (rule === "both-arch-canines") return TOOTH_POSITIONS[id].position === 3;
    if (rule === "both-arch-laterals") return TOOTH_POSITIONS[id].position === 2;
    if (rule === "both-arch-centrals") return TOOTH_POSITIONS[id].position === 1;
    return true;
  }

  function deriveArchLabel(selectedTeeth) {
    if (!selectedTeeth?.length) return "";
    const hasUpper = selectedTeeth.some((id) => id.startsWith("U"));
    const hasLower = selectedTeeth.some((id) => id.startsWith("L") && !id.startsWith("U"));
    if (hasUpper && hasLower) return "Both";
    if (hasUpper) return "Upper";
    if (hasLower) return "Lower";
    return "";
  }

  function resolveValidationArch(product, selected) {
    const derived = deriveArchLabel(selected);
    if (derived) return derived;
    const mode = getChartMode(product);
    if (mode === "upper") return "Upper";
    if (mode === "lower") return "Lower";
    return "";
  }

  function getEffectiveArch(product, selected) {
    return resolveValidationArch(product, selected);
  }

  function toothArch(id) {
    return id.startsWith("U") ? "upper" : "lower";
  }

  function orderForArch(id) {
    return toothArch(id) === "upper" ? UPPER_ORDER : LOWER_ORDER;
  }

  function isContiguous(ids) {
    if (ids.length <= 1) return true;
    const arch = toothArch(ids[0]);
    const order = arch === "upper" ? UPPER_ORDER : LOWER_ORDER;
    const indices = ids.map((id) => order.indexOf(id)).sort((a, b) => a - b);
    for (let i = 1; i < indices.length; i += 1) {
      if (indices[i] !== indices[i - 1] + 1) return false;
    }
    return true;
  }

  function sameSide(id) {
    return id.slice(0, 2);
  }

  function isCanineLateralPair(ids) {
    if (ids.length !== 2) return false;
    const [a, b] = ids;
    if (sameSide(a) !== sameSide(b)) return false;
    const positions = [TOOTH_POSITIONS[a].position, TOOTH_POSITIONS[b].position].sort();
    return positions[0] === 2 && positions[1] === 3;
  }

  function isCanineBarPair(ids) {
    return isCanineLateralPair(ids);
  }

  function isArchCanines(ids) {
    if (ids.length !== 2) return false;
    if (ids.every((id) => toothArch(id) === "upper")) {
      return ids.includes("UR3") && ids.includes("UL3");
    }
    if (ids.every((id) => toothArch(id) === "lower")) {
      return ids.includes("LR3") && ids.includes("LL3");
    }
    return false;
  }

  function isArchLaterals(ids) {
    if (ids.length !== 2) return false;
    if (ids.every((id) => toothArch(id) === "upper")) {
      return ids.includes("UR2") && ids.includes("UL2");
    }
    if (ids.every((id) => toothArch(id) === "lower")) {
      return ids.includes("LR2") && ids.includes("LL2");
    }
    return false;
  }

  function isBothArchCanines(ids) {
    return (
      ids.length === 4 &&
      ["UR3", "UL3", "LR3", "LL3"].every((t) => ids.includes(t))
    );
  }

  function isBothArchLaterals(ids) {
    return (
      ids.length === 4 &&
      ["UR2", "UL2", "LR2", "LL2"].every((t) => ids.includes(t))
    );
  }

  function isArchCentrals(ids) {
    if (ids.length !== 2) return false;
    if (ids.every((id) => toothArch(id) === "upper")) {
      return ids.includes("UR1") && ids.includes("UL1");
    }
    if (ids.every((id) => toothArch(id) === "lower")) {
      return ids.includes("LR1") && ids.includes("LL1");
    }
    return false;
  }

  function isBothArchCentrals(ids) {
    return (
      ids.length === 4 &&
      ["UR1", "UL1", "LR1", "LL1"].every((t) => ids.includes(t))
    );
  }

  function sideCanineLateralPair(side) {
    return [`${side}2`, `${side}3`];
  }

  function isTwoQuadrantCanineLateral(ids) {
    if (ids.length !== 4) return false;
    const sides = [...new Set(ids.map(sameSide))];
    if (sides.length !== 2) return false;
    return sides.every((side) => {
      const pair = sideCanineLateralPair(side);
      return pair.every((t) => ids.includes(t));
    });
  }

  function isLateralCanineCross(ids) {
    if (ids.length !== 2) return false;
    const [a, b] = ids;
    if (toothArch(a) !== toothArch(b)) return false;
    const positions = [TOOTH_POSITIONS[a].position, TOOTH_POSITIONS[b].position].sort();
    return positions[0] === 2 && positions[1] === 3;
  }

  function validateBothArchContiguous(ids, perArch) {
    const upper = ids.filter((id) => toothArch(id) === "upper");
    const lower = ids.filter((id) => toothArch(id) === "lower");
    return (
      upper.length === perArch &&
      lower.length === perArch &&
      isContiguous(upper) &&
      isContiguous(lower)
    );
  }

  function validate(product, _arch, selected) {
    const rule = getToothRule(product);
    const need = requiredCount(product);
    const allowed = selected.filter((id) => isToothVisibleInChart(id, product));

    if (rule === "flexible") {
      if (allowed.length < 1) return { ok: false, message: "Select at least one tooth." };
      return { ok: true };
    }

    if (allowed.length !== need) {
      return {
        ok: false,
        message: `Select exactly ${need} tooth${need === 1 ? "" : "es"}. (${allowed.length} selected)`,
      };
    }

    if (rule === "single-canine") {
      if (allowed.length === 1 && TOOTH_POSITIONS[allowed[0]].position === 3) return { ok: true };
      return { ok: false, message: "Select one canine tooth." };
    }
    if (rule === "single-lateral") {
      if (allowed.length === 1 && TOOTH_POSITIONS[allowed[0]].position === 2) return { ok: true };
      return { ok: false, message: "Select one lateral tooth." };
    }
    if (rule === "single-central") {
      if (allowed.length === 1 && TOOTH_POSITIONS[allowed[0]].position === 1) return { ok: true };
      return { ok: false, message: "Select one central tooth." };
    }
    if (rule === "arch-canines") {
      if (isArchCanines(allowed)) return { ok: true };
      return { ok: false, message: "Select both canines on upper or lower teeth." };
    }
    if (rule === "arch-laterals") {
      if (isArchLaterals(allowed)) return { ok: true };
      return { ok: false, message: "Select both laterals on upper or lower teeth." };
    }
    if (rule === "arch-centrals") {
      if (isArchCentrals(allowed)) return { ok: true };
      return { ok: false, message: "Select both centrals on upper or lower teeth." };
    }
    if (rule === "both-arch-canines") {
      if (isBothArchCanines(allowed)) return { ok: true };
      return { ok: false, message: "Select all four canines." };
    }
    if (rule === "both-arch-laterals") {
      if (isBothArchLaterals(allowed)) return { ok: true };
      return { ok: false, message: "Select all four laterals." };
    }
    if (rule === "both-arch-centrals") {
      if (isBothArchCentrals(allowed)) return { ok: true };
      return { ok: false, message: "Select all four centrals." };
    }
    if (rule === "canine-lateral-pair") {
      if (isCanineLateralPair(allowed)) return { ok: true };
      return { ok: false, message: "Select a canine and adjacent lateral on the same side." };
    }
    if (rule === "canine-bar-pair") {
      if (isCanineBarPair(allowed)) return { ok: true };
      return { ok: false, message: "Select 2 teeth: canine and adjacent lateral." };
    }
    if (rule === "both-side-canine-lateral") {
      if (isTwoQuadrantCanineLateral(allowed)) return { ok: true };
      return { ok: false, message: "Select canine and lateral on two sides." };
    }
    if (rule === "lateral-canine-cross") {
      if (isLateralCanineCross(allowed)) return { ok: true };
      return { ok: false, message: "Select a lateral and a canine on the same arch." };
    }
    if (rule === "both-arch-contiguous") {
      const perArch = perArchCount(product);
      if (validateBothArchContiguous(allowed, perArch)) return { ok: true };
      return {
        ok: false,
        message: `Select ${perArch} contiguous teeth on upper and ${perArch} on lower.`,
      };
    }
    if (isContiguous(allowed)) return { ok: true };
    return { ok: false, message: "Selected teeth must be in one continuous block." };
  }

  function formatLabels(ids) {
    return ids.map((id) => TOOTH_POSITIONS[id]?.label || id).join(", ");
  }

  function formatAbbrevLabels(ids) {
    const selected = new Set(ids);
    return [...UPPER_ORDER, ...LOWER_ORDER]
      .filter((id) => selected.has(id))
      .map((id) => POSITION_ABBR[TOOTH_POSITIONS[id].position])
      .join(", ");
  }

  function formatSelectionSummary(product, ids) {
    const rule = getToothRule(product);
    if (rule === "both-arch-contiguous") {
      return ids.length ? formatAbbrevLabels(ids) : "";
    }
    return formatLabels(ids);
  }

  function toggleContiguous(id, selected, max) {
    const order = orderForArch(id);
    const idx = order.indexOf(id);
    if (idx === -1) return selected;

    if (selected.includes(id)) {
      const next = selected.filter((x) => x !== id);
      return next.length === 0 || isContiguous(next) ? next : [id];
    }

    if (selected.length === 0) return [id];
    if (selected.length >= max) {
      const sameArch = selected.filter((x) => toothArch(x) === toothArch(id));
      if (sameArch.length >= max && toothArch(id) === toothArch(sameArch[0])) {
        return [id];
      }
    }

    const indices = selected.map((x) => order.indexOf(x));
    const min = Math.min(...indices);
    const maxIdx = Math.max(...indices);
    if (idx === min - 1 || idx === maxIdx + 1) {
      const next = [...selected, id];
      return next.length <= max ? next : [id];
    }
    return [id];
  }

  function applySelectionRule(id, product) {
    const rule = getToothRule(product);
    let selected = [...state.selected];

    if (rule === "single-canine" || rule === "single-lateral" || rule === "single-central") {
      const pos = rule === "single-canine" ? 3 : rule === "single-lateral" ? 2 : 1;
      if (TOOTH_POSITIONS[id].position !== pos) return selected;
      return selected.includes(id) ? [] : [id];
    }

    if (rule === "arch-canines") {
      if (toothArch(id) === "lower") return ["LR3", "LL3"];
      return ["UR3", "UL3"];
    }

    if (rule === "arch-laterals") {
      if (TOOTH_POSITIONS[id].position !== 2) return selected;
      if (toothArch(id) === "lower") return ["LR2", "LL2"];
      return ["UR2", "UL2"];
    }

    if (rule === "arch-centrals") {
      if (TOOTH_POSITIONS[id].position !== 1) return selected;
      if (toothArch(id) === "lower") return ["LR1", "LL1"];
      return ["UR1", "UL1"];
    }

    if (rule === "both-arch-canines") {
      if (TOOTH_POSITIONS[id].position !== 3) return selected;
      return ["UR3", "UL3", "LR3", "LL3"];
    }

    if (rule === "both-arch-laterals") {
      if (TOOTH_POSITIONS[id].position !== 2) return selected;
      return ["UR2", "UL2", "LR2", "LL2"];
    }

    if (rule === "both-arch-centrals") {
      if (TOOTH_POSITIONS[id].position !== 1) return selected;
      return ["UR1", "UL1", "LR1", "LL1"];
    }

    if (rule === "both-side-canine-lateral") {
      const pos = TOOTH_POSITIONS[id].position;
      if (!isCanineLateralPosition(pos)) return selected;
      const side = sameSide(id);
      const pair = sideCanineLateralPair(side);
      const hasPair = pair.every((t) => selected.includes(t));
      if (hasPair) return selected.filter((t) => !pair.includes(t));

      const selectedSides = [...new Set(selected.map(sameSide))];
      if (selectedSides.length >= 2 && !selectedSides.includes(side)) {
        const column = side.endsWith("L") ? "L" : "R";
        const sameColumnSide = selectedSides.find(
          (s) => (column === "L" && s.endsWith("L")) || (column === "R" && s.endsWith("R"))
        );
        const sideToRemove = sameColumnSide || selectedSides[0];
        const removePair = sideCanineLateralPair(sideToRemove);
        const remaining = selected.filter((t) => !removePair.includes(t));
        return [...remaining, ...pair];
      }

      const otherSide = selected.filter((t) => sameSide(t) !== side);
      return [...otherSide, ...pair];
    }

    if (rule === "lateral-canine-cross") {
      const pos = TOOTH_POSITIONS[id].position;
      if (!isCanineLateralPosition(pos)) return selected;
      if (selected.includes(id)) return selected.filter((x) => x !== id);
      if (selected.length === 1) {
        const first = selected[0];
        if (toothArch(first) !== toothArch(id)) return [id];
        const positions = [TOOTH_POSITIONS[first].position, pos].sort();
        if (positions[0] === 2 && positions[1] === 3) return [first, id];
        return [id];
      }
      return [id];
    }

    if (rule === "canine-lateral-pair" || rule === "canine-bar-pair") {
      const pos = TOOTH_POSITIONS[id].position;
      if (!isCanineLateralPosition(pos)) return selected;
      if (selected.includes(id)) return selected.filter((x) => x !== id);
      if (selected.length === 1 && sameSide(selected[0]) !== sameSide(id)) return [id];
      const next = [...selected, id];
      if (next.length > 2) return [id];
      return next;
    }

    if (rule === "both-arch-contiguous") {
      const maxPerArch = perArchCount(product);
      const archName = toothArch(id);
      const sameArch = selected.filter((x) => toothArch(x) === archName);
      const otherArch = selected.filter((x) => toothArch(x) !== archName);
      const updated = toggleContiguous(id, sameArch, maxPerArch);
      return [...otherArch, ...updated];
    }

    if (rule === "flexible") {
      if (selected.includes(id)) return selected.filter((x) => x !== id);
      return [...selected, id];
    }

    const need = requiredCount(product);
    if (selected.length > 0 && toothArch(id) !== toothArch(selected[0])) {
      selected = [];
    }
    return toggleContiguous(id, selected, need);
  }

  function renderArchRow(container, archKey, archLabel) {
    const row = document.createElement("div");
    row.className = "tooth-picker__arch";
    row.dataset.archKey = archKey;

    const title = document.createElement("p");
    title.className = "tooth-picker__arch-label";
    title.textContent = archLabel;
    row.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "tooth-picker__grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", `${archLabel} teeth`);

    const sides =
      archKey === "upper"
        ? [
            { side: "UL", reverse: true },
            { side: "UR", reverse: false },
          ]
        : [
            { side: "LL", reverse: true },
            { side: "LR", reverse: false },
          ];

    for (const { side, reverse } of sides) {
      const sideWrap = document.createElement("div");
      sideWrap.className = `tooth-picker__side-wrap tooth-picker__side-wrap--${side.toLowerCase()}`;

      const sideLabel = document.createElement("span");
      sideLabel.className = "tooth-picker__side-label";
      sideLabel.textContent = side;
      sideWrap.appendChild(sideLabel);

      const sideEl = document.createElement("div");
      sideEl.className = `tooth-picker__side tooth-picker__side--${side.toLowerCase()}`;

      const nums = reverse ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
      for (const n of nums) {
        const id = `${side}${n}`;
        const tooth = TOOTH_POSITIONS[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tooth-btn";
        btn.dataset.toothId = id;
        btn.setAttribute("aria-label", tooth.label);
        btn.setAttribute("aria-pressed", state.selected.includes(id) ? "true" : "false");

        const num = document.createElement("span");
        num.className = "tooth-btn__num";
        num.textContent = String(n);
        btn.appendChild(num);

        const abbr = document.createElement("span");
        abbr.className = "tooth-btn__type";
        abbr.textContent = POSITION_ABBR[n];
        btn.appendChild(abbr);

        if (state.selected.includes(id)) btn.classList.add("tooth-btn--selected");
        if (!isToothVisibleInChart(id, state.product)) {
          btn.classList.add("tooth-btn--hidden");
          btn.disabled = true;
        } else if (state.readOnly) {
          btn.classList.add("tooth-btn--readonly");
          btn.disabled = true;
          btn.tabIndex = -1;
        } else if (!isToothSelectable(id, state.product)) {
          btn.classList.add("tooth-btn--disabled");
          btn.disabled = true;
        } else {
          btn.addEventListener("click", () => onToothClick(id));
          btn.addEventListener("keydown", (e) => onToothKeydown(e, btn));
        }

        sideEl.appendChild(btn);
      }

      sideWrap.appendChild(sideEl);
      grid.appendChild(sideWrap);

      if (side.endsWith("L")) {
        const mid = document.createElement("div");
        mid.className = "tooth-picker__midline";
        mid.setAttribute("aria-hidden", "true");
        grid.appendChild(mid);
      }
    }

    row.appendChild(grid);
    container.appendChild(row);
  }

  function centerToothGrids(root) {
    root.querySelectorAll(".tooth-picker__grid").forEach((grid) => {
      const mid = grid.querySelector(".tooth-picker__midline");
      if (!mid) {
        grid.scrollLeft = Math.max(0, (grid.scrollWidth - grid.clientWidth) / 2);
        return;
      }
      const gridRect = grid.getBoundingClientRect();
      const midRect = mid.getBoundingClientRect();
      const midCenter = grid.scrollLeft + (midRect.left + midRect.width / 2 - gridRect.left);
      grid.scrollLeft = midCenter - grid.clientWidth / 2;
    });
  }

  function onToothClick(id) {
    if (state.readOnly) return;
    state.selected = applySelectionRule(id, state.product);
    render();
    state.onChange?.();
  }

  function onToothKeydown(e, btn) {
    const grid = btn.closest(".tooth-picker__grid");
    if (!grid) return;
    const buttons = [...grid.querySelectorAll(".tooth-btn:not(:disabled)")];
    const idx = buttons.indexOf(btn);
    if (idx === -1) return;

    let next = idx;
    if (e.key === "ArrowRight") next = Math.min(buttons.length - 1, idx + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, idx - 1);
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToothClick(btn.dataset.toothId);
      return;
    } else return;

    e.preventDefault();
    buttons[next]?.focus();
  }

  function render() {
    const root = document.getElementById("tooth-picker");
    if (!root) return;

    root.innerHTML = "";

    const helper = document.createElement("p");
    helper.className = "tooth-picker__helper";
    helper.id = "tooth-picker-helper";
    helper.textContent = helperText(state.product);
    root.appendChild(helper);

    const charts = document.createElement("div");
    charts.className = "tooth-picker__charts";

    const mode = getChartMode(state.product);
    if (mode === "upper" || mode === "both") renderArchRow(charts, "upper", "Upper");
    if (mode === "lower" || mode === "both") renderArchRow(charts, "lower", "Lower");

    root.appendChild(charts);

    if (!state.readOnly) {
      const summary = document.createElement("p");
      summary.className = "tooth-picker__summary";
      summary.id = "tooth-picker-summary";
      summary.setAttribute("role", "status");
      summary.setAttribute("aria-live", "polite");
      summary.textContent = state.selected.length
        ? formatSelectionSummary(state.product, state.selected)
        : "No teeth selected yet.";
      root.appendChild(summary);
    }

    requestAnimationFrame(() => centerToothGrids(root));
  }

  function init(product, options = {}) {
    state.product = product;
    state.readOnly = Boolean(options.readOnly);
    state.summaryLabel = options.selectedTeethLabel || "";
    if (state.readOnly && options.selectedTeeth?.length) {
      state.selected = [...options.selectedTeeth];
    } else {
      const incoming = options.selectedTeeth || [];
      state.selected = incoming.filter((id) => isToothSelectable(id, product));
    }
    state.onChange = options.onChange || null;
    render();
  }

  function getSelection() {
    return {
      selectedTeeth: [...state.selected],
      selectedTeethLabel: state.summaryLabel || formatSelectionSummary(state.product, state.selected),
    };
  }

  return {
    TOOTH_POSITIONS,
    getToothRule,
    needsArchSelector,
    getChartMode,
    deriveArchLabel,
    getEffectiveArch,
    requiredCount,
    helperText,
    validate,
    formatLabels,
    init,
    getSelection,
  };
})();
