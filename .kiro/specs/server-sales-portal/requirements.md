# Requirements Document

## Introduction

The Server Sales Portal is a full-stack B2B/B2C web application for selling new and used physical servers. The system provides a server catalog with advanced filtering, a 4-step server configurator wizard, a support ticket system, order management, and a comprehensive admin panel. It is built as a Turborepo monorepo with Next.js 15 frontend and Express.js 5 backend, backed by PostgreSQL 16 and Redis 7.

## Glossary

- **Portal**: The Server Sales Portal web application
- **Catalog_Service**: The backend service responsible for product listing, filtering, searching, and pagination
- **Configurator_Service**: The backend service implementing the 4-step server configurator wizard
- **Auth_Service**: The backend service handling user authentication, token management, and session lifecycle
- **Order_Service**: The backend service managing the order lifecycle from cart to fulfillment tracking
- **Ticket_Service**: The backend service managing the support ticket system with chat-like messaging
- **Admin_Panel**: The administrative interface for managing products, orders, tickets, users, and settings
- **Client**: A registered user with the CLIENT role who browses and orders servers
- **Manager**: A registered user with the MANAGER role who manages orders and tickets
- **Admin**: A registered user with the ADMIN role who has full system access
- **Product**: A server listing in the catalog with full hardware specifications
- **Configurator**: The 4-step wizard that guides users through workload → CPU → RAM → storage selection
- **Ticket**: A support request with chat-like threaded messaging
- **Order**: A purchase request submitted by a client, managed by a manager

## Requirements

### Requirement 1: Server Catalog Browsing

**User Story:** As a client, I want to browse the server catalog with advanced filtering, so that I can find servers matching my specific hardware requirements.

#### Acceptance Criteria

1. WHEN a client visits the catalog page without specifying a page size, THE Catalog_Service SHALL return a paginated list of products using cursor-based pagination with a default page size of 20 and a configurable page size between 1 and 100
2. WHEN a client applies filters (condition, CPU family, CPU cores range, CPU count, CPU frequency range, CPU socket, RAM size range, RAM type, RAM frequency range, RAM slots, storage type, storage size range, hot-swap, form factor, units, PSU wattage range, price range, brand, stock status), THE Catalog_Service SHALL return only products matching ALL active filter criteria
3. WHEN a client navigates between pages using cursors, THE Catalog_Service SHALL return a complete dataset with no duplicates and no skipped items across all pages
4. WHEN a client applies a sort option (price ascending, price descending, newest, popular), THE Catalog_Service SHALL return products in the specified order with stable ordering for equal sort keys using product ID as the tiebreaker
5. WHEN filter parameters change, THE Catalog_Service SHALL return an accurate total count matching the number of products satisfying the active filters
6. WHEN a client searches for products by text query of at least 1 character and no more than 200 characters, THE Catalog_Service SHALL return products whose name or description contains all search terms, ordered by the number of matching terms descending
7. WHILE product data has not changed within the last 10 minutes, THE Catalog_Service SHALL serve cached results from Redis instead of querying the database
8. WHEN product data changes, THE Catalog_Service SHALL invalidate the corresponding cached results within 5 seconds
9. IF a client provides filter parameters with invalid values or out-of-range page size, THEN THE Catalog_Service SHALL reject the request with an error message indicating which parameters are invalid without executing the query
10. IF no products match the active filters or search query, THEN THE Catalog_Service SHALL return an empty product list with a total count of zero

### Requirement 2: Product Detail Pages

**User Story:** As a client, I want to view detailed product pages with full specifications, so that I can make informed purchasing decisions.

#### Acceptance Criteria

1. WHEN a client requests a product by its URL slug, THE Catalog_Service SHALL return the complete product record including all hardware specifications, images, custom fields, and SEO metadata
2. IF a product slug does not exist or the product is not in a published state, THEN THE Catalog_Service SHALL return a 404 Not Found response
3. WHEN a product is created or its name is updated, THE Portal SHALL generate a URL-safe slug using only lowercase alphanumeric characters and hyphens, with a maximum length of 200 characters, and SHALL append a numeric suffix to ensure uniqueness if a collision exists
4. IF a user attempts to publish a product that has fewer than 1 image or more than 20 images, THEN THE Portal SHALL reject the publish action with an error message indicating the image count must be between 1 and 20
5. WHEN displaying a product, THE Portal SHALL show condition, stock status, price, original price (if discounted), brand, model, and all CPU, RAM, storage, and physical specifications

### Requirement 3: Server Configurator Wizard

**User Story:** As a client, I want to use a step-by-step configurator to find servers matching my workload requirements, so that I can narrow down options without manually setting filters.

#### Acceptance Criteria

1. WHEN a client selects a workload type in step 1, THE Configurator_Service SHALL apply the workload profile defaults (minimum cores, minimum RAM, storage type) and return the first page of matching products (maximum 50 per page) with a total match count
2. WHEN a client configures CPU parameters in step 2, THE Configurator_Service SHALL narrow the product matches using the specified CPU family, cores range, count, frequency range, and socket, and return the updated match count
3. WHEN a client configures RAM parameters in step 3, THE Configurator_Service SHALL further narrow matches using the specified RAM size range, type, and frequency, and return the updated match count
4. WHEN a client configures storage parameters in step 4, THE Configurator_Service SHALL further narrow matches using the specified storage type, size range, hot-swap preference, and count, and return the updated match count
5. WHEN a client advances through configurator steps, THE Configurator_Service SHALL ensure the match count is monotonically non-increasing (more constraints produce fewer or equal matches)
6. IF the match count reaches zero at any configurator step, THEN THE Configurator_Service SHALL display a notification indicating no products match the current criteria and allow the client to revise parameters in the current or previous steps
7. WHEN a client clicks "Show Results", THE Configurator_Service SHALL convert the configurator state to catalog filter parameters preserving all selected constraints and redirect to the catalog page with those filters applied
8. WHEN a client clicks "Send Request" with contact information (name, email address, and phone number), THE Configurator_Service SHALL generate a quote request containing all selected configuration parameters from every completed step and send a notification email to managers within 5 minutes
9. IF the notification email to managers fails to send, THEN THE Configurator_Service SHALL retry delivery up to 3 times at 1-minute intervals and display a confirmation to the client that the quote request was received regardless of email delivery status

### Requirement 4: User Authentication

**User Story:** As a user, I want to register and log in securely, so that I can access personalized features and manage my orders.

#### Acceptance Criteria

1. WHEN a user registers with a valid email, password (minimum 8 characters), name, and optional company and phone, THE Auth_Service SHALL create a new account with the CLIENT role, hash the password with bcrypt (12 rounds), and return a JWT access token (15-minute expiry) and a refresh token (7-day expiry stored as httpOnly cookie in Redis)
2. WHEN a user logs in with valid credentials, THE Auth_Service SHALL issue a JWT access token (15-minute expiry) and a refresh token (7-day expiry stored as httpOnly cookie in Redis)
3. WHEN a user presents a valid refresh token, THE Auth_Service SHALL issue a new access token (15-minute expiry) and rotate the refresh token with a new 7-day expiry (old token becomes invalid immediately)
4. IF more than 5 failed login attempts occur for the same email within 15 minutes, THEN THE Auth_Service SHALL reject all subsequent attempts with a 429 status and Retry-After header until the rate limit window expires
5. IF a login attempt fails, THEN THE Auth_Service SHALL return a generic "Invalid credentials" message without revealing whether the email exists in the system
6. WHEN a user logs out, THE Auth_Service SHALL revoke the refresh token in Redis, preventing further token refresh
7. THE Auth_Service SHALL use constant-time password comparison to prevent timing-based user enumeration attacks
8. IF a user attempts to register with an email that already exists, THEN THE Auth_Service SHALL reject the request with an error message indicating the email is already registered
9. IF a user attempts to register with a password shorter than 8 characters or an email that does not conform to a valid email format, THEN THE Auth_Service SHALL reject the request with an error message indicating which validation rule failed

### Requirement 5: Role-Based Access Control

**User Story:** As a system administrator, I want to enforce role-based access control, so that users can only access features appropriate to their role.

#### Acceptance Criteria

1. THE Portal SHALL support three roles: CLIENT, MANAGER, and ADMIN with hierarchical permissions where ADMIN includes all MANAGER permissions and MANAGER includes all CLIENT permissions
2. WHEN an unauthenticated user attempts to access admin endpoints, THE Portal SHALL return a 401 Unauthorized response
3. WHEN a CLIENT-role user attempts to access admin endpoints, THE Portal SHALL return a 403 Forbidden response
4. WHEN a MANAGER-role user accesses admin endpoints, THE Portal SHALL allow access to order management, ticket management, and product viewing, but SHALL return 403 for user management, product CRUD, and system settings
5. WHEN an ADMIN-role user accesses admin endpoints, THE Portal SHALL allow full access including user management, product CRUD, and system settings
6. THE Portal SHALL enforce role checks via middleware on every protected API route before executing the route handler
7. WHEN a user's role is changed, THE Portal SHALL enforce the new permissions on the user's next request without requiring re-authentication

### Requirement 6: Shopping Cart and Order Management

**User Story:** As a client, I want to add servers to a cart and submit orders, so that I can purchase servers through the portal.

#### Acceptance Criteria

1. WHEN a client adds a product to the cart, THE Order_Service SHALL add the product with the specified quantity (minimum 1, maximum 99 per line item) to the client's cart, and SHALL support a maximum of 50 distinct line items per cart
2. WHEN a client submits an order with items, contact information (name, email, phone number), and optional delivery address, THE Order_Service SHALL validate product availability, validate that all required contact fields are non-empty and that email matches a valid email format, create the order atomically within a database transaction, assign a sequential order number (format: ORD-NNNNNN), set the order status to PENDING, and clear the user's cart
3. IF any product in the order is out of stock at submission time, THEN THE Order_Service SHALL rollback the transaction and return a 409 Conflict response identifying the unavailable products by name and requested quantity
4. IF the submitted contact information is missing required fields or contains an invalid email format, THEN THE Order_Service SHALL reject the order and return a response indicating which fields failed validation
5. WHEN an order is created, THE Order_Service SHALL snapshot each product's current price (to 2 decimal places) as the unit price in the order item, ensuring price changes after order creation do not affect the order total
6. THE Order_Service SHALL calculate the order total as the sum of (unit price × quantity) for all order items, and this total SHALL remain consistent with the individual item calculations
7. WHEN an order is successfully created, THE Order_Service SHALL send a confirmation email to the customer and a notification email to all managers within 60 seconds of order creation
8. IF email delivery fails after order creation, THEN THE Order_Service SHALL retain the order as successfully created and queue the failed email for retry up to 3 attempts
9. WHEN a client requests their order history, THE Order_Service SHALL return orders sorted by creation date descending using cursor-based pagination with a default page size of 20 and a maximum page size of 100

### Requirement 7: Order Status Workflow

**User Story:** As a manager, I want to update order statuses through a defined workflow, so that clients can track their order progress.

#### Acceptance Criteria

1. THE Order_Service SHALL enforce the following status transitions: PENDING → CONFIRMED or CANCELLED; CONFIRMED → PROCESSING or CANCELLED; PROCESSING → SHIPPED or CANCELLED; SHIPPED → DELIVERED; DELIVERED and CANCELLED are terminal states
2. IF a manager attempts an invalid status transition, THEN THE Order_Service SHALL reject the request with an error listing the allowed transitions from the current status
3. WHEN an order status changes, THE Order_Service SHALL record the transition in the status history with the previous status, new status, manager ID, timestamp, and optional note of at most 500 characters
4. WHEN an order status changes, THE Order_Service SHALL send an email notification to the customer within 60 seconds, including the order identifier, the new status, and a timestamp of the change
5. IF the email notification fails to send after up to 3 retry attempts, THEN THE Order_Service SHALL preserve the status change and the status history record, and log the notification failure for later retry

### Requirement 8: Support Ticket System

**User Story:** As a client, I want to create support tickets and communicate with managers through chat-like messaging, so that I can get help with orders and technical questions.

#### Acceptance Criteria

1. WHEN a client creates a ticket with subject (5-200 characters), message (1-5000 characters), priority (LOW, MEDIUM, HIGH, URGENT), and optional order link, THE Ticket_Service SHALL create the ticket with status OPEN, an initial message, and assign a sequential ticket number (format: TKT-NNNNNN)
2. WHEN a user adds a message (1-5000 characters) to a ticket that is not in CLOSED status, THE Ticket_Service SHALL append the message with optional file attachments (max 5 per message, max 10MB each, accepted formats: JPEG, PNG, GIF, WebP)
3. WHEN a manager assigns a ticket to themselves, THE Ticket_Service SHALL update the ticket's assigned manager, replacing any previous assignment
4. THE Ticket_Service SHALL enforce ticket status transitions: OPEN → IN_PROGRESS or RESOLVED or CLOSED; IN_PROGRESS → WAITING_CUSTOMER or RESOLVED or CLOSED; WAITING_CUSTOMER → IN_PROGRESS or RESOLVED or CLOSED; RESOLVED → CLOSED or OPEN; CLOSED is a terminal state
5. IF a user attempts a status transition not permitted by the defined transitions, THEN THE Ticket_Service SHALL reject the request and return an error indicating the current status and the allowed transitions
6. WHEN a new message is added or ticket status changes, THE Ticket_Service SHALL send an email notification to the ticket's creator (client) and the assigned manager, excluding the user who triggered the event
7. WHERE a message is marked as internal, THE Ticket_Service SHALL make it visible only to users with MANAGER or ADMIN roles
8. IF a user attempts to add a message to a ticket in CLOSED status, THEN THE Ticket_Service SHALL reject the message and return an error indicating the ticket is closed

### Requirement 9: File Upload Handling

**User Story:** As a user, I want to upload images for tickets and product listings, so that I can provide visual context.

#### Acceptance Criteria

1. WHEN a user uploads a file, THE Portal SHALL validate the MIME type (must start with 'image/'), verify magic bytes match the declared type, and enforce a maximum size of 10MB
2. IF a file fails MIME type, magic byte, or size validation, THEN THE Portal SHALL reject the upload and return a 400 error with a message identifying which validation check failed
3. WHEN a file passes validation, THE Portal SHALL store it in S3/MinIO with a unique key following the pattern: {context}/{userId}/{uuid}.{ext}
4. IF storage to S3/MinIO fails during upload, THEN THE Portal SHALL return an error indicating the file could not be stored and SHALL NOT create any reference to the unstored file
5. WHEN a user with MANAGER or ADMIN role uploads an image in the product context, THE Portal SHALL accept and store the file
6. IF a user without MANAGER or ADMIN role attempts to upload an image in the product context, THEN THE Portal SHALL reject the upload and return a 403 error indicating insufficient permissions
7. WHEN any authenticated user uploads an image in the ticket context, THE Portal SHALL accept and store the file
8. IF an unauthenticated user attempts to upload a file, THEN THE Portal SHALL reject the request and return a 401 error indicating authentication is required

### Requirement 10: Server Comparison

**User Story:** As a client, I want to compare up to 4 servers side-by-side, so that I can evaluate differences in specifications and pricing.

#### Acceptance Criteria

1. WHEN a client selects servers for comparison, THE Portal SHALL allow a minimum of 2 and a maximum of 4 servers to be compared simultaneously
2. IF a client attempts to add a server when 4 servers are already selected for comparison, THEN THE Portal SHALL prevent the addition and display a message indicating the maximum of 4 servers has been reached
3. WHEN displaying a comparison, THE Portal SHALL show all hardware specifications (CPU, RAM, storage, chassis form factor), pricing, condition, and stock status in a side-by-side layout
4. WHEN a client removes a server from comparison, THE Portal SHALL update the comparison view within 1 second
5. IF a client removes a server resulting in fewer than 2 servers remaining in comparison, THEN THE Portal SHALL exit the comparison view and retain the remaining server in the selection

### Requirement 11: Favorites and Wishlist

**User Story:** As a client, I want to save servers to a favorites list, so that I can quickly access products I am interested in.

#### Acceptance Criteria

1. WHEN an authenticated client adds a product to favorites, THE Portal SHALL persist the favorite association for that user and return a success confirmation
2. IF an authenticated client adds a product that is already in their favorites, THEN THE Portal SHALL return a success response without creating a duplicate entry
3. IF an authenticated client adds a product that does not exist, THEN THE Portal SHALL return a 404 Not Found response
4. WHEN an authenticated client removes a product from favorites, THE Portal SHALL delete the favorite association and return a success confirmation
5. WHEN an authenticated client views their favorites list, THE Portal SHALL return all favorited products with current pricing, stock status, and condition using cursor-based pagination with a configurable page size between 1 and 100
6. IF a favorited product has been deleted from the catalog, THEN THE Portal SHALL exclude it from the favorites list

### Requirement 12: Admin Product Management

**User Story:** As an admin, I want to create, update, and delete products, so that I can maintain an accurate and up-to-date server catalog.

#### Acceptance Criteria

1. WHEN an admin creates or updates a product, THE Portal SHALL validate all fields according to the product validation rules: price must be positive with max 2 decimal places; CPU cores 1-128; CPU count 1-8; RAM must be a power of 2 (8-2048 GB); units 1-48; PSU wattage 100-3000
2. WHEN a product is created or updated, THE Catalog_Service SHALL invalidate all Redis cache entries that contain the affected product to ensure fresh data on subsequent requests
3. WHEN an admin deletes a product, THE Portal SHALL soft-delete the product (mark as inactive) preserving order history that references the product, and remove it from catalog listings
4. THE Portal SHALL support custom fields (JSONB) on products with each field containing a label, type (text, number, boolean, list), value, and optional showInFilter flag
5. IF an admin submits a product with fields that violate validation rules, THEN THE Portal SHALL reject the request with a 400 error listing all fields that failed validation

### Requirement 13: Admin Order and Ticket Management

**User Story:** As a manager, I want to view and manage all orders and tickets, so that I can process customer requests efficiently.

#### Acceptance Criteria

1. WHEN a manager views the admin order list, THE Portal SHALL provide filtering by status, date range, and customer, with cursor-based pagination supporting a configurable page size between 1 and 100, and a default sort order of most recently created first
2. WHEN a manager views the admin ticket list, THE Portal SHALL provide filtering by status, priority, assignment, and date range, with cursor-based pagination supporting a configurable page size between 1 and 100, and a default sort order of most recently created first
3. WHEN a manager assigns a ticket to a user with MANAGER or ADMIN role, THE Portal SHALL update the ticket assignment and send an email notification to the newly assigned user
4. IF a manager attempts to assign a ticket to a user who does not have MANAGER or ADMIN role, THEN THE Portal SHALL return a 422 error indicating the target user is not a valid assignee

### Requirement 14: User Management

**User Story:** As an admin, I want to manage user accounts, so that I can control access and maintain system security.

#### Acceptance Criteria

1. WHEN an admin views the user list, THE Portal SHALL display all users with their roles, active status, and last login date, using cursor-based pagination with a configurable page size between 1 and 100
2. WHEN an admin changes a user's role to one of the valid roles (CLIENT, MANAGER, ADMIN), THE Portal SHALL update the role and invalidate all cached permissions so that the new permissions are enforced on the user's next request
3. WHEN an admin deactivates a user account, THE Auth_Service SHALL revoke all existing refresh tokens for that account in Redis and reject all subsequent authentication attempts for that account
4. IF an admin attempts to change their own role or deactivate their own account, THEN THE Portal SHALL reject the request with a 403 Forbidden response
5. IF an admin attempts to assign a role that is not one of CLIENT, MANAGER, or ADMIN, THEN THE Portal SHALL return a 400 error indicating the invalid role value

### Requirement 15: Email Notifications

**User Story:** As a user, I want to receive email notifications for important events, so that I stay informed about my orders and tickets.

#### Acceptance Criteria

1. WHEN an order is created, THE Portal SHALL send a confirmation email to the customer including the order number, list of ordered items with quantities and unit prices, order total, and delivery address if provided
2. WHEN an order status changes, THE Portal SHALL send a notification email to the customer with the order number, previous status, new status, and any manager notes recorded with the transition
3. WHEN a new ticket message is received from a customer, THE Portal SHALL send a notification email to the assigned manager; IF no manager is assigned, THEN THE Portal SHALL send the notification to all managers
4. WHEN a new non-internal ticket message is received from a manager, THE Portal SHALL send a notification email to the ticket's customer
5. WHEN a configurator quote request is submitted, THE Portal SHALL send a notification email to all managers including the selected workload type, CPU parameters, RAM parameters, storage parameters, and the submitter's contact information
6. IF email delivery fails, THEN THE Portal SHALL retry delivery up to 3 times with exponential backoff and log the failure without blocking the triggering operation
7. THE Portal SHALL send all notification emails asynchronously within 60 seconds of the triggering event under normal operating conditions

### Requirement 16: Input Validation and Sanitization

**User Story:** As a system operator, I want all user inputs validated and sanitized, so that the system is protected from malformed data and injection attacks.

#### Acceptance Criteria

1. IF an API request contains unknown fields or fields that fail Zod schema validation, THEN THE Portal SHALL reject the request with a 400 Bad Request response containing an error message indicating which fields failed validation
2. WHEN user-provided rich text content is stored, THE Portal SHALL sanitize it with DOMPurify before persistence to prevent XSS attacks
3. THE Portal SHALL validate ticket message content: minimum 1 character and maximum 5000 characters after trimming leading and trailing whitespace, rejecting whitespace-only input
4. THE Portal SHALL validate ticket subjects: minimum 5 characters and maximum 200 characters after trimming leading and trailing whitespace, rejecting whitespace-only input
5. THE Portal SHALL validate user passwords: minimum 8 characters, maximum 72 characters, must contain at least one uppercase letter, at least one lowercase letter, and at least one digit
6. THE Portal SHALL validate email addresses against RFC 5322 format with a maximum of 255 characters

### Requirement 17: Caching and Performance

**User Story:** As a system operator, I want the portal to use caching effectively, so that response times remain fast under load.

#### Acceptance Criteria

1. THE Catalog_Service SHALL cache product listing results in Redis with a 10-minute TTL
2. THE Catalog_Service SHALL cache filter options in Redis with a 1-hour TTL
3. WHEN a product is created, updated, or deleted, THE Catalog_Service SHALL invalidate all cache entries that contain the affected product within 5 seconds
4. THE Portal SHALL generate deterministic cache keys by sorting filter parameters alphabetically and hashing the resulting JSON string with SHA-256
5. THE Portal SHALL target API response times under 50ms at the 95th percentile for cached responses and under 300ms at the 95th percentile for database queries
6. IF Redis is unavailable, THEN THE Catalog_Service SHALL fall back to querying the database directly without caching, and SHALL NOT return an error to the client

### Requirement 18: Theme and UI

**User Story:** As a client, I want to switch between dark and light themes, so that I can use the portal comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Portal SHALL render all UI elements using the active theme's color scheme, with dark theme as the default for users who have not set a preference
2. WHEN a user toggles the theme, THE Portal SHALL apply the selected theme to all visible UI elements within 300 milliseconds without a page reload
3. WHEN a user toggles the theme, THE Portal SHALL persist the preference in local browser storage so that it is retained across browser sessions
4. WHEN a user with a previously saved theme preference opens the Portal, THE Portal SHALL apply the saved preference before displaying content to the user
5. IF the stored theme preference cannot be read, THEN THE Portal SHALL apply the dark theme as the default without displaying an error to the user

### Requirement 19: SEO Optimization

**User Story:** As a business stakeholder, I want the portal to be SEO-optimized, so that product pages rank well in search engines.

#### Acceptance Criteria

1. THE Portal SHALL render product pages using server-side rendering (SSR) with React Server Components and output SEO metadata (title, description, canonical URL) within the HTML head element for search engine crawlability
2. THE Portal SHALL support custom SEO title (maximum 60 characters) and description (maximum 160 characters) fields on each product
3. THE Portal SHALL use Incremental Static Regeneration (ISR) with a 10-minute revalidation interval for catalog pages
4. IF a product's custom SEO title or description field is empty, THEN THE Portal SHALL fall back to the product name as the title and the first 160 characters of the product description as the meta description
5. THE Portal SHALL render a canonical URL in the head element for each product page to prevent duplicate content indexing

### Requirement 20: Error Handling and Resilience

**User Story:** As a system operator, I want the portal to handle errors gracefully, so that users receive clear feedback and the system recovers from failures.

#### Acceptance Criteria

1. IF a product becomes out of stock during order submission, THEN THE Order_Service SHALL rollback the transaction and return a 409 Conflict response listing the specific product IDs and names that are unavailable
2. IF a JWT access token expires, THEN THE Portal SHALL attempt a single token refresh request using the httpOnly refresh cookie within 3 seconds; IF the refresh succeeds, THEN THE Portal SHALL retry the original request with the new token; IF the refresh fails or times out, THEN THE Portal SHALL redirect the user to the login page and discard the failed request
3. IF the database becomes unreachable, THEN THE Portal SHALL return 503 Service Unavailable for write endpoints and serve stale cached data for read endpoints where a cached response exists in Redis with an age no greater than 30 minutes; IF no cached response exists, THEN THE Portal SHALL return 503 Service Unavailable for that read endpoint
4. IF an invalid order status transition is attempted, THEN THE Order_Service SHALL return a 422 error with the current status and the list of valid target statuses from that state
5. IF an unhandled error occurs during request processing, THEN THE Portal SHALL return a 500 Internal Server Error response with a unique error reference identifier, without exposing internal stack traces or system details to the client
6. IF an external service (email or file storage) is unreachable during a non-critical operation, THEN THE Portal SHALL complete the primary user operation successfully, log the external service failure, and retry the failed external operation up to 3 times with exponential backoff starting at 1 second
