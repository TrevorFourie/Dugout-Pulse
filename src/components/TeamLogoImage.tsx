import React, { useEffect, useState } from 'react';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { readTeamLogoLibrary } from '../utils/teamLogoLibrary';

interface TeamLogoImageProps {
  value?: string;
  alt: string;
  className?: string;
  onError?: () => void;
}

/** Read saved image bytes at render time: Capacitor filesystem URIs are not
 * necessarily browser-loadable URLs for <img>. */
export const TeamLogoImage: React.FC<TeamLogoImageProps> = ({ value, alt, className, onError }) => {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    const load = async () => {
      if (!value) { setSrc(undefined); return; }
      if (value.startsWith('data:image/')) { setSrc(value); return; }
      if (!value.startsWith('logo-ref-v1:')) { setSrc(value); return; }
      setSrc(undefined);
      const id = value.slice('logo-ref-v1:'.length);
      const item = readTeamLogoLibrary().find(entry => entry.id === id);
      if (!item) { if (!cancelled) onError?.(); return; }
      try {
        const result = await Filesystem.readFile({ path: `team-logos/${item.fileName}`, directory: Directory.Data });
        if (cancelled) return;
        if (typeof result.data === 'string') {
          setSrc(result.data.startsWith('data:') ? result.data : `data:image/jpeg;base64,${result.data}`);
        } else {
          objectUrl = URL.createObjectURL(result.data);
          setSrc(objectUrl);
        }
      } catch {
        if (!cancelled) onError?.();
      }
    };
    void load();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // Inline onError callbacks should not trigger repeated filesystem reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <img src={src} alt={alt} className={className} onError={() => { setSrc(undefined); onError?.(); }} />;
};
