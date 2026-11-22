import { SectionId } from "../types";

const links: { id: SectionId; label: string }[] = [
  { id: "home", label: "Титулка" },
  { id: "coordinates", label: "Координатна площина" },
  { id: "geometry", label: "Геометрія" },
  { id: "formulas", label: "Довідник" },
  { id: "calculators", label: "Калькулятори" },
];

interface NavProps {
  current: SectionId;
  onNavigate: (s: SectionId) => void;
}

export function Nav({ current, onNavigate }: NavProps) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a
          className="nav-logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("home");
          }}
        >
          <span className="nav-logo-icon" aria-hidden>
            ∑
          </span>
          Математичний зошит
        </a>
        <nav className="nav-tabs">
          {links.map((l) => (
            <button
              key={l.id}
              className={"nav-tab" + (current === l.id ? " is-active" : "")}
              onClick={() => onNavigate(l.id)}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
