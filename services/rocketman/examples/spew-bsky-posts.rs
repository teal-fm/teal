use rocketman::{
    connection::JetstreamConnection,
    handler,
    ingestion::LexiconIngestor,
    options::JetstreamOptions,
    types::event::{ Event, Commit },
};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::Arc,
    sync::Mutex,
};
use async_trait::async_trait;

#[tokio::main]
async fn main() {
    // init the builder
    let opts = JetstreamOptions::builder()
        // your EXACT nsids
        .wanted_collections(vec!["app.bsky.feed.post".to_string()])
        .build();
    // create the jetstream connector
    let jetstream = JetstreamConnection::new(opts);

    // create your ingestors
    let mut ingestors: HashMap<String, Box<dyn LexiconIngestor + Send + Sync>> = HashMap::new();
    ingestors.insert(
        // your EXACT nsid
        "app.bsky.feed.post".to_string(),
        Box::new(MyCoolIngestor),
    );


    // tracks the last message we've processed
    let cursor: Arc<Mutex<Option<u64>>> = Arc::new(Mutex::new(None));

    // get channels
    let msg_rx = jetstream.get_msg_rx();
    let reconnect_tx = jetstream.get_reconnect_tx();

    // spawn a task to process messages from the queue.
    // this is a simple implementation, you can use a more complex one based on needs.
    let c_cursor = cursor.clone();
    tokio::spawn(async move {
        while let Ok(message) = msg_rx.recv_async().await {
            if let Err(e) =
                handler::handle_message(message, &ingestors, reconnect_tx.clone(), c_cursor.clone())
                    .await
            {
                eprintln!("Error processing message: {}", e);
            };
        }
    });

    // connect to jetstream
    // retries internally, but may fail if there is an extreme error.
    if let Err(e) = jetstream.connect(cursor.clone()).await {
        eprintln!("Failed to connect to Jetstream: {}", e);
        std::process::exit(1);
    }
}

pub struct MyCoolIngestor;

/// A cool ingestor implementation. Will just print the message. Does not do verification.
#[async_trait]
impl LexiconIngestor for MyCoolIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(Commit { record: Some(record), .. }) = message.commit {
            if let Some(Value::String(text)) = record.get("text") {
                println!("{text:?}");
            }
        }
        Ok(())
    }
}
