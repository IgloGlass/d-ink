import { NavLink } from "react-router-dom";

export type SidebarSectionItemV1 = {
  id: string;
  label: string;
  to: string;
};

export type SidebarSectionV1 = {
  collapsible?: boolean;
  collapsed?: boolean;
  id: string;
  items: SidebarSectionItemV1[];
  onToggle?: () => void;
  title: string;
};

export function SidebarNavV1({
  sections,
  pinnedItems = [],
  pinnedTitle = "Calculation Chain",
}: {
  sections: SidebarSectionV1[];
  pinnedItems?: SidebarSectionItemV1[];
  pinnedTitle?: string;
}) {
  return (
    <aside className="sidebar-v1" aria-label="Module navigation">
      <div className="sidebar-v1-scroll">
        {sections.map((section) => (
          <section key={section.id} className="sidebar-v1-section">
            {section.collapsible ? (
              <button
                type="button"
                className="sidebar-v1-section-toggle"
                onClick={section.onToggle}
                aria-expanded={!section.collapsed}
                aria-controls={`sidebar-section-${section.id}`}
              >
                <span>{section.title}</span>
                <span aria-hidden="true">{section.collapsed ? "+" : "-"}</span>
              </button>
            ) : (
              <h3 className="sidebar-v1-section-title">{section.title}</h3>
            )}
            {!section.collapsed ? (
              <ul
                id={`sidebar-section-${section.id}`}
                className="sidebar-v1-link-list"
              >
                {section.items.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={item.to}
                      title={item.label}
                      className={({ isActive }) =>
                        isActive
                          ? "is-active sidebar-v1-link"
                          : "sidebar-v1-link"
                      }
                    >
                      <span className="sidebar-v1-link-label">
                        {item.label}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      {pinnedItems.length > 0 ? (
        <div className="sidebar-v1-pinned" aria-label={pinnedTitle}>
          <h3 className="sidebar-v1-section-title">{pinnedTitle}</h3>
          <ul className="sidebar-v1-link-list">
            {pinnedItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.to}
                  title={item.label}
                  className={({ isActive }) =>
                    isActive ? "is-active sidebar-v1-link" : "sidebar-v1-link"
                  }
                >
                  <span className="sidebar-v1-link-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
