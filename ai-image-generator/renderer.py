import asyncio
import os
import re
import uuid
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

CTA_VALIDATION_JS = """
function checkCTA() {
  const cta = document.querySelector('[data-cta], button, .cta, [role="button"]');
  if (!cta) return { valid: false, reason: "No CTA found", visible: false };
  const rect = cta.getBoundingClientRect();
  return {
    valid: rect.width >= 120 && rect.height >= 44,
    visible: rect.width > 0 && rect.height > 0,
    size: { w: rect.width, h: rect.height }
  };
}
"""

ASSET_VALIDATION_JS = """
function checkVisualAssets() {
  const icon = document.querySelector('[data-lucide-icon]');
  const logo = document.querySelector('[data-brand-logo], [data-logo], img[alt*="logo" i], img[class*="logo" i], img[src*="logo" i]');
  const illustration = document.querySelector('[data-undraw-illustration]');
  const iconRect = icon ? icon.getBoundingClientRect() : null;
  const logoRect = logo ? logo.getBoundingClientRect() : null;
  const illustrationRect = illustration ? illustration.getBoundingClientRect() : null;
  const iconVisible = !!iconRect && iconRect.width > 0 && iconRect.height > 0;
  const logoVisible = !!logoRect && logoRect.width > 0 && logoRect.height > 0;
  const illustrationVisible = !!illustrationRect && illustrationRect.width > 0 && illustrationRect.height > 0;
  const supportingVisualVisible = logoVisible || illustrationVisible;
  return {
    valid: iconVisible && supportingVisualVisible,
    hasIcon: !!icon,
    hasLogo: !!logo,
    hasIllustration: !!illustration,
    iconVisible,
    logoVisible,
    illustrationVisible,
    iconName: icon ? icon.getAttribute('data-lucide-icon') : null,
    logoSource: logo ? logo.getAttribute('src') : null,
    illustrationName: illustration ? illustration.getAttribute('data-undraw-illustration') : null
  };
}
"""

TEXT_OVERFLOW_VALIDATION_JS = """
function checkTextOverflow() {
  const candidates = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,[data-cta],button,a"));
  const offenders = [];
  for (const node of candidates) {
    if (!(node instanceof HTMLElement)) continue;
    const text = (node.textContent || "").trim();
    if (!text) continue;
    const overX = node.scrollWidth > node.clientWidth + 1;
    const overY = node.scrollHeight > node.clientHeight + 1;
    if (overX || overY) {
      offenders.push({
        tag: node.tagName.toLowerCase(),
        className: node.className || "",
        overX,
        overY
      });
    }
    if (offenders.length >= 10) break;
  }
  return { valid: offenders.length === 0, overflowCount: offenders.length, offenders };
}
"""

SAFE_ZONE_VALIDATION_JS = """
function checkSafeZone() {
  const margin = 48;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const elements = Array.from(
    document.querySelectorAll("h1,h2,h3,h4,p,[data-cta],button,[data-brand-logo],[data-undraw-illustration],[data-lucide-icon]")
  );
  const violations = [];
  for (const node of elements) {
    if (!(node instanceof HTMLElement)) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (
      rect.left < margin ||
      rect.top < margin ||
      rect.right > width - margin ||
      rect.bottom > height - margin
    ) {
      violations.push({
        tag: node.tagName.toLowerCase(),
        className: node.className || "",
        box: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
      });
    }
    if (violations.length >= 10) break;
  }
  return { valid: violations.length === 0, margin, violations };
}
"""

CONTRAST_VALIDATION_JS = """
function _parseRgb(input) {
  if (!input) return null;
  const value = String(input).trim().toLowerCase();
  if (value === "transparent") return null;
  const rgbMatch = value.match(/^rgba?\\(([^)]+)\\)$/);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1].split(",").map((p) => Number.parseFloat(p.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
}

function _luminance(c) {
  const ch = [c.r, c.g, c.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function _contrastRatio(fg, bg) {
  const l1 = _luminance(fg);
  const l2 = _luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function _findBackground(node) {
  let current = node;
  while (current && current instanceof HTMLElement) {
    const bg = _parseRgb(window.getComputedStyle(current).backgroundColor);
    if (bg && bg.a > 0.5) return bg;
    current = current.parentElement;
  }
  const bodyBg = _parseRgb(window.getComputedStyle(document.body).backgroundColor);
  return bodyBg || { r: 255, g: 255, b: 255, a: 1 };
}

function checkContrast() {
  const nodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,[data-cta],button,a"));
  const failures = [];
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const text = (node.textContent || "").trim();
    if (text.length < 3) continue;
    const style = window.getComputedStyle(node);
    const fg = _parseRgb(style.color);
    if (!fg) continue;
    const bg = _findBackground(node);
    const ratio = _contrastRatio(fg, bg);
    const fontSize = Number.parseFloat(style.fontSize || "16");
    const fontWeight = Number.parseInt(style.fontWeight || "400", 10);
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const required = isLarge ? 3.0 : 4.5;
    if (ratio < required) {
      failures.push({
        tag: node.tagName.toLowerCase(),
        className: node.className || "",
        ratio,
        required
      });
    }
    if (failures.length >= 10) break;
  }
  return { valid: failures.length === 0, failures };
}
"""

VARIABLE_FONT_IMPORT_QUERIES = [
    "family=Inter:opsz,wght@14..32,100..900",
    "family=Roboto+Flex:opsz,wght@8..144,100..1000",
    "family=Space+Grotesk:wght@300..700",
    "family=Manrope:wght@200..800",
]

FORMAT_CONSTRAINTS_JS = """
(params) => {
  const width = Number(params?.width) || window.innerWidth;
  const height = Number(params?.height) || window.innerHeight;
  const maxHeadlineLines = Number(params?.maxHeadlineLines) || 2;
  const maxBodyLines = Number(params?.maxBodyLines) || 3;
  const minFontPx = Number(params?.minFontPx) || 14;

  document.documentElement.style.width = `${width}px`;
  document.documentElement.style.height = `${height}px`;
  document.body.style.width = `${width}px`;
  document.body.style.height = `${height}px`;
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";
  document.body.style.position = "relative";

  const allElements = Array.from(document.querySelectorAll("*"));
  for (const node of allElements) {
    if (!(node instanceof HTMLElement)) continue;
    node.style.boxSizing = "border-box";
    node.style.maxWidth = "100%";
    node.style.overflowWrap = "anywhere";
    node.style.wordBreak = "break-word";
  }

  const textNodes = Array.from(
    document.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,[data-cta],button,a")
  );
  for (const node of textNodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (!node.textContent || !node.textContent.trim()) continue;

    const isHeading = /^H[1-4]$/.test(node.tagName);
    const maxLines = isHeading ? maxHeadlineLines : maxBodyLines;
    if (node.childElementCount === 0) {
      node.style.overflow = "hidden";
      node.style.display = "-webkit-box";
      node.style.webkitBoxOrient = "vertical";
      node.style.webkitLineClamp = String(maxLines);
    }

    let guard = 0;
    while (
      guard < 10 &&
      (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
    ) {
      const current = Number.parseFloat(window.getComputedStyle(node).fontSize || "16");
      if (!Number.isFinite(current) || current <= minFontPx) {
        break;
      }
      node.style.fontSize = `${Math.max(minFontPx, current - 1)}px`;
      guard += 1;
    }
  }

  let scale = 1;
  document.body.style.transformOrigin = "top left";
  for (let i = 0; i < 8; i += 1) {
    const rect = document.body.getBoundingClientRect();
    const overflowX = Math.max(0, rect.right - width, -rect.left);
    const overflowY = Math.max(0, rect.bottom - height, -rect.top);
    if (overflowX <= 0.5 && overflowY <= 0.5) {
      break;
    }
    scale = Math.max(0.72, scale - 0.04);
    document.body.style.transform = `scale(${scale})`;
  }
}
"""


def _format_text_policy(width: int, height: int) -> dict[str, int]:
    if width == 1080 and height == 1350:
        return {
            "width": width,
            "height": height,
            "maxHeadlineLines": 3,
            "maxBodyLines": 4,
            "minFontPx": 16,
        }
    return {
        "width": width,
        "height": height,
        "maxHeadlineLines": 2,
        "maxBodyLines": 3,
        "minFontPx": 15,
    }


def _inject_brand_tokens(
    raw_html: str,
    brand_kit: Any,
    width: int,
    height: int,
    procedural_background: dict[str, Any] | None = None,
) -> str:
    colors = getattr(brand_kit, "colors", {}) or {}
    fonts = getattr(brand_kit, "fonts", {}) or {}
    heading_font = str(fonts.get("heading", "Inter")).strip() or "Inter"
    body_font = str(fonts.get("body", "Inter")).strip() or "Inter"
    css_var_parts = [
        f"--{name}: {value}"
        for name, value in colors.items()
        if isinstance(value, str) and value.strip()
    ]
    css_var_parts.append(f"--heading-font: '{heading_font}'")
    css_var_parts.append(f"--body-font: '{body_font}'")
    css_vars = "; ".join(css_var_parts)

    import_statements: list[str] = [
        f"@import url('https://fonts.googleapis.com/css2?{query}&display=swap');"
        for query in VARIABLE_FONT_IMPORT_QUERIES
    ]
    import_statements.extend(
        [
            f"@import url('https://fonts.googleapis.com/css2?family={font.replace(' ', '+')}:wght@400;600;700;800&display=swap');"
            for font in fonts.values()
            if isinstance(font, str) and font.strip()
        ]
    )
    deduped_imports: list[str] = []
    seen: set[str] = set()
    for statement in import_statements:
        if statement in seen:
            continue
        deduped_imports.append(statement)
        seen.add(statement)
    imports = "".join(deduped_imports)
    texture_data_uri = ""
    texture_opacity = 0.3
    if isinstance(procedural_background, dict):
        texture_data_uri = str(procedural_background.get("svgDataUri", "")).strip()
        try:
            texture_opacity = max(
                0.0,
                min(1.0, float(procedural_background.get("textureOpacity", texture_opacity))),
            )
        except (TypeError, ValueError):
            texture_opacity = 0.3

    procedural_css = ""
    if texture_data_uri:
        escaped_texture_uri = texture_data_uri.replace("\\", "\\\\").replace('"', '\\"')
        overlay_opacity = max(0.08, min(0.22, texture_opacity * 0.55))
        procedural_css = (
            "body{position:relative;isolation:isolate;}"
            "body::before{content:'';position:fixed;inset:0;z-index:0;"
            f'background-image:url("{escaped_texture_uri}");'
            "background-repeat:no-repeat;background-position:center;background-size:cover;"
            f"opacity:{texture_opacity:.3f};mix-blend-mode:normal;pointer-events:none;"
            "}"
            "body::after{content:'';position:fixed;inset:0;z-index:2147483646;"
            f'background-image:url("{escaped_texture_uri}");'
            "background-repeat:no-repeat;background-position:center;background-size:cover;"
            f"opacity:{overlay_opacity:.3f};mix-blend-mode:soft-light;pointer-events:none;"
            "}"
            "body>*{position:relative;z-index:1;}"
        )

    theme_style = (
        f"<style>{imports}:root {{{css_vars}}}"
        f"html,body{{width:{width}px;height:{height}px;margin:0;padding:0;overflow:hidden;}}"
        "body{font-family:var(--body-font,'Inter'),sans-serif;font-optical-sizing:auto;}"
        "*,*::before,*::after{box-sizing:border-box;}"
        "h1,h2,h3,h4,p,li,blockquote,span,a,button{max-width:100%;overflow-wrap:anywhere;word-break:break-word;}"
        f"{procedural_css}"
        "</style>"
    )
    if re.search(r"</head>", raw_html, flags=re.IGNORECASE):
        return re.sub(r"</head>", f"{theme_style}</head>", raw_html, count=1, flags=re.IGNORECASE)
    html_open_match = re.search(r"<html\b[^>]*>", raw_html, flags=re.IGNORECASE)
    if html_open_match:
        html_open = html_open_match.group(0)
        replacement = f"{html_open}<head>{theme_style}</head>"
        return raw_html[: html_open_match.start()] + replacement + raw_html[html_open_match.end() :]
    return f"<html><head>{theme_style}</head><body>{raw_html}</body></html>"


async def render_and_validate(
    htmls: list[str],
    brand_kit: Any,
    format_str: str,
    procedural_backgrounds: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    try:
        width, height = [int(part) for part in format_str.split("x", 1)]
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid format string: {format_str}")

    output_dir = Path(os.getenv("RENDER_OUTPUT_DIR", "output"))
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    validations: list[dict[str, Any]] = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": width, "height": height})
        render_concurrency = max(1, int(os.getenv("RENDER_CONCURRENCY", "3")))
        semaphore = asyncio.Semaphore(render_concurrency)

        try:
            async def render_variant(index: int, html: str) -> tuple[str, dict[str, Any]]:
                async with semaphore:
                    page = await context.new_page()
                    try:
                        procedural_background = (
                            procedural_backgrounds[index]
                            if procedural_backgrounds and index < len(procedural_backgrounds)
                            else None
                        )
                        final_html = _inject_brand_tokens(
                            html,
                            brand_kit,
                            width,
                            height,
                            procedural_background=procedural_background,
                        )
                        await page.set_content(final_html, wait_until="networkidle")
                        await page.evaluate(FORMAT_CONSTRAINTS_JS, _format_text_policy(width, height))
                        cta_result = await page.evaluate(
                            f"(() => {{ {CTA_VALIDATION_JS} return checkCTA(); }})()"
                        )
                        assets_result = await page.evaluate(
                            f"(() => {{ {ASSET_VALIDATION_JS} return checkVisualAssets(); }})()"
                        )
                        overflow_result = await page.evaluate(
                            f"(() => {{ {TEXT_OVERFLOW_VALIDATION_JS} return checkTextOverflow(); }})()"
                        )
                        safe_zone_result = await page.evaluate(
                            f"(() => {{ {SAFE_ZONE_VALIDATION_JS} return checkSafeZone(); }})()"
                        )
                        contrast_result = await page.evaluate(
                            f"(() => {{ {CONTRAST_VALIDATION_JS} return checkContrast(); }})()"
                        )

                        filename = f"variant_{index}_{uuid.uuid4().hex}.png"
                        destination = output_dir / filename
                        await page.screenshot(path=str(destination), full_page=False)

                        file_size_warning = destination.stat().st_size > 5 * 1024 * 1024
                        return (
                            str(destination),
                            {
                                "variant": index,
                                "cta": cta_result,
                                "visual_assets": assets_result,
                                "text_overflow": overflow_result,
                                "safe_zone": safe_zone_result,
                                "contrast": contrast_result,
                                "file_size_warning": file_size_warning,
                            },
                        )
                    finally:
                        await page.close()

            rendered_variants = await asyncio.gather(
                *(render_variant(index, html) for index, html in enumerate(htmls))
            )
            for destination, validation in rendered_variants:
                paths.append(destination)
                validations.append(validation)
        finally:
            await browser.close()

    return {"paths": paths, "validations": validations}
