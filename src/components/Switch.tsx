interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Name für die Vorlesehilfe. */
  label: string;
}

/** Schalter für ein Ein/Aus. */
export default function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span aria-hidden="true" />
    </label>
  );
}
