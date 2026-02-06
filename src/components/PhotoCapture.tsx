"use client";

import { useState, useRef, useCallback } from "react";
import { uploadPhotoToDrive } from "@/lib/webhookClient";

interface PhotoCaptureProps {
  onPhotoCaptured?: (dataUrl: string) => void;
  dossierId?: string;
  dossierNumero?: string;
  dossierClient?: string;
}

type UploadStatus = "idle" | "uploading" | "done" | "error";

interface CapturedPhoto {
  id: string;
  dataUrl: string;
  timestamp: Date;
  uploadStatus: UploadStatus;
  driveUrl?: string;
  error?: string;
}

export default function PhotoCapture({
  onPhotoCaptured,
  dossierId,
  dossierNumero,
  dossierClient,
}: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<CapturedPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDossier = !!(dossierId && dossierNumero);

  const uploadPhoto = useCallback(
    async (photoId: string, file: File) => {
      if (!dossierId || !dossierNumero) return;

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, uploadStatus: "uploading" as const } : p
        )
      );

      try {
        const result = await uploadPhotoToDrive({
          photoBlob: file,
          fileName: file.name || `photo_${Date.now()}.jpg`,
          dossierId,
          dossierNumero,
          dossierClient: dossierClient || "",
        });

        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId
              ? {
                  ...p,
                  uploadStatus: "done" as const,
                  driveUrl: result.photo_url,
                }
              : p
          )
        );
      } catch (e) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId
              ? {
                  ...p,
                  uploadStatus: "error" as const,
                  error:
                    e instanceof Error ? e.message : "Erreur inconnue",
                }
              : p
          )
        );
      }
    },
    [dossierId, dossierNumero, dossierClient]
  );

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const photoId = crypto.randomUUID();
        const photo: CapturedPhoto = {
          id: photoId,
          dataUrl,
          timestamp: new Date(),
          uploadStatus: hasDossier ? "uploading" : "idle",
        };
        setPhotos((prev) => [...prev, photo]);
        onPhotoCaptured?.(dataUrl);

        // Upload automatique si un dossier est selectionne
        if (hasDossier) {
          uploadPhoto(photoId, file);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (previewPhoto?.id === id) setPreviewPhoto(null);
  };

  const retryUpload = useCallback(
    async (photoId: string) => {
      const photo = photos.find((p) => p.id === photoId);
      if (!photo || !dossierId || !dossierNumero) return;

      // Reconvertir le dataUrl en Blob
      const res = await fetch(photo.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `photo_${Date.now()}.jpg`, {
        type: blob.type,
      });
      await uploadPhoto(photoId, file);
    },
    [photos, dossierId, dossierNumero, uploadPhoto]
  );

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {!hasDossier && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
          Selectionne un dossier pour que les photos soient uploadees automatiquement dans Google Drive.
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--card-border)] bg-[var(--card)] px-4 py-6 text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] transition-all active:scale-[0.98]"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
            />
          </svg>
          <span className="text-sm font-medium">Prendre une photo</span>
        </button>

        <button
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = (e) =>
              handleCapture(
                e as unknown as React.ChangeEvent<HTMLInputElement>
              );
            input.click();
          }}
          className="flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--card-border)] bg-[var(--card)] px-4 py-6 text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] transition-all active:scale-[0.98]"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
        </button>
      </div>

      {photos.length > 0 && (
        <p className="text-xs text-[var(--muted)] font-medium">
          {photos.length} photo{photos.length > 1 ? "s" : ""} capturee
          {photos.length > 1 ? "s" : ""}
          {hasDossier && (
            <span>
              {" "}
              &mdash;{" "}
              {photos.filter((p) => p.uploadStatus === "done").length} uploadee
              {photos.filter((p) => p.uploadStatus === "done").length > 1
                ? "s"
                : ""}
            </span>
          )}
        </p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square">
              <img
                src={photo.dataUrl}
                alt="Photo capturee"
                className="h-full w-full rounded-lg object-cover cursor-pointer border border-[var(--card-border)]"
                onClick={() => setPreviewPhoto(photo)}
              />
              {/* Upload status overlay */}
              {photo.uploadStatus === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                  <svg
                    className="h-6 w-6 animate-spin text-white"
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
              {photo.uploadStatus === "done" && (
                <div className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs shadow">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
              {photo.uploadStatus === "error" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    retryUpload(photo.id);
                  }}
                  className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs shadow"
                  title={photo.error || "Erreur upload"}
                >
                  !
                </button>
              )}
              <button
                onClick={() => removePhoto(photo.id)}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--danger)] text-white text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

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
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white text-xl backdrop-blur"
            onClick={() => setPreviewPhoto(null)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
