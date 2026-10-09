// Tiny SVG drawing helpers used to build the guide's diagrams in code.
export const COLORS = {
  blue: { f: "#eef2ff", s: "#6366f1", t: "#312e81" },
  green: { f: "#ecfdf5", s: "#10b981", t: "#064e3b" },
  amber: { f: "#fffbeb", s: "#f59e0b", t: "#78350f" },
  red: { f: "#fef2f2", s: "#ef4444", t: "#7f1d1d" },
  slate: { f: "#f8fafc", s: "#94a3b8", t: "#1e293b" },
  violet: { f: "#f5f3ff", s: "#8b5cf6", t: "#4c1d95" },
  cyan: { f: "#ecfeff", s: "#06b6d4", t: "#164e63" },
  pink: { f: "#fdf2f8", s: "#ec4899", t: "#831843" },
  white: { f: "#ffffff", s: "#cbd5e1", t: "#1e293b" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function svg(w, h, body, caption) {
  const fig = `<svg class="diagram" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
<defs>
<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker>
<marker id="ahr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#dc2626"/></marker>
<marker id="ahg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#059669"/></marker>
</defs>${body}</svg>`;
  return `<figure>${fig}${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
}

export function text(x, y, str, { size = 12, weight = 400, anchor = "middle", color = "#334155", italic = false } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}" xml:space="preserve"${italic ? ' font-style="italic"' : ""}>${esc(str)}</text>`;
}

/** Rounded box with a bold title and optional smaller lines, vertically centered. */
export function box(x, y, w, h, title, lines = [], { color = "blue", size = 11.5, titleSize = 14, rx = 10, dashed = false, align = "middle", fill } = {}) {
  const c = COLORS[color];
  const lh = size * 1.38;
  const total = (title ? titleSize * 1.25 : 0) + lines.length * lh;
  let cy = y + (h - total) / 2 + (title ? titleSize : size);
  const tx = align === "start" ? x + 12 : x + w / 2;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill ?? c.f}" stroke="${c.s}" stroke-width="1.6"${dashed ? ' stroke-dasharray="6 4"' : ""}/>`;
  if (title) {
    out += text(tx, cy, title, { size: titleSize, weight: 700, color: c.t, anchor: align });
    cy += titleSize * 0.25 + lh;
  }
  for (const l of lines) {
    out += text(tx, cy, l, { size, color: "#334155", anchor: align });
    cy += lh;
  }
  return out;
}

/** Database cylinder. */
export function cylinder(x, y, w, h, title, lines = [], { color = "green" } = {}) {
  const c = COLORS[color];
  const ry = 12;
  let out = `<path d="M${x},${y + ry} v${h - 2 * ry} a${w / 2},${ry} 0 0 0 ${w},0 v${-(h - 2 * ry)}" fill="${c.f}" stroke="${c.s}" stroke-width="1.6"/>`;
  out += `<ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="${c.f}" stroke="${c.s}" stroke-width="1.6"/>`;
  let cy = y + ry * 2 + 18;
  out += text(x + w / 2, cy, title, { size: 14, weight: 700, color: c.t });
  for (const l of lines) {
    cy += 16;
    out += text(x + w / 2, cy, l, { size: 11.5 });
  }
  return out;
}

function label(x, y, str, color = "#475569", size = 11) {
  if (!str) return "";
  const w = String(str).length * size * 0.56 + 10;
  return `<rect x="${x - w / 2}" y="${y - size + 1}" width="${w}" height="${size + 6}" rx="4" fill="#ffffff" opacity="0.92"/>` + text(x, y + 2, str, { size, color });
}

export function arrow(x1, y1, x2, y2, { lbl, dashed = false, color = "slate", dx = 0, dy = 0, both = false } = {}) {
  const stroke = color === "red" ? "#dc2626" : color === "green" ? "#059669" : "#475569";
  const m = color === "red" ? "ahr" : color === "green" ? "ahg" : "ah";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#${m})"${both ? ` marker-start="url(#${m})"` : ""}/>` +
    label((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, lbl, stroke);
}

/** Poly-line arrow through points [[x,y],...]; label at segment `at`. */
export function path(points, { lbl, dashed = false, color = "slate", at = 0, dx = 0, dy = 0 } = {}) {
  const stroke = color === "red" ? "#dc2626" : color === "green" ? "#059669" : "#475569";
  const m = color === "red" ? "ahr" : color === "green" ? "ahg" : "ah";
  const d = points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const [a, b] = [points[at], points[at + 1] ?? points[at]];
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#${m})"/>` +
    label((a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy, lbl, stroke);
}

/** Curved arrow (quadratic) - used by the state machine. */
export function curve(x1, y1, cx, cy, x2, y2, { lbl, color = "slate", dashed = false, lx, ly } = {}) {
  const stroke = color === "red" ? "#dc2626" : color === "green" ? "#059669" : "#475569";
  const m = color === "red" ? "ahr" : color === "green" ? "ahg" : "ah";
  const mx = lx ?? 0.25 * x1 + 0.5 * cx + 0.25 * x2;
  const my = ly ?? 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  return `<path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="${stroke}" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#${m})"/>` + label(mx, my, lbl, stroke);
}

export function circle(cx, cy, r, title, sub, color = "blue") {
  const c = COLORS[color];
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.f}" stroke="${c.s}" stroke-width="2"/>` +
    text(cx, sub ? cy - 2 : cy + 5, title, { size: 13, weight: 700, color: c.t }) + (sub ? text(cx, cy + 14, sub, { size: 10 }) : "");
}

/** Group frame with a tab label. */
export function frame(x, y, w, h, title, color = "slate", tabX = 14) {
  const c = COLORS[color];
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="none" stroke="${c.s}" stroke-width="1.4" stroke-dasharray="7 5"/>` +
    `<rect x="${x + tabX}" y="${y - 11}" width="${title.length * 7.2 + 18}" height="22" rx="6" fill="${c.s}"/>` +
    text(x + tabX + 9, y + 4, title, { size: 12, weight: 700, color: "#ffffff", anchor: "start" });
}

export function chevron(x, y, w, h, n, title, sub, color = "blue") {
  const c = COLORS[color];
  const t = 16;
  const d = `M${x},${y} L${x + w - t},${y} L${x + w},${y + h / 2} L${x + w - t},${y + h} L${x},${y + h} L${x + t},${y + h / 2} Z`;
  return `<path d="${d}" fill="${c.f}" stroke="${c.s}" stroke-width="1.6"/>` +
    `<circle cx="${x + t + 14}" cy="${y + 16}" r="10" fill="${c.s}"/>` + text(x + t + 14, y + 20, n, { size: 11, weight: 700, color: "#fff" }) +
    text(x + w / 2 + 6, y + h / 2 + 2, title, { size: 13, weight: 700, color: c.t }) +
    text(x + w / 2 + 6, y + h / 2 + 19, sub, { size: 10.5 });
}
