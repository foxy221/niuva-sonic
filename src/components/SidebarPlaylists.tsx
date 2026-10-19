import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { NavLink } from "react-router-dom";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Playlist } from "../api/types";
import { usePlaylists } from "../hooks/playlists";
import { useT } from "../i18n";
import { applyOrder, moveId } from "../state/playlistOrder";
import { useNowPlayingPlaylist } from "../state/playlistSource";
import { useSession } from "../state/session";
import { readValue, writeValue } from "../state/storage";

const FILE = "playlist-order.json";

function Item({ playlist, onKeyMove, dragging, state }: { playlist: Playlist; state: "playing" | "paused" | null; onKeyMove: (id: string, delta: number) => void; dragging: { current: boolean } }) {
  const t = useT();
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: playlist.id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    onKeyMove(playlist.id, e.key === "ArrowUp" ? -1 : 1);
  };
  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "is-dragging" : undefined} {...listeners} onClickCapture={(e) => { if (dragging.current) { e.preventDefault(); e.stopPropagation(); } }}>
      <NavLink to={`/playlist/${playlist.id}`} draggable={false} onKeyDown={onKeyDown}><span>{playlist.name}</span>{state && <span className={`now${state === "paused" ? " paused" : ""}`} aria-label={t(state === "playing" ? "queue.playing" : "common.pause")}><i /><i /><i /></span>}</NavLink>
    </li>
  );
}

/** Playlists als Unterpunkte von „Playlists“, per Ziehen oder Alt+Pfeil umsortierbar. */
export default function SidebarPlaylists({ open }: { open: boolean }) {
  const t = useT();
  const playlists = usePlaylists().data;
  const creds = useSession((s) => s.creds);
  const storeKey = creds ? `playlistOrder:${creds.serverUrl}|${creds.username}` : "";
  const [order, setOrder] = useState<string[]>([]);
  // Das Loslassen nach dem Ziehen löst sonst einen Klick auf den Link aus.
  const dragging = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!storeKey) return;
    let live = true;
    void readValue<string[]>(FILE, storeKey).then((saved) => { if (live && Array.isArray(saved)) setOrder(saved); });
    return () => { live = false; };
  }, [storeKey]);

  const { id: nowId, playing } = useNowPlayingPlaylist();
  const sorted = useMemo(() => applyOrder(playlists ?? [], order), [playlists, order]);
  if (!sorted.length) return null;

  function commit(next: string[]) {
    setOrder(next);
    if (storeKey) void writeValue(FILE, storeKey, next);
  }
  const ids = sorted.map((p) => p.id);
  function moveBy(id: string, delta: number) {
    const from = ids.indexOf(id);
    const to = from + delta;
    if (to >= 0 && to < ids.length) commit(moveId(ids, from, to));
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    window.setTimeout(() => { dragging.current = false; }, 150);
    if (over && active.id !== over.id) commit(moveId(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragStart={() => { dragging.current = true; }} onDragCancel={() => { window.setTimeout(() => { dragging.current = false; }, 150); }} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={`nav-sub-wrap${open ? " open" : ""}`} inert={!open}>
          <ul className="nav-sub" aria-label={t("nav.playlists")}>
            {sorted.map((p) => <Item key={p.id} playlist={p} onKeyMove={moveBy} dragging={dragging} state={p.id === nowId ? (playing ? "playing" : "paused") : null} />)}
          </ul>
        </div>
      </SortableContext>
    </DndContext>
  );
}
