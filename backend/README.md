# Backend Documentation

This folder contains the Node.js/Express backend for the prediction app. It handles user authentication, JWT-based authorization, role-based team management, and prediction activity viewing.

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JSON Web Tokens (JWT)
- bcryptjs for password hashing
- dotenv for environment configuration

## Project Structure

- server.js
  - Starts the Express server
  - Loads environment variables
  - Connects to MongoDB
  - Mounts API routes
  - Creates an admin user on startup if one does not already exist

- routes/auth.js
  - Handles user registration and login
  - Issues JWT tokens after successful authentication

- routes/users.js
  - Provides role-protected user, team, and activity management endpoints

- models/User.js
  - Defines the Mongoose schema for the User model

## API Endpoints

### Authentication

There is **only one way** to register an account:
- User registration: `POST /api/auth/register/user` (or `POST /api/auth/register`)
- Team registration: `POST /api/auth/register/team`

Both endpoints accept:
- `name` (required)
- `email` (required)
- `password` (required, min 6 characters)
- `contactNumber` (optional)

Upon registration:
- The account is recorded with `accountStatus: 'pending'`.
- An approval request is sent to the administrator.
- Neither users nor teams can log in until an administrator approves them (login returns HTTP 403).
- Admins **cannot** create accounts directly; all accounts must go through the registration and approval process.

- GET /api/auth/approve-registration/:token
- GET /api/auth/reject-registration/:token
  - Linked from the admin notification email (valid 48 hours).

- POST /api/auth/login
- POST /api/auth/login/user | /login/team | /login/admin
  - Expects: email, password
  - Returns JWT only if `accountStatus` is `approved`
  - Pending/rejected accounts receive HTTP 403 with a clear message

### Email (required for production approval flow)

Install dependencies from the project root:

```bash
npm install
```

Configure SMTP in `.env` (see `.env.example`). If SMTP is not configured, the server logs approval URLs to the console.

### Team and User Management

- GET /api/users/
  - Returns all users and their roles
  - Requires a `team` or `admin` JWT token

- GET /api/users/activity
  - Returns recent prediction/search activity for all users
  - Optional query parameters: `userId`, `limit` (maximum 100)
  - Requires a `team` or `admin` JWT token

- GET /api/users/:id/activity
  - Returns one user's profile and prediction/search activity
  - Requires a `team` or `admin` JWT token

- GET /api/users/registrations/pending
  - Lists pending registrations (both user and team requests)
  - Requires an `admin` JWT token

- PUT /api/users/registrations/:id/approve
  - Directly approves a pending registration by user ID
  - Requires an `admin` JWT token

- PUT /api/users/registrations/:id/reject
  - Directly rejects a pending registration by user ID
  - Requires an `admin` JWT token

- DELETE /api/users/teams/:id
  - Removes a team account
  - Requires an `admin` JWT token

- DELETE /api/users/:id
  - Deletes a regular user and their saved activity
  - Requires an `admin` JWT token

### Roles

- `user`: normal registered account
- `team`: can view users and their activity
- `admin`: can do everything a team can do, review/approve pending registrations, remove teams, and delete regular users

The configured `ADMIN_EMAIL` account is created or promoted to `admin` on startup. `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` remain supported as legacy environment-variable names. Existing records are migrated from `super_admin` to `admin` and from the old `admin` role to `team` on startup.

## Authentication Flow

1. A user or team self-registers with basic info (`POST /api/auth/register/user` or `/register/team`).
2. The backend stores the account as `pending` and emails the admin approve/reject links.
3. After the admin approves, the registrant signs in with the password they chose during registration.
4. Protected routes load the current user from the database and enforce role and account status.

## Environment Variables

Create a .env file in the root of the project with the following values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/prediction-app
JWT_SECRET=your_secret_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_ADMIN_PASSWORD
```

## Running the Backend

From the project root:

```bash
npm install
npm run server
```

If you are using nodemon, the server will restart automatically when files change.

## Notes

- The backend automatically creates an admin account on startup if the configured admin email does not already exist.
- Admin-only endpoints require the Authorization header in the following format:

```http
Authorization: Bearer <token>
```

## information regarding data flow
