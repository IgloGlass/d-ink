import { useRef } from "react";

import { ButtonV1 } from "./button-v1";

export type TabItemV1 = {
  id: string;
  label: string;
};

export function TabsV1({
  items,
  activeId,
  onChange,
  ariaLabel = "Core modules",
}: {
  items: TabItemV1[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );

  function moveFocus(nextIndex: number) {
    if (items.length === 0) {
      return;
    }
    const boundedIndex =
      ((nextIndex % items.length) + items.length) % items.length;
    const nextItem = items[boundedIndex];
    if (!nextItem) {
      return;
    }
    onChange(nextItem.id);
    tabRefs.current[boundedIndex]?.focus();
  }

  return (
    <div
      className="tabs-v1"
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      data-tab-count={items.length}
    >
      {items.map((item, index) => (
        <ButtonV1
          key={item.id}
          id={`module-tab-${item.id}`}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          className="tabs-v1-tab"
          role="tab"
          tabIndex={index === activeIndex ? 0 : -1}
          aria-selected={item.id === activeId}
          aria-controls={`module-panel-${item.id}`}
          title={item.label}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              moveFocus(index + 1);
              return;
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              moveFocus(index - 1);
              return;
            }
            if (event.key === "Home") {
              event.preventDefault();
              moveFocus(0);
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
              moveFocus(items.length - 1);
            }
          }}
        >
          {item.label}
        </ButtonV1>
      ))}
    </div>
  );
}
