# How to Extract rkey from AT Protocol CAR Files

The **rkey** (record key) is not stored inside the IPLD record data itself. Instead, it's found in **commit operations** that map collection paths to record CIDs.

## AT Protocol Structure

```
Repository Structure:
├── Records (IPLD blocks)
│   ├── bafyrei123... (actual play record data)
│   ├── bafyrei456... (actual profile record data)
│   └── bafyrei789... (actual post record data)
└── Commits (IPLD blocks)
    ├── bafycommit1... (operations mapping paths to CIDs)
    └── bafycommit2... (more operations)
```

## Example: Record IPLD (without rkey)

```json
{
  "$type": "fm.teal.alpha.feed.play",
  "track_name": "Bohemian Rhapsody",
  "artist_names": ["Queen"],
  "duration": 355000,
  "played_time": "2024-01-15T14:30:00Z"
}
```

**❌ No rkey here!** The record contains the data but not its key.

## Example: Commit IPLD (with rkey mappings)

```json
{
  "ops": [
    {
      "action": "create",
      "path": "fm.teal.alpha.feed.play/3k2akjdlkjsf",  // ← collection/rkey
      "cid": "bafyrei123..."  // ← points to the record above
    },
    {
      "action": "create", 
      "path": "fm.teal.alpha.actor.profile/self",
      "cid": "bafyrei456..."
    }
  ],
  "prev": "bafyrei...",
  "rev": "3k2bkl...",
  "time": "2024-01-15T14:35:00Z"
}
```

**✅ rkey is here!** Extract it from the `path` field: `"3k2akjdlkjsf"`

## Extraction Algorithm

```rust
fn extract_rkeys_from_commits(commits: &[CommitInfo]) -> HashMap<String, String> {
    let mut cid_to_rkey = HashMap::new();
    
    for commit in commits {
        for operation in &commit.operations {
            // Path format: "collection/rkey"
            if let Some(rkey) = operation.path.split('/').last() {
                if let Some(ref record_cid) = operation.record_cid {
                    cid_to_rkey.insert(record_cid.clone(), rkey.to_string());
                }
            }
        }
    }
    
    cid_to_rkey
}
```

## Complete Example

1. **Find commit blocks** in CAR file
2. **Extract operations** from commit IPLD
3. **Parse paths** like `"fm.teal.alpha.feed.play/3k2akjdlkjsf"`
4. **Map CID → rkey**: `bafyrei123... → 3k2akjdlkjsf`
5. **Use rkey** when processing records

## Why This Matters

The rkey is essential for:
- **AT URI construction**: `at://did:plc:user123/fm.teal.alpha.feed.play/3k2akjdlkjsf`
- **Record identity**: Uniquely identifies the record within the collection
- **Data integrity**: Maintains proper AT Protocol addressing

## CLI Usage

```bash
# Explore CAR file and show rkey extraction
teal car explore --file archive.car --verbose

# The verbose output will show:
# 🔑 rkey Extraction Examples:
#    1. bafyrei123... → rkey: 3k2akjdlkjsf
#    2. bafyrei456... → rkey: self
```

**Note**: Some CAR files may not contain commit operations with rkey mappings, especially if they're partial exports or contain only raw records without repository structure.