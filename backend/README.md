# Backend Documentation

This folder contains the Node.js/Express backend for the prediction app. It handles user authentication, JWT-based authorization, and basic admin user management.

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
  - Provides admin-only endpoints for listing and deleting users

- models/User.js
  - Defines the Mongoose schema for the User model

## API Endpoints

### Authentication

- POST /api/auth/register
  - Registers a new user
  - Expects: name, email, password
  - Returns: JWT token

- POST /api/auth/login
  - Authenticates an existing user
  - Expects: email, password
  - Returns: JWT token and user details

### Admin User Management

- GET /api/users/
  - Returns all users
  - Requires an admin JWT token

- DELETE /api/users/:id
  - Deletes a specific user
  - Requires an admin JWT token

## Authentication Flow

1. A user registers or logs in.
2. The backend verifies the supplied credentials.
3. A JWT token is generated and returned to the client.
4. Protected admin routes validate the token and check whether the user is an admin.

## Environment Variables

Create a .env file in the root of the project with the following values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/prediction-app
JWT_SECRET=your_secret_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password
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


