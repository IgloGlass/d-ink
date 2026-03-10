import { useId, useRef, useState } from "react";

import { ButtonV1 } from "./button-v1";

type UploadDropZoneV1Props = {
  accept: string;
  buttonLabel: string;
  file: File | null;
  helperText: string;
  idPrefix: string;
  isDisabled?: boolean;
  onFileSelected: (file: File | null) => void;
  title: string;
};

export function UploadDropZoneV1({
  accept,
  buttonLabel,
  file,
  helperText,
  idPrefix,
  isDisabled = false,
  onFileSelected,
  title,
}: UploadDropZoneV1Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = `${idPrefix}-${useId()}`;
  const [isDragActive, setIsDragActive] = useState(false);

  function handleFiles(files: FileList | null) {
    if (isDisabled || !files || files.length === 0) {
      return;
    }

    onFileSelected(files[0] ?? null);
  }

  return (
    <div
      className={`drop-zone module-upload-drop-zone${isDragActive ? " active" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!isDisabled) {
          setIsDragActive(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isDisabled) {
          setIsDragActive(true);
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        handleFiles(event.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
      aria-disabled={isDisabled}
      aria-label={`${title} drop zone`}
      onClick={() => {
        if (!isDisabled) {
          inputRef.current?.click();
        }
      }}
      onKeyDown={(event) => {
        if (isDisabled) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        onChange={(event) => handleFiles(event.target.files)}
        className="module-upload-drop-zone__input"
        disabled={isDisabled}
      />
      <div className="module-upload-drop-zone__title">{title}</div>
      <div className="module-upload-drop-zone__helper">{helperText}</div>
      <div className="module-upload-drop-zone__actions">
        <ButtonV1
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            if (!isDisabled) {
              inputRef.current?.click();
            }
          }}
          disabled={isDisabled}
        >
          {buttonLabel}
        </ButtonV1>
        {file ? (
          <span className="module-upload-drop-zone__file">
            Selected: {file.name}
          </span>
        ) : (
          <span className="module-upload-drop-zone__file">
            No file selected yet
          </span>
        )}
      </div>
    </div>
  );
}
