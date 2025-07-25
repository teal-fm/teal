use anyhow::Result;
use redis::{AsyncCommands, Client};

pub struct RedisClient {
    client: Client,
}

impl RedisClient {
    pub fn new(redis_url: &str) -> Result<Self> {
        let client = Client::open(redis_url)?;
        Ok(Self { client })
    }

    pub async fn get_connection(&self) -> Result<redis::aio::MultiplexedConnection> {
        let conn = self.client.get_multiplexed_async_connection().await?;
        Ok(conn)
    }

    /// Pop a job from the Redis queue (blocking)
    pub async fn pop_job(&self, queue_key: &str, timeout_seconds: u64) -> Result<Option<String>> {
        let mut conn = self.get_connection().await?;
        let result: Option<Vec<String>> = conn.brpop(queue_key, timeout_seconds as f64).await?;
        
        match result {
            Some(mut items) if items.len() >= 2 => {
                // brpop returns [queue_name, item], we want the item
                Ok(Some(items.remove(1)))
            }
            _ => Ok(None)
        }
    }

    /// Update job status in Redis
    pub async fn update_job_status(&self, status_key: &str, status_data: &str) -> Result<()> {
        let mut conn = self.get_connection().await?;
        let _: () = conn.set(status_key, status_data).await?;
        Ok(())
    }
}