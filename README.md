# Pick My Pit Backend V2

A modern TypeScript-based backend for the Pick My Pit pet adoption platform, featuring real-time functionality with Socket.IO, Redis integration, and comprehensive API endpoints.

## 🚀 Features

- **TypeScript**: Fully typed codebase for better development experience
- **Express**: Fast and minimal web framework
- **MongoDB**: NoSQL database with Mongoose ODM
- **Socket.IO**: Real-time bidirectional communication
- **Redis**: Caching and session storage
- **JWT Authentication**: Secure token-based authentication
- **Validation**: Input validation with Joi
- **File Upload**: Image upload with Cloudinary integration
- **Email Service**: Nodemailer for email notifications
- **Admin Panel**: Socket.IO Admin UI for monitoring

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── helper/          # Utility functions and validation
├── middleware/      # Custom middleware
├── model/           # Database models
├── routes/          # API routes
├── sockets/         # Socket.IO event handlers
└── index.ts         # Application entry point
```

## 🛠️ Setup Instructions

### Prerequisites

- Node (v18 or higher)
- MongoDB
- Redis
- npm or yarn

### Installation

1. **Clone and navigate to the project:**

   ```bash
   cd Backend_v2
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Environment Configuration:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` file with your configuration values.

4. **Build the project:**

   ```bash
   npm run build
   ```

5. **Start development server:**

   ```bash
   npm run dev
   ```

6. **Start production server:**
   ```bash
   npm start
   ```

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/admin/login` - Admin login

### Users (Planned)

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Posts (Planned)

- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post
- `GET /api/posts/:id` - Get post by ID
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

### Addresses (Planned)

- `GET /api/addresses` - Get user addresses
- `POST /api/addresses` - Create new address
- `PUT /api/addresses/:id` - Update address
- `DELETE /api/addresses/:id` - Delete address

## 🔄 Real-time Events

### Socket.IO Events

**Client to Server:**

- `join` - Join user to personal room
- `message` - Send chat message
- `typing` - Typing indicator
- `post_update` - Update post status

**Server to Client:**

- `message` - Receive chat message
- `notification` - Receive notification
- `post_status_changed` - Post status update
- `typing` - Typing indicator
- `admin_notification` - Admin action notification

## 🗄️ Database Models

### User Model

- Personal information (name, email, etc.)
- Authentication data
- Profile settings
- Referral system
- Owned and purchased pets

### Post Model

- Pet information
- Images and description
- Pricing and availability
- Location data
- Age and characteristics

### Address Model

- User addresses
- Location coordinates
- Default address handling

### Admin Model

- Admin user management
- Role-based permissions
- Session handling

### Species & Breed Models

- Pet categorization
- Breed characteristics
- Popularity tracking

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Session management
- Rate limiting (to be implemented)

## 🚀 Deployment

### Environment Variables

Ensure all required environment variables are set in production:

```bash
NODE_ENV=production
DATABASE_URL=mongodb://your-production-db
REDIS_URL=redis://your-production-redis
JWT_SECRET=your-secure-jwt-secret
# ... other variables
```

### Build and Start

```bash
npm run build
npm start
```

## 🧪 Testing (To be implemented)

```bash
npm test
```

## 📊 Monitoring

- Socket.IO Admin UI available at `/admin`
- Health check endpoint at `/health`
- Request logging middleware

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use proper error handling
3. Add input validation for all endpoints
4. Write meaningful commit messages
5. Test your changes thoroughly

## 📄 Migration from V1

This TypeScript version includes:

- Better type safety
- Improved error handling
- Modern async/await patterns
- Enhanced socket functionality
- Better project structure
- Comprehensive validation

## 🔧 Development Tools

- **TypeScript**: Static typing
- **ts-node-dev**: Development server
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Joi**: Schema validation
- **Socket.IO Admin UI**: Real-time monitoring

## 📞 Support

For issues and questions, please refer to the project documentation or create an issue in the repository.
"# pick_my_pit_backend"
