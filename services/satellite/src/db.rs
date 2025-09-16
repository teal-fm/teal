use sqlx::postgres::{PgPool, PgPoolOptions};
use std::env;
use tracing::info;

fn censor_url(url: &str) -> String {
    let password_start = url.find(':').unwrap_or(0) + 1;
    let password_end = url.find('@').unwrap_or(url.len());

    if password_start > 0 && password_start < password_end && password_end <= url.len() {
        let mut censored_url = String::with_capacity(url.len());
        censored_url.push_str(&url[..password_start]);
        censored_url.push_str("*****");
        censored_url.push_str(&url[password_end..]);
        censored_url
    } else {
        url.to_string()
    }
}

pub async fn init_pool() -> anyhow::Result<PgPool, anyhow::Error> {
    info!(
            target: "db",
        "Connecting to the database at url {}",
        censor_url(&env::var("DATABASE_URL")?)
    );
    let pool = PgPoolOptions::new()
        .max_connections(50)
        .min_connections(1)
        .max_lifetime(std::time::Duration::from_secs(10))
        .connect(&env::var("DATABASE_URL")?)
        .await?;
    info!(target: "db", "Connected to the database!");

    // run migrations
    info!(target: "db", "Running migrations...");
    //sqlx::migrate!().run(&pool).await?;

    info!(target: "db", "Migrations complete!");
    Ok(pool)
}
