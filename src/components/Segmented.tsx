interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Name der Gruppe für die Vorlesehilfe. */
  label: string;
  /** z. B. solange der Server die Werte gar nicht liefert. */
  disabled?: boolean;
}

/** Auswahl aus wenigen festen Werten, alle auf einen Blick. */
export default function Segmented<T extends string | number>({ value, options, onChange, label, disabled = false }: SegmentedProps<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" role="radio" aria-checked={option.value === value} disabled={disabled} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
