import type { Database } from "@teal/db/connect";
import { db } from "@teal/db/connect";
import { status } from "@teal/db/schema";
import { CommitCreateEvent, Jetstream } from "@skyware/jetstream";

import {
  Record as XyzStatusphereStatus,
  isRecord as isStatusphereStatus,
} from "@teal/lexicons/generated/server/types/xyz/statusphere/status";

class Handler {
  private static instance: Handler;
  private constructor() {}
  public static getInstance(): Handler {
    if (!Handler.instance) {
      Handler.instance = new Handler();
    }
    return Handler.instance;
  }

  handle(msg_type: string, record: CommitCreateEvent<string & {}>) {
    // Handle message logic here
    const msg = record.commit.record;
    console.log("Handling" + msg_type + "message:", msg);
    if (isStatusphereStatus(msg) && msg.$type === "xyz.statusphere.status") {
      if (record.commit.operation === "create") {
        // serialize message as xyz.statusphere.status
        db.insert(status).values({
          createdAt: new Date().getSeconds().toString(),
          indexedAt: new Date(record.time_us).getSeconds().toString(),
          status: msg.status,
          // the AT path
          uri: record.commit.rkey,
          authorDid: record.did,
        });
      } else {
        console.log("unsupported operation:", record.commit.operation);
      }
    } else {
      console.log("Unknown message type:", msg_type);
      console.log("Message:", record);
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
    console.log("Creating new jetstream with collections", wantedCollections);
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
        console.log("Received message:", event.commit.record);
        this.handleCreate(collection, event);
      });
    } catch (error) {
      console.error("Error setting onCreate:", error);
    }
    console.log("Started onCreate stream for", collection);
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
      console.log("Streamer started successfully");
    } catch (error) {
      console.error("Error starting streamer:", error);
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
      console.log("Received SIGINT. Graceful shutdown...");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("Received SIGTERM. Graceful shutdown...");
      process.exit(0);
    });

    // Prevent the Node.js process from exiting
    setInterval(() => {
      // This empty interval keeps the process running
    }, 1000);

    console.log("Application is running. Press Ctrl+C to exit.");
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
