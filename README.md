# TrueValidator Backend - Complete Auth System

## Features Implemented

### ✅ MVC Architecture
- **Models**: User schema with Mongoose
- **Controllers**: Auth controller with complete CRUD operations
- **Routes**: RESTful API endpoints with validation
- **Middleware**: Authentication and authorization middleware
- **Utils**: JWT handling, error handling, and validation

### ✅ Authentication Features
- **User Registration** with validation
- **User Login** with JWT token generation
- **Password Hashing** with bcrypt
- **Token-based Authentication**
- **Protected Routes** middleware
- **Role-based Access Control**
- **Profile Management**
- **Password Change**

### ✅ Security Features
- **Input Validation** with express-validator
- **Password Requirements** (min 6 chars, uppercase, lowercase, number)
- **Rate Limiting** ready (configurable)
- **CORS Configuration** for frontend integration
- **Error Handling** with proper HTTP status codes
- **JWT Token Management**

### ✅ API Endpoints

#### Public Routes
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

#### Protected Routes
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/password` - Change password
- `POST /api/auth/logout` - Logout

### ✅ Demo Credentials
- **Email**: test@gmail.com
- **Password**: test@123

## Project Structure
```
backend/
├── controllers/
│   └── authController.js
├── middleware/
│   └── auth.js
├── models/
│   └── User.js
├── routes/
│   └── auth.js
├── utils/
│   ├── errorHandler.js
│   ├── jwt.js
│   └── validation.js
├── .env
├── package.json
└── server.js
```

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables** (in `.env`):
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/truevalidator
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=http://localhost:5173
   DEMO_EMAIL=test@gmail.com
   DEMO_PASSWORD=test@123
   ```

3. **Start MongoDB**:
   Make sure MongoDB is running on your system

4. **Run Server**:
   ```bash
   npm start
   # or
   npm run dev
   ```

## Usage Examples

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "MyPassword123"
  }'
```

### Login User
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "MyPassword123"
  }'
```

### Access Protected Route
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Handling
The system includes comprehensive error handling:
- Input validation errors
- Authentication errors
- Database errors
- JWT token errors
- 404 handling for undefined routes

All errors return consistent JSON responses with appropriate HTTP status codes.