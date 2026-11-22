# E-Commerce and Inventory Management System (Backend)

Backend Development Capstone – Project 4. Built with **Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, EventEmitter and Socket.IO**.

## One-line explanation
Customers browse products and place orders, sellers manage their own products and stock, admins oversee everything – and stock can **never** go negative, even when two people buy the last item at the same time.

## Setup
```bash
npm install
cp .env.example .env      # then edit secrets (.env is git-ignored)
npm run seed              # creates sample users, categories, products
npm start                 # http://localhost:5000
```
Needs Node 18+ and a running MongoDB (local or Atlas URI in `MONGO_URI`).

**Seed logins:** `admin@shop.com / admin123` · `seller@shop.com / seller123` · `seller2@shop.com / seller123` · `customer@shop.com / customer123`

## Architecture (request flow)
`Route → Middleware (logger, protect, authorize, validate) → Controller → Model (Mongoose) → MongoDB → JSON response`
Any thrown error → **centralized errorHandler** → consistent `{ success:false, message }`.

```
src/
  config/       db.js, socket.js
  models/       User, Category, Product, Cart, Order
  controllers/  auth, category, product, cart, order, report
  routes/       one file per resource
  middleware/   auth (JWT + RBAC), validate, logger, errorHandler
  events/       eventBus.js (EventEmitter)
  utils/        ApiError, asyncHandler, tokens
  seed.js  app.js  server.js
public/index.html (frontend SPA), public/socket-demo.html (socket test page)
```

## Roles (RBAC)
| Role | Can do |
|---|---|
| customer | browse, manage own cart, place/cancel own orders, view own orders |
| seller | CRUD **own** products, see orders containing own products, update order status, reports for own data |
| admin | manage categories, any product/order, all reports |

## Security
- Passwords hashed with **bcrypt** (bcryptjs) in a Mongoose `pre('save')` hook.
- **JWT access token** (15 min) + **refresh token** (7 days). Refresh tokens are stored *hashed*, **rotated** on every refresh, and deleted on logout.
- Secrets in `.env` via dotenv. Public registration can only create `customer`/`seller`.

## API endpoints
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | – | Register customer/seller |
| POST | /api/auth/login | – | Returns access + refresh token |
| POST | /api/auth/refresh | – | Body `{refreshToken}` → new pair |
| POST | /api/auth/logout | any | Invalidate refresh token |
| GET/PATCH | /api/users/me | any | View / update own profile |
| GET | /api/categories | – | List categories |
| POST/PATCH/DELETE | /api/categories(/:id) | admin | Manage categories |
| GET | /api/products | – | `?q=&category=&minPrice=&maxPrice=&sort=&page=&limit=` |
| GET | /api/products/:id | – | Single product |
| GET | /api/products/mine | seller | Own products |
| POST | /api/products | seller/admin | Create product |
| PATCH/DELETE | /api/products/:id | owner seller/admin | Update / delete |
| GET | /api/cart | customer | View cart + server-calculated total |
| POST | /api/cart/items | customer | `{productId, quantity}` |
| PATCH/DELETE | /api/cart/items/:productId | customer | Change qty / remove |
| DELETE | /api/cart | customer | Clear cart |
| POST | /api/orders | customer | Checkout. Body `{shippingAddress:{line1,city,postalCode}}` |
| GET | /api/orders | any | Role-filtered list (`?status=&page=&limit=`) |
| GET | /api/orders/:id | owner/seller/admin | Order details |
| PATCH | /api/orders/:id/status | seller/admin | `{status}` following transition rules |
| POST | /api/orders/:id/cancel | customer | Cancel own order, stock restored |
| GET | /api/reports/sales | seller/admin | Daily sales (aggregation) |
| GET | /api/reports/best-sellers | seller/admin | Top products (aggregation) |
| GET | /api/reports/inventory | seller/admin | Stock by category (aggregation) |
| GET | /api/reports/low-stock | seller/admin | Products at/below threshold |

Authenticated requests use header `Authorization: Bearer <accessToken>`.

Order status rules: `pending → confirmed → shipped → delivered`; `pending/confirmed → cancelled`. Anything else returns 400.

## Key design decisions (good for viva)
1. **No overselling** – checkout uses an atomic `findOneAndUpdate({_id, stock:{$gte:qty}}, {$inc:{stock:-qty}})`. If one item fails, already-reserved items are rolled back (stock restored).
2. **Server-side pricing** – the client never sends prices/totals; cart and order totals are computed from the DB. Orders store **price snapshots** so later price changes don't alter history.
3. **Ownership checks** – sellers can only edit their own products; customers only see their own cart/orders.
4. **Simulated payment** – orders are marked `payment.status = SIMULATED_PAID`; no real gateway.
5. **Standalone MongoDB** has no multi-document transactions, so manual rollback is used instead (with a replica set you could use `session.withTransaction`).

## MongoDB aggregation pipelines
1. **Daily sales** – `$match → $unwind → $group (by day) → $project → $sort`
2. **Best sellers** – `$match → $unwind → $group (by product) → $sort → $limit`
3. **Inventory by category** – `$match → $lookup (categories) → $unwind → $group → $project → $sort`

## Indexes
- `Product`: text index (name, description), compound `{category, price}`, `{seller}`
- `Order`: `{customer, createdAt:-1}`, `{items.seller, status}`
- `User.email` and `Category.name`: unique

## EventEmitter + Socket.IO
- **EventEmitter** (`src/events/eventBus.js`): controllers emit `order.placed`, `order.statusChanged`, `stock.low`. Listeners react independently (console log + socket notifications), so controllers stay decoupled from notification code.
- **Socket.IO** (`src/config/socket.js`): the connection is authenticated with the JWT (`io({auth:{token}})`). Rooms: `user:<id>`, `admins`.

| Server → client event | Sent to | Payload |
|---|---|---|
| order:placed | customer | `{orderId, total}` |
| order:new | sellers of items + admins | `{orderId, customer, items}` |
| order:status | customer | `{orderId, status}` |
| stock:low | owning seller + admins | `{productId, name, stock}` |

**Demo:** open `http://localhost:5000/socket-demo.html`, paste a token, connect, then act in Postman.

## Test cases to run in Postman
| # | Scenario | Expected |
|---|---|---|
| 1 | Register with valid data | 201 + tokens |
| 2 | Register with missing email / short password | 400 |
| 3 | Register with existing email | 409 |
| 4 | Login wrong password | 401 |
| 5 | GET /api/cart without token | 401 |
| 6 | Customer calls POST /api/products | 403 |
| 7 | GET /api/products/<random valid id> | 404 |
| 8 | Add to cart more than stock | 400 |
| 9 | Checkout with empty cart | 400 |
| 10 | Checkout valid cart | 201, stock reduced, cart emptied, socket events |
| 11 | Seller2 edits Seller1's product | 403 |
| 12 | Customer2 opens Customer1's order | 403 |
| 13 | Status `delivered` on a `pending` order | 400 (invalid transition) |
| 14 | Cancel order | 200, stock restored |
| 15 | Refresh token used twice | second call 401 |
| 16 | Two customers buy the last unit | only one succeeds, other gets 409 |

## Frontend (included)
A dependency-free single-page app in `public/index.html`, served by Express – no build step. After `npm start` open **http://localhost:5000**.

| Role | Screens |
|---|---|
| Everyone | Shop (search, category filter, pagination), Login/Register |
| Customer | Cart (qty, remove, server-calculated total), Checkout (simulated payment), Orders (cancel) |
| Seller | My Products (add/edit/delete), Orders (confirm/ship/deliver), Reports |
| Admin | All products & orders, Categories, Reports |

The frontend auto-refreshes expired access tokens with the refresh token and shows live Socket.IO toasts (order placed, new order, status change, low stock).

## Extra features
| Feature | Endpoints | How it works |
|---|---|---|
| **Discount coupons** | `POST/GET/DELETE /api/coupons` (admin), `POST /api/coupons/validate` (customer), `couponCode` in `POST /api/orders` | Percent discount with minimum order, expiry and usage limit. Redeemed **atomically** at checkout (conditional `$inc` on `usedCount`), and released if the order fails. Discount is computed on the server. Demo codes: `WELCOME10`, `BIG20` |
| **Reviews & ratings** | `GET/POST /api/products/:id/reviews` | Only customers with a **delivered** order for the product can review; one review per product (unique index). Average rating is recomputed with an aggregation. |
| **Wishlist** | `GET /api/wishlist`, `POST/DELETE /api/wishlist/:productId` | Stored on the user using `$addToSet` / `$pull` (no duplicates). |

Extra test cases: expired/unknown coupon → 400; reuse beyond `maxUses` → 400; BIG20 below ₹2000 → 400; review without delivered order → 403; second review of same product → 409; wishlist as seller → 403.
