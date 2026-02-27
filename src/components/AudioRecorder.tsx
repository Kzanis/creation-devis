"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { sendAudioForTranscription } from "@/lib/webhookClient";
import { getAgentContext, setAgentContext } from "@/lib/agentContext";
import type { AgentResponse } from "@/types/agent";

type RecordingStatus = "idle" | "recording" | "uploading";
type AgentStatus = "idle" | "classifying" | "processing";

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  dossierId?: string;
  onAgentResponse?: (response: AgentResponse) => void;
}

export default function AudioRecorder({ onTranscription, dossierId, onAgentResponse }: AudioRecorderProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [liveText, setLiveText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const audioBlobRef = useRef<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const startSpeechRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setLiveText(text);
    };

    recognition.onerror = () => {};
    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setLiveText("");
    setDuration(0);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError("Impossible d\u2019acc\u00e9der au microphone. V\u00e9rifie les autorisations.");
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined,
    });

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

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    startSpeechRecognition();
  }, [startSpeechRecognition]);

  const stopAndTranscribe = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }

    stopSpeechRecognition();

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.stop();
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    const blob = audioBlobRef.current;
    if (!blob) {
      setError("Aucun audio enregistr\u00e9.");
      return;
    }

    setStatus("uploading");

    try {
      const result = await sendAudioForTranscription({ audioBlob: blob });
      const transcribedText = result.text;

      // If agent callback provided, route through agent
      if (onAgentResponse && transcribedText.trim()) {
        setStatus("idle");
        setAgentStatus("classifying");

        try {
          const context = getAgentContext();
          const agentRes = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: transcribedText,
              dossierId: dossierId || "",
              context,
            }),
          });

          const agentData: AgentResponse = await agentRes.json();

          // Update context for next turn
          if (agentData.context) {
            setAgentContext(agentData.context);
          }

          if (agentData.intent === "dictation") {
            // Dictation: add to segments as before
            // Guard: never display raw JSON as a segment
            const msg = agentData.message || "";
            const isJson = msg.trimStart().startsWith("{") || msg.trimStart().startsWith("[");
            onTranscription(isJson ? (agentData.tts || transcribedText) : msg);
          }

          // Always notify parent of agent response
          onAgentResponse(agentData);
        } catch {
          // Agent failed — fallback to normal dictation
          onTranscription(transcribedText);
        } finally {
          setAgentStatus("idle");
        }
      } else {
        // No agent — original behavior
        onTranscription(transcribedText);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la transcription.");
    }

    audioBlobRef.current = null;
    setLiveText("");
    setDuration(0);
    if (status !== "idle") setStatus("idle");
  }, [stopSpeechRecognition, onTranscription, onAgentResponse, dossierId, status]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main button */}
      {(status === "idle") && (
        <button
          onClick={startRecording}
          className="btn-xxl flex h-32 w-32 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-xl hover:bg-[var(--color-primary-hover)] active:scale-95 transition-all"
          aria-label="D\u00e9marrer l'enregistrement"
        >
          <svg className="h-14 w-14" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </button>
      )}

      {status === "recording" && (
        <button
          onClick={stopAndTranscribe}
          className="btn-xxl animate-recording flex h-32 w-32 items-center justify-center rounded-full bg-[var(--color-danger)] text-white shadow-xl active:scale-95 transition-all"
          aria-label="Arr\u00eater l'enregistrement"
        >
          <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      )}

      {status === "uploading" && (
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[var(--color-surface)]">
          <svg className="h-12 w-12 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Status label */}
      {status === "idle" && (
        <p className="text-base text-[var(--color-text-muted)]">Appuie pour dicter</p>
      )}

      {status === "recording" && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-[var(--color-danger)] animate-pulse" />
            <span className="text-base font-semibold text-[var(--color-danger)]">
              Enregistrement {formatDuration(duration)}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Appuie pour arr&ecirc;ter</p>
        </div>
      )}

      {status === "uploading" && (
        <p className="text-base text-[var(--color-text-muted)]">Transcription en cours&hellip;</p>
      )}

      {agentStatus === "classifying" && (
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-[var(--color-primary)]">Analyse de la commande&hellip;</p>
        </div>
      )}

      {/* Live transcript */}
      {status === "recording" && liveText && (
        <div className="w-full rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Aper&ccedil;u en direct
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-text)] opacity-70 italic">
            {liveText}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="w-full rounded-xl border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-[var(--color-text-muted)] underline"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
