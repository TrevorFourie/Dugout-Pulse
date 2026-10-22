export const LOGO_REFERENCE_PREFIX = 'logo-ref-v1:';

export const isLogoDataUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(value);

/** Stable content identifier used only to match a backup reference to a local image. */
export function logoReferenceForDataUrl(dataUrl: string): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  for (let index = 0; index < dataUrl.length; index += 1) {
    const code = dataUrl.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 0x01000193) >>> 0;
    hashB = Math.imul(hashB ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${LOGO_REFERENCE_PREFIX}${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
}

export interface LogoReferenceInfo {
  reference: string;
  ownerName: string;
  location: string;
}

/** Replace image bytes with stable references before writing a JSON backup. */
export function createLogoSafeBackup<T>(value: T): { data: T; customLogoReferences: LogoReferenceInfo[] } {
  const references = new Map<string, LogoReferenceInfo>();
  const visit = (current: unknown, path: string, ownerName: string): unknown => {
    if (Array.isArray(current)) {
      return current.map((item, index) => visit(item, `${path}[${index}]`, ownerName));
    }
    if (!current || typeof current !== 'object') return current;

    const object = current as Record<string, unknown>;
    const currentOwner = [object.playerName, object.teamName, object.name]
      .find((candidate) => typeof candidate === 'string' && candidate.trim()) as string | undefined;
    const nextOwner = currentOwner || ownerName;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(object)) {
      const childPath = path ? `${path}.${key}` : key;
      if (key === 'logo' && isLogoDataUrl(child)) {
        const reference = logoReferenceForDataUrl(child);
        result.logo = reference;
        references.set(reference, { reference, ownerName: nextOwner || 'Unnamed item', location: childPath });
      } else if (key === 'logo' && typeof child === 'string' && child.startsWith(LOGO_REFERENCE_PREFIX)) {
        result.logo = child;
        references.set(child, { reference: child, ownerName: nextOwner || 'Unnamed item', location: childPath });
      } else {
        result[key] = visit(child, childPath, nextOwner);
      }
    }
    return result;
  };

  const transformed = visit(value, '', 'Unnamed item') as T;
  return { data: transformed, customLogoReferences: [...references.values()] };
}

/** Collect existing local logo bytes so imported references can be restored if still available. */
export function collectLocalLogoDataUrls(value: unknown, output = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLocalLogoDataUrls(item, output));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'logo' && isLogoDataUrl(child)) output.set(logoReferenceForDataUrl(child), child);
      else collectLocalLogoDataUrls(child, output);
    }
  }
  return output;
}

/** Resolve backup references against locally available images; missing references fall back to defaults. */
export function restoreLocalLogoReferences<T>(
  value: T,
  localLogos: Map<string, string>,
): { data: T; missingReferences: Set<string> } {
  const missingReferences = new Set<string>();
  const visit = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(visit);
    if (!current || typeof current !== 'object') return current;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (key === 'logo' && typeof child === 'string') {
        if (child.startsWith(LOGO_REFERENCE_PREFIX)) {
          const local = localLogos.get(child);
          if (local) result.logo = local;
          else missingReferences.add(child);
        } else if (isLogoDataUrl(child)) {
          // Legacy backups embedded image bytes. Reuse only an identical image already stored locally.
          const reference = logoReferenceForDataUrl(child);
          const local = localLogos.get(reference);
          if (local) result.logo = local;
          else missingReferences.add(reference);
        } else if (child.trim()) {
          // Never trust arbitrary paths, URLs, or inline content supplied by a JSON backup.
          missingReferences.add(child);
        }
      } else {
        result[key] = visit(child);
      }
    }
    return result;
  };
  return { data: visit(value) as T, missingReferences };
}
