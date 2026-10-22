(() => {
  if (window.location.pathname !== "/" && window.location.pathname !== "/index.html") return;

  const style = document.createElement("style");
  style.textContent = `
    #jugnu-share-button {
      position: fixed;
      z-index: 70;
      right: 16px;
      bottom: calc(88px + env(safe-area-inset-bottom));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      min-height: 48px;
      padding: 0 17px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 999px;
      background: linear-gradient(115deg, #8b5cf6, #3b82f6);
      color: #fff;
      font: 700 14px/1 system-ui, sans-serif;
      box-shadow: 0 10px 28px rgba(89, 64, 200, .38);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    #jugnu-share-button:hover { filter: brightness(1.08); }
    #jugnu-share-button:focus-visible,
    .jugnu-share-dialog button:focus-visible,
    .jugnu-share-dialog input:focus-visible {
      outline: 3px solid rgba(167, 139, 250, .8);
      outline-offset: 3px;
    }
    #jugnu-share-button[disabled] { opacity: .72; cursor: wait; }
    .jugnu-share-overlay {
      position: fixed;
      z-index: 10000;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(3, 5, 14, .78);
      backdrop-filter: blur(8px);
    }
    .jugnu-share-dialog {
      width: min(100%, 420px);
      padding: 24px;
      border: 1px solid rgba(148, 163, 184, .22);
      border-radius: 24px;
      background: #111426;
      color: #f8fafc;
      font: 500 14px/1.5 system-ui, sans-serif;
      box-shadow: 0 24px 80px rgba(0,0,0,.55);
    }
    .jugnu-share-dialog h2 { margin: 0 34px 8px 0; font-size: 20px; line-height: 1.2; }
    .jugnu-share-dialog p { margin: 0 0 18px; color: #a7aec4; }
    .jugnu-share-dialog .jugnu-share-close {
      float: right;
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 50%;
      background: rgba(255,255,255,.08);
      color: #e2e8f0;
      font-size: 20px;
      cursor: pointer;
    }
    .jugnu-share-dialog .jugnu-share-url {
      box-sizing: border-box;
      width: 100%;
      min-height: 44px;
      margin: 2px 0 12px;
      padding: 10px 12px;
      border: 1px solid rgba(148,163,184,.25);
      border-radius: 12px;
      background: #080b17;
      color: #e2e8f0;
      font: 13px/1.4 ui-monospace, monospace;
    }
    .jugnu-share-dialog .jugnu-share-actions { display: flex; gap: 10px; }
    .jugnu-share-dialog .jugnu-share-actions button {
      flex: 1;
      min-height: 44px;
      border: 0;
      border-radius: 12px;
      background: linear-gradient(115deg, #8b5cf6, #3b82f6);
      color: #fff;
      font: 700 14px/1 system-ui, sans-serif;
      cursor: pointer;
    }
    .jugnu-share-dialog .jugnu-share-actions button.secondary {
      border: 1px solid rgba(148,163,184,.25);
      background: rgba(255,255,255,.06);
    }
    .jugnu-share-dialog .jugnu-share-status {
      min-height: 21px;
      margin: 12px 0 0;
      color: #c4b5fd;
      font-size: 13px;
    }
    @media (min-width: 760px) {
      #jugnu-share-button { bottom: 24px; }
    }
    @media (prefers-reduced-motion: reduce) {
      #jugnu-share-button { transition: none; }
    }
  `;
  document.head.appendChild(style);

  const shareButton = document.createElement("button");
  shareButton.id = "jugnu-share-button";
  shareButton.type = "button";
  shareButton.setAttribute("aria-label", "Create and share a JUGNU TV link");
  shareButton.innerHTML = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"></path></svg><span>Share JUGNU TV</span>';
  document.body.appendChild(shareButton);

  let activeOverlay = null;
  let currentShortUrl = "";

  function closeDialog() {
    if (activeOverlay) activeOverlay.remove();
    activeOverlay = null;
    currentShortUrl = "";
    shareButton.focus();
  }

  function showDialog() {
    const overlay = document.createElement("div");
    overlay.className = "jugnu-share-overlay";
    overlay.innerHTML = `
      <section class="jugnu-share-dialog" role="dialog" aria-modal="true" aria-labelledby="jugnu-share-title">
        <button class="jugnu-share-close" type="button" aria-label="Close">&times;</button>
        <h2 id="jugnu-share-title">Share JUGNU TV</h2>
        <p>You can keep watching without sharing. Create a link only when you want to share the site.</p>
        <p class="jugnu-share-status" role="status" aria-live="polite">Creating your link…</p>
      </section>`;
    document.body.appendChild(overlay);
    activeOverlay = overlay;
    overlay.querySelector(".jugnu-share-close").addEventListener("click", closeDialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeDialog();
    });
    document.addEventListener("keydown", onEscape);
    return overlay;
  }

  function onEscape(event) {
    if (event.key === "Escape" && activeOverlay) {
      document.removeEventListener("keydown", onEscape);
      closeDialog();
    }
  }

  function renderLink(overlay, shortUrl) {
    if (!overlay.isConnected) return;
    currentShortUrl = shortUrl;
    const dialog = overlay.querySelector(".jugnu-share-dialog");
    const status = dialog.querySelector(".jugnu-share-status");
    status.textContent = "Your optional share link is ready.";
    const input = document.createElement("input");
    input.className = "jugnu-share-url";
    input.type = "url";
    input.readOnly = true;
    input.value = shortUrl;
    input.setAttribute("aria-label", "JUGNU TV share link");
    status.before(input);

    const actions = document.createElement("div");
    actions.className = "jugnu-share-actions";
    actions.innerHTML = '<button class="secondary" type="button">Copy link</button><button type="button">Share</button>';
    status.before(actions);

    const [copyButton, nativeShareButton] = actions.querySelectorAll("button");
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentShortUrl);
        status.textContent = "Link copied.";
      } catch {
        input.focus();
        input.select();
        const copied = document.execCommand("copy");
        status.textContent = copied ? "Link copied." : "Select and copy the link above.";
      }
    });
    nativeShareButton.addEventListener("click", async () => {
      if (!navigator.share) {
        input.focus();
        input.select();
        status.textContent = "Use Copy link to share this URL.";
        return;
      }
      try {
        await navigator.share({ title: "JUGNU TV", url: currentShortUrl });
        status.textContent = "Share sheet opened.";
      } catch (error) {
        if (error && error.name !== "AbortError") status.textContent = "Could not open the share sheet.";
      }
    });
    input.focus();
    input.select();
  }

  shareButton.addEventListener("click", async () => {
    shareButton.disabled = true;
    const overlay = showDialog();
    try {
      const response = await fetch("/api/shorten.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await response.json();
      if (!response.ok || !result.shortUrl) {
        throw new Error(result.error || "Could not create a share link.");
      }
      renderLink(overlay, result.shortUrl);
    } catch (error) {
      const status = overlay.querySelector(".jugnu-share-status");
      if (status) status.textContent = error.message || "Could not create a share link. Check the server configuration.";
    } finally {
      shareButton.disabled = false;
    }
  });
})();
