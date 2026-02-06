"use client";

import { useState, useRef, useCallback } from "react";
import { sendAudioForTranscription } from "@/lib/webhookClient";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type RecordingStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "done"
  | "error";

interface AudioRecorderProps {
  pieceId: string;
  chantierId: string;
  userId: string;
  dossierId?: string;
  dossierNumero?: string;
  dossierClient?: string;
}

// ─────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────

export default function AudioRecorder({
  pieceId,
  chantierId,
  userId,
  dossierId,
  dossierNumero,
  dossierClient,
}: AudioRecorderProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Démarrer ──
  const startRecording = useCallback(async () => {
    setError(null);
    setTranscription(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "Impossible d\u2019accéder au microphone. Vérifie les autorisations."
      );
      setStatus("error");
      return;
    }

    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      audioBlobRef.current = blob;
      stream.getTracks().forEach((track) => track.stop());
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setStatus("recording");
  }, []);

  // ── Arrêter + envoyer ──
  const stopAndSend = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.stop();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    const blob = audioBlobRef.current;
    if (!blob) {
      setError("Aucun audio enregistré.");
      setStatus("error");
      return;
    }

    setStatus("uploading");

    try {
      const result = await sendAudioForTranscription({
        audioBlob: blob,
        pieceId,
        chantierId,
        userId,
        dossierId,
        dossierNumero,
        dossierClient,
      });
      setTranscription(result.text);
      setStatus("done");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur inconnue lors de l\u2019envoi."
      );
      setStatus("error");
      return;
    }

    audioBlobRef.current = null;
  }, [pieceId, chantierId, userId, dossierId, dossierNumero, dossierClient]);

  // ── Retry ──
  const retry = useCallback(async () => {
    if (!audioBlobRef.current) return;
    setError(null);
    setStatus("uploading");

    try {
      const result = await sendAudioForTranscription({
        audioBlob: audioBlobRef.current,
        pieceId,
        chantierId,
        userId,
      });
      setTranscription(result.text);
      setStatus("done");
      audioBlobRef.current = null;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur inconnue lors de l\u2019envoi."
      );
      setStatus("error");
    }
  }, [pieceId, chantierId, userId, dossierId, dossierNumero, dossierClient]);

  // ── Reset ──
  const reset = useCallback(() => {
    audioBlobRef.current = null;
    setTranscription(null);
    setError(null);
    setStatus("idle");
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-5">
      {/* ── Bouton principal ── */}
      {(status === "idle" || status === "done") && (
        <button
          onClick={status === "idle" ? startRecording : reset}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg hover:bg-[var(--primary-hover)] active:scale-95 transition-all"
          aria-label={
            status === "idle"
              ? "Démarrer l\u2019enregistrement"
              : "Nouvelle dictée"
          }
        >
          {status === "idle" ? (
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          ) : (
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </button>
      )}

      {status === "recording" && (
        <button
          onClick={stopAndSend}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--danger)] text-white shadow-lg hover:bg-red-700 active:scale-95 transition-all"
          aria-label="Arrêter l\u2019enregistrement"
        >
          <span className="absolute inset-0 rounded-full bg-[var(--danger)] animate-ping opacity-20" />
          <svg className="relative h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      )}

      {status === "uploading" && (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--muted-light)]">
          <svg
            className="h-8 w-8 animate-spin text-[var(--primary)]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      {/* ── Label sous le bouton ── */}
      {status === "idle" && (
        <p className="text-sm text-[var(--muted)]">
          Appuie pour dicter
        </p>
      )}

      {status === "recording" && (
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--danger)] animate-pulse" />
          <span className="text-sm font-medium text-[var(--danger)]">
            Enregistrement en cours…
          </span>
        </div>
      )}

      {status === "uploading" && (
        <p className="text-sm text-[var(--muted)]">Transcription en cours…</p>
      )}

      {status === "done" && (
        <p className="text-xs text-[var(--success)] font-medium">
          Nouvelle dictée ? Appuie sur +
        </p>
      )}

      {/* ── Résultat ── */}
      {status === "done" && transcription && (
        <div className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Texte transcrit
          </p>
          <p className="text-sm leading-relaxed text-[var(--foreground)]">
            {transcription}
          </p>
        </div>
      )}

      {/* ── Erreur ── */}
      {status === "error" && error && (
        <div className="w-full rounded-xl border border-red-200 bg-[var(--danger-light)] p-4">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <div className="mt-3 flex gap-3">
            {audioBlobRef.current && (
              <button
                onClick={retry}
                className="rounded-lg bg-[var(--danger)] px-4 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors"
              >
                Réessayer
              </button>
            )}
            <button
              onClick={reset}
              className="rounded-lg bg-[var(--muted-light)] px-4 py-2 text-xs font-medium text-[var(--muted)] hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
