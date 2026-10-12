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

- POST /api/auth/register
  - Registers a new user
  - Expects: name, email, password, contactNumber
  - Optional: sector (`Govt` or `Private`), departmentName, institutionName
  - Returns: JWT token

- POST /api/auth/login
  - Authenticates an existing user
  - Expects: email, password
  - Returns: JWT token and user details

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

- POST /api/users/teams
  - Creates a team account
  - Expects: `name`, `email`, `password`, `contactNumber`
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
- `admin`: can do everything a team can do, create/remove teams, and delete regular users

The configured `ADMIN_EMAIL` account is created or promoted to `admin` on startup. `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` remain supported as legacy environment-variable names. Existing records are migrated from `super_admin` to `admin` and from the old `admin` role to `team` on startup.

## Authentication Flow

1. A user registers or logs in.
2. The backend verifies the supplied credentials.
3. A JWT token is generated and returned to the client.
4. Protected routes load the current user from the database and enforce the user's current role. Role changes therefore take effect even after an older token was issued.

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
