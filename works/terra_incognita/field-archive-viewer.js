import { archiveCaptureProfile as captureFor, archiveEnglish, archiveImage, readFieldArchive } from '../../engine/core/field-archive.js';

(() => {
  const FALLBACK = [
    ["P01-001", "terra", "PLANET 01", "SHEAR WORLD", "IRON–NICKEL ALLOY SAMPLE · FIELD 1", 231.6, 543.4, 0],
    ["P01-002", "terra", "PLANET 01", "SHEAR WORLD", "IRON–NICKEL ALLOY SAMPLE · FIELD 2", 247, 519, 1],
    ["P01-003", "terra", "PLANET 01", "SHEAR WORLD", "SILICATE CERAMIC SAMPLE · FIELD 1", 199.1, 516.1, 2],
    ["P01-004", "terra", "PLANET 01", "SHEAR WORLD", "SILICATE CERAMIC SAMPLE · FIELD 2", 185, 536, 3],
    ["P01-005", "terra", "PLANET 01", "SHEAR WORLD", "CARBON COMPOSITE SAMPLE · FIELD 1", 209.9, 471.4, 4],
    ["P01-006", "terra", "PLANET 01", "SHEAR WORLD", "CARBON COMPOSITE SAMPLE · FIELD 2", 190, 484, 5],
    ["P01-007", "terra", "PLANET 01", "SHEAR WORLD", "CONDUCTIVE LATTICE SAMPLE · FIELD 1", 168.5, 445.3, 6],
    ["P01-008", "terra", "PLANET 01", "SHEAR WORLD", "CONDUCTIVE LATTICE SAMPLE · FIELD 2", 151, 466, 7],
    ["P01-009", "terra", "PLANET 01", "SHEAR WORLD", "MOLECULAR NITROGEN (N₂) FROST · FIELD 1", 173.9, 391.9, 8],
    ["P01-010", "terra", "PLANET 01", "SHEAR WORLD", "MOLECULAR NITROGEN (N₂) FROST · FIELD 2", 153, 403, 9],
    ["P01-011", "terra", "PLANET 01", "SHEAR WORLD", "ETHANOL CRYSTALLINE PHASE · FIELD 1", 127.7, 352.8, 10],
    ["P01-012", "terra", "PLANET 01", "SHEAR WORLD", "ETHANOL CRYSTALLINE PHASE · FIELD 2", 111, 371, 11],
    ["P02-001", "desert", "PLANET 02", "YARDANG FIELD", "LANDING DATUM", 96, 520, 0],
    ["P02-002", "desert", "PLANET 02", "YARDANG FIELD", "YARDANG INGRESS", 88, 503, 1],
    ["P02-003", "desert", "PLANET 02", "YARDANG FIELD", "SINTERED PASSAGE", 79, 486, 2],
    ["P02-004", "desert", "PLANET 02", "YARDANG FIELD", "WIND-SHADOW CUT", 70, 468, 3],
    ["P02-005", "desert", "PLANET 02", "YARDANG FIELD", "HYDRATION GRADIENT", 62, 450, 4],
    ["P02-006", "desert", "PLANET 02", "YARDANG FIELD", "PORE-ICE APPROACH", 56, 438, 5],
    ["P02-007", "desert", "PLANET 02", "YARDANG FIELD", "HYDRATION RETURN", 52, 428, 6],
    ["P03-001", "granite", "PLANET 03", "JOINTED GRANITE", "LANDING DATUM", 120, 460, 0],
    ["P03-002", "granite", "PLANET 03", "JOINTED GRANITE", "MATERIAL PHASE", 107, 431, 1],
    ["P03-003", "granite", "PLANET 03", "JOINTED GRANITE", "MEMORY TRANSIT", 124, 402, 2],
    ["P03-004", "granite", "PLANET 03", "JOINTED GRANITE", "HYDRATION PHASE", 150, 383, 3],
    ["P03-005", "granite", "PLANET 03", "JOINTED GRANITE", "CONCORDANCE", 170, 345, 4]
  ].map(([id, body, planet, world, label, x, z, order]) => ({
    id, body, planet, world, label, x, z, order,
    resourceItem: body === "terra" ? Math.floor(order / 2) : null,
    resourceVariant: body === "terra" ? order % 2 : null,
    archiveRole: "unresolved",
    potentialCount: 0,
    resolved: false,
    capture: captureFor({ id, body, order })
  }));
  const byId = (items) => new Map(items.map((item) => [item.id, item]));
  const escape = (value) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" })[char]);
  let storage;
  try { storage = sessionStorage; } catch { storage = null; }
  const source = readFieldArchive(storage);
  const bodyOrder = ["terra", "desert", "granite"];
  const fallbackById = byId(FALLBACK);
  const storedStations = source.stations.filter(station => fallbackById.has(station.id)).map(station => ({
    ...fallbackById.get(station.id), ...station,
    body: fallbackById.get(station.id).body,
    planet: fallbackById.get(station.id).planet,
    world: fallbackById.get(station.id).world,
    label: archiveEnglish(station.label, fallbackById.get(station.id).label)
  }));
  const stations = [...byId([...FALLBACK, ...storedStations]).values()].sort((a, b) => bodyOrder.indexOf(a.body) - bodyOrder.indexOf(b.body) || a.order - b.order);
  const stationsById = byId(stations);
  const stationNumbers = new Map(stations.map((station, index) => [station.id, String(index).padStart(3, "0")]));
  const records = (source.records || []).filter((record) => stationsById.has(record.id));
  const recordsById = byId(records);
  const ledger = document.getElementById("fa-ledger");
  const image = document.getElementById("fa-image");
  const empty = document.getElementById("fa-empty");
  const emptyTitle = empty.querySelector("b");
  const emptyStatus = empty.querySelector("span");
  const count = document.getElementById("fa-count");
  const preview = document.getElementById("fa-preview");
  const frameSurface = preview.querySelector(".frame");
  const selection = document.getElementById("fa-selection");
  let filter = "all";
  let selected = null;
  let recordNodes = new Map();
  const coord = (station) => `X ${Number(station.x).toFixed(1)}  /  Z ${Number(station.z).toFixed(1)}`;
  function filtered() { return stations.filter((station) => filter === "all" || station.body === filter); }
  function positionPreview(node = selected && recordNodes.get(selected.id)) {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    selection.style.top = `${rect.top}px`;
    selection.style.height = `${rect.height}px`;
    selection.classList.toggle("on", rect.bottom > 0 && rect.top < innerHeight);
    if (innerWidth > 700) {
      const available = Math.max(84, innerHeight - preview.offsetHeight - 24);
      const top = Math.max(84, Math.min(rect.top - preview.offsetHeight * .36, available));
      preview.style.setProperty("--preview-top", `${top}px`);
    }
  }
  function sizePreview(capture) {
    const aspect = capture?.aspect ?? 2.392;
    const horizontalPad = Math.max(16, innerWidth * .01875);
    const maxWidth = innerWidth > 700 ? innerWidth * .475 : innerWidth - horizontalPad * 2;
    const maxHeight = innerWidth > 700 ? innerHeight - 150 : innerHeight - 142;
    preview.style.setProperty("--capture-aspect", String(aspect));
    preview.style.width = `${Math.max(72, Math.floor(Math.min(maxWidth, maxHeight * aspect)))}px`;
  }
  function select(station, node) {
    selected = station;
    const record = recordsById.get(station.id);
    const capture = captureFor(record ?? station);
    for (const [id, recordNode] of recordNodes) recordNode.setAttribute("aria-pressed", String(id === station.id));
    sizePreview(capture);
    frameSurface.dataset.capture = capture.profile;
    if (record && archiveImage(record.image)) {
      image.alt = `${capture.lens} ${capture.viewpoint} field observation`;
      image.src = record.image;
      image.classList.add("on");
      empty.hidden = true;
      frameSurface.classList.remove("empty");
    }
    else {
      image.removeAttribute("src");
      image.classList.remove("on");
      empty.hidden = false;
      frameSurface.classList.add("empty");
      const potential = station.archiveRole === "potential";
      emptyTitle.textContent = potential ? "RESOLVED POTENTIAL" : "NO IMAGE";
      emptyStatus.textContent = potential ? "FIELD SUBTRACTED" : "SIGNAL NOT ACQUIRED";
    }
    preview.classList.add("on");
    positionPreview(node);
  }
  function clearPreview() {
    selected = null;
    for (const node of recordNodes.values()) node.setAttribute("aria-pressed", "false");
    image.removeAttribute("src");
    image.classList.remove("on");
    preview.style.removeProperty("width");
    preview.style.removeProperty("--capture-aspect");
    delete frameSurface.dataset.capture;
    empty.hidden = false;
    preview.classList.remove("on");
    selection.classList.remove("on");
  }
  function render() {
    const visible = filtered();
    if (!visible.some((station) => station.id === selected?.id)) selected = null;
    ledger.innerHTML = visible.map((station) => {
      const acquired = recordsById.has(station.id);
      const role = station.archiveRole === "evidence" ? "evidence" : station.archiveRole === "potential" ? "potential" : "unresolved";
      const number = stationNumbers.get(station.id);
      const status = role === "evidence" ? "EVIDENCE" : role === "potential" ? "POTENTIAL" : acquired ? "ACQUIRED" : "—";
      const spoken = role === "evidence" ? "selected evidence" : role === "potential" ? `resolved potential ${station.potentialCount || 0}` : acquired ? "acquired" : "signal not acquired";
      return `<button class="record" type="button" data-id="${escape(station.id)}" data-role="${role}" aria-label="${escape(`${number} ${station.planet} ${station.label} ${coord(station)} ${spoken}`)}" aria-pressed="false"><span class="record-number">${number}</span><span class="record-planet">${escape(station.planet)}</span><span class="record-label">${escape(station.label)}</span><span class="status ${role}">${status}</span></button>`;
    }).join("") || `<p class="empty-ledger">NO COORDINATE RECORDS</p>`;
    recordNodes = new Map([...ledger.querySelectorAll(".record")].map((node) => [node.dataset.id, node]));
    for (const [id, node] of recordNodes) {
      const station = stationsById.get(id);
      node.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") select(station, node); });
      node.addEventListener("focus", () => select(station, node));
      node.addEventListener("click", () => select(station, node));
    }
    count.textContent = `${String(records.length).padStart(2, "0")} / ${String(stations.length).padStart(2, "0")} SIGNALS ACQUIRED`;
    document.getElementById("fa-footer").textContent = records.length
      ? `${records.length} camera return${records.length === 1 ? "" : "s"} retained for this session.`
      : "No field observations in this session.";
    if (selected) select(selected, recordNodes.get(selected.id));
    else clearPreview();
  }
  ledger.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && !document.activeElement?.classList.contains("record")) clearPreview();
  });
  document.querySelectorAll(".filter").forEach((node) => node.addEventListener("click", () => {
    filter = node.dataset.filter;
    selected = null;
    document.querySelectorAll(".filter").forEach((button) => button.setAttribute("aria-pressed", String(button === node)));
    render();
  }));
  addEventListener("resize", () => {
    if (selected) sizePreview(captureFor(recordsById.get(selected.id) ?? selected));
    positionPreview();
  });
  addEventListener("scroll", () => positionPreview(), { passive:true });
  image.addEventListener("load", () => positionPreview());
  image.addEventListener("error", () => { image.classList.remove("on"); empty.hidden = false; emptyTitle.textContent = "NO IMAGE"; emptyStatus.textContent = "IMAGE UNAVAILABLE"; frameSurface.classList.add("empty"); });
  const returnLink = document.querySelector("[data-return]");
  if (returnLink) returnLink.href = 'planet.html';
  returnLink?.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || history.length <= 1) return;
    event.preventDefault();
    history.back();
  });
  render();
})();
