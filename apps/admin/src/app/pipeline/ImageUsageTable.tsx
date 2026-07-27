"use client";

import type { CanonicalProduct } from "@commerce/shared";
import type { WorkspaceItem } from "./types";

/**
 * 카드마다 있는 대표/상품/상세 컨트롤과 같은 데이터를 표 형태로 한눈에 보여준다
 * (읽기 전용 — 수정은 카드에서만 한다. 같은 상태를 두 군데서 각각 관리하면
 * 어긋날 수 있어서, 이 표는 product.images를 그대로 반영만 한다).
 */
export function ImageUsageTable({
  product,
  items,
}: {
  product: CanonicalProduct;
  items: WorkspaceItem[];
}) {
  if (product.images.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-background text-text-secondary">
          <tr>
            <th className="px-3 py-2 font-medium">사진</th>
            <th className="px-3 py-2 font-medium">타입</th>
            <th className="px-3 py-2 text-center font-medium">대표</th>
            <th className="px-3 py-2 text-center font-medium">상품</th>
            <th className="px-3 py-2 text-center font-medium">상세</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {product.images.map((image) => {
            const item = items.find((existing) => existing.id === image.id);
            return (
              <tr key={image.id}>
                <td className="px-3 py-1.5 text-text-primary">{item?.fileName ?? image.id}</td>
                <td className="px-3 py-1.5 text-text-secondary">{image.classification}</td>
                <td className="px-3 py-1.5 text-center">{image.isRepresentative ? "●" : "○"}</td>
                <td className="px-3 py-1.5 text-center">{image.useInProductGallery ? "●" : "○"}</td>
                <td className="px-3 py-1.5 text-center">{image.useInDescription ? "●" : "○"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
