// ─── Cart Types ──────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}
