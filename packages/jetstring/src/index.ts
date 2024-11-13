import type { Database } from "@teal/db/connect";
import { db } from "@teal/db/connect";
import { status } from "@teal/db/schema";
import { CommitCreateEvent, Jetstream } from "@skyware/jetstream";
import { server } from "@teal/lexicons/generated/server/types";
import ws from "ws";

class Handler {
  private static instance: Handler;
  private constructor() {}
  public static getInstance(): Handler {
    if (!Handler.instance) {
      Handler.instance = new Handler();
    }
    return Handler.instance;
  }

  handle(msg_type: string, msg: any) {
    // Handle message logic here
    console.log("Handling" + msg_type + "message:", msg);
    if (msg_type === "xyz.statusphere.status") {
      // serialize message as xyz.statusphere.status
      const st = db.insert(status).values({
        status: msg.status,
        uri: msg.uri,
        authorDid: msg.authorDid,
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
