import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let memoryServer = null;
let connectingPromise = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    const customUri = process.env.MONGODB_URI;

    if (customUri && customUri.trim() !== '') {
      console.log(`[DB] Connecting to provided MongoDB URI: ${customUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
      await mongoose.connect(customUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('[DB] MongoDB Connected successfully (External/Configured).');
      return mongoose.connection;
    }

    // Embedded persistent MongoDB instance using MongoMemoryServer
    const dbDirectory = path.resolve('data/db');
    if (!fs.existsSync(dbDirectory)) {
      fs.mkdirSync(dbDirectory, { recursive: true });
    }

    // Clean stale mongod.lock file if server was terminated abruptly
    const lockFile = path.join(dbDirectory, 'mongod.lock');
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
      } catch (e) {
        // Ignore if locked by active process
      }
    }

    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const isTestEnv = process.env.NODE_ENV === 'test';
      console.log(`[DB] Launching ${isTestEnv ? 'ephemeral test' : 'local persistent'} MongoDB instance...`);
      memoryServer = await MongoMemoryServer.create(
        isTestEnv
          ? {}
          : {
              instance: {
                dbPath: dbDirectory,
                storageEngine: 'wiredTiger'
              }
            }
      );

      const uri = memoryServer.getUri();
      console.log(`[DB] Embedded MongoDB running at: ${uri}`);
      await mongoose.connect(uri);
      console.log('[DB] Connected to embedded persistent MongoDB.');
      return mongoose.connection;
    } catch (err) {
      console.error('[DB] Failed to initialize persistent MongoDB:', err);
      throw err;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

export async function disconnectDB() {
  connectingPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});
