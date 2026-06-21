import Link from "next/link";

const enlaces = [
  { label: "gob.mx", href: "https://www.gob.mx" },
  { label: "Participa", href: "https://www.gob.mx/participa" },
  { label: "Publicaciones Oficiales", href: "https://www.dof.gob.mx" },
  { label: "Marco Jurídico", href: "https://www.gob.mx/marco-juridico" },
];

export function GobMxFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12">
      <div className="bg-gobmx-guinda-dark text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Enlaces</h3>
            <ul className="space-y-2 text-sm">
              {enlaces.map((e) => (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gobmx-dorado hover:text-white hover:underline"
                  >
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">¿Qué es gob.mx?</h3>
            <p className="text-sm leading-relaxed text-white/90">
              Es el portal único de trámites, información y participación ciudadana. Conoce más en{" "}
              <Link
                href="https://www.gob.mx/que-es-gobmx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gobmx-dorado hover:underline"
              >
                gob.mx
              </Link>
              .
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Contacto</h3>
            <address className="text-sm not-italic leading-relaxed text-white/90">
              CCINSHAE — Secretaría de Salud
              <br />
              Lieja 7, Col. Juárez
              <br />
              Cuauhtémoc, CDMX, C.P. 06600
              <br />
              <Link
                href="https://www.gob.mx/insalud"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gobmx-dorado hover:underline"
              >
                gob.mx/insalud
              </Link>
            </address>
          </div>
        </div>
      </div>
      <div className="bg-black text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs sm:flex-row">
          <span>Gobierno de México · {year}</span>
          <span className="text-gobmx-neutro-light">
            Agente de análisis de precisión de gastos · CCINSHAE
          </span>
        </div>
      </div>
    </footer>
  );
}
