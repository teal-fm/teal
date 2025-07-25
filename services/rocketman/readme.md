## Rocketman

A modular(ish) jetstream consumer. Backed by Tungstenite.


### Installation
```toml
[dependencies]
rocketman = "latest" # pyt the latest version here
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```
### Usage
```rs
#[tokio::main]
async fn main() {
    // init the builder
    let opts = JetstreamOptions::builder()
        // your EXACT nsids
        .wanted_collections(vec!["com.example.cool.nsid".to_string()])
        .build();
    // create the jetstream connector
    let jetstream = JetstreamConnection::new(opts);

    // create your ingestors
    let mut ingestors: HashMap<String, Box<dyn LexiconIngestor + Send + Sync>> = HashMap::new();
    ingestors.insert(
        // your EXACT nsid
        "com.example.cool.nsid".to_string(),
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
                error!("Error processing message: {}", e);
            };
        }
    });

    // connect to jetstream
    // retries internally, but may fail if there is an extreme error.
    if let Err(e) = jetstream.connect(cursor.clone()).await {
        error!("Failed to connect to Jetstream: {}", e);
        std::process::exit(1);
    }
}

pub struct MyCoolIngestor;

/// A cool ingestor implementation. Will just print the message. Does not do verification.
impl LexiconIngestor for MyCoolIngestor {
    async fn ingest(&self, message: Event<Value>) -> Result<()> {
        info!("{:?}", message);
        // Process message for default lexicon.
        Ok(())
    }
}
```
### gratz
Based heavily on [phil's jetstream consumer on atcosm constellation.](https://github.com/atcosm/links/blob/main/constellation/src/consumer/jetstream.rs)
