import { ButtonV1 } from "./button-v1";

export type TabItemV1 = {
  id: string;
  label: string;
};

export function TabsV1({
  items,
  activeId,
  onChange,
}: {
  items: TabItemV1[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs-v1" role="tablist" aria-label="Core modules">
      {items.map((item) => (
        <ButtonV1
          key={item.id}
          role="tab"
          aria-selected={item.id === activeId}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </ButtonV1>
      ))}
    </div>
  );
}
