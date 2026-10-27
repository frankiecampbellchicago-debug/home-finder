/* Paste the inbox address here once there is one. Empty = preview mode (forms show success, nothing is sent). */
const INBOX = "";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const areas = [...new Set(HOMES.map(h => h.area))].sort();

/* nav */
const nav = $("#nav");
const burger = $(".burger");
const solid = () => nav.classList.toggle("solid", scrollY > 40);
if (!document.body.classList.contains("inner")) { solid(); addEventListener("scroll", solid, {passive:true}); }
burger.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  burger.setAttribute("aria-expanded", open);
  burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
$$(".links a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); burger.setAttribute("aria-expanded", false); }));
$("#yr").textContent = new Date().getFullYear();
$("#f-areas").innerHTML = areas.map(a => `<li><a href="homes.html?area=${encodeURIComponent(a)}">${a}</a></li>`).join("");

/* saved homes (kept in this browser only) */
let saved;
try { saved = new Set(JSON.parse(localStorage.getItem("hf-saved") || "[]")); } catch { saved = new Set(); }
const keepSaved = () => { try { localStorage.setItem("hf-saved", JSON.stringify([...saved])); } catch {} };

const icon = {
  bed:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18V7m0 6h18v5m0-5a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.5" r="1.6"/></svg>',
  bath:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2m11-2 1 2"/></svg>',
  size:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM4 9h5V4m11 11h-5v5"/></svg>',
  heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>'
};

function card(h) {
  const on = saved.has(h.id);
  return `<a class="card rv" href="listing.html?id=${h.id}">
    <div class="ph">
      <img src="images/${h.img}-800.webp" alt="${esc(h.name)}, ${esc(h.line)}" loading="lazy" width="800" height="533">
      <span class="status ${h.status.replace(" ", "")}">${h.status}</span>
      <button class="save" type="button" data-save="${h.id}" aria-pressed="${on}" aria-label="${on ? "Remove from" : "Save to"} saved homes: ${esc(h.name)}">${icon.heart}</button>
    </div>
    <div class="body">
      <span class="price">${money(h.price)}</span>
      <h3>${esc(h.name)}</h3>
      <span class="area">${esc(h.area)}</span>
      <div class="facts"><span>${icon.bed}${h.beds} beds</span><span>${icon.bath}${h.baths} baths</span><span>${icon.size}${h.sqft.toLocaleString()} sq ft</span></div>
    </div>
  </a>`;
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-save]");
  if (!b) return;
  e.preventDefault();
  const id = b.dataset.save, on = !saved.has(id);
  on ? saved.add(id) : saved.delete(id);
  keepSaved();
  b.setAttribute("aria-pressed", on);
  b.setAttribute("aria-label", b.getAttribute("aria-label").replace(on ? "Save to" : "Remove from", on ? "Remove from" : "Save to"));
  if (!on && filter.status === "saved") renderGrid();
});

/* reveal on scroll */
const io = "IntersectionObserver" in window && !calm
  ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), {rootMargin:"0px 0px -8% 0px"})
  : null;
const watch = () => $$(".rv:not(.in)").forEach(el => io ? io.observe(el) : el.classList.add("in"));

/* forms */
$$("form[data-form]").forEach(f => f.addEventListener("submit", async e => {
  e.preventDefault();
  let ok = true;
  $$("[required]", f).forEach(i => {
    const bad = !i.value.trim() || (i.type === "email" && !/^\S+@\S+\.\S+$/.test(i.value));
    i.setAttribute("aria-invalid", bad);
    if (bad && ok) { i.focus(); ok = false; }
  });
  if (!ok) return;
  const btn = $("button[type=submit]", f), label = btn.textContent;
  btn.disabled = true; btn.textContent = "Sending…";
  try {
    if (INBOX) {
      const data = Object.fromEntries(new FormData(f));
      data._subject = "Home Finder: " + f.dataset.form;
      const r = await fetch("https://formsubmit.co/ajax/" + INBOX, {method:"POST", headers:{"Content-Type":"application/json", Accept:"application/json"}, body:JSON.stringify(data)});
      if (!r.ok) throw 0;
    } else await new Promise(r => setTimeout(r, 700));
    f.classList.add("sent");
    f.nextElementSibling.focus?.();
  } catch {
    btn.textContent = "Try again";
    btn.disabled = false;
    return;
  }
  btn.textContent = label; btn.disabled = false;
}));
$$("form[data-form] [required]").forEach(i => i.addEventListener("input", () => i.removeAttribute("aria-invalid")));

/* ---------- home page ---------- */
const filter = {status:"", area:"", type:"", max:0, sort:"feat"};

function renderGrid() {
  const grid = $("#grid");
  if (!grid) return;
  let list = HOMES.filter(h =>
    (!filter.status || (filter.status === "saved" ? saved.has(h.id) : h.status === filter.status)) &&
    (!filter.area || h.area === filter.area) &&
    (!filter.type || h.type === filter.type) &&
    (!filter.max || h.price <= filter.max));
  const by = {low:(a,b)=>a.price-b.price, high:(a,b)=>b.price-a.price, size:(a,b)=>b.sqft-a.sqft};
  if (by[filter.sort]) list = [...list].sort(by[filter.sort]);
  if (grid.dataset.limit) list = list.filter(h => h.status !== "Sold").slice(0, +grid.dataset.limit);
  grid.innerHTML = list.length ? list.map(card).join("")
    : `<p class="empty">${filter.status === "saved" ? "No saved homes yet. Tap the heart on any home to keep it here." : "No homes match that search yet. Try widening it, or ask us: new homes come in every week."}</p>`;
  if (!$("#count")) return watch();
  const extra = [filter.area, filter.type, filter.max && "under " + shortMoney(filter.max)].filter(Boolean).join(", ");
  $("#count").textContent = `Showing ${list.length} of ${HOMES.length} homes${extra ? " · " + extra : ""}`;
  watch();
}

if ($("#grid")) {
  const q = new URLSearchParams(location.search);
  const sel = {area:"#f-area", type:"#f-type", max:"#f-max"};
  if ($("#f-area")) $("#f-area").insertAdjacentHTML("beforeend", areas.map(a => `<option>${a}</option>`).join(""));
  for (const k in sel) {
    if (q.get(k)) filter[k] = k === "max" ? +q.get(k) || 0 : q.get(k);
    const el = $(sel[k]);
    if (!el) continue;
    el.value = q.get(k) || "";
    el.addEventListener("change", () => {
      filter[k] = k === "max" ? +el.value || 0 : el.value;
      const p = new URLSearchParams(location.search);
      el.value ? p.set(k, el.value) : p.delete(k);
      history.replaceState(null, "", "?" + p);
      renderGrid();
    });
  }
  $$(".chip").forEach(c => c.addEventListener("click", () => {
    $$(".chip").forEach(x => x.setAttribute("aria-pressed", x === c));
    filter.status = c.dataset.status; renderGrid();
  }));
  $("#sort")?.addEventListener("change", e => { filter.sort = e.target.value; renderGrid(); });
  renderGrid();
}

if ($("#search")) {
  $("#s-area").insertAdjacentHTML("beforeend", areas.map(a => `<option>${a}</option>`).join(""));
  $("#c-home").insertAdjacentHTML("beforeend", HOMES.filter(h => h.status !== "Sold").map(h => `<option>${esc(h.name)}</option>`).join(""));
  /* the hero search sends people to the full homes page; drop the empty fields so the link stays tidy */
  $("#search").addEventListener("submit", e => {
    e.preventDefault();
    const p = new URLSearchParams([...new FormData(e.target)].filter(([, v]) => v));
    location.href = "homes.html" + (p.size ? "?" + p : "");
  });
}

if ($("#doors")) {
  /* "Step inside": each featured home sits behind an arched doorway that opens to full screen as you scroll */
  const feat = HOMES.filter(h => h.featured).sort((a, b) => a.featured - b.featured);
  const pad = n => String(n).padStart(2, "0");
  $("#doors").innerHTML = feat.map((h, i) => `
    <article class="door" aria-label="${esc(h.name)}">
      <div class="door-stage">
        <div class="door-img"><img src="images/${h.img}.webp" srcset="images/${h.img}-800.webp 800w, images/${h.img}.webp 1600w" sizes="100vw" alt="${esc(h.name)}: ${esc(h.line)}" loading="lazy"></div>
        <div class="door-shade"></div>
        <p class="door-num">${pad(i + 1)} <i>/ ${pad(feat.length)}</i></p>
        <div class="door-title" aria-hidden="true"><h3>${esc(h.name)}</h3><p>${esc(h.area)}</p></div>
        <div class="door-card">
          <p class="tag">${h.status} · ${esc(h.area)}</p>
          <h3>${esc(h.name)}</h3>
          <p class="line">${esc(h.line)}</p>
          <div class="specs"><div><b>${shortMoney(h.price)}</b><span>Price</span></div><div><b>${h.beds}</b><span>Beds</span></div><div><b>${h.baths}</b><span>Baths</span></div><div><b>${h.sqft.toLocaleString()}</b><span>Sq ft</span></div></div>
          <a class="btn" href="listing.html?id=${h.id}">Tour this home</a>
        </div>
        <div class="door-rail" aria-hidden="true">${feat.map((_, j) => `<i${j === i ? ' class="on"' : ""}></i>`).join("")}</div>
        ${i === 0 ? '<p class="door-hint" aria-hidden="true">Scroll to open</p>' : ""}
      </div>
    </article>`).join("");

  const doors = $$(".door");
  const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  function paint() {
    const H = innerHeight;
    doors.forEach(d => {
      const r = d.getBoundingClientRect();
      if (r.bottom < -50 || r.top > H + 50) return;
      const stage = d.firstElementChild, W = stage.clientWidth, SH = stage.clientHeight;
      const prog = calm ? 1 : clamp(-r.top / (d.offsetHeight - SH));
      const p = calm ? 1 : ease(clamp((prog - .04) / .56));
      const c = calm ? 1 : clamp((prog - .58) / .18);
      const aw = W < 700 ? W * .64 : Math.min(W * .34, 440);
      const top = SH * .17 * (1 - p), side = (W - aw) / 2 * (1 - p), bottom = SH * .23 * (1 - p), rad = aw / 2 * (1 - p);
      d.querySelector(".door-img").style.clipPath = `inset(${top}px ${side}px ${bottom}px ${side}px round ${rad}px ${rad}px 0 0)`;
      stage.style.setProperty("--zoom", 1.22 - .22 * p);
      stage.style.setProperty("--open", p.toFixed(3));
      stage.style.setProperty("--card", c.toFixed(3));
      d.querySelector(".door-card").classList.toggle("on", c > .5);
    });
  }
  let ticking = false;
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { paint(); ticking = false; }); } };
  paint();
  if (!calm) { addEventListener("scroll", queue, {passive:true}); addEventListener("resize", queue); }

  /* count the stats up once they come into view */
  if (io) {
    const co = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      co.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, suf = el.dataset.suffix || "", t0 = performance.now();
      const step = t => { const k = clamp((t - t0) / 2600); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }), {threshold:.6});
    $$("[data-count]").forEach(el => co.observe(el));
  }
}

/* reviews: one at a time on the homepage (arrows, counter, swipe), all of them on reviews.html */
const stars = '<div class="stars" aria-label="5 out of 5 stars">★★★★★</div>';
if ($("#revTrack")) {
  const list = REVIEWS.slice(0, 6), track = $("#revTrack"), count = $("#revCount");
  track.innerHTML = list.map((r, i) => `<figure class="trust-slide" aria-roledescription="slide" aria-label="${i + 1} of ${list.length}"${i ? ' aria-hidden="true"' : ""}>${stars}<blockquote>“${esc(r.text)}”</blockquote><figcaption><b>${esc(r.by)}</b>${esc(r.what)}</figcaption></figure>`).join("");
  const slides = $$(".trust-slide", track);
  let at = 0;
  const go = i => {
    at = (i + list.length) % list.length;
    track.style.transform = `translateX(-${at * 100}%)`;
    count.textContent = `${at + 1} / ${list.length}`;
    slides.forEach((s, j) => s.setAttribute("aria-hidden", j !== at));
  };
  $("#revPrev").addEventListener("click", () => go(at - 1));
  $("#revNext").addEventListener("click", () => go(at + 1));
  let startX = null;
  track.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, {passive:true});
  track.addEventListener("touchend", e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) go(dx < 0 ? at + 1 : at - 1);
    startX = null;
  }, {passive:true});
}
if ($("#allReviews")) {
  $("#allReviews").innerHTML = REVIEWS.map(r => `<figure class="quote rv" style="margin:0">${stars}<p>“${esc(r.text)}”</p><footer><b>${esc(r.by)}</b><br>${esc(r.what)}</footer></figure>`).join("");
}

/* ---------- listing page ---------- */
if ($("#detail")) {
  const id = new URLSearchParams(location.search).get("id");
  const h = HOMES.find(x => x.id === id) || HOMES[0];
  const pics = [h.img, ...h.gallery];
  document.title = `${h.name}, ${h.area} | Home Finder`;
  $("#crumb").textContent = h.name;
  $("#gallery").innerHTML = pics.slice(0, 3).map((p, i) =>
    `<button type="button" data-i="${i}" aria-label="Open photo ${i + 1} of ${pics.length}"><img src="images/${p}${i ? "-800" : ""}.webp" alt="${i ? "Inside " + esc(h.name) : esc(h.name) + ", " + esc(h.line)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>${i === 2 ? `<span class="more">View all ${pics.length} photos</span>` : ""}</button>`).join("");
  $("#d-name").textContent = h.name;
  $("#d-where").textContent = `${h.area} · ${h.type} · ${h.status}`;
  $("#d-price").textContent = money(h.price);
  $("#d-specs").innerHTML = [[h.beds,"Beds"],[h.baths,"Baths"],[h.sqft.toLocaleString(),"Sq ft"],[h.lot,"Lot"],[h.year,"Built"]].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join("");
  $("#d-about").textContent = h.about;
  $("#d-feats").innerHTML = h.features.map(f => `<li>${esc(f)}</li>`).join("");
  $("#t-home").value = h.name;
  $("#t-title").textContent = h.status === "Sold" ? "Sold, but ask us" : "Book a tour";
  const sv = $("#d-save");
  sv.dataset.save = h.id;
  sv.setAttribute("aria-pressed", saved.has(h.id));
  sv.setAttribute("aria-label", (saved.has(h.id) ? "Remove from" : "Save to") + " saved homes: " + h.name);
  sv.insertAdjacentHTML("afterbegin", icon.heart);

  /* lightbox */
  const lb = $("#lightbox"), lbImg = $("img", lb);
  let cur = 0, opener;
  const show = i => { cur = (i + pics.length) % pics.length; lbImg.src = `images/${pics[cur]}.webp`; lbImg.alt = `${h.name}, photo ${cur + 1} of ${pics.length}`; };
  const close = () => { lb.classList.remove("open"); opener?.focus(); };
  $$("#gallery button").forEach(b => b.addEventListener("click", () => { opener = b; show(+b.dataset.i); lb.classList.add("open"); $(".lb-close").focus(); }));
  $(".lb-close").addEventListener("click", close);
  $(".lb-prev").addEventListener("click", () => show(cur - 1));
  $(".lb-next").addEventListener("click", () => show(cur + 1));
  lb.addEventListener("click", e => { if (e.target === lb) close(); });
  addEventListener("keydown", e => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(cur - 1);
    if (e.key === "ArrowRight") show(cur + 1);
  });

  /* monthly payment estimate */
  const price = $("#m-price"), down = $("#m-down"), rate = $("#m-rate"), yrs = $("#m-yrs");
  price.value = h.price;
  const calc = () => {
    const loan = Math.max(0, +price.value * (1 - +down.value / 100)), r = +rate.value / 1200, n = +yrs.value * 12;
    const m = r ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n;
    $("#m-out").textContent = isFinite(m) ? money(Math.round(m)) : "–";
  };
  [price, down, rate, yrs].forEach(i => i.addEventListener("input", calc));
  calc();

  $("#similar").innerHTML = HOMES.filter(x => x.id !== h.id && x.status !== "Sold")
    .sort((a, b) => (b.area === h.area) - (a.area === h.area) || Math.abs(a.price - h.price) - Math.abs(b.price - h.price))
    .slice(0, 3).map(card).join("");
  watch();
}

watch();
