import { AppIcon } from "./AppIcon";

interface DashboardFilePickerProps {
  id: string;
  label?: string;
  file: File | null;
  accept?: string;
  onChange: (file: File | null) => void;
}

export function DashboardFilePicker({ id, label = "Immagine", file, accept = "image/*", onChange }: DashboardFilePickerProps) {
  return (
    <div className="dashboard-file-field">
      <span>{label}</span>
      <label className="dashboard-file-picker" htmlFor={id}>
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
        <span className="dashboard-file-picker__icon"><AppIcon name="paperclip" size={17} /></span>
        <span className="dashboard-file-picker__copy">
          <strong>{file?.name || "Seleziona immagine"}</strong>
          <small>{file ? "Pronta per il caricamento" : "JPG, PNG o WebP"}</small>
        </span>
        <span className="dashboard-file-picker__action">Sfoglia</span>
      </label>
    </div>
  );
}
