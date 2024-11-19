import { db } from "@teal/db/connect";
import { status } from "@teal/db/schema";
import { CommitCreateEvent, Jetstream } from "@skyware/jetstream";

import {Record as Status, isRecord as isStatus, validateRecord as validateStatus} from "@teal/lexicons/generated/server/types/xyz/statusphere/status";

import pino from "pino";
const logger = pino({ name: "jetstream" });

class Handler {
  private static instance: Handler;
  private constructor() {}
  public static getInstance(): Handler {
    if (!Handler.instance) {
      Handler.instance = new Handler();
    }
    return Handler.instance;
  }

  handle(msg_type: string, message: CommitCreateEvent<string & {}>) {
    // Handle message logic here
    logger.info("Handling " + msg_type + " message:", message);
    // check and verify message is what it says it is
    if (message.commit.collection === "xyz.statusphere.status" && isStatus(message.commit.record) && validateStatus(message.commit.record) ) {
      // serialize message as xyz.statusphere.status
      let msg = message.commit.record as Status;
      const st = db.insert(status).values({
        createdAt: new Date(message.time_us).toISOString(),
        indexedAt: new Date().toISOString(),
        status: msg.status,
        uri: message.commit.cid,
        authorDid: message.did,
      });
    }
  }
}

class Streamer {
  private static instance: Streamer;
  private jetstream: Jetstream;
  private handler: Handler;

  private wantedCollections: string[];

  private constructor(wantedCollections: string[]) {
    this.handler = Handler.getInstance();
    logger.info("Creating new jetstream with collections", wantedCollections);
    this.jetstream = new Jetstream({
      wantedCollections,
    });
    this.wantedCollections = wantedCollections;
  }

  public static getInstance(wantedCollections?: string[]): Streamer {
    if (!Streamer.instance && wantedCollections) {
      Streamer.instance = new Streamer(wantedCollections);
    } else if (!Streamer.instance) {
      throw Error(
        "Wanted collections are required if instance does not exist!",
      );
    }
    return Streamer.instance;
  }

  async setOnCreates() {
    for (const collection of this.wantedCollections) {
      await this.setOnCreate(collection);
    }
  }

  async setOnCreate(collection: string) {
    try {
      this.jetstream.onCreate(collection, (event) => {
        logger.info("Received message:", event);
        this.handleCreate(collection, event);
      });
    } catch (error) {
      logger.error("Error setting onCreate:", error);
    }
    logger.info("Started onCreate stream for", collection);
  }

  async handleCreate(
    collection: string,
    event: CommitCreateEvent<string & {}>,
  ) {
    this.handler.handle(collection, event);
  }

  // Add method to start the streamer
  async start() {
    try {
      await this.setOnCreates();
      this.jetstream.start();
      logger.info("Streamer started successfully");
    } catch (error) {
      logger.error("Error starting streamer:", error);
    }
  }
}

// Main function to run the application
async function main() {
  try {
    const streamer = Streamer.getInstance(["xyz.statusphere.status"]);
    await streamer.start();

    // Keep the process running
    process.on("SIGINT", () => {
      logger.info("Received SIGINT. Graceful shutdown...");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger.info("Received SIGTERM. Graceful shutdown...");
      process.exit(0);
    });

    // Prevent the Node.js process from exiting
    setInterval(() => {
      // This empty interval keeps the process running
    }, 1000);

    logger.info("Application is running. Press Ctrl+C to exit.");
  } catch (error) {
    logger.error("Error in main:", error);
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
