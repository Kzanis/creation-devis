"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { AgentResponse as AgentResponseType } from "@/types/agent";

interface AgentResponseProps {
  response: AgentResponseType;
  onDismiss: () => void;
}

const intentConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  dictation: {
    label: "Dictee",
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      </svg>
    ),
    color: "var(--color-primary)",
  },
  readback: {
    label: "Relecture",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    ),
    color: "var(--color-info, #3b82f6)",
  },
  correction: {
    label: "Correction",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: "var(--color-warning, #f59e0b)",
  },
  devis: {
    label: "Devis",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    color: "var(--color-success)",
  },
  info: {
    label: "Info",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "var(--color-info, #3b82f6)",
  },
};

export default function AgentResponse({ response, onDismiss }: AgentResponseProps) {
  const [playing, setPlaying] = useState(false);
  const [loadingTts, setLoadingTts] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayedRef = useRef(false);

  const config = intentConfig[response.intent] || intentConfig.dictation;

  // Browser speechSynthesis fallback (always available on mobile)
  const speakWithBrowser = useCallback((text: string) => {
    if (!window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 1.0;
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }, []);

  const playTts = useCallback(async () => {
    if (!response.tts) return;
    if (playing) {
      stopSpeaking();
      return;
    }

    setLoadingTts(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: response.tts }),
      });

      const data = await res.json();
      if (!data.success) {
        // Server TTS failed — fallback to browser speech
        console.warn("Server TTS failed, using browser speech:", data.error);
        speakWithBrowser(response.tts);
        return;
      }

      let audioUrl: string;
      if (data.audioBase64) {
        const mimeType = data.mimeType || "audio/mpeg";
        audioUrl = `data:${mimeType};base64,${data.audioBase64}`;
      } else if (data.audioUrl) {
        audioUrl = data.audioUrl;
      } else {
        speakWithBrowser(response.tts);
        return;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        // Audio playback failed — fallback to browser speech
        speakWithBrowser(response.tts!);
      };
      await audio.play();
      setPlaying(true);
    } catch (error) {
      console.warn("TTS playback error, using browser speech:", error);
      speakWithBrowser(response.tts);
    } finally {
      setLoadingTts(false);
    }
  }, [response.tts, playing, speakWithBrowser, stopSpeaking]);

  // Auto-play TTS for readback intent
  useEffect(() => {
    if (response.intent === "readback" && response.tts && !autoPlayedRef.current) {
      autoPlayedRef.current = true;
      // Small delay to let the UI render first
      const timer = setTimeout(() => playTts(), 300);
      return () => clearTimeout(timer);
    }
  }, [response.intent, response.tts, playTts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopSpeaking();
  }, [stopSpeaking]);

  return (
    <div
      className="w-full rounded-xl border bg-[var(--color-surface)] p-4"
      style={{ borderColor: config.color }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ color: config.color }}>
          {config.icon}
          <span className="text-xs font-semibold uppercase tracking-wider">
            {config.label}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-border)]"
          aria-label="Fermer"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Message */}
      <p className="text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
        {response.message}
      </p>

      {/* Actions */}
      {response.tts && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={playTts}
            disabled={loadingTts}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: config.color, color: "white" }}
          >
            {loadingTts ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : playing ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {playing ? "Pause" : "Ecouter"}
          </button>
        </div>
      )}

      {/* Error state */}
      {!response.success && (
        <p className="mt-2 text-xs text-[var(--color-danger)]">
          Une erreur est survenue. La dictee a ete sauvegardee.
        </p>
      )}
    </div>
  );
}
