# CAR Import System with `atmst`

This directory contains the implementation of Teal's CAR (Content Addressable aRchive) import functionality, now powered by the `atmst` library for proper AT Protocol-style Merkle Search Tree handling.

## Overview

The CAR import system allows Teal to ingest historical music listening data from AT Protocol repositories. Previously, this was done with manual IPLD parsing, but we've now migrated to use the specialized `atmst` library for more accurate and robust CAR file processing.

## Key Components

### `CarImportIngestor`

The main entry point for CAR file processing. This ingestor:

1. **Accepts CAR data** via the `LexiconIngestor` interface (base64 or URL)
2. **Uses `atmst::CarImporter`** to parse CAR files with proper MST handling
3. **Converts to MST structure** for tree traversal and record extraction
4. **Delegates to existing ingestors** for Teal record types (play, profile, status)

### Migration from `iroh-car` to `atmst`

**Previous Implementation:**
- Used `iroh-car` for basic CAR parsing
- Manual IPLD block decoding with `libipld`
- Complex two-pass processing to extract rkey mappings from commit operations
- Error-prone MST parsing that could miss records

**New Implementation:**
- Uses `atmst::CarImporter` for specialized AT Protocol CAR handling
- Built-in MST structure understanding
- Proper tree traversal with guaranteed rkey extraction
- More reliable and maintainable code

## Usage

### As a LexiconIngestor

The CAR importer integrates seamlessly with Teal's existing ingestion pipeline:

```rust
// CAR data in a record
{
  "$type": "com.teal.car.import",
  "carData": "base64-encoded-car-file-here"
}

// Or as a URL reference
{
  "$type": "com.teal.car.import", 
  "carData": {
    "url": "https://example.com/repo.car"
  }
}
```

### Direct Import

```rust
let ingestor = CarImportIngestor::new(db_pool);

// Import from bytes
let import_id = ingestor.import_car_bytes(&car_data, "did:plc:example").await?;

// Import from PDS
let import_id = ingestor.fetch_and_process_identity_car("user.bsky.social").await?;
```

## Supported Record Types

The CAR importer automatically detects and processes these Teal record types:

- **`fm.teal.alpha.feed.play`** - Music play records
- **`fm.teal.alpha.profile`** - User profile data  
- **`fm.teal.alpha.status`** - User status updates

Records are processed using the same logic as real-time Jetstream ingestion, ensuring data consistency.

## Architecture

### MST Processing Flow

1. **CAR Import**: `atmst::CarImporter` loads and validates the CAR file
2. **MST Conversion**: CAR data is converted to an `atmst::Mst` structure
3. **Tree Traversal**: MST is traversed depth-first to find all records
4. **Record Extraction**: Each MST entry is examined for Teal record types
5. **Delegation**: Valid records are passed to existing Teal ingestors

### Key Benefits

- **Proper rkey handling**: MST structure ensures correct record key extraction
- **AT Protocol compliance**: Uses specialized library designed for AT Protocol
- **Maintainable code**: Eliminates complex manual MST parsing
- **Better error handling**: More robust than previous implementation

## Current Status

### ✅ Completed
- Basic `atmst` integration 
- MST structure setup and conversion
- Record type detection and routing
- Integration with existing Teal ingestors
- Error handling and logging

### 🚧 In Progress
- **Block data access**: Full implementation of record data extraction from MST
- **MST traversal**: Complete iteration through MST entries  
- **Testing**: Comprehensive test suite with real CAR files

### 📋 TODO
- Complete `get_record_from_mst()` implementation
- Add MST entry iteration logic
- Performance optimization for large CAR files
- Comprehensive integration tests

## Implementation Notes

### Block Data Access

The current implementation has a placeholder for accessing actual record data from the MST:

```rust
fn get_record_from_mst(&self, cid: &atmst::Cid, mst: &Mst) -> Option<Value> {
    // TODO: Implement proper block data access using atmst API
    // This requires understanding how to extract IPLD data for a given CID
    // from the MST's internal block storage
    None
}
```

This is the key missing piece that needs to be completed based on `atmst` library documentation.

### MST Traversal

Similarly, the MST traversal logic needs completion:

```rust
// TODO: Implement proper MST iteration
// for (cid, node) in mst.iter() {
//     // Process MST entries
// }
```

### Error Handling

The system is designed to be resilient:
- Invalid records are logged and skipped
- Network errors during PDS fetching are properly reported
- Database errors are propagated with context

## Testing

### Test Structure

```bash
# Unit tests (no database required)
cargo test test_parse_teal_key
cargo test test_is_teal_record_key

# Integration tests (requires database)
cargo test test_atmst_car_import --ignored

# CLI testing
cd tools/teal-cli
cargo run -- car analyze path/to/file.car
```

### Test Data

Test CAR files should be placed in `services/cadet/` for integration testing:
- `test.car` - Basic test file with Teal records
- `large.car` - Performance testing file
- `empty.car` - Edge case testing

## Dependencies

### Key Dependencies
- **`atmst`**: AT Protocol MST library (v0.0.1)
- **`serde_json`**: JSON serialization for record processing
- **`anyhow`**: Error handling
- **`uuid`**: Import ID generation
- **`reqwest`**: HTTP client for PDS fetching

### Workspace Dependencies
The implementation uses existing Teal workspace dependencies for database access, logging, and record processing.

## Configuration

No additional configuration is required. The CAR importer uses the same database connection and logging setup as other Teal ingestors.

## Monitoring

The CAR importer provides detailed logging:

- **Info**: Successful imports, record counts, processing progress
- **Warn**: Skipped records, missing data, network issues  
- **Error**: Database failures, invalid CAR files, processing errors

Metrics are integrated with Teal's existing observability stack.

## Performance

### Optimization Strategies

1. **Streaming processing**: Records are processed as they're discovered
2. **Batch database operations**: Multiple records can be inserted in batches
3. **Memory management**: Large CAR files are processed without loading entirely into memory
4. **Parallel processing**: Future enhancement for concurrent record processing

### Benchmarks

Performance testing should be conducted with:
- Small CAR files (< 1MB, ~100 records)
- Medium CAR files (1-50MB, ~10K records) 
- Large CAR files (> 50MB, ~100K+ records)

## Future Enhancements

### Planned Features
- **Incremental imports**: Support for delta/since-based CAR fetching
- **Batch processing**: Queue-based processing for multiple CAR files
- **Validation**: Pre-import validation of CAR file integrity
- **Metrics**: Detailed import statistics and performance monitoring

### Integration Opportunities
- **Admin API**: Trigger imports via HTTP API
- **Scheduled imports**: Cron-based periodic imports from known users
- **Real-time sync**: Hybrid approach combining Jetstream + CAR imports

---

## Contributing

When working on the CAR import system:

1. **Test thoroughly**: Use both unit and integration tests
2. **Document changes**: Update this README for significant modifications
3. **Monitor performance**: Large CAR files can impact system performance
4. **Handle errors gracefully**: Network and parsing errors are expected

For questions about `atmst` integration or MST processing, refer to the library documentation or consider reaching out to the `atmst` maintainers.