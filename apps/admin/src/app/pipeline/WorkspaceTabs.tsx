"use client";

import type { TabKey } from "./types";

const TAB_LABELS: Record<TabKey, string> = {
  original: "Original",
  thumbnail: "Thumbnail",
  detail: "Detail",
};

const TAB_ORDER: TabKey[] = ["original", "thumbnail", "detail"];

export function WorkspaceTabs({
  active,
  counts,
  onChange,
}: {
  active: TabKey;
  counts: Record<TabKey, number>;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-zinc-200">
      {TAB_ORDER.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === tab
              ? "border-b-2 border-black text-black"
              : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          {TAB_LABELS[tab]} ({counts[tab]})
        </button>
      ))}
    </div>
  );
}
