#!/bin/bash

# Backend V2 Setup Script
echo "🚀 Setting up Pick My Pit Backend V2..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your configuration values"
fi

# Build the project
echo "🔨 Building TypeScript..."
npm run build

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with the correct values"
echo "2. Make sure MongoDB and Redis are running"
echo "3. Run 'npm run dev' to start the development server"
echo "4. Run 'npm start' to start the production server"
echo ""
echo "🌐 Server will be available at http://localhost:5000"
echo "📊 Admin UI will be available at http://localhost:5000/admin"
