interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Name der Gruppe für die Vorlesehilfe. */
  label: string;
}

/** Auswahl aus wenigen festen Werten, alle auf einen Blick. */
export default function Segmented<T extends string | number>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" role="radio" aria-checked={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
