import Link from "next/link";

const navItems = [
  { label: "Trámites", href: "https://www.gob.mx/tramites" },
  { label: "Gobierno", href: "https://www.gob.mx/gobierno" },
];

export function GobMxHeader() {
  return (
    <header>
      <div className="bg-gobmx-guinda-dark text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="https://www.gob.mx"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-3 transition hover:opacity-90"
            aria-label="Gobierno de México"
          >
            <span
              role="img"
              aria-hidden="true"
              className="block h-11 w-11 shrink-0 sm:h-12 sm:w-12"
              style={{
                backgroundImage: "url(/gobmx/escudo.png)",
                backgroundSize: "auto 100%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "left center",
              }}
            />
            <span className="flex flex-col font-serif leading-[1.05]">
              <span className="text-xs font-normal sm:text-sm">Gobierno de</span>
              <span className="text-xl font-bold sm:text-2xl">México</span>
            </span>
          </Link>
          <nav aria-label="Sitios de gob.mx">
            <ul className="flex items-center gap-1 text-sm sm:gap-3">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded px-2 py-1 text-white/95 transition hover:bg-white/10 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  aria-label="Buscar"
                  className="grid h-8 w-8 place-items-center rounded-full text-white/95 transition hover:bg-white/10 hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-4 leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gobmx-neutro-mid">
            Secretaría de Salud
          </p>
          <p className="text-base font-bold text-gobmx-guinda-dark sm:text-lg">CCINSHAE</p>
          <p className="text-xs text-gobmx-neutro sm:text-sm">
            Comisión Coordinadora de Institutos Nacionales de Salud y Hospitales de Alta
            Especialidad
          </p>
        </div>
      </div>
    </header>
  );
}
