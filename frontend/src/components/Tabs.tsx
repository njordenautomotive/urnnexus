import { NavLink } from "react-router-dom";

interface TabsProps {
  items: Array<{ to: string; label: string }>;
}

export function Tabs({ items }: TabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label="Prosjektseksjoner">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "."}
          className={({ isActive }) => `tabs__item ${isActive ? "tabs__item--active" : ""}`}
          role="tab"
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

