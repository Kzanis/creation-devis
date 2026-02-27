"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // iOS detection
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !("MSStream" in window)
    );

    // Already installed?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as never as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    // Dismiss check
    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts) {
      const days =
        (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) setIsDismissed(true);
      else localStorage.removeItem(DISMISS_KEY);
    }

    // beforeinstallprompt (Android/Chrome)
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
  }, []);

  return {
    isInstallable: !isInstalled && !isDismissed && "serviceWorker" in navigator,
    isIOS,
    canPrompt: !!deferredPrompt,
    promptInstall,
    dismiss,
  };
}
