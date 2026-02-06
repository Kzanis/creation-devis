"use client";

/**
 * Client webhook pour communiquer avec n8n.
 *
 * - sendAudioForTranscription : WF1 — Dictation + Google Docs
 * - uploadPhotoToDrive : WF2 — Photo Upload Google Drive
 */

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
  pieceId: string;
  chantierId: string;
  userId: string;
  dossierId?: string;
  dossierNumero?: string;
  dossierClient?: string;
}

export async function sendAudioForTranscription({
  audioBlob,
  pieceId,
  chantierId,
  userId,
  dossierId,
  dossierNumero,
  dossierClient,
}: DictationParams): Promise<DictationResponse> {
  const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_N8N_DICTATION_URL;
  const apiToken = process.env.NEXT_PUBLIC_WEBHOOK_API_TOKEN;

  if (!webhookUrl) {
    throw new Error(
      "Variable d'environnement manquante : NEXT_PUBLIC_WEBHOOK_N8N_DICTATION_URL"
    );
  }

  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");
  formData.append("piece_id", pieceId);
  formData.append("chantier_id", chantierId);
  formData.append("user_id", userId);

  // Infos dossier pour Google Docs integration
  if (dossierId) formData.append("dossier_id", dossierId);
  if (dossierNumero) formData.append("dossier_numero", dossierNumero);
  if (dossierClient) formData.append("dossier_client", dossierClient);

  const headers: HeadersInit = {};
  if (apiToken) {
    headers["X-API-Token"] = apiToken;
  }

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
  const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_N8N_PHOTO_UPLOAD_URL;
  const apiToken = process.env.NEXT_PUBLIC_WEBHOOK_API_TOKEN;

  if (!webhookUrl) {
    throw new Error(
      "Variable d'environnement manquante : NEXT_PUBLIC_WEBHOOK_N8N_PHOTO_UPLOAD_URL"
    );
  }

  const formData = new FormData();
  formData.append("photo", photoBlob, fileName);
  formData.append("dossier_id", dossierId);
  formData.append("dossier_numero", dossierNumero);
  formData.append("dossier_client", dossierClient);

  const headers: HeadersInit = {};
  if (apiToken) {
    headers["X-API-Token"] = apiToken;
  }

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
