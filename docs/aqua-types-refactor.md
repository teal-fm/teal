# Aqua Types Refactoring Summary

This document summarizes the refactoring work done to fix the `aqua` service's dependency on the problematic external `types` crate by creating local type definitions.

## Problem Statement

The `aqua` Rust service was depending on an external `types` workspace crate (`services/types`) that had compilation errors due to:

1. **Generated Rust types with incorrect import paths** - The lexicon-generated Rust types were referencing modules that didn't exist or had wrong paths
2. **Compilation failures in the types crate** - Multiple compilation errors preventing the entire workspace from building
3. **Circular dependency issues** - The types crate was trying to reference itself in complex ways

The main compilation errors were:
- `failed to resolve: unresolved import` for `crate::app::bsky::richtext::facet::Main`
- `cannot find type 'Main' in module` errors
- Type conversion issues between different datetime representations

## Solution Approach

Instead of trying to fix the complex generated types system, I created **local type definitions** within the `aqua` service that match the actual data structures being used.

## Changes Made

### 1. Created Local Types Module

**Location**: `teal/apps/aqua/src/types/`

- `mod.rs` - Module declarations and re-exports
- `jobs.rs` - Job-related types (CarImportJob, CarImportJobStatus, etc.)
- `lexicon.rs` - Lexicon-compatible types matching the actual schema

### 2. Removed External Dependency

**File**: `teal/apps/aqua/Cargo.toml`
```toml
# Removed this line:
types.workspace = true
```

### 3. Updated All Import Statements

**Files Updated**:
- `src/main.rs` - Updated job type imports
- `src/api/mod.rs` - Fixed CarImportJobStatus import
- `src/repos/actor_profile.rs` - Updated ProfileViewData import
- `src/repos/feed_play.rs` - Updated PlayViewData and Artist imports
- `src/repos/stats.rs` - Updated stats-related type imports
- `src/xrpc/actor.rs` - Updated actor type imports
- `src/xrpc/feed.rs` - Updated feed type imports
- `src/xrpc/stats.rs` - Updated stats type imports

### 4. Type Definitions Created

#### Job Types (`jobs.rs`)
```rust
pub struct CarImportJob {
    pub request_id: Uuid,
    pub identity: String,
    pub since: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub description: Option<String>,
}

pub struct CarImportJobStatus {
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub progress: Option<JobProgress>,
}

pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}
```

#### Lexicon Types (`lexicon.rs`)
```rust
pub struct ProfileViewData {
    pub avatar: Option<String>,
    pub banner: Option<String>,
    pub created_at: Option<atrium_api::types::string::Datetime>,
    pub description: Option<String>,
    pub description_facets: Option<Vec<String>>,
    pub did: Option<String>,
    pub display_name: Option<String>,
    pub featured_item: Option<String>,
    pub handle: Option<String>,
    pub status: Option<StatusViewData>,
}

pub struct PlayViewData {
    pub track_name: Option<String>,
    pub track_mb_id: Option<String>,
    pub recording_mb_id: Option<String>,
    pub duration: Option<i64>,
    pub artists: Option<Vec<Artist>>,
    pub release_name: Option<String>,
    pub release_mb_id: Option<String>,
    pub isrc: Option<String>,
    pub origin_url: Option<String>,
    pub music_service_base_domain: Option<String>,
    pub submission_client_agent: Option<String>,
    pub played_time: Option<atrium_api::types::string::Datetime>,
    // Compatibility fields
    pub album: Option<String>,
    pub artist: Option<String>,
    pub created_at: Option<atrium_api::types::string::Datetime>,
    pub did: Option<String>,
    pub image: Option<String>,
    pub title: Option<String>,
    pub track_number: Option<i32>,
    pub uri: Option<String>,
}

pub struct Artist {
    pub artist_name: Option<String>,
    pub artist_mb_id: Option<String>,
    pub mbid: Option<String>,
    pub name: Option<String>,
}
```

### 5. Namespace Compatibility

Created namespace modules for backward compatibility:
```rust
pub mod fm {
    pub mod teal {
        pub mod alpha {
            pub mod actor {
                pub mod defs {
                    pub use crate::types::lexicon::ProfileViewData;
                }
            }
            pub mod feed {
                pub mod defs {
                    pub use crate::types::lexicon::{Artist, PlayViewData};
                }
            }
            pub mod stats {
                pub mod defs {
                    pub use crate::types::lexicon::{ArtistViewData, ReleaseViewData};
                }
            }
        }
    }
}
```

## Issues Fixed

### Compilation Errors
- ✅ Fixed all unresolved import errors
- ✅ Fixed missing type definitions
- ✅ Fixed type conversion issues (i32 ↔ i64, DateTime types)
- ✅ Fixed missing struct fields in initializers

### Field Mapping Issues
- ✅ Fixed duration type conversion (i32 → i64)
- ✅ Fixed missing handle field (set to None when not available)
- ✅ Fixed field access errors (actor_did → did, etc.)
- ✅ Fixed borrow checker issues with moved values

### Type System Issues
- ✅ Aligned types with actual database schema
- ✅ Made all fields Optional where appropriate
- ✅ Used correct datetime types (atrium_api::types::string::Datetime)

## Result

The `aqua` service now compiles successfully without depending on the problematic external `types` crate:

```bash
$ cd apps/aqua && cargo check
Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.13s
```

## Benefits

1. **Independence** - aqua no longer depends on broken external types
2. **Maintainability** - Types are co-located with their usage
3. **Flexibility** - Easy to modify types as needed
4. **Compilation Speed** - No complex generated type dependencies
5. **Debugging** - Clearer error messages and simpler type definitions

## Future Considerations

### Option 1: Fix Generated Types (Long-term)
- Fix the lexicon generation system to produce correct Rust types
- Resolve import path issues in the code generator
- Test thoroughly across all services

### Option 2: Keep Local Types (Pragmatic)
- Maintain local types as the source of truth
- Sync with lexicon schema changes manually
- Focus on functionality over generated code purity

### Option 3: Hybrid Approach
- Use local types for job-related functionality
- Fix generated types for lexicon-specific data structures
- Gradual migration as generated types become stable

## Recommendation

For now, **keep the local types approach** because:
- It works and allows development to continue
- It's simpler to maintain and debug
- It provides flexibility for service-specific requirements
- The generated types system needs significant work to be reliable

Once the lexicon generation system is more mature and stable, consider migrating back to generated types for consistency across services.

---

**Status**: ✅ Complete - aqua service compiles and runs with local types
**Impact**: Unblocks development on aqua service
**Risk**: Low - types are simple and focused on actual usage patterns