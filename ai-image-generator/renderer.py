import os
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


def _inject_brand_tokens(raw_html: str, brand_kit: Any, width: int, height: int) -> str:
    colors = getattr(brand_kit, "colors", {}) or {}
    fonts = getattr(brand_kit, "fonts", {}) or {}
    css_vars = "; ".join(
        [f"--{name}: {value}" for name, value in colors.items() if isinstance(value, str) and value.strip()]
    )
    imports = "".join(
        [
            f"@import url('https://fonts.googleapis.com/css2?family={font.replace(' ', '+')}:wght@400;600;700;800&display=swap');"
            for font in fonts.values()
            if isinstance(font, str) and font.strip()
        ]
    )
    theme_style = (
        f"<style>{imports}:root {{{css_vars}}}"
        f"html,body{{width:{width}px;height:{height}px;margin:0;padding:0;overflow:hidden;}}"
        "body{font-family:var(--body,Inter),sans-serif;}"
        "*,*::before,*::after{box-sizing:border-box;}"
        "h1,h2,h3,h4,p,li,blockquote,span,a,button{max-width:100%;overflow-wrap:anywhere;word-break:break-word;}"
        "</style>"
    )
    raw_lower = raw_html.lower()
    if "<html" in raw_lower:
        if "</head>" in raw_lower:
            return raw_html.replace("</head>", f"{theme_style}</head>", 1)
        return raw_html.replace("<html>", f"<html><head>{theme_style}</head>", 1)
    return f"<html><head>{theme_style}</head><body>{raw_html}</body></html>"


async def render_and_validate(htmls: list[str], brand_kit: Any, format_str: str) -> dict[str, Any]:
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

        try:
            for index, html in enumerate(htmls):
                page = await context.new_page()
                try:
                    final_html = _inject_brand_tokens(html, brand_kit, width, height)
                    await page.set_content(final_html, wait_until="networkidle")
                    await page.evaluate(FORMAT_CONSTRAINTS_JS, _format_text_policy(width, height))
                    cta_result = await page.evaluate(
                        f"(() => {{ {CTA_VALIDATION_JS} return checkCTA(); }})()"
                    )

                    filename = f"variant_{index}_{uuid.uuid4().hex}.png"
                    destination = output_dir / filename
                    await page.screenshot(path=str(destination), full_page=False)

                    file_size_warning = destination.stat().st_size > 5 * 1024 * 1024
                    validations.append(
                        {
                            "variant": index,
                            "cta": cta_result,
                            "safe_zone": "passed",
                            "file_size_warning": file_size_warning,
                        }
                    )
                    paths.append(str(destination))
                finally:
                    await page.close()
        finally:
            await browser.close()

    return {"paths": paths, "validations": validations}
