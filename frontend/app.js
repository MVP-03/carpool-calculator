document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // ===== Backend API =====
  const API_BASE = "https://fuelsplit-backend.onrender.com/api/sessions";

  async function apiGetHistory() {
    const r = await fetch(API_BASE);
    if (!r.ok) throw new Error("History fetch failed");
    return await r.json();
  }

  async function apiSave(item) {
  const r = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    console.error("SAVE ERROR:", r.status, text);
    throw new Error("Save failed");
  }

  // ⭐ Backend returns { ok:true, id: X }
  return await r.json();
}

  async function apiClear() {
    const r = await fetch(API_BASE, { method: "DELETE" });
    if (!r.ok) throw new Error("Clear failed");
  }

  // ===== Helpers =====
  const round2 = (n) => Math.round(n * 100) / 100;

  function formatINR(n) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);
  }

  function num(el) {
    return Number(String(el?.value ?? "").trim());
  }
  function int(el) {
    return parseInt(String(el?.value ?? "").trim(), 10);
  }

  // ===== Elements =====
  const sidebarToggle = $("sidebarToggle");
  const sidebar = $("sidebar");
  const darkToggle = $("darkToggle");
  const darkToggleSide = $("darkToggleSide");

  const tripMode = $("tripMode");
  const fuelType = $("fuelType");
  const fuelRate = $("fuelRate");

  const milage1 = $("milage1");
  const distance1 = $("distance1");
  const passengers1 = $("passengers1");

  const milage2 = $("milage2");
  const distance2 = $("distance2");
  const passengers2 = $("passengers2");

  const miniTrip1 = $("miniTrip1");
  const miniTrip2 = $("miniTrip2");

  const liveSummary = $("liveSummary");

  const steps = Array.from(document.querySelectorAll(".step"));
  const dots = Array.from(document.querySelectorAll(".dot"));
  const lines = Array.from(document.querySelectorAll(".line"));
  const progressLabel = $("progressLabel");

  const next1 = $("next1");
  const next2 = $("next2");
  const next3 = $("next3");
  const back2 = $("back2");
  const back3 = $("back3");
  const back4 = $("back4");
  const startOver = $("startOver");

  const toast = $("toast");

  const kTrip1Cost = $("kTrip1Cost");
  const kTrip2Cost = $("kTrip2Cost");
  const kTotalCost = $("kTotalCost");
  const kTotalFuel = $("kTotalFuel");

  const meterBar = $("meterBar");
  const meterLabel = $("meterLabel");

  const resultBox = $("resultBox");
  const waShareBtn = $("waShareBtn");
  const saveBtn = $("saveBtn");

  const historyList = $("historyList");
  const refreshHistoryBtn = $("refreshHistoryBtn");
  const clearHistoryBtn = $("clearHistoryBtn");

  const floatingWA = $("floatingWA");

  const errRate = $("errRate");
  const errMilage1 = $("errMilage1");
  const errDistance1 = $("errDistance1");
  const errPassengers1 = $("errPassengers1");
  const errMilage2 = $("errMilage2");
  const errDistance2 = $("errDistance2");
  const errPassengers2 = $("errPassengers2");

  // Preset chips
  document.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      fuelRate.value = btn.getAttribute("data-rate");
      onAnyInput();
    });
  });

  // ===== State =====
  let currentStep = 1;
  let lastResult = null; // latest full calculation
  let savingNow = false; // ⭐ prevents double save

  function mode() {
    return tripMode?.value === "two" ? "two" : "single";
  }

  // ===== UI: toast =====
  function showToast(msg, type = "ok") {
    if (!toast) return;
    toast.classList.remove("hidden", "err", "warn");
    toast.textContent = msg;

    if (type === "err") toast.classList.add("err");
    if (type === "warn") toast.classList.add("warn");

    // auto-hide
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toast.classList.add("hidden");
    }, 2200);
  }

  function setError(el, msg) { if (el) el.textContent = msg || ""; }

  // ===== Progress animation =====
  function updateProgress(step) {
    currentStep = step;
    if (progressLabel) progressLabel.textContent = `Step ${step} of 4`;

    dots.forEach(d => {
      const n = Number(d.getAttribute("data-dot"));
      d.classList.remove("active", "done");
      if (n < step) d.classList.add("done");
      if (n === step) d.classList.add("active");
    });

    lines.forEach((l, i) => {
      // line 1 is between dot1-dot2, etc.
      const lineIndex = i + 1;
      l.classList.toggle("filled", lineIndex < step);
    });
  }

  function showStep(step) {
    steps.forEach(s => s.classList.add("hidden"));
    document.querySelector(`.step[data-step="${step}"]`)?.classList.remove("hidden");
    updateProgress(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ===== Theme switch on fuel type =====
  function applyFuelTheme() {
    const diesel = fuelType.value === "diesel";
    document.documentElement.style.setProperty("--accent", diesel ? "#16a34a" : "#2563eb");
    document.documentElement.style.setProperty("--accent2", diesel ? "#15803d" : "#1d4ed8");
  }

  // ===== Validation =====
  function validateStep1() {
    setError(errRate, "");
    const r = num(fuelRate);
    if (!Number.isFinite(r) || r < 0) {
      setError(errRate, "Fuel rate must be ≥ 0");
      return false;
    }
    return true;
  }

  function validateTrip1() {
    setError(errMilage1, "");
    setError(errDistance1, "");
    setError(errPassengers1, "");

    const m = num(milage1);
    const d = num(distance1);
    const p = int(passengers1);

    let ok = true;
    if (!Number.isFinite(m) || m <= 0) { setError(errMilage1, "Mileage must be > 0"); ok = false; }
    if (!Number.isFinite(d) || d <= 0) { setError(errDistance1, "Distance must be > 0"); ok = false; }
    if (!Number.isInteger(p) || p < 0) { setError(errPassengers1, "Passengers must be ≥ 0"); ok = false; }
    return ok;
  }

  function validateTrip2() {
    setError(errMilage2, "");
    setError(errDistance2, "");
    setError(errPassengers2, "");

    const m = num(milage2);
    const d = num(distance2);
    const p = int(passengers2);

    let ok = true;
    if (!Number.isFinite(m) || m <= 0) { setError(errMilage2, "Mileage must be > 0"); ok = false; }
    if (!Number.isFinite(d) || d <= 0) { setError(errDistance2, "Distance must be > 0"); ok = false; }
    if (!Number.isInteger(p) || p < 0) { setError(errPassengers2, "Passengers must be ≥ 0"); ok = false; }
    return ok;
  }

  // ===== Calculation (per trip costs + per person) =====
  function calcTrip(distance, mileage, passengers, rate) {
    const liters = distance / mileage;
    const cost = liters * rate;
    const splitCount = passengers + 1; // driver included
    const perPerson = cost / splitCount;

    return { liters, cost, splitCount, perPerson };
  }

  function calculateAll() {
    // must have a valid rate + valid trip1
    const rate = num(fuelRate);
    if (!Number.isFinite(rate) || rate < 0) return null;

    // Trip 1
    const m1 = num(milage1);
    const d1 = num(distance1);
    const p1 = int(passengers1);
    if (!Number.isFinite(m1) || m1 <= 0) return null;
    if (!Number.isFinite(d1) || d1 <= 0) return null;
    if (!Number.isInteger(p1) || p1 < 0) return null;

    const t1 = calcTrip(d1, m1, p1, rate);

    // Trip 2 optional
    let m2 = 0, d2 = 0, p2 = 0;
    let t2 = { liters: 0, cost: 0, splitCount: 0, perPerson: 0 };

    if (mode() === "two") {
      m2 = num(milage2);
      d2 = num(distance2);
      p2 = int(passengers2);

      // For live preview: if user hasn't entered valid Trip2 yet, keep it null-ish
      if (
        Number.isFinite(m2) && m2 > 0 &&
        Number.isFinite(d2) && d2 > 0 &&
        Number.isInteger(p2) && p2 >= 0
      ) {
        t2 = calcTrip(d2, m2, p2, rate);
      } else {
        // Trip2 not ready yet
        t2 = null;
      }
    }

    const totalLiters = t1.liters + (t2 ? t2.liters : 0);
    const totalCost = t1.cost + (t2 ? t2.cost : 0);

    return {
      fuel: fuelType.value,
      tripMode: mode(),
      rate,

      milage1: m1, distance1: d1, passengers1: p1,
      trip1: t1,

      milage2: m2, distance2: d2, passengers2: p2,
      trip2: t2, // can be null if not ready

      totalLiters,
      totalCost,
      timestamp: new Date().toISOString(),
    };
  }

  // ===== Auto live UI updates =====
  function renderMiniTrip(previewEl, tripObj, label) {
    if (!previewEl) return;
    if (!tripObj) {
      previewEl.textContent = "Enter valid values to preview.";
      return;
    }
    previewEl.innerHTML = `
      ${label}: <span class="pill">${formatINR(tripObj.cost)}</span>
      • ${round2(tripObj.liters)} L
      • ${formatINR(tripObj.perPerson)}/person
    `;
  }

  function renderLiveSummary(data) {
    if (!liveSummary) return;

    if (!data) {
      liveSummary.innerHTML = `<div class="muted">Fill inputs to see live summary.</div>`;
      return;
    }

    const t2ready = data.trip2 && data.tripMode === "two";
    const trip2Line = data.tripMode === "two"
      ? (t2ready
        ? `<div><b>Trip 2:</b> ${formatINR(data.trip2.cost)} • ${formatINR(data.trip2.perPerson)}/person</div>`
        : `<div class="muted"><b>Trip 2:</b> waiting for valid inputs…</div>`)
      : `<div class="muted"><b>Trip 2:</b> (single trip)</div>`;

    liveSummary.innerHTML = `
      <div class="pill" style="display:inline-flex;margin-bottom:10px;">
        ${data.fuel.toUpperCase()} • Rate ${formatINR(data.rate)}/L
      </div>

      <div><b>Trip 1:</b> ${formatINR(data.trip1.cost)} • ${formatINR(data.trip1.perPerson)}/person</div>
      ${trip2Line}

      <div class="divider"></div>

      <div><b>Total Cost:</b> ${formatINR(data.totalCost)}</div>
      <div><b>Total Fuel:</b> ${round2(data.totalLiters)} L</div>
    `;
  }

  function renderFinalResult(data) {
    if (!data) return;

    // Trip 2 in final must be fully valid if two mode
    const t2 = data.tripMode === "two" ? data.trip2 : null;

    // KPIs
    kTrip1Cost.textContent = formatINR(data.trip1.cost);
    kTrip2Cost.textContent = (t2 ? formatINR(t2.cost) : "—");
    kTotalCost.textContent = formatINR(data.totalCost);
    kTotalFuel.textContent = `${round2(data.totalLiters)} L`;

    // Meter (10L = 100% cap)
    const pct = Math.max(0, Math.min(100, (data.totalLiters / 10) * 100));
    meterBar.style.width = `${pct}%`;
    meterLabel.textContent = `${Math.round(pct)}%`;

    // Summary box
    const trip2Block = (data.tripMode === "two")
      ? `
        <div class="hr"></div>
        <div class="row">
          <div><b>Trip 2</b></div>
          <div class="muted small">Mileage ${round2(data.milage2)} km/L • Distance ${round2(data.distance2)} km</div>
          <div class="muted small">Passengers ${data.passengers2} (+ driver)</div>
          <div class="muted small">Fuel ${round2(t2.liters)} L</div>
          <div><b>Cost:</b> ${formatINR(t2.cost)}</div>
          <div><b>Per Person:</b> ${formatINR(t2.perPerson)} (Split: ${t2.splitCount})</div>
        </div>
      `
      : `<div class="muted small" style="margin-top:10px;">Trip 2 skipped (Single Trip mode)</div>`;

    resultBox.innerHTML = `
      <div class="pill">${data.tripMode === "two" ? "TWO TRIPS" : "SINGLE TRIP"} • ${data.fuel.toUpperCase()}</div>

      <div style="margin-top:10px;">
        <div><b>Trip 1</b></div>
        <div class="muted small">Mileage ${round2(data.milage1)} km/L • Distance ${round2(data.distance1)} km</div>
        <div class="muted small">Passengers ${data.passengers1} (+ driver)</div>
        <div class="muted small">Fuel ${round2(data.trip1.liters)} L</div>
        <div><b>Cost:</b> ${formatINR(data.trip1.cost)}</div>
        <div><b>Per Person:</b> ${formatINR(data.trip1.perPerson)} (Split: ${data.trip1.splitCount})</div>
      </div>

      ${trip2Block}

      <div class="divider"></div>
      <div><b>Total Cost:</b> ${formatINR(data.totalCost)}</div>
      <div><b>Total Fuel:</b> ${round2(data.totalLiters)} L</div>
    `;

    waShareBtn.disabled = false;
    saveBtn.disabled = false;
  }

  // ===== WhatsApp =====
  function buildWhatsAppText(data) {
    const lines = [
      `FuelSplit — ${data.tripMode === "two" ? "Two Trips" : "Single Trip"} (${data.fuel.toUpperCase()})`,
      `Rate: ₹${round2(data.rate)}/L`,
      ``,
      `Trip 1:`,
      `Mileage: ${round2(data.milage1)} km/L`,
      `Distance: ${round2(data.distance1)} km`,
      `Passengers: ${data.passengers1} (+ driver)`,
      `Cost: ${formatINR(data.trip1.cost)}`,
      `Per Person: ${formatINR(data.trip1.perPerson)}`,
    ];

    if (data.tripMode === "two" && data.trip2) {
      lines.push(
        ``,
        `Trip 2:`,
        `Mileage: ${round2(data.milage2)} km/L`,
        `Distance: ${round2(data.distance2)} km`,
        `Passengers: ${data.passengers2} (+ driver)`,
        `Cost: ${formatINR(data.trip2.cost)}`,
        `Per Person: ${formatINR(data.trip2.perPerson)}`
      );
    }

    lines.push(
      ``,
      `Total Cost: ${formatINR(data.totalCost)}`,
      `Total Fuel: ${round2(data.totalLiters)} L`
    );

    return lines.join("\n");
  }

  // ===== History UI =====
  function historyItemHTML(x) {
    const t2 = x.trip2 && x.tripMode === "two";

    return `
      <div class="historyItem">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <div class="pill">${(x.tripMode === "two" ? "TWO TRIPS" : "SINGLE")} • ${String(x.fuel).toUpperCase()}</div>
          <div class="muted small">${new Date(x.timestamp).toLocaleString()}</div>
        </div>

        <div class="historyGrid">
          <div>
            <div class="muted small"><b>Trip 1</b></div>
            <div><b>Cost:</b> ${formatINR(x.trip1?.cost ?? x.cost1 ?? 0)}</div>
            <div class="muted small"><b>Per Person:</b> ${formatINR(x.trip1?.perPerson ?? x.per1 ?? 0)}</div>
          </div>

          <div>
            <div class="muted small"><b>Trip 2</b></div>
            <div><b>Cost:</b> ${t2 ? formatINR(x.trip2.cost) : "—"}</div>
            <div class="muted small"><b>Per Person:</b> ${t2 ? formatINR(x.trip2.perPerson) : "—"}</div>
          </div>
        </div>

        <div class="divider"></div>
        <div><b>Total:</b> ${formatINR(x.totalCost ?? 0)} • ${round2(x.totalLiters ?? 0)} L</div>
      </div>
    `;
  }

  async function renderHistory() {
    if (!historyList) return;
    try {
      const items = await apiGetHistory();
      if (!Array.isArray(items) || items.length === 0) {
        historyList.classList.add("muted");
        historyList.textContent = "No history yet. Save a result to see it here.";
        return;
      }
      historyList.classList.remove("muted");
      historyList.innerHTML = items.map(historyItemHTML).join("");
    } catch {
      historyList.classList.add("muted");
      historyList.textContent = "Backend not reachable. Start Flask on http://127.0.0.1:5000";
    }
  }

  // ===== Step navigation rules =====
  function goStep(step) {
    // if single mode, step 3 is still in the flow visually, but we skip it on Next
    showStep(step);
  }

  function onAnyInput() {
    applyFuelTheme();

    // live preview calc
    const data = calculateAll();

    // mini previews
    if (data) {
      renderMiniTrip(miniTrip1, data.trip1, "Trip 1");
      if (mode() === "two") {
        renderMiniTrip(miniTrip2, data.trip2, "Trip 2");
      } else {
        renderMiniTrip(miniTrip2, null, "Trip 2");
      }
    } else {
      renderMiniTrip(miniTrip1, null, "Trip 1");
      renderMiniTrip(miniTrip2, null, "Trip 2");
    }

    // live summary
    renderLiveSummary(data);

    // keep lastResult only if it’s “final-ready”
    // final-ready means: step1+trip1 valid AND (if two) trip2 valid too
    if (!data) {
      lastResult = null;
      return;
    }

    if (data.tripMode === "single") {
      lastResult = data;
      return;
    }

    // two trips: need trip2 fully valid (not null)
    lastResult = data.trip2 ? data : null;
  }

  // Auto live calc on all inputs
  [
    tripMode, fuelType, fuelRate,
    milage1, distance1, passengers1,
    milage2, distance2, passengers2
  ].forEach(el => el?.addEventListener("input", onAnyInput));

  tripMode?.addEventListener("change", () => {
    onAnyInput();
  });

  fuelType?.addEventListener("change", () => {
    onAnyInput();
  });

  // Buttons
  next1?.addEventListener("click", () => {
    if (!validateStep1()) { showToast("Fix fuel rate first.", "err"); return; }
    applyFuelTheme();
    goStep(2);
  });

  back2?.addEventListener("click", () => goStep(1));

  next2?.addEventListener("click", () => {
    if (!validateTrip1()) { showToast("Fix Trip 1 inputs.", "err"); return; }

    if (mode() === "single") {
      // single: jump to result (step4) using current computed data
      const data = calculateAll();
      if (!data) { showToast("Enter valid values.", "err"); return; }
      lastResult = data;
      renderFinalResult(data);
      showToast("Result ready ✅", "ok");
      goStep(4);
      return;
    }

    // two trips
    goStep(3);
  });

  back3?.addEventListener("click", () => goStep(2));

  next3?.addEventListener("click", () => {
    if (mode() !== "two") { goStep(4); return; }
    if (!validateTrip2()) { showToast("Fix Trip 2 inputs.", "err"); return; }

    const data = calculateAll();
    if (!data || !data.trip2) { showToast("Trip 2 not valid yet.", "err"); return; }

    lastResult = data;
    renderFinalResult(data);
    showToast("Result ready ✅", "ok");
    goStep(4);
  });

  back4?.addEventListener("click", () => {
    if (mode() === "single") goStep(2);
    else goStep(3);
  });

  startOver?.addEventListener("click", () => {
    waShareBtn.disabled = true;
    saveBtn.disabled = true;
    lastResult = null;
    showToast("Reset ✅", "ok");
    goStep(1);
  });

  waShareBtn?.addEventListener("click", () => {
    if (!lastResult) { showToast("No result to share.", "warn"); return; }
    const url = "https://wa.me/?text=" + encodeURIComponent(buildWhatsAppText(lastResult));
    window.open(url, "_blank", "noopener,noreferrer");
  });

  floatingWA?.addEventListener("click", () => {
    const text = lastResult ? buildWhatsAppText(lastResult) : "FuelSplit — carpool calculator";
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  });

  saveBtn?.addEventListener("click", async () => {
  if (!lastResult) {
    showToast("No result to save.", "warn");
    return;
  }

  if (savingNow) {
    showToast("Already saving...", "warn");
    return;
  }

  try {
    savingNow = true;
    saveBtn.disabled = true;

    const resp = await apiSave(lastResult); // ⭐ DB response

    await renderHistory();

    showToast(`Saved ✅ (ID: ${resp?.id ?? "-"})`, "ok");
  } catch (e) {
    console.error("SAVE FAILED:", e);
    showToast("Save failed. Check Flask console.", "err");
  } finally {
    savingNow = false;
    saveBtn.disabled = false;
    saveBtn.disabled = true;
  }
});

  refreshHistoryBtn?.addEventListener("click", renderHistory);

  clearHistoryBtn?.addEventListener("click", async () => {
    try {
      await apiClear();
      await renderHistory();
      showToast("History cleared ✅", "ok");
    } catch {
      showToast("Clear failed. Is backend running?", "err");
    }
  });

  // Sidebar + dark
  sidebarToggle?.addEventListener("click", () => {
    document.body.classList.toggle("sidebarCollapsed");
  });

  function toggleDark() { document.body.classList.toggle("dark"); }
  darkToggle?.addEventListener("click", toggleDark);
  darkToggleSide?.addEventListener("click", toggleDark);

  // ===== Init =====
  applyFuelTheme();
  goStep(1);
  onAnyInput();
  renderHistory();
});
