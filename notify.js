// Shared helper for turning browser notifications on and off.
window.PushHelper = (function () {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  // Why notifications can't be offered here, or "" if they can.
  function blocker() {
    if (isIOS && !standalone) return "ios";
    if (!supported()) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    return "";
  }

  function keyToBytes(base64) {
    const pad = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function registration() {
    return navigator.serviceWorker.register("/sw.js");
  }

  async function current() {
    if (!supported()) return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? reg.pushManager.getSubscription() : null;
  }

  // Must be called from a click: asks permission and returns a subscription.
  async function subscribe() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications were blocked. You can allow them in your browser's site settings.");
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const r = await fetch("/api/push");
    const { publicKey } = await r.json();
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  }

  async function unsubscribe() {
    const sub = await current();
    if (sub) await sub.unsubscribe();
    return sub;
  }

  // Register early so a tap on a notification can focus this tab.
  if (supported()) registration().catch(() => {});

  return { supported, blocker, subscribe, unsubscribe, current, isIOS, standalone };
})();
