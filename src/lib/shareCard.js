/** A square "today" card (PNG) for sharing on WhatsApp and similar apps. */
export const SHARE_CARD_SIZE = 1080;

/** Mirrors the AQI tokens in styles.css; canvas cannot read CSS variables reliably. */
const TONES = {
  good: { fill: "#2f9a59", ink: "#ffffff" },
  moderate: { fill: "#e9b51c", ink: "#2b2100" },
  sensitive: { fill: "#e0702a", ink: "#ffffff" },
  unhealthy: { fill: "#d23f3b", ink: "#ffffff" },
  "very-unhealthy": { fill: "#8b3ea5", ink: "#ffffff" },
  hazardous: { fill: "#7a1f33", ink: "#ffffff" },
  neutral: { fill: "#8a958f", ink: "#ffffff" },
};
const FONT = "system-ui, 'Segoe UI', 'Noto Sans', 'Noto Sans Devanagari', 'Mangal', sans-serif";

export function toneColors(tone) {
  return TONES[tone] ?? TONES.neutral;
}

/** Plain-text version of the card, for share targets that don't take images. */
export function shareText({ title, aqi, unit, category, headline, lines = [], footer, url }) {
  return [
    `${title}: ${aqi ?? "—"} ${unit} · ${category}`,
    headline,
    ...lines,
    footer,
    url,
  ].filter(Boolean).join("\n");
}

/** Splits `text` into lines that fit `maxWidth` with the context's current font. */
export function wrapLines(ctx, text, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** Draws the card onto a 2D context. Every string arrives already translated. */
export function drawShareCard(ctx, data) {
  const size = SHARE_CARD_SIZE;
  const pad = 80;
  const width = size - pad * 2;
  const tone = toneColors(data.tone);

  ctx.fillStyle = "#f7f9f6";
  ctx.fillRect(0, 0, size, size);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#1f5c40";
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(data.brand ?? "airwise.", pad, 130);
  ctx.textAlign = "right";
  ctx.fillStyle = "#64716a";
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(data.date ?? "", size - pad, 128);

  ctx.textAlign = "left";
  ctx.fillStyle = "#16201b";
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText(wrapLines(ctx, data.title, width)[0] ?? "", pad, 225);

  roundedRect(ctx, pad, 265, width, 330, 36);
  ctx.fillStyle = tone.fill;
  ctx.fill();
  ctx.fillStyle = tone.ink;
  ctx.font = `800 210px ${FONT}`;
  const aqiText = data.aqi == null ? "—" : String(data.aqi);
  ctx.fillText(aqiText, pad + 50, 510);
  const textX = pad + 80 + ctx.measureText(aqiText).width;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(data.unit ?? "US AQI", textX, 400);
  ctx.font = `800 52px ${FONT}`;
  wrapLines(ctx, data.category, size - pad - 50 - textX).slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, textX, 470 + index * 60);
  });

  let y = 685;
  ctx.fillStyle = "#16201b";
  ctx.font = `700 46px ${FONT}`;
  wrapLines(ctx, data.headline, width).slice(0, 2).forEach((line) => {
    ctx.fillText(line, pad, y);
    y += 58;
  });

  y += 18;
  ctx.fillStyle = "#43514a";
  ctx.font = `500 34px ${FONT}`;
  (data.lines ?? []).slice(0, 3).forEach((text) => {
    wrapLines(ctx, text, width).slice(0, 2).forEach((line) => {
      ctx.fillText(line, pad, y);
      y += 46;
    });
  });

  ctx.fillStyle = "#64716a";
  ctx.font = `500 25px ${FONT}`;
  const footerLines = wrapLines(ctx, data.footer, width).slice(0, 2);
  footerLines.forEach((line, index) => {
    ctx.fillText(line, pad, size - 70 - (footerLines.length - 1 - index) * 34);
  });
}

/** Renders the card to a PNG blob, or null where canvas is unavailable. */
export async function createShareCardBlob(data, doc = document) {
  const canvas = doc.createElement("canvas");
  canvas.width = SHARE_CARD_SIZE;
  canvas.height = SHARE_CARD_SIZE;
  let ctx = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx || typeof canvas.toBlob !== "function") return null;
  drawShareCard(ctx, data);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export function shareFileName(title) {
  const slug = String(title ?? "air").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "air";
  return `airwise-${slug}.png`;
}

/**
 * Shares the card as an image where the browser supports it, otherwise downloads it,
 * and falls back to sharing or copying text. Resolves to what happened.
 */
export async function shareSnapshot(data, { nav = navigator, doc = document, createBlob = createShareCardBlob } = {}) {
  const text = shareText(data);
  try {
    const blob = await createBlob(data, doc);
    if (blob) {
      const name = shareFileName(data.title);
      const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
      if (file && nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: data.title, text });
        return "shared";
      }
      const url = URL.createObjectURL(blob);
      const link = doc.createElement("a");
      link.href = url;
      link.download = name;
      doc.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return "downloaded";
    }
    if (nav.share) {
      await nav.share({ title: data.title, text });
      return "shared";
    }
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return "copied";
    }
    return "unavailable";
  } catch (error) {
    return error?.name === "AbortError" ? "cancelled" : "failed";
  }
}
