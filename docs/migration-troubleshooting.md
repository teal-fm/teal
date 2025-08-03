# Migration Troubleshooting Guide

## Common Migration Issues and Solutions

### Issue: "cannot drop function because other objects depend on it"

**Error Message:**
```
error: while executing migration 20241220000008: error returned from database: cannot drop function extract_discriminant(text) because other objects depend on it
```

**Cause:**
This error occurs when trying to drop database functions that have dependent objects (views, other functions, triggers, etc.) without properly handling the dependencies.

**Solution:**

#### Option 1: Fix the Migration (Recommended)
Update the problematic migration to handle dependencies properly:

1. **Edit the migration file** (e.g., `20241220000008_fix_discriminant_case_sensitivity.sql`):

```sql
-- Drop dependent views first, then functions, then recreate everything
DROP VIEW IF EXISTS discriminant_analysis CASCADE;
DROP VIEW IF EXISTS discriminant_stats CASCADE;

-- Drop existing functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS extract_discriminant(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_base_name(TEXT) CASCADE;
DROP FUNCTION IF EXISTS extract_edition_discriminant(TEXT) CASCADE;

-- Then recreate functions and views...
```

2. **Reset the migration state** if the migration was partially applied:

```bash
# Connect to your database and reset the specific migration
psql $DATABASE_URL -c "DELETE FROM _sqlx_migrations WHERE version = '20241220000008';"

# Or reset all migrations and start fresh (WARNING: This drops all data)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

3. **Run migrations again**:
```bash
cd services
DATABASE_URL="your_database_url" sqlx migrate run
```

#### Option 2: Manual Dependency Cleanup
If you can't modify the migration file:

1. **Identify dependencies**:
```sql
-- Find objects that depend on the function
SELECT 
    p.proname as function_name,
    d.objid,
    d.classid::regclass as object_type,
    d.refobjid
FROM pg_depend d
JOIN pg_proc p ON d.refobjid = p.oid
WHERE p.proname = 'extract_discriminant';
```

2. **Drop dependencies manually**:
```sql
-- Drop dependent views
DROP VIEW IF EXISTS discriminant_analysis CASCADE;
DROP VIEW IF EXISTS discriminant_stats CASCADE;
DROP VIEW IF EXISTS track_variants CASCADE;
DROP VIEW IF EXISTS release_variants CASCADE;

-- Drop the functions
DROP FUNCTION IF EXISTS extract_discriminant(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_base_name(TEXT) CASCADE;
DROP FUNCTION IF EXISTS extract_edition_discriminant(TEXT) CASCADE;
```

3. **Continue with migration**:
```bash
DATABASE_URL="your_database_url" sqlx migrate run
```

### Issue: "migration was previously applied but has been modified"

**Error Message:**
```
error: migration 20241220000008 was previously applied but has been modified
```

**Cause:**
The migration file has been changed after it was already applied to the database.

**Solutions:**

#### Option 1: Reset Migration State
```bash
# Remove the specific migration from tracking
psql $DATABASE_URL -c "DELETE FROM _sqlx_migrations WHERE version = '20241220000008';"

# Run migrations again
DATABASE_URL="your_database_url" sqlx migrate run
```

#### Option 2: Create a New Migration
```bash
# Create a new migration with your changes
sqlx migrate add fix_discriminant_case_sensitivity_v2

# Copy your changes to the new migration file
# Run the new migration
DATABASE_URL="your_database_url" sqlx migrate run
```

#### Option 3: Full Reset (WARNING: Destroys all data)
```bash
# Connect to database and reset everything
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Run all migrations from scratch
DATABASE_URL="your_database_url" sqlx migrate run
```

### Issue: "No such file or directory" when running migrations

**Error Message:**
```
error: while resolving migrations: No such file or directory (os error 2)
```

**Cause:**
The migration directory is not found in the expected location.

**Solutions:**

#### Option 1: Check Migration Directory Location
```bash
# Check where sqlx expects migrations
cat services/.sqlx/.sqlxrc

# Ensure migrations exist in the correct location
ls -la services/migrations/
```

#### Option 2: Copy Migrations to Correct Location
```bash
# If migrations are in wrong location, copy them
cp migrations/*.sql services/migrations/

# Or create symlink
ln -s ../migrations services/migrations
```

#### Option 3: Update sqlx Configuration
Edit `services/.sqlx/.sqlxrc`:
```toml
[database]
url = "postgres://localhost/teal"
migrations = "../migrations"  # Update path as needed
```

### Issue: Database Connection Problems

**Error Messages:**
- `Connection refused (os error 61)`
- `password authentication failed`
- `database "teal_test" does not exist`

**Solutions:**

#### Connection Refused
```bash
# Check if database is running
docker ps | grep postgres

# Start database if needed
docker-compose -f compose.db-test.yml up -d

# Wait for database to start
sleep 5
```

#### Authentication Issues
```bash
# Check connection string format
DATABASE_URL="postgres://username:password@host:port/database"

# Example for test database
DATABASE_URL="postgres://postgres:testpass123@localhost:5433/teal_test"
```

#### Database Doesn't Exist
```bash
# Create database
docker exec postgres_container psql -U postgres -c "CREATE DATABASE teal_test;"

# Or recreate test environment
docker-compose -f compose.db-test.yml down
docker-compose -f compose.db-test.yml up -d
```

## Migration Best Practices

### 1. Handle Dependencies Properly
Always use `CASCADE` when dropping objects with dependencies:
```sql
DROP FUNCTION function_name(args) CASCADE;
DROP VIEW view_name CASCADE;
```

### 2. Test Migrations Locally
```bash
# Use test database for migration testing
DATABASE_URL="postgres://localhost:5433/teal_test" sqlx migrate run

# Verify results
psql "postgres://localhost:5433/teal_test" -c "SELECT extract_discriminant('Test (Example)');"
```

### 3. Backup Before Major Migrations
```bash
# Create backup
pg_dump $DATABASE_URL > backup_before_migration.sql

# Apply migrations
sqlx migrate run

# Restore if needed
psql $DATABASE_URL < backup_before_migration.sql
```

### 4. Version Control Migration Files
- Never modify applied migrations
- Create new migrations for changes
- Use descriptive migration names
- Include rollback instructions in comments

### 5. Migration File Structure
```sql
-- Migration: descriptive_name
-- Purpose: Brief description of what this migration does
-- Dependencies: List any required prior migrations
-- Rollback: Instructions for manual rollback if needed

-- Drop dependencies first
DROP VIEW IF EXISTS dependent_view CASCADE;

-- Make changes
CREATE OR REPLACE FUNCTION new_function() ...;

-- Recreate dependencies
CREATE VIEW dependent_view AS ...;

-- Update existing data if needed
UPDATE table_name SET column = new_value WHERE condition;

-- Add comments
COMMENT ON FUNCTION new_function IS 'Description of function purpose';
```

## Emergency Recovery

### Complete Database Reset
If migrations are completely broken:

```bash
# 1. Stop all services
docker-compose down

# 2. Remove database volume (WARNING: Destroys all data)
docker volume rm teal_postgres_data

# 3. Start fresh
docker-compose up -d postgres

# 4. Wait for database to initialize
sleep 10

# 5. Run all migrations from scratch
DATABASE_URL="your_database_url" sqlx migrate run
```

### Partial Recovery
If only discriminant system is broken:

```sql
-- Remove discriminant-related objects
DROP VIEW IF EXISTS discriminant_analysis CASCADE;
DROP VIEW IF EXISTS discriminant_stats CASCADE;
DROP VIEW IF EXISTS track_variants CASCADE;
DROP VIEW IF EXISTS release_variants CASCADE;
DROP FUNCTION IF EXISTS extract_discriminant(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_base_name(TEXT) CASCADE;
DROP FUNCTION IF EXISTS extract_edition_discriminant(TEXT) CASCADE;

-- Remove discriminant columns
ALTER TABLE plays DROP COLUMN IF EXISTS track_discriminant;
ALTER TABLE plays DROP COLUMN IF EXISTS release_discriminant;
ALTER TABLE recordings DROP COLUMN IF EXISTS discriminant;
ALTER TABLE releases DROP COLUMN IF EXISTS discriminant;

-- Mark discriminant migrations as not applied
DELETE FROM _sqlx_migrations WHERE version >= '20241220000006';

-- Re-run discriminant migrations
```

## Getting Help

### Debug Information to Collect
When reporting migration issues, include:

1. **Error message** (full stack trace)
2. **Migration file content** that's causing issues
3. **Database state**:
   ```sql
   SELECT version FROM _sqlx_migrations ORDER BY version;
   \df extract_discriminant
   \dv discriminant_*
   ```
4. **Environment details**:
   - Database version: `SELECT version();`
   - Operating system
   - sqlx version: `cargo sqlx --version`

### Useful Debugging Commands
```sql
-- Check applied migrations
SELECT * FROM _sqlx_migrations ORDER BY version;

-- Check function definitions
\df+ extract_discriminant

-- Check view definitions
\d+ discriminant_analysis

-- Check table schemas
\d+ plays
\d+ recordings
\d+ releases

-- Test function directly
SELECT extract_discriminant('Test (Example)');
```

## Contact and Support

For persistent migration issues:
1. Check this troubleshooting guide first
2. Review the specific migration file causing issues
3. Try solutions in order of preference (fix migration → manual cleanup → reset)
4. Create minimal reproduction case for complex issues
5. Document exact steps that led to the error for support requests