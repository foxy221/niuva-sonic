import type { CSSProperties, ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

const announcements = {
  onDragStart: () => "Aufgenommen.",
  onDragOver: ({ over }: { over: { id: string | number } | null }) => (over ? `Über Position ${Number(over.id) + 1}.` : "Über keiner Position."),
  onDragEnd: ({ over }: { over: { id: string | number } | null }) => (over ? `Abgelegt auf Position ${Number(over.id) + 1}.` : "Abgelegt."),
  onDragCancel: () => "Verschieben abgebrochen.",
};

interface SortableListProps {
  /** Erste und letzte Position der verschiebbaren Zeilen (absolute Indizes). */
  indexes: number[];
  /** `from` und `to` sind absolute Indizes der Liste. */
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}

/** Macht eine senkrechte Liste per Maus, Touch und Tastatur umsortierbar. */
export function SortableList({ indexes, onMove, children }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onMove(Number(active.id), Number(over.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: "Leertaste nimmt die Zeile auf, Pfeiltasten verschieben sie, Leertaste legt sie ab. Escape bricht ab." },
      }}
    >
      <SortableContext items={indexes.map(String)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  /** Absoluter Index der Zeile. */
  index: number;
  className?: string;
  /** Bekommt den Griff, den die Zeile selbst platziert. */
  children: (handle: ReactNode) => ReactNode;
}

/** Eine verschiebbare Zeile (`<li>`) mit eigenem Griff. */
export function SortableRow({ index, className = "", children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: String(index) });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  const handle = (
    <button type="button" className="icon drag-handle" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Verschieben">
      <GripVertical size={18} />
    </button>
  );

  return (
    <li ref={setNodeRef} style={style} className={`${className} sortable${isDragging ? " is-dragging" : ""}`}>
      {children(handle)}
    </li>
  );
}
