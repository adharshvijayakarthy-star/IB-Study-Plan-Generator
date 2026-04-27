"use client";

const navItems = ["Home", "Planner", "Focus", "Settings"];

export default function Header({ view, onViewChange }) {
  return (
    <header className="header-shell">
      <div className="header-left">
        <div className="logo">IB Study Planner</div>
      </div>

      <nav className="nav">
        {navItems.map((item) => {
          const viewId = item.toLowerCase();

          return (
            <button
              key={item}
              className={`btn ${view === viewId ? "active" : ""}`}
              type="button"
              onClick={() => onViewChange(viewId)}
            >
              {item}
            </button>
          );
        })}
      </nav>

      <div className="header-right">
        {/* Placeholder for future top-right actions like profile, etc */}
      </div>
    </header>
  );
}
