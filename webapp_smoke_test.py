import os

from playwright.sync_api import sync_playwright


def main() -> None:
  """Basic smoke test for the local Vite React web application."""
  base_url = os.environ.get("WEBAPP_BASE_URL", "http://localhost:8081")
  console_errors: list[str] = []
  console_warnings: list[str] = []
  benign_error_substrings = [
    "Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.",
    "X-Frame-Options may only be set via an HTTP header sent along with a document.",
  ]

  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    def _on_console(msg) -> None:  # type: ignore[no-untyped-def]
      # Playwright's ConsoleMessage may expose type/text as callables or attributes,
      # so handle both forms defensively.
      raw_type = getattr(msg, "type", None)
      msg_type = raw_type() if callable(raw_type) else (raw_type or "log")

      raw_text = getattr(msg, "text", None)
      text = raw_text() if callable(raw_text) else (raw_text or "")
      if msg_type == "error":
        # Ignore known benign browser console errors.
        if any(substr in text for substr in benign_error_substrings):
          return
        console_errors.append(f"ERROR: {text}")
      elif msg_type == "warning":
        console_warnings.append(f"WARNING: {text}")

    page.on("console", _on_console)

    page.goto(base_url, wait_until="networkidle")

    # Give any late-loading UI a short buffer.
    page.wait_for_timeout(1000)

    # Take a full-page screenshot for debugging if needed.
    page.screenshot(path="webapp_smoke_test.png", full_page=True)

    # Basic sanity checks: page has a title and some visible content.
    title = page.title()
    if not title:
      raise RuntimeError("Smoke test failed: page title is empty.")

    # Require at least one visible button or link; adjust if this is too strict.
    has_clickable = bool(
      page.locator("button").count() or page.locator("a").count()
    )
    if not has_clickable:
      raise RuntimeError("Smoke test failed: no buttons or links found on page.")

    if console_warnings:
      # Avoid printing full warning texts to sidestep encoding issues on some consoles.
      print(f"{len(console_warnings)} console warning(s) encountered (ignored by smoke test).")

    if console_errors:
      joined = "\n".join(console_errors)
      raise RuntimeError(f"Smoke test failed due to console errors/warnings:\n{joined}")

    browser.close()


if __name__ == "__main__":
  main()

