# Implementation Plan: Server Sales Portal

## Overview

This implementation plan covers the full-stack B2B/B2C Server Sales Portal built as a Turborepo monorepo with Next.js 15 frontend and Express.js 5 backend, backed by PostgreSQL 16 and Redis 7. Tasks are organized to build incrementally from infrastructure through core services to frontend pages, ensuring no orphaned code.

## Tasks

- [x] 1. Monorepo setup and shared packages
  - [x] 1.1 Initialize Turborepo monorepo with apps/web, apps/api, packages/ui, packages/types, packages/config
    - Create root package.json with Turborepo configuration
    - Set up turbo.json with build, dev, lint, test pipelines
    - Configure shared tsconfig, ESLint 9, and Prettier in packages/config
    - _Requirements: 17.5_

  - [x] 1.2 Set up packages/types with shared TypeScript interfaces
    - Define Product, Order, User, Ticket, ConfiguratorState, and all related types
    - Define API response types (PaginatedResult, AuthResult, TokenPair, etc.)
    - Define enums: Condition, StockStatus, Role, OrderStatus, TicketStatus, TicketPriority
    - _Requirements: 1.1, 6.2, 7.1, 8.1, 8.4_

  - [x] 1.3 Set up packages/ui with base Tailwind 4 configuration and theme system
    - Configure Tailwind with dark/light theme CSS variables
    - Create ThemeProvider component with localStorage persistence
    - Create base UI primitives: Button, Input, Select, Card, Badge, Modal
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 2. Database schema and Prisma setup
  - [x] 2.1 Initialize Prisma in apps/api with PostgreSQL 16 connection
    - Create Prisma schema with Product, User, Order, OrderItem, Ticket, TicketMessage, Cart, CartItem, Favorite, Quote models
    - Define all relations, indexes (condition, brand, price, cpu_cores, ram_gb, stock_status, created_at)
    - Add composite indexes for common filter combinations (condition+brand+price, cpu_cores+ram_gb)
    - Add full-text search index on products (name + description)
    - _Requirements: 1.2, 1.4, 2.1, 17.5_

  - [x] 2.2 Create seed script with sample data
    - Seed workload profiles, sample products (various conditions, specs), test users (CLIENT, MANAGER, ADMIN)
    - _Requirements: 3.1_


- [x] 3. Backend API foundation (Express.js 5)
  - [x] 3.1 Set up Express.js 5 app with middleware stack
    - Configure CORS, Helmet.js security headers, JSON body parser, cookie-parser
    - Set up global error handler with unique error reference IDs (no stack traces in responses)
    - Configure request logging and Sentry integration
    - _Requirements: 20.5, 20.6_

  - [x] 3.2 Implement Zod validation middleware
    - Create validateBody, validateQuery, validateParams middleware factories
    - Return 400 with field-specific error messages for invalid inputs
    - Reject unknown fields in request bodies
    - _Requirements: 16.1_

  - [x] 3.3 Implement Redis connection and caching middleware
    - Set up ioredis client with connection pooling
    - Create cache middleware with deterministic key generation (sorted JSON + SHA-256 hash)
    - Implement graceful fallback to DB when Redis is unavailable
    - _Requirements: 17.1, 17.4, 17.6_

  - [x]* 3.4 Write property test for cache key determinism
    - **Property 20: Cache Key Determinism**
    - **Validates: Requirement 17.4**

- [x] 4. Authentication and authorization
  - [x] 4.1 Implement Auth Service (register, login, refresh, logout)
    - Hash passwords with bcrypt (12 rounds)
    - Generate JWT access tokens (15min expiry) and refresh tokens (7d, httpOnly cookie)
    - Implement refresh token rotation (old token invalidated immediately)
    - Use constant-time comparison to prevent timing attacks
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_

  - [x] 4.2 Implement rate limiting middleware for login attempts
    - Track failed attempts per email in Redis (5 per 15min window)
    - Return 429 with Retry-After header when limit exceeded
    - Clear rate limit counter on successful login
    - _Requirements: 4.4_

  - [x]* 4.3 Write property tests for authentication
    - **Property 7: Token Validity and Rotation**
    - **Property 8: Rate Limit Enforcement**
    - **Property 9: Authentication Error Uniformity**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [x] 4.4 Implement RBAC middleware
    - Create requireAuth middleware (validates JWT, returns 401 if missing/invalid)
    - Create requireRole middleware (checks role hierarchy: ADMIN > MANAGER > CLIENT)
    - Return 403 for insufficient permissions
    - Enforce role checks before route handler execution
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x]* 4.5 Write property test for RBAC enforcement
    - **Property 10: RBAC Enforcement**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

  - [x] 4.6 Create auth routes (POST /api/auth/register, /api/auth/login, /api/auth/refresh, /api/auth/logout, GET /api/auth/me)
    - Wire Auth Service to Express routes with Zod validation schemas
    - Validate registration: email format, password (min 8 chars, uppercase, lowercase, digit)
    - Return generic "Invalid credentials" on login failure
    - _Requirements: 4.1, 4.2, 4.8, 4.9, 16.5, 16.6_


- [x] 5. Checkpoint - Ensure auth and infrastructure tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Catalog Service and product routes
  - [x] 6.1 Implement Catalog Service with filter query builder
    - Build Prisma queries from ProductFilters (condition, CPU, RAM, storage, price, brand, form factor, stock status)
    - Implement cursor-based pagination (fetch limit+1 for hasNext detection)
    - Support sort options: price_asc, price_desc, newest, popular (with ID tiebreaker)
    - Implement text search using PostgreSQL full-text search
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x]* 6.2 Write property tests for catalog filtering and pagination
    - **Property 1: Filter Consistency**
    - **Property 2: Pagination Completeness**
    - **Property 3: Sort Stability**
    - **Property 4: Count Accuracy**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

  - [x] 6.3 Implement catalog caching layer
    - Cache product listings with 10min TTL
    - Cache filter options with 1hr TTL
    - Implement targeted cache invalidation on product CRUD (within 5 seconds)
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 6.4 Create product routes (GET /api/products, GET /api/products/:slug, GET /api/products/count, GET /api/products/filters)
    - Wire Catalog Service to Express routes
    - Validate filter parameters with Zod (reject invalid values with specific error messages)
    - Return empty list with count 0 when no products match
    - _Requirements: 1.9, 1.10, 2.1, 2.2_

  - [x] 6.5 Implement product slug generation
    - Auto-generate URL-safe slugs from product name (lowercase, alphanumeric, hyphens, max 200 chars)
    - Append numeric suffix for uniqueness on collision
    - _Requirements: 2.3_

  - [x]* 6.6 Write property test for slug URL-safety
    - **Property 23: Slug URL-Safety**
    - **Validates: Requirement 2.3**

- [x] 7. Configurator Service
  - [x] 7.1 Implement Configurator Service with workload profiles and progressive matching
    - Define workload profiles (database, virtualization, web_hosting, ai_ml, file_storage, general)
    - Implement matchProducts: apply workload defaults then user selections
    - Ensure match count is monotonically non-increasing as steps advance
    - Convert configurator state to catalog filter parameters for redirect
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

  - [x]* 7.2 Write property tests for configurator
    - **Property 5: Configurator Progressive Narrowing**
    - **Property 6: Configurator-to-Catalog Equivalence**
    - **Validates: Requirements 3.5, 3.7**

  - [x] 7.3 Create configurator routes (POST /api/configurator/match, POST /api/configurator/quote, GET /api/configurator/workloads)
    - Wire Configurator Service to Express routes
    - Implement quote generation with email notification to managers
    - Retry email delivery up to 3 times at 1-minute intervals on failure
    - _Requirements: 3.6, 3.8, 3.9_


- [x] 8. Order Service and cart management
  - [x] 8.1 Implement Cart Service (add, remove, update quantity, get cart, clear)
    - Enforce max 99 quantity per line item, max 50 distinct items per cart
    - Persist cart in database (authenticated users)
    - _Requirements: 6.1_

  - [x] 8.2 Implement Order Service (create order, get orders, update status)
    - Create orders atomically within a database transaction
    - Validate product availability, rollback on out-of-stock (409 Conflict)
    - Assign sequential order numbers (ORD-NNNNNN format)
    - Snapshot product prices at order creation time
    - Calculate total as sum of (unitPrice × quantity)
    - Clear user cart on successful order creation
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x]* 8.3 Write property tests for order management
    - **Property 11: Order Atomicity**
    - **Property 12: Price Snapshot Integrity**
    - **Property 13: Order Total Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [x] 8.4 Implement order status workflow
    - Define valid transitions: PENDING→CONFIRMED/CANCELLED, CONFIRMED→PROCESSING/CANCELLED, PROCESSING→SHIPPED/CANCELLED, SHIPPED→DELIVERED
    - Record status history with manager ID, timestamp, optional note (max 500 chars)
    - Return 422 with allowed transitions on invalid transition attempt
    - _Requirements: 7.1, 7.2, 7.3_

  - [x]* 8.5 Write property test for order status workflow
    - **Property 14: Order Status Workflow Validity**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 8.6 Create order and cart routes
    - Cart: GET /api/cart, POST /api/cart/items, PATCH /api/cart/items/:id, DELETE /api/cart/items/:id
    - Orders: POST /api/orders, GET /api/orders, GET /api/orders/:id
    - Admin orders: GET /api/admin/orders, PATCH /api/admin/orders/:id/status
    - _Requirements: 6.1, 6.2, 6.9, 7.1, 13.1_

- [x] 9. Ticket Service
  - [x] 9.1 Implement Ticket Service (create, add message, update status, assign)
    - Create tickets with sequential number (TKT-NNNNNN), initial message, OPEN status
    - Validate subject (5-200 chars), message content (1-5000 chars), sanitize with DOMPurify
    - Enforce ticket status transitions (OPEN→IN_PROGRESS/RESOLVED/CLOSED, etc.)
    - Support internal messages visible only to MANAGER/ADMIN
    - Reject messages on CLOSED tickets
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8_

  - [x]* 9.2 Write property tests for ticket service
    - **Property 15: Ticket Status Workflow Validity**
    - **Property 16: Internal Message Visibility**
    - **Validates: Requirements 8.4, 8.7**

  - [x] 9.3 Create ticket routes
    - Client: POST /api/tickets, GET /api/tickets, GET /api/tickets/:id, POST /api/tickets/:id/messages
    - Admin: GET /api/admin/tickets, PATCH /api/admin/tickets/:id/status, PATCH /api/admin/tickets/:id/assign
    - _Requirements: 8.1, 8.2, 8.3, 13.2, 13.3, 13.4_

- [x] 10. Checkpoint - Ensure all backend service tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 11. File upload handling
  - [x] 11.1 Implement file upload service with S3/MinIO storage
    - Configure Multer for multipart uploads (max 10MB)
    - Validate MIME type (must start with 'image/') and magic bytes
    - Store files with unique key: {context}/{userId}/{uuid}.{ext}
    - Enforce permissions: product context requires MANAGER/ADMIN, ticket context requires any authenticated user
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x]* 11.2 Write property test for file upload validation
    - **Property 17: File Upload Validation**
    - **Validates: Requirements 9.1, 9.2**

  - [x] 11.3 Create upload routes (POST /api/uploads/product, POST /api/uploads/ticket)
    - Wire upload service with auth and role middleware
    - Return public URL and metadata on success
    - Return 400 with specific validation error on failure
    - _Requirements: 9.1, 9.3, 9.5, 9.6, 9.7_

- [x] 12. Input validation and sanitization
  - [x] 12.1 Implement comprehensive Zod schemas for all API endpoints
    - Product validation: price positive (max 2 decimals), CPU cores 1-128, CPU count 1-8, RAM power of 2 (8-2048), units 1-48, PSU 100-3000
    - User validation: email RFC 5322 (max 255), password 8-72 chars with uppercase+lowercase+digit
    - Ticket validation: subject 5-200 chars, message 1-5000 chars (trimmed, no whitespace-only)
    - _Requirements: 12.1, 16.1, 16.3, 16.4, 16.5, 16.6_

  - [x]* 12.2 Write property tests for input validation
    - **Property 18: Input Validation Correctness**
    - **Property 21: Product Validation Rules**
    - **Validates: Requirements 12.1, 16.1, 16.3, 16.4, 16.5, 16.6**

  - [x] 12.3 Implement DOMPurify sanitization for rich text content
    - Sanitize ticket messages and product descriptions before persistence
    - Strip script tags, event handlers, javascript: URLs
    - _Requirements: 16.2_

  - [x]* 12.4 Write property test for XSS sanitization
    - **Property 19: XSS Sanitization**
    - **Validates: Requirement 16.2**

- [x] 13. Email notification service
  - [x] 13.1 Implement email service with Nodemailer
    - Create email templates: order confirmation, order status change, ticket notification, quote request
    - Send emails asynchronously (within 60 seconds of triggering event)
    - Implement retry with exponential backoff (up to 3 attempts, starting at 1 second)
    - Never block primary operations on email failure
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [x] 13.2 Wire email notifications to order and ticket services
    - Order created: confirmation to customer + notification to all managers
    - Order status change: notification to customer with order number, new status, notes
    - Ticket message from customer: notify assigned manager (or all managers if unassigned)
    - Ticket message from manager (non-internal): notify customer
    - _Requirements: 6.7, 6.8, 7.4, 7.5, 8.6, 15.1, 15.2, 15.3, 15.4_

- [x] 14. Admin product management routes
  - [x] 14.1 Implement admin product CRUD
    - POST /api/admin/products, PATCH /api/admin/products/:id, DELETE /api/admin/products/:id
    - Validate all product fields per validation rules
    - Soft-delete products (mark inactive, preserve order history references)
    - Support custom fields (JSONB) with label, type, value, showInFilter
    - Invalidate Redis cache on create/update/delete
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x]* 14.2 Write property test for custom fields round-trip
    - **Property 22: Custom Fields Round-Trip**
    - **Validates: Requirement 12.4**

- [x] 15. User management and favorites
  - [x] 15.1 Implement admin user management routes
    - GET /api/admin/users (paginated, filterable)
    - PATCH /api/admin/users/:id/role (change role, invalidate cached permissions)
    - PATCH /api/admin/users/:id/deactivate (revoke all refresh tokens, reject future auth)
    - Prevent admin from changing own role or deactivating own account (403)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 15.2 Implement favorites/wishlist routes
    - POST /api/favorites/:productId, DELETE /api/favorites/:productId, GET /api/favorites
    - Idempotent add (no duplicates), 404 for non-existent products
    - Cursor-based pagination, exclude deleted products
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_


- [x] 16. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Frontend foundation (Next.js 15)
  - [x] 17.1 Initialize Next.js 15 app with App Router in apps/web
    - Configure next.config with API proxy, ISR settings, image optimization
    - Set up Tailwind 4 with theme system integration from packages/ui
    - Configure @tanstack/react-query provider and Zustand stores
    - Set up API client with JWT interceptor (auto-refresh on 401)
    - _Requirements: 18.1, 19.3, 20.2_

  - [x] 17.2 Create shared layout with navigation, theme toggle, and footer
    - Implement responsive header with logo, nav links, cart icon, user menu
    - Add theme toggle button (dark/light switch, <300ms transition, no page reload)
    - Apply saved theme preference from localStorage before first paint
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 18. Frontend authentication pages
  - [x] 18.1 Create login page (/login)
    - Form with email and password fields, Zod validation
    - Display rate limit countdown on 429 response
    - Redirect to previous page on success
    - _Requirements: 4.2, 4.4_

  - [x] 18.2 Create registration page (/register)
    - Form with name, email, password, optional company and phone
    - Client-side validation matching server rules (password strength, email format)
    - _Requirements: 4.1, 4.8, 4.9_

- [x] 19. Catalog frontend pages
  - [x] 19.1 Create catalog page (/catalog) with SSR and ISR
    - Server component fetching products with filters from URL search params
    - ISR with 10-minute revalidation interval
    - Render product grid with images, price, condition badge, stock status
    - _Requirements: 1.1, 19.3_

  - [x] 19.2 Implement filter sidebar component
    - Render all filter categories (condition, CPU, RAM, storage, form factor, price, brand, stock)
    - Debounced count updates (300ms) when filters change
    - URL-synced filter state (shareable URLs)
    - _Requirements: 1.2, 1.5_

  - [x] 19.3 Implement cursor-based pagination controls
    - Next/Previous page buttons using cursor tokens
    - Display total count and current page position
    - _Requirements: 1.1, 1.3_

  - [x] 19.4 Implement product search with autocomplete
    - Debounced search input (1-200 characters)
    - Display results ordered by matching term count
    - _Requirements: 1.6_

  - [x] 19.5 Create product detail page (/catalog/[slug])
    - Server component with full specifications display
    - Image gallery, pricing, condition, stock status
    - Add to cart button, add to favorites, add to comparison
    - SEO metadata (title, description, canonical URL)
    - _Requirements: 2.1, 2.2, 2.5, 19.1, 19.2, 19.4, 19.5_

- [x] 20. Server comparison page
  - [x] 20.1 Implement server comparison feature (/compare)
    - Allow 2-4 servers side-by-side comparison
    - Show all hardware specs, pricing, condition, stock status in columns
    - Prevent adding beyond 4 servers (show message)
    - Remove server updates view within 1 second
    - Exit comparison view if fewer than 2 servers remain
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_


- [x] 21. Configurator wizard frontend
  - [x] 21.1 Create configurator page (/configurator) with 4-step wizard UI
    - Step 1: Workload type selection (cards with icons)
    - Step 2: CPU configuration (family, cores range, count, frequency, socket)
    - Step 3: RAM configuration (size range, type, frequency)
    - Step 4: Storage configuration (type, size range, hot-swap, count)
    - Sidebar showing live match count at each step
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 21.2 Implement Zustand configurator store with API integration
    - Manage configurator state across steps
    - Fetch match results on each step change
    - Implement "Show Results" (redirect to catalog with filters)
    - Implement "Send Request" (quote form with contact info)
    - Display notification when match count reaches zero
    - _Requirements: 3.5, 3.6, 3.7, 3.8_

- [x] 22. Cart and order frontend pages
  - [x] 22.1 Create cart page (/cart)
    - Display cart items with product info, quantity controls, line totals
    - Show order total, proceed to checkout button
    - Handle empty cart state
    - _Requirements: 6.1_

  - [x] 22.2 Create checkout/order submission flow
    - Contact information form (name, email, phone, optional company, delivery address, notes)
    - Client-side validation matching server rules
    - Handle 409 Conflict (out-of-stock) with specific product feedback
    - Show order confirmation with order number on success
    - _Requirements: 6.2, 6.3, 6.4, 20.1_

  - [x] 22.3 Create order history page (/orders) and order detail page (/orders/[id])
    - List orders with status badges, dates, totals (cursor-paginated)
    - Order detail: items, status timeline, contact info
    - _Requirements: 6.9, 7.3_

- [x] 23. Support ticket frontend pages
  - [x] 23.1 Create tickets list page (/tickets) and create ticket form
    - List user's tickets with status, priority, date (cursor-paginated)
    - Create ticket form: subject, message, priority selector, optional order link
    - File attachment upload (max 5 per message, max 10MB each, images only)
    - _Requirements: 8.1, 8.2_

  - [x] 23.2 Create ticket detail page (/tickets/[id]) with chat-like messaging
    - Display messages in chronological order (chat UI)
    - Message input with file attachment support
    - Show ticket status and assigned manager
    - Disable messaging for CLOSED tickets
    - _Requirements: 8.2, 8.7, 8.8_

- [x] 24. Favorites page
  - [x] 24.1 Create favorites page (/favorites)
    - Display favorited products with current pricing and stock status
    - Cursor-based pagination
    - Remove from favorites action
    - _Requirements: 11.1, 11.4, 11.5_

- [x] 25. Checkpoint - Ensure all frontend pages render correctly
  - Ensure all tests pass, ask the user if questions arise.


- [x] 26. Admin panel - Layout and dashboard
  - [x] 26.1 Create admin layout (/admin) with sidebar navigation
    - Protected route (MANAGER/ADMIN only)
    - Sidebar: Dashboard, Products, Orders, Tickets, Users, Settings
    - Responsive layout with collapsible sidebar
    - _Requirements: 5.4, 5.5_

- [ ] 27. Admin panel - Product management
  - [-] 27.1 Create admin products page (/admin/products)
    - Product list with search, filter by condition/stock status
    - Create/Edit product form with all specification fields
    - Image upload management (1-20 images per product)
    - Custom fields editor (JSONB: label, type, value, showInFilter)
    - Delete product (soft-delete confirmation)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 2.4_

- [ ] 28. Admin panel - Order management
  - [-] 28.1 Create admin orders page (/admin/orders)
    - Order list with filtering by status, date range, customer
    - Cursor-based pagination, default sort by newest
    - Order detail view with status update controls
    - Show only valid next statuses as options
    - Status change form with optional note (max 500 chars)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 13.1, 20.4_

- [ ] 29. Admin panel - Ticket management
  - [-] 29.1 Create admin tickets page (/admin/tickets)
    - Ticket list with filtering by status, priority, assignment, date range
    - Cursor-based pagination, default sort by newest
    - Ticket detail with full message thread
    - Assign ticket to manager, change status
    - Internal notes (visible only to MANAGER/ADMIN)
    - _Requirements: 8.3, 8.4, 8.7, 13.2, 13.3, 13.4_

- [ ] 30. Admin panel - User management
  - [-] 30.1 Create admin users page (/admin/users)
    - User list with roles, active status, last login (cursor-paginated)
    - Change user role (CLIENT/MANAGER/ADMIN)
    - Deactivate/activate user accounts
    - Prevent self-role-change and self-deactivation
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 31. SEO optimization
  - [ ] 31.1 Implement SEO metadata across all public pages
    - Product pages: custom SEO title (max 60 chars) and description (max 160 chars) with fallbacks
    - Catalog pages: dynamic meta based on active filters
    - Canonical URLs on all product pages
    - Structured data (JSON-LD) for products
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 32. Error handling and resilience
  - [ ] 32.1 Implement frontend error handling and token refresh interceptor
    - Axios/fetch interceptor: auto-refresh on 401 within 3 seconds, retry original request
    - Redirect to login if refresh fails
    - Display user-friendly error messages with reference IDs
    - Handle 503 gracefully (service unavailable page)
    - _Requirements: 20.1, 20.2, 20.3, 20.5_

  - [ ] 32.2 Implement backend resilience patterns
    - Serve stale cached data for read endpoints when DB is unreachable (max 30min age)
    - Return 503 for write endpoints when DB is unreachable
    - External service failures (email, S3) don't block primary operations
    - Retry failed external operations up to 3 times with exponential backoff
    - _Requirements: 20.3, 20.6_

- [ ] 33. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout (Next.js 15, Express.js 5, Prisma, Vitest, fast-check)
- All API responses use cursor-based pagination for consistent performance
- Redis caching is used throughout with graceful fallback when unavailable

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.6"] },
    { "id": 6, "tasks": ["4.5", "6.1", "7.1", "8.1", "9.1", "11.1", "12.1"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.5", "7.2", "7.3", "8.2", "9.3", "11.2", "11.3", "12.2", "12.3"] },
    { "id": 8, "tasks": ["6.4", "6.6", "8.3", "8.4", "9.2", "12.4", "13.1"] },
    { "id": 9, "tasks": ["8.5", "8.6", "13.2", "14.1", "15.1", "15.2"] },
    { "id": 10, "tasks": ["14.2", "17.1"] },
    { "id": 11, "tasks": ["17.2", "18.1", "18.2"] },
    { "id": 12, "tasks": ["19.1", "19.2", "19.3", "19.4"] },
    { "id": 13, "tasks": ["19.5", "20.1", "21.1", "21.2"] },
    { "id": 14, "tasks": ["22.1", "22.2", "22.3", "23.1", "23.2", "24.1"] },
    { "id": 15, "tasks": ["26.1"] },
    { "id": 16, "tasks": ["27.1", "28.1", "29.1", "30.1"] },
    { "id": 17, "tasks": ["31.1", "32.1", "32.2"] }
  ]
}
```
