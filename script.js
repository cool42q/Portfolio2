/* ==========================================================
   script-v2.js — alternative to script.js (drop-in replacement)
   Different approach: small modules + new features:
   typing headline, cursor glow, magnetic buttons, gallery
   lightbox, toast notifications, back-to-top, keyboard nav.
   Use it by changing the last line of index.html to:
   <script src="script-v2.js"></script>
   ========================================================== */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Injected styles for the new features ---------- */
(function injectStyles() {
  const css = `
    .cursor-glow{position:fixed;width:320px;height:320px;border-radius:50%;pointer-events:none;z-index:1;
      background:radial-gradient(circle,color-mix(in srgb,var(--accent) 22%,transparent),transparent 65%);
      transform:translate(-50%,-50%);opacity:0;transition:opacity .3s}
    .caret{display:inline-block;width:2px;height:1em;margin-left:3px;background:var(--accent);vertical-align:-0.12em;animation:blink 1s steps(1) infinite}
    @keyframes blink{50%{opacity:0}}
    .lightbox{position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:rgba(0,0,0,.88);
      opacity:0;pointer-events:none;transition:opacity .3s;padding:1rem}
    .lightbox.open{opacity:1;pointer-events:auto}
    .lightbox img{max-width:min(92vw,900px);max-height:86vh;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
    .lightbox button{position:absolute;top:1rem;right:1.2rem;font-size:2rem;color:#fff;width:48px;height:48px}
    .toast{position:fixed;left:50%;bottom:1.5rem;z-index:300;transform:translate(-50%,120%);padding:.9rem 1.4rem;border-radius:14px;
      background:var(--surface);color:var(--text);border:1px solid var(--line);box-shadow:var(--shadow);transition:transform .4s cubic-bezier(.2,.8,.2,1);max-width:90vw}
    .toast.show{transform:translate(-50%,0)}
    .toast.ok{border-color:var(--accent)} .toast.err{border-color:#ff6b6b}
    .totop{position:fixed;right:1.2rem;bottom:1.2rem;z-index:80;width:46px;height:46px;border-radius:50%;
      background:var(--accent);color:var(--accent-ink);font-size:1.2rem;transform:scale(0);transition:transform .3s}
    .totop.show{transform:scale(1)}
    .g{cursor:zoom-in}
  `;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
})();

/* ---------- Toast helper ---------- */
const Toast = (() => {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  document.body.appendChild(el);
  let t;
  return (text, type = "ok") => {
    el.textContent = text;
    el.className = `toast show ${type}`;
    clearTimeout(t);
    t = setTimeout(() => el.classList.remove("show"), 3500);
  };
})();

/* ---------- Modules ---------- */
const Theme = {
  init() {
    const root = document.documentElement;
    const saved = store.get("theme");
    const preferred = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    root.dataset.theme = saved || preferred;
    $("#themeToggle")?.addEventListener("click", () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = next;
      store.set("theme", next);
      Toast(`${next[0].toUpperCase() + next.slice(1)} mode on`);
    });
  },
};

const Menu = {
  init() {
    const burger = $("#burger"), links = $("#navLinks");
    if (!burger || !links) return;
    const set = (open) => {
      links.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", () => set(!links.classList.contains("open")));
    links.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  },
};

const ScrollFX = {
  init() {
    const nav = $("#nav"), bar = $("#progress");
    const sections = $$("main section[id]");
    const anchors = $$("#navLinks a[href^='#']");
    const totop = Object.assign(document.createElement("button"), { className: "totop", textContent: "↑", ariaLabel: "Back to top" });
    totop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
    document.body.appendChild(totop);

    // Highlight the section currently in view
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          anchors.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => spy.observe(s));

    let ticking = false;
    const update = () => {
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      nav?.classList.toggle("scrolled", y > 30);
      totop.classList.toggle("show", y > 600);
      if (bar) bar.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
      ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  },
};

const Reveal = {
  init() {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        if (e.target.matches(".skills")) e.target.classList.add("in");
        obs.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    $$(".reveal, .skills").forEach((el, i) => {
      if (el.classList.contains("reveal")) el.style.transitionDelay = `${(i % 5) * 80}ms`;
      io.observe(el);
    });

    // Count-up with easeOutExpo
    const ease = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const counter = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target, end = Number(el.dataset.count), start = performance.now(), dur = 1600;
        (function frame(now) {
          const p = Math.min((now - start) / dur, 1);
          el.textContent = Math.round(end * ease(p));
          if (p < 1) requestAnimationFrame(frame);
        })(start);
        obs.unobserve(el);
      });
    }, { threshold: 0.6 });
    $$("[data-count]").forEach((el) => counter.observe(el));
  },
};

const Typing = {
  init() {
    const target = $(".hero .eyebrow");
    if (!target) return;
    const words = ["Creative", "Designer", "Developer", "Storyteller"];
    const fixed = "I'm a ";
    const caret = document.createElement("span");
    caret.className = "caret";
    if (reduceMotion) { target.textContent = fixed + words[0]; return; }
    let w = 0, c = 0, deleting = false;
    const tick = () => {
      const word = words[w];
      c += deleting ? -1 : 1;
      target.textContent = fixed + word.slice(0, c);
      target.appendChild(caret);
      let delay = deleting ? 55 : 110;
      if (!deleting && c === word.length) { deleting = true; delay = 1400; }
      else if (deleting && c === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
      setTimeout(tick, delay);
    };
    tick();
  },
};

const Pointer = {
  init() {
    if (!matchMedia("(hover: hover)").matches || reduceMotion) return;

    // Soft glow that follows the cursor
    const glow = Object.assign(document.createElement("div"), { className: "cursor-glow" });
    document.body.appendChild(glow);
    let x = 0, y = 0, gx = 0, gy = 0;
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; glow.style.opacity = 1; });
    (function follow() {
      gx += (x - gx) * 0.12; gy += (y - gy) * 0.12;
      glow.style.left = gx + "px"; glow.style.top = gy + "px";
      requestAnimationFrame(follow);
    })();

    // Magnetic buttons
    $$(".btn").forEach((b) => {
      b.addEventListener("mousemove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      b.addEventListener("mouseleave", () => { b.style.transform = ""; });
    });

    // Parallax photo (follows mouse, subtle)
    const wrap = $("#tilt"), frame = $(".photo-frame");
    wrap?.addEventListener("mousemove", (e) => {
      const r = wrap.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      frame.style.transform = `rotateY(${px * 12}deg) rotateX(${-py * 12}deg) scale(1.02)`;
    });
    wrap?.addEventListener("mouseleave", () => { frame.style.transform = ""; });
  },
};

const Projects = {
  init() {
    const filters = $("#filters");
    if (!filters) return;
    const cards = $$(".card");
    filters.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      $$(".chip", filters).forEach((c) => c.classList.toggle("active", c === chip));
      const f = chip.dataset.filter;
      let shown = 0;
      cards.forEach((card) => {
        const match = f === "all" || card.dataset.cat === f;
        card.classList.toggle("hide", !match);
        if (match) shown++;
      });
      Toast(`${shown} project${shown === 1 ? "" : "s"} shown`);
    });
  },
};

const Lightbox = {
  init() {
    const figures = $$(".gallery .g");
    if (!figures.length) return;
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<button aria-label="Close">×</button><img alt="" />`;
    document.body.appendChild(box);
    const img = $("img", box);
    const close = () => box.classList.remove("open");
    figures.forEach((fig) => fig.addEventListener("click", () => {
      const src = $("img", fig);
      img.src = src.src; img.alt = src.alt;
      box.classList.add("open");
    }));
    box.addEventListener("click", (e) => { if (e.target !== img) close(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  },
};

const ContactForm = {
  init() {
    const form = $("#contactForm"), note = $("#formMsg");
    if (!form) return;
    const rules = {
      name: (v) => v.trim().length >= 2 || "Please enter your name.",
      email: (v) => /^\S+@\S+\.\S+$/.test(v) || "Enter a valid email address.",
      message: (v) => v.trim().length >= 10 || "Message should be at least 10 characters.",
    };
    const check = (field) => {
      const result = rules[field.name]?.(field.value);
      field.classList.toggle("invalid", result !== true);
      return result === true ? null : result;
    };
    $$("input, textarea", form).forEach((f) => f.addEventListener("blur", () => check(f)));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const errors = $$("input, textarea", form).map(check).filter(Boolean);
      if (errors.length) { note.textContent = ""; return Toast(errors[0], "err"); }
      // TODO: send to your backend / Formspree here with fetch()
      Toast("Message ready! Connect a form service to deliver it.");
      form.reset();
    });
  },
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  [Theme, Menu, ScrollFX, Reveal, Typing, Pointer, Projects, Lightbox, ContactForm].forEach((m) => m.init());
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
});
