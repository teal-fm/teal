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

    /// Push a job to the Redis queue
    pub async fn queue_job(&self, queue_key: &str, job_data: &str) -> Result<()> {
        let mut conn = self.get_connection().await?;
        let _: () = conn.lpush(queue_key, job_data).await?;
        Ok(())
    }

    /// Set job status in Redis
    pub async fn set_job_status(&self, status_key: &str, status_data: &str) -> Result<()> {
        let mut conn = self.get_connection().await?;
        let _: () = conn.set(status_key, status_data).await?;
        Ok(())
    }

    /// Get job status from Redis
    pub async fn get_job_status(&self, status_key: &str) -> Result<Option<String>> {
        let mut conn = self.get_connection().await?;
        let status: Option<String> = conn.get(status_key).await?;
        Ok(status)
    }
}