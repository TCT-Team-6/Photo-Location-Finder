import { useEffect, useMemo, useState } from "react";
import { FileImage, Upload, X } from "lucide-react";

export type PhotoUploadSlotId = "original" | "recreation" | "fake-news";

export type PhotoUploadSlotDefinition = {
  id: PhotoUploadSlotId;
  label: string;
  description: string;
};

type PhotoUploadSlotProps = {
  slot: PhotoUploadSlotDefinition;
  file: File | null;
  error?: string;
  disabled?: boolean;
  onSelectFile: (file: File) => void;
  onRemoveFile: () => void;
};

export function PhotoUploadSlot({
  slot,
  file,
  error,
  disabled = false,
  onSelectFile,
  onRemoveFile,
}: PhotoUploadSlotProps) {
  const [dragging, setDragging] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file],
  );

  useEffect(() => {
    setPreviewUnavailable(false);
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const inputId = `photo-upload-${slot.id}`;
  const inputTestId =
    slot.id === "original" ? "input-photo-file" : `input-photo-file-${slot.id}`;
  const dropzoneTestId =
    slot.id === "original"
      ? "dropzone-photo-upload"
      : `dropzone-photo-upload-${slot.id}`;
  const removeTestId =
    slot.id === "original" ? "button-remove-photo" : `button-remove-photo-${slot.id}`;

  return (
    <section
      className="photo-upload-card rounded-2xl border bg-[#f8f5ec] p-3 transition-colors duration-300"
      data-testid={`photo-upload-slot-${slot.id}`}
    >
      <div className="mb-3 flex min-h-12 items-start justify-between gap-3 px-1">
        <div>
          <h2 className="photo-upload-title font-editorial text-xl leading-tight">
            {slot.label}
          </h2>
          <p className="mt-1 text-[11px] leading-4 text-[#78847b]">
            {slot.description}
          </p>
        </div>
        <span className="photo-upload-optional shrink-0 rounded-full border px-2.5 py-1 font-data text-[8px] uppercase tracking-[.12em]">
          Optional
        </span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const droppedFile = event.dataTransfer.files[0];
          if (droppedFile) onSelectFile(droppedFile);
        }}
        className={`photo-upload-dropzone relative h-[210px] overflow-hidden rounded-xl border border-dashed text-center transition ${dragging ? "is-dragging" : ""} ${disabled ? "cursor-wait opacity-70" : "cursor-pointer"}`}
        data-testid={dropzoneTestId}
      >
        <input
          id={inputId}
          type="file"
          accept="image/*,.heic,.heif,.tif,.tiff,.bmp"
          disabled={disabled}
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0];
            if (selected) onSelectFile(selected);
            event.currentTarget.value = "";
          }}
          className="sr-only"
          data-testid={inputTestId}
        />
        <label
          htmlFor={inputId}
          className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center overflow-hidden px-4 py-5"
        >
          {file ? (
            <>
              {previewUnavailable ? (
                <div className="photo-upload-fallback flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg px-4 text-center text-xs leading-5">
                  <FileImage size={30} />
                  <span>
                    This format can’t be previewed here, but it can still be
                    analyzed.
                  </span>
                </div>
              ) : (
                <img
                  src={preview}
                  alt={`Selected ${slot.label} photo: ${file.name}`}
                  onError={() => setPreviewUnavailable(true)}
                  className="h-full w-full rounded-lg object-contain"
                  data-testid={
                    slot.id === "original"
                      ? "img-selected-photo"
                      : `img-selected-photo-${slot.id}`
                  }
                />
              )}
              <span className="photo-upload-filename absolute bottom-3 left-3 right-3 truncate rounded-full px-3 py-2 text-[10px] text-[#f4f0e6]">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </>
          ) : (
            <>
              <span className="photo-upload-icon grid h-12 w-12 place-items-center rounded-full">
                <Upload size={21} strokeWidth={1.6} />
              </span>
              <p className="mt-4 font-editorial text-lg">Drop photo here</p>
              <p className="mt-1 text-xs text-[#77847a]">or browse files</p>
              <span className="photo-upload-optional mt-4 rounded-full border px-3 py-1.5 font-data text-[8px] uppercase tracking-[.1em]">
                Image · up to 25 MB
              </span>
            </>
          )}
        </label>
      </div>

      {file && (
        <button
          type="button"
          onClick={onRemoveFile}
          disabled={disabled}
          data-testid={removeTestId}
          className="photo-upload-remove mt-2 inline-flex min-h-8 items-center gap-1.5 px-1 text-[11px] disabled:opacity-50"
        >
          <X size={13} />
          Remove photo
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-[#dfc6b6] bg-[#f9eee6] px-3 py-2 text-[11px] leading-4 text-[#875545]"
          data-testid={`status-photo-upload-error-${slot.id}`}
        >
          {error}
        </p>
      )}
    </section>
  );
}
