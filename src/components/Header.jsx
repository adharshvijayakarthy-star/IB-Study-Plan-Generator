"use client";

const navItems = [
  { label: "Home", id: "home" },
  { label: "Planner", id: "planner" },
  { label: "Exam Portions", id: "exam-portions" },
  { label: "Focus", id: "focus" },
  { label: "Settings", id: "settings" },
];

export default function Header({ view, onViewChange }) {
  return (
    <header className="header-shell">
      <div className="header-left">
        <div className="logo">IB Study Planner</div>
      </div>

      <nav className="nav">
        {navItems.map((item) => {
          return (
            <button
              key={item.id}
              className={`btn ${view === item.id ? "active" : ""}`}
              type="button"
              onClick={() => onViewChange(item.id)}
            >
              {item.label}
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
