#!/bin/bash

# Setup script for SQLx CLI and database migrations
# This script installs sqlx-cli and sets up the database for development

set -e

echo "🔧 Setting up SQLx CLI and database..."

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo is not installed. Please install Rust first."
    exit 1
fi

# Install sqlx-cli if not already installed
if ! command -v sqlx &> /dev/null; then
    echo "📦 Installing sqlx-cli..."
    cargo install sqlx-cli --features postgres
else
    echo "✅ sqlx-cli is already installed"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set. Using default: postgres://localhost/teal"
    export DATABASE_URL="postgres://localhost/teal"
fi

echo "🗄️  Database URL: $DATABASE_URL"

# Migrations live at the repository root (./migrations), next to the workspace Cargo.toml.
cd "$(dirname "$0")/.."

# Check if database exists, create if it doesn't
echo "🏗️  Creating database if it doesn't exist..."
sqlx database create 2>/dev/null || echo "Database already exists or created successfully"

# Run migrations
echo "🚀 Running database migrations..."
sqlx migrate run

# Prepare queries for compile-time verification
echo "🔍 Preparing queries for compile-time verification..."
cargo sqlx prepare --workspace --check 2>/dev/null || {
    echo "📝 Generating query metadata..."
    cargo sqlx prepare --workspace
}

echo "✅ SQLx setup complete!"
echo ""
echo "Available commands:"
echo "  pnpm db:migrate       - Run migrations"
echo "  pnpm db:migrate:revert - Revert last migration"
echo "  pnpm db:create        - Create database"
echo "  pnpm db:drop          - Drop database"
echo "  pnpm db:reset         - Drop, create, and migrate database"
echo "  pnpm db:prepare       - Prepare queries for compile-time verification"
echo ""
echo "🎉 Your database is ready for development!"
