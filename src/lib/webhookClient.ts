"use client";

/**
 * Client webhook pour communiquer avec n8n.
 *
 * - sendAudioForTranscription : WF1 — Dictation + Google Docs
 * - uploadPhotoToDrive : WF2 — Photo Upload Google Drive
 */

import { getClientConfig, getClientId } from "@/lib/clientConfig";

// ── Headers communs ──

function getHeaders(): HeadersInit {
  const config = getClientConfig();
  const apiToken = config.api_token || process.env.NEXT_PUBLIC_WEBHOOK_API_TOKEN;
  const headers: HeadersInit = {
    "X-Client-ID": getClientId(),
  };
  if (apiToken) {
    headers["X-API-Token"] = apiToken;
  }
  return headers;
}

function getWebhookBase(): string {
  const config = getClientConfig();
  return config.n8n_base_url || process.env.NEXT_PUBLIC_WEBHOOK_N8N_BASE_URL || "https://creatorweb.fr/webhook";
}

// ── Types Dictation ──

export interface DictationResponse {
  text: string;
  transcription_id?: string;
  google_doc_url?: string | null;
  google_folder_url?: string | null;
  success: boolean;
}

export interface DictationParams {
  audioBlob: Blob;
}

export async function sendAudioForTranscription({
  audioBlob,
}: DictationParams): Promise<DictationResponse> {
  const webhookUrl =
    process.env.NEXT_PUBLIC_WEBHOOK_N8N_DICTATION_URL ||
    `${getWebhookBase()}/dictation`;

  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");
  formData.append("client_id", getClientId());

  const headers = getHeaders();

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Erreur webhook (${response.status}) : ${errorText || "Reponse vide"}`
    );
  }

  return response.json() as Promise<DictationResponse>;
}

// ── Types Photo Upload ──

export interface PhotoUploadResponse {
  success: boolean;
  photo_url?: string;
  folder_url?: string;
  error?: string;
}

export interface PhotoUploadParams {
  photoBlob: Blob;
  fileName: string;
  dossierId: string;
  dossierNumero: string;
  dossierClient: string;
}

export async function uploadPhotoToDrive({
  photoBlob,
  fileName,
  dossierId,
  dossierNumero,
  dossierClient,
}: PhotoUploadParams): Promise<PhotoUploadResponse> {
  const webhookUrl =
    process.env.NEXT_PUBLIC_WEBHOOK_N8N_PHOTO_UPLOAD_URL ||
    `${getWebhookBase()}/photo-upload`;

  const formData = new FormData();
  formData.append("photo", photoBlob, fileName);
  formData.append("client_id", getClientId());
  formData.append("dossier_id", dossierId);
  formData.append("dossier_numero", dossierNumero);
  formData.append("dossier_client", dossierClient);

  const headers = getHeaders();

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Erreur webhook photo (${response.status}) : ${errorText || "Reponse vide"}`
    );
  }

  return response.json() as Promise<PhotoUploadResponse>;
}
