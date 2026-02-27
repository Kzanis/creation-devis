"use client";

import { useState, useRef, useCallback } from "react";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface PhotoCaptureProps {
  dossierId?: string;
  dossierNumero?: string;
  dossierClient?: string;
}

type UploadStatus = "idle" | "uploading" | "done" | "error";

interface CapturedPhoto {
  id: string;
  dataUrl: string;
  file: File;
  uploadStatus: UploadStatus;
  error?: string;
}

export default function PhotoCapture({
  dossierId,
  dossierNumero,
  dossierClient,
}: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<CapturedPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Upload une photo vers /api/save-photo --
  const uploadPhoto = useCallback(
    async (photoId: string, file: File) => {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, uploadStatus: "uploading" as const } : p
        )
      );

      try {
        const formData = new FormData();
        formData.append("photo", file, file.name || `photo_${Date.now()}.jpg`);
        formData.append("dossier_id", dossierId || "");
        formData.append("dossier_numero", dossierNumero || "");
        formData.append("dossier_client", dossierClient || "");

        const res = await fetch("/api/photo-upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (data.success) {
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === photoId
                ? { ...p, uploadStatus: "done" as const }
                : p
            )
          );
        } else {
          throw new Error(data.error || "Erreur inconnue");
        }
      } catch (e) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId
              ? {
                  ...p,
                  uploadStatus: "error" as const,
                  error: e instanceof Error ? e.message : "Erreur inconnue",
                }
              : p
          )
        );
      }
    },
    [dossierId]
  );

  // -- Capture depuis camera ou galerie --
  const handleCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const photoId = generateId();
          const photo: CapturedPhoto = {
            id: photoId,
            dataUrl,
            file,
            uploadStatus: "idle",
          };
          setPhotos((prev) => [...prev, photo]);

          // Upload immediatement
          uploadPhoto(photoId, file);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    },
    [uploadPhoto]
  );

  // -- Supprimer une photo locale --
  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (previewPhoto?.id === id) setPreviewPhoto(null);
  };

  // -- Retry upload --
  const retryUpload = useCallback(
    (photoId: string) => {
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) return;
      uploadPhoto(photoId, photo.file);
    },
    [photos, uploadPhoto]
  );

  const doneCount = photos.filter((p) => p.uploadStatus === "done").length;
  const uploadingCount = photos.filter((p) => p.uploadStatus === "uploading").length;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {/* Boutons capture */}
      <div className="flex gap-3">
        {/* Camera (capture) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-xxl flex flex-1 items-center justify-center gap-3 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-4 py-4 text-[var(--color-text-muted)] transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-[0.97]"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          <span className="text-sm font-medium">Photo</span>
        </button>

        {/* Galerie (pas de capture) */}
        <button
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = (e) =>
              handleCapture(e as unknown as React.ChangeEvent<HTMLInputElement>);
            input.click();
          }}
          className="flex items-center justify-center rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-4 py-4 text-[var(--color-text-muted)] transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-[0.97]"
          title="Choisir depuis la galerie"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        </button>
      </div>

      {/* Compteur */}
      {photos.length > 0 && (
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {photos.length} photo{photos.length > 1 ? "s" : ""}
          {uploadingCount > 0 && (
            <span> &mdash; {uploadingCount} en cours</span>
          )}
          {doneCount > 0 && (
            <span> &mdash; {doneCount} sauvegardee{doneCount > 1 ? "s" : ""}</span>
          )}
        </p>
      )}

      {/* Grille de miniatures */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square">
              <img
                src={photo.dataUrl}
                alt="Photo capturee"
                className="h-full w-full cursor-pointer rounded-lg border border-[var(--color-surface-border)] object-cover"
                onClick={() => setPreviewPhoto(photo)}
              />
              {/* Overlay uploading */}
              {photo.uploadStatus === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                  <svg className="h-6 w-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
              {/* Badge done */}
              {photo.uploadStatus === "done" && (
                <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success)] text-white text-xs shadow">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {/* Badge error + retry */}
              {photo.uploadStatus === "error" && (
                <button
                  onClick={(e) => { e.stopPropagation(); retryUpload(photo.id); }}
                  className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-xs shadow"
                  title={photo.error || "Erreur — appuie pour re-essayer"}
                >
                  !
                </button>
              )}
              {/* Bouton supprimer */}
              <button
                onClick={() => removePhoto(photo.id)}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-xs shadow-md opacity-0 transition-opacity group-hover:opacity-100"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <img
            src={previewPhoto.dataUrl}
            alt="Apercu"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xl text-white backdrop-blur"
            onClick={() => setPreviewPhoto(null)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
