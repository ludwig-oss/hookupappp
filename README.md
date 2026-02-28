# Authentication Web Application

A full-stack web application with complete authentication features including login, signup, and password recovery.

## Features

- ✅ User Signup
- ✅ User Login
- ✅ Forgot Password
- ✅ Reset Password
- ✅ Protected Dashboard
- ✅ Modern, responsive UI
- ✅ JWT-based authentication

## Tech Stack

### Frontend
- React 18 with TypeScript
- React Router for navigation
- Vite for build tooling
- Axios for API calls

### Backend
- Node.js with Express
- TypeScript
- JWT for authentication
- bcryptjs for password hashing
- JSON file-based storage (easily upgradeable to database)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Set up environment variables (optional):
```bash
cp server/.env.example server/.env
```

Edit `server/.env` if you want to configure email settings for password reset.

### Running the Application

Start both frontend and backend:
```bash
npm run dev
```

Or run them separately:
```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Usage

1. **Sign Up**: Create a new account at `/signup`
2. **Login**: Sign in at `/login`
3. **Forgot Password**: Click "Forgot password?" on the login page
4. **Reset Password**: Use the link sent to your email (in development, check the server console for the reset link)

## Development Notes

- In development mode, password reset emails are logged to the console instead of being sent
- User data is stored in `server/data/users.json`
- For production, configure SMTP settings in `.env` for actual email delivery

## Project Structure

```
.
├── client/          # React frontend
│   ├── src/
│   │   ├── pages/   # Page components
│   │   ├── api/     # API client
│   │   └── context/ # React context
├── server/          # Express backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
│   └── data/        # JSON database
└── package.json     # Root package.json
```








