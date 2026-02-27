"use client";

import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function PWAInstallBanner() {
  const { isInstallable, isIOS, canPrompt, promptInstall, dismiss } =
    usePWAInstall();
  const [visible, setVisible] = useState(true);

  if (!isInstallable || !visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    dismiss();
  };

  return (
    <div className="fixed bottom-4 right-4 left-4 z-50 md:left-auto md:max-w-sm animate-[slideUp_0.4s_ease-out]">
      <div className="relative rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-4 shadow-xl">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          aria-label="Fermer"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {isIOS ? (
          /* iOS instructions */
          <div className="pr-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
                {/* Share icon */}
                <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  Installer Dictaphone Chantier
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                  Touchez{" "}
                  <svg className="inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>{" "}
                  Partager, puis <strong>&quot;Sur l&apos;ecran d&apos;accueil&quot;</strong>
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleDismiss}
                className="rounded-lg border border-[var(--color-surface-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                Compris
              </button>
            </div>
          </div>
        ) : canPrompt ? (
          /* Android / Chrome install */
          <div className="pr-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
                {/* Download icon */}
                <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  Installer Dictaphone Chantier
                </h3>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Acces rapide depuis ton ecran d&apos;accueil
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button
                onClick={handleDismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                Plus tard
              </button>
              <button
                onClick={promptInstall}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-95"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Installer
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
