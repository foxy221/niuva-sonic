import { useEffect, useState } from "react";
import { Disc3, Radio } from "lucide-react";

/** Senderlogos sind oft breit: ganz zeigen statt die Seiten abzuschneiden. */
const LOGO_FIT = { objectFit: "contain", background: "var(--raised)" } as const;

interface CoverProps {
  src?: string;
  /** Sender bekommen ein Radio-Symbol, Titel eine Schallplatte. */
  radio?: boolean;
  /** Kantenlänge des Ersatzsymbols in Pixeln. */
  iconSize?: number;
  className?: string;
  loading?: "lazy";
  imgRef?: (el: HTMLElement | null) => void;
}

/** Cover mit Ersatz: ohne Bild oder bei Ladefehler erscheint ein Symbol statt einer leeren Fläche. */
export default function Cover({ src, radio = false, iconSize = 24, className, loading, imgRef }: CoverProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src && !failed) return <img ref={imgRef} className={className} src={src} alt="" loading={loading} onError={() => setFailed(true)} style={radio ? LOGO_FIT : undefined} />;
  const Icon = radio ? Radio : Disc3;
  return <div ref={imgRef} className={`${className ? `${className} ` : ""}cover-empty`}><Icon size={iconSize} /></div>;
}
