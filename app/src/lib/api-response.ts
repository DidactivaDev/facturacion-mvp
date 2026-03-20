/**
 * Reads a failed HTTP response body without assuming JSON.
 * Next.js and proxies often return HTML error pages.
 */
export async function readApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  const trimmed = text.trim();

  if (res.status === 413) {
    return (
      "La petición es demasiado grande (HTTP 413): el proxy rechazó el cuerpo. " +
      "La app ya comprime el payload con gzip; si persiste, sube client_max_body_size en nginx (p. ej. 128m) en el bloque server HTTPS y ejecuta nginx -t && systemctl reload nginx. " +
      "Referencia: deploy/ccinshae-1.activamente.com.conf."
    );
  }

  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as { error?: string; message?: string };
      const msg = j.error || j.message;
      if (msg) return msg;
    } catch {
      /* ignore */
    }
  }
  if (trimmed.startsWith("<")) {
    return `Error del servidor (HTTP ${res.status}). La respuesta fue HTML, no JSON (revisa la URL de la API o el proxy).`;
  }
  if (trimmed.length > 0 && trimmed.length < 400) {
    return trimmed;
  }
  return `Error HTTP ${res.status}`;
}
