// ─── Shared TypeScript Types for the Server Sales Portal ─────────────────────

// Enums
export {
  Condition,
  StockStatus,
  Role,
  OrderStatus,
  TicketStatus,
  TicketPriority,
} from './enums';

// Product
export type { Product, ProductImage } from './product';

// User
export type { User, SafeUser } from './user';

// Order
export type { Order, OrderItem, StatusChange, CreateOrderInput } from './order';

// Ticket
export type { Ticket, TicketMessage, CreateTicketInput } from './ticket';

// Cart
export type { CartItem } from './cart';

// Favorite
export type { Favorite } from './favorite';

// Configurator
export type {
  ConfiguratorState,
  WorkloadType,
  CpuConfig,
  RamConfig,
  StorageConfig,
  MatchResult,
} from './configurator';

// Catalog (filters, pagination, sort)
export type {
  ProductFilters,
  RangeFilter,
  CursorPagination,
  PaginatedResult,
  SortOption,
} from './catalog';

// Auth
export type { AuthResult, TokenPair, TokenPayload } from './auth';
