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
}: {
  sections: SidebarSectionV1[];
  pinnedItems?: SidebarSectionItemV1[];
}) {
  return (
    <aside className="sidebar-v1" aria-label="Module navigation">
      <div className="sidebar-v1-scroll">
        {sections.map((section) => (
          <div key={section.id}>
            {section.collapsible ? (
              <button
                type="button"
                className="sidebar-v1-section-toggle"
                onClick={section.onToggle}
                aria-expanded={!section.collapsed}
              >
                <span>{section.title}</span>
                <span aria-hidden="true">{section.collapsed ? "+" : "-"}</span>
              </button>
            ) : (
              <h3>{section.title}</h3>
            )}
            {!section.collapsed
              ? section.items.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      isActive ? "is-active sidebar-v1-link" : "sidebar-v1-link"
                    }
                  >
                    <span className="sidebar-v1-link-label">{item.label}</span>
                  </NavLink>
                ))
              : null}
          </div>
        ))}
      </div>
      {pinnedItems.length > 0 ? (
        <div className="sidebar-v1-pinned">
          {pinnedItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              title={item.label}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              <span className="sidebar-v1-link-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
