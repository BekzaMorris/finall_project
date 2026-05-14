import { OrderStatus } from './enums';

// ─── Order Types ─────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string; // Snapshot at order time
  productSlug: string;
  quantity: number;
  unitPrice: number; // Snapshot at order time
  totalPrice: number;
}

export interface StatusChange {
  from: OrderStatus;
  to: OrderStatus;
  changedBy: string;
  changedAt: Date;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // Sequential: ORD-000001
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;

  // Contact Info
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company?: string;
  notes?: string;
  deliveryAddress?: string;

  // Tracking
  assignedManagerId?: string;
  statusHistory: StatusChange[];

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  items: Array<{ productId: string; quantity: number }>;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company?: string;
  notes?: string;
  deliveryAddress?: string;
}
