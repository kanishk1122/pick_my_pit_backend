@echo off
echo 🚀 Setting up Pick My Pit Backend V2...

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Create environment file if it doesn't exist
if not exist .env (
    echo 📄 Creating environment file...
    copy .env.example .env
    echo ⚠️  Please update the .env file with your configuration values
)

REM Build the project
echo 🔨 Building TypeScript...
npm run build

echo ✅ Setup complete!
echo.
echo 📋 Next steps:
echo 1. Update your .env file with the correct values
echo 2. Make sure MongoDB and Redis are running
echo 3. Run 'npm run dev' to start the development server
echo 4. Run 'npm start' to start the production server
echo.
echo 🌐 Server will be available at http://localhost:5000
echo 📊 Admin UI will be available at http://localhost:5000/admin

pause
