import { ReactNode, useState } from "react";

/**
 * Shows a real photograph from /public/images when the file exists, otherwise the fallback.
 * No stock photos are bundled; drop licensed images in frontend/public/images (see README there).
 */
export function Photo({ src, alt, className, fallback }: { src: string; alt: string; className?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} loading="eager" onError={() => setFailed(true)} />;
}
