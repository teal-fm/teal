use anyhow::{Context, Result};
use colored::*;
use k256::ecdsa::{SigningKey, VerifyingKey};
use k256::SecretKey;
use multibase::Base;
use rand::rngs::OsRng;
use serde_json::json;
use std::path::PathBuf;
use tokio::fs;

/// Generate a new K256 private key
pub fn generate_private_key() -> SigningKey {
    SigningKey::random(&mut OsRng)
}

/// Load a private key from a file
pub async fn load_private_key(path: &PathBuf) -> Result<SigningKey> {
    let key_bytes = fs::read(path)
        .await
        .with_context(|| format!("Failed to read private key from {:?}", path))?;

    if key_bytes.len() != 32 {
        anyhow::bail!(
            "Invalid private key length. Expected 32 bytes, got {}",
            key_bytes.len()
        );
    }

    let secret_key = SecretKey::from_slice(&key_bytes).context("Failed to parse private key")?;

    Ok(SigningKey::from(secret_key))
}

/// Save a private key to a file
pub async fn save_private_key(key: &SigningKey, path: &PathBuf) -> Result<()> {
    let key_bytes = key.as_nonzero_scalar().to_bytes();

    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create key directory: {:?}", parent))?;
    }

    fs::write(path, key_bytes)
        .await
        .with_context(|| format!("Failed to write private key to {:?}", path))?;

    // Set restrictive permissions on Unix systems
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path).await?.permissions();
        perms.set_mode(0o600); // rw-------
        fs::set_permissions(path, perms).await?;
    }

    Ok(())
}

/// Convert a public key to AT Protocol compatible multibase format
pub fn public_key_to_multibase(public_key: &VerifyingKey) -> Result<String> {
    // Get the compressed public key bytes (33 bytes)
    let public_key_bytes = public_key.to_encoded_point(true).as_bytes().to_vec();

    // Encode as multibase with base58btc (z prefix)
    let multibase_string = multibase::encode(Base::Base58Btc, &public_key_bytes);

    Ok(multibase_string)
}

/// Generate a new key pair and save to files
pub async fn generate_key(
    name: String,
    keys_dir: PathBuf,
    force: bool,
    format: String,
) -> Result<()> {
    let private_key_path = keys_dir.join(format!("{}.key", name));
    let public_key_path = keys_dir.join(format!("{}.pub", name));

    // Check if files already exist
    if !force && (private_key_path.exists() || public_key_path.exists()) {
        anyhow::bail!(
            "Key files already exist for '{}'. Use --force to overwrite.\n  Private: {:?}\n  Public:  {:?}",
            name,
            private_key_path,
            public_key_path
        );
    }

    println!(
        "{} Generating K256 key pair for '{}'...",
        "🔐".blue(),
        name.bold()
    );

    // Generate new private key
    let private_key = generate_private_key();
    let public_key = private_key.verifying_key();

    // Save private key
    save_private_key(&private_key, &private_key_path)
        .await
        .with_context(|| format!("Failed to save private key to {:?}", private_key_path))?;

    // Generate public key multibase
    let public_key_multibase =
        public_key_to_multibase(public_key).context("Failed to generate public key multibase")?;

    // Output based on format
    match format.as_str() {
        "json" => {
            let output = json!({
                "keyName": name,
                "privateKeyPath": private_key_path,
                "publicKeyPath": public_key_path,
                "publicKeyMultibase": public_key_multibase,
                "publicKeyHex": hex::encode(public_key.to_encoded_point(false).as_bytes()),
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        "multibase" => {
            println!("{}", public_key_multibase);
        }
        _ => {
            // includes "files"
            // Save public key multibase to file
            fs::write(&public_key_path, &public_key_multibase)
                .await
                .with_context(|| format!("Failed to write public key to {:?}", public_key_path))?;

            println!("{} Key pair generated successfully!", "✅".green());
            println!("  {} {}", "Name:".bold(), name);
            println!("  {} {:?}", "Private key:".bold(), private_key_path);
            println!("  {} {:?}", "Public key:".bold(), public_key_path);
            println!(
                "  {} {}",
                "Multibase:".bold(),
                public_key_multibase.bright_blue()
            );
            println!();
            println!("{} Add this to your DID document:", "💡".yellow());
            println!("  \"publicKeyMultibase\": \"{}\"", public_key_multibase);
        }
    }

    Ok(())
}

/// Extract public key from private key file
pub async fn extract_pubkey(private_key_path: PathBuf, format: String) -> Result<()> {
    println!(
        "{} Extracting public key from {:?}...",
        "🔍".blue(),
        private_key_path
    );

    let private_key = load_private_key(&private_key_path)
        .await
        .with_context(|| format!("Failed to load private key from {:?}", private_key_path))?;

    let public_key = private_key.verifying_key();

    match format.as_str() {
        "multibase" => {
            let multibase = public_key_to_multibase(public_key)?;
            println!("{}", multibase);
        }
        "hex" => {
            let hex = hex::encode(public_key.to_encoded_point(false).as_bytes());
            println!("{}", hex);
        }
        "compressed-hex" => {
            let hex = hex::encode(public_key.to_encoded_point(true).as_bytes());
            println!("{}", hex);
        }
        "json" => {
            let multibase = public_key_to_multibase(public_key)?;
            let hex_uncompressed = hex::encode(public_key.to_encoded_point(false).as_bytes());
            let hex_compressed = hex::encode(public_key.to_encoded_point(true).as_bytes());

            let output = json!({
                "publicKeyMultibase": multibase,
                "publicKeyHex": hex_uncompressed,
                "publicKeyHexCompressed": hex_compressed,
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        _ => {
            anyhow::bail!(
                "Invalid format '{}'. Use: multibase, hex, compressed-hex, or json",
                format
            );
        }
    }

    Ok(())
}

/// List available keys in directory
pub async fn list_keys(keys_dir: PathBuf) -> Result<()> {
    if !keys_dir.exists() {
        println!("{} No keys directory found at {:?}", "ℹ️".blue(), keys_dir);
        println!("Run 'teal gen-key' to create your first key.");
        return Ok(());
    }

    let mut keys = Vec::new();
    let mut entries = fs::read_dir(&keys_dir).await?;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if let Some(extension) = path.extension() {
            if extension == "key" {
                if let Some(stem) = path.file_stem() {
                    if let Some(name) = stem.to_str() {
                        keys.push(name.to_string());
                    }
                }
            }
        }
    }

    if keys.is_empty() {
        println!("{} No keys found in {:?}", "ℹ️".blue(), keys_dir);
        println!("Run 'teal gen-key' to create your first key.");
        return Ok(());
    }

    keys.sort();

    println!("{} Available keys in {:?}:", "🔑".blue(), keys_dir);
    println!();

    let keys_count = keys.len();

    for key_name in keys {
        let private_path = keys_dir.join(format!("{}.key", key_name));
        let public_path = keys_dir.join(format!("{}.pub", key_name));

        let mut status_parts = Vec::new();

        if private_path.exists() {
            status_parts.push("private".green().to_string());
        }

        if public_path.exists() {
            status_parts.push("public".cyan().to_string());

            // Try to read and display the multibase
            if let Ok(multibase) = fs::read_to_string(&public_path).await {
                let multibase = multibase.trim();
                println!(
                    "  {} {} ({})",
                    "•".bold(),
                    key_name.bold(),
                    status_parts.join(", ")
                );
                println!("    {}: {}", "Multibase".dimmed(), multibase.bright_blue());
            } else {
                println!(
                    "  {} {} ({})",
                    "•".bold(),
                    key_name.bold(),
                    status_parts.join(", ")
                );
            }
        } else {
            println!(
                "  {} {} ({})",
                "•".bold(),
                key_name.bold(),
                status_parts.join(", ")
            );
        }

        // Show file modification times
        if let Ok(metadata) = fs::metadata(&private_path).await {
            if let Ok(modified) = metadata.modified() {
                let datetime = chrono::DateTime::<chrono::Local>::from(modified);
                println!(
                    "    {}: {}",
                    "Created".dimmed(),
                    datetime.format("%Y-%m-%d %H:%M:%S").to_string().dimmed()
                );
            }
        }
        println!();
    }

    println!(
        "{} Total: {} key(s)",
        "📊".blue(),
        keys_count.to_string().bold()
    );

    Ok(())
}

/// Rotate a key (backup old, generate new)
pub async fn rotate_key(
    keys_dir: PathBuf,
    name: String,
    backup_dir: Option<PathBuf>,
) -> Result<()> {
    let private_key_path = keys_dir.join(format!("{}.key", name));

    if !private_key_path.exists() {
        anyhow::bail!("Key '{}' does not exist in {:?}", name, keys_dir);
    }

    println!("{} Rotating key '{}'...", "🔄".blue(), name.bold());

    // Backup existing key
    let backup_location = backup_dir.unwrap_or_else(|| keys_dir.join("backups"));

    fs::create_dir_all(&backup_location).await?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_private = backup_location.join(format!("{}_{}.key", name, timestamp));
    let backup_public = backup_location.join(format!("{}_{}.pub", name, timestamp));

    fs::copy(&private_key_path, &backup_private).await?;

    let public_key_path = keys_dir.join(format!("{}.pub", name));
    if public_key_path.exists() {
        fs::copy(&public_key_path, &backup_public).await?;
    }

    println!("Backed up existing key to: {:?}", backup_private);

    // Generate new key
    let new_key = generate_private_key();
    save_private_key(&new_key, &private_key_path).await?;

    // Save new public key multibase
    let public_key = new_key.verifying_key();
    let multibase = public_key_to_multibase(public_key)?;
    fs::write(&public_key_path, &multibase).await?;

    println!("{} Key rotation completed!", "✅".green());
    println!("  {} {}", "New multibase:".bold(), multibase.bright_blue());
    println!();
    println!("{} Update your DID document with:", "💡".yellow());
    println!("  \"publicKeyMultibase\": \"{}\"", multibase);

    Ok(())
}
