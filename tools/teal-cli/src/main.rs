use anyhow::Result;
use clap::{Parser, Subcommand};

use std::path::PathBuf;

mod crypto;

#[derive(Parser)]
#[command(name = "teal")]
#[command(about = "Teal management utilities")]
#[command(version = "0.1.0")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate a new K256 key pair
    GenKey {
        /// Key name/identifier
        #[arg(short, long, default_value = "repo")]
        name: String,

        /// Output directory (defaults to ~/.teal/keys)
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Overwrite existing keys
        #[arg(short, long)]
        force: bool,

        /// Output format: json, multibase, or files
        #[arg(long, default_value = "files")]
        format: String,
    },

    /// Extract public key multibase from private key
    ExtractPubkey {
        /// Path to private key file
        #[arg(short, long)]
        private_key: PathBuf,

        /// Output format
        #[arg(short, long, default_value = "multibase")]
        format: String,
    },

    /// List available keys
    List {
        /// Keys directory (defaults to ~/.teal/keys)
        #[arg(short, long)]
        directory: Option<PathBuf>,
    },

    /// Rotate keys (generate new, backup old)
    Rotate {
        /// Key name to rotate
        #[arg(short, long)]
        name: String,

        /// Backup directory
        #[arg(short, long)]
        backup_dir: Option<PathBuf>,
    },
}

fn get_default_keys_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".teal")
        .join("keys")
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::GenKey {
            name,
            output,
            force,
            format,
        } => {
            let keys_dir = output.unwrap_or_else(get_default_keys_dir);
            crypto::generate_key(name, keys_dir, force, format).await
        }
        Commands::ExtractPubkey {
            private_key,
            format,
        } => crypto::extract_pubkey(private_key, format).await,
        Commands::List { directory } => {
            let keys_dir = directory.unwrap_or_else(get_default_keys_dir);
            crypto::list_keys(keys_dir).await
        }
        Commands::Rotate { name, backup_dir } => {
            let keys_dir = get_default_keys_dir();
            crypto::rotate_key(keys_dir, name, backup_dir).await
        }
    }
}
