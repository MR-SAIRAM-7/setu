const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./index');

let isConnected = false;
let connectionPromise = null;
let listenersBound = false;
let lastError = null;

/* -------------------------------------------------------------------------- */
/* SRV resolution                                                             */
/* -------------------------------------------------------------------------- */

/**
 * `mongodb+srv://` needs SRV and TXT lookups before the driver can reach a
 * single node. Plenty of networks answer A records but refuse those two record
 * types, and the driver reports it as `querySrv ECONNREFUSED` — which reads like
 * a dead cluster rather than a DNS policy.
 *
 * So: try the system resolver first, and only if it refuses, check whether a
 * public resolver can answer. If one can, point the process-wide resolver at it
 * so the driver's own lookup succeeds too. `dns.lookup` (used for the actual
 * socket connections) still goes through the OS, so nothing else changes.
 */
async function ensureSrvResolvable(uri) {
  if (!uri.startsWith('mongodb+srv://')) return true;

  let hostname;
  try {
    hostname = new URL(uri).hostname;
  } catch {
    return true; // Let the driver produce the parse error itself.
  }

  const srvName = `_mongodb._tcp.${hostname}`;

  try {
    await dns.promises.resolveSrv(srvName);
    return true;
  } catch (systemError) {
    const servers = config.dnsFallbackServers;
    if (!servers.length) {
      console.warn(`  [MongoDB] SRV lookup for ${hostname} failed (${systemError.code || systemError.message}).`);
      return false;
    }

    const resolver = new dns.promises.Resolver();
    resolver.setServers(servers);

    try {
      await resolver.resolveSrv(srvName);
    } catch (fallbackError) {
      console.warn(
        `  [MongoDB] SRV lookup for ${hostname} failed on both the system resolver ` +
          `(${systemError.code || systemError.message}) and ${servers.join(', ')} ` +
          `(${fallbackError.code || fallbackError.message}).`
      );
      return false;
    }

    dns.setServers(servers);
    console.log(
      `  [MongoDB] System DNS cannot resolve SRV records (${systemError.code || systemError.message}); ` +
        `using ${servers.join(', ')} for this process.`
    );
    return true;
  }
}

/* -------------------------------------------------------------------------- */
/* Connection                                                                 */
/* -------------------------------------------------------------------------- */

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;

  mongoose.connection.on('connected', () => {
    isConnected = true;
    lastError = null;
    console.log(`  [MongoDB] Connected to "${mongoose.connection.name}" at ${mongoose.connection.host}`);
  });

  mongoose.connection.on('error', (err) => {
    isConnected = false;
    lastError = err.message;
  });

  mongoose.connection.on('disconnected', () => {
    if (!isConnected) return; // Never connected — the connect path reports this.
    isConnected = false;
    console.log('  [MongoDB] Disconnected from database');
  });
}

async function connectDB() {
  if (isConnected) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  const mongoUri = config.mongoUri;
  if (!mongoUri || process.env.MONGODB_DISABLED === 'true') {
    const reason =
      process.env.MONGODB_DISABLED === 'true'
        ? 'MongoDB is explicitly disabled by MONGODB_DISABLED=true.'
        : 'No MONGODB_URI configured.';
    console.log(`  [MongoDB] ${reason} Operating in local in-memory/browser fallback mode.`);
    return null;
  }

  bindListeners();

  connectionPromise = (async () => {
    const resolvable = await ensureSrvResolvable(mongoUri);
    if (!resolvable) {
      lastError = 'SRV DNS lookup failed';
      console.log(
        '  [MongoDB] Continuing with client-side/local fallback storage. ' +
          'Set DNS_SERVERS to a resolver that answers SRV records, or use the non-SRV ' +
          '(mongodb://host1,host2,host3/db) form of the connection string.'
      );
      return null;
    }

    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 15000),
        socketTimeoutMS: 45000,
        retryWrites: true,
        autoIndex: true
      });
      isConnected = true;
      return conn;
    } catch (err) {
      isConnected = false;
      lastError = err.message;
      console.warn(`  [MongoDB] Could not connect to ${config.safeMongoUri}: ${err.message}`);
      console.log(
        '  [MongoDB] Database is unreachable or the connection string is invalid. ' +
          'Continuing with client-side/local fallback storage.'
      );
      if (/authentication failed|bad auth/i.test(err.message)) {
        console.log('  [MongoDB] The username or password in MONGODB_URI was rejected by the cluster.');
      } else if (/IP that isn.t whitelisted|not allowed to connect/i.test(err.message)) {
        console.log('  [MongoDB] Add this machine\'s IP to the Atlas Network Access list.');
      }
      // Drop the cached promise so a later call can retry rather than being
      // permanently stuck in fallback mode after one transient failure.
      connectionPromise = null;
      return null;
    }
  })();

  return connectionPromise;
}

/**
 * Resolve once the in-flight connection attempt has settled.
 *
 * Connecting to Atlas takes a couple of seconds — SRV lookup, then a TLS
 * handshake — and the API starts listening immediately. Without this, a client
 * that loads during those two seconds reads an empty library and never asks
 * again, which is indistinguishable from a broken database.
 *
 * Resolves false immediately when nothing is in flight (no URI, or a previous
 * attempt already failed), so fallback mode is never delayed.
 */
function whenReady(timeoutMs = 10000) {
  if (isConnected) return Promise.resolve(true);
  if (!connectionPromise) return Promise.resolve(false);

  return Promise.race([
    Promise.resolve(connectionPromise).then(() => isConnected, () => false),
    new Promise((resolve) => {
      setTimeout(() => resolve(false), timeoutMs).unref();
    })
  ]);
}

function getStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const stateCode = mongoose.connection.readyState;
  const connected = isConnected && stateCode === 1;
  return {
    configured: Boolean(config.mongoUri),
    connected,
    state: states[stateCode] || 'unknown',
    database: connected ? mongoose.connection.name : config.mongoDbName,
    uri: config.safeMongoUri,
    lastError: connected ? null : lastError
  };
}

async function closeDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
    connectionPromise = null;
  }
}

module.exports = {
  connectDB,
  whenReady,
  getStatus,
  closeDB,
  mongoose
};
