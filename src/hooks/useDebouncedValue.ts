import { useEffect, useState } from "react";

/** Gibt den Wert erst zurück, wenn er `delay` Millisekunden unverändert bleibt (Suche). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
