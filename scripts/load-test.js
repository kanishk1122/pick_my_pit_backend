require('dotenv').config();
const os = require('os');
const { Pool } = require('pg');
let pgPool = null;

// Configuration
let TARGET_URL = 'http://localhost:5000';
let MAX_VUS = 10;
let DURATION_SEC = 60;
let RESOURCE_LIMIT_PERCENT = 90;

// Stats tracking
const stats = {
  requestsSent: 0,
  requestsSuccess: 0,
  requestsFailed: 0,
  latencies: [],
  startTime: Date.now(),
  cpuUsage: 0,
  ramUsage: 0,
  safetyViolations: 0,
  errors: {}
};

// Parse command line arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target' && args[i + 1]) {
    TARGET_URL = args[i + 1].replace(/\/$/, '');
    i++;
  } else if (args[i] === '--vus' && args[i + 1]) {
    MAX_VUS = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--duration' && args[i + 1]) {
    DURATION_SEC = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--limit' && args[i + 1]) {
    RESOURCE_LIMIT_PERCENT = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Pick My Pit Load Tester - CLI Usage:
  node load-test.js [options]

Options:
  --target <url>     Target backend base URL (default: http://localhost:5000)
  --vus <count>      Number of concurrent virtual users (default: 10)
  --duration <sec>   Duration of load test in seconds (default: 60)
  --limit <percent>  CPU/Memory threshold to stop test (default: 90)
  --help, -h         Show this help message
`);
    process.exit(0);
  }
}

// Helper to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to calculate CPU times
function getCPUTimes() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return { idle: 0, total: 0 };
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

// Measure CPU and RAM utilization
let lastCpuTimes = getCPUTimes();
function updateSystemMetrics() {
  // RAM Usage
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  stats.ramUsage = ((totalMem - freeMem) / totalMem) * 100;

  // CPU Usage
  const currentCpuTimes = getCPUTimes();
  const idleDiff = currentCpuTimes.idle - lastCpuTimes.idle;
  const totalDiff = currentCpuTimes.total - lastCpuTimes.total;
  
  if (totalDiff > 0) {
    stats.cpuUsage = (1 - (idleDiff / totalDiff)) * 100;
  }
  lastCpuTimes = currentCpuTimes;
}

// Log error details for reporting
function logError(apiPath, errMessage) {
  const key = `${apiPath} -> ${errMessage}`;
  stats.errors[key] = (stats.errors[key] || 0) + 1;
}

// Parse cookie header to retrieve specific cookie value
function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(`${name}=`)) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}

// HTTP request helper utilizing Node native fetch
async function makeRequest(method, path, body = null, token = null) {
  const url = `${TARGET_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    // Also attach auth_token cookie since backend middleware looks there first
    headers['Cookie'] = `auth_token=${token}`;
  }

  const startTime = Date.now();
  stats.requestsSent++;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000) // 15s timeout
    });

    const duration = Date.now() - startTime;
    stats.latencies.push(duration);

    // Extract auth_token cookie if present in response headers
    let returnedToken = null;
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      returnedToken = parseCookie(setCookieHeader, 'auth_token');
    }

    if (response.ok) {
      stats.requestsSuccess++;
      try {
        const json = await response.json();
        return { success: true, status: response.status, data: json, token: returnedToken };
      } catch {
        return { success: true, status: response.status, data: null, token: returnedToken };
      }
    } else {
      stats.requestsFailed++;
      let errMsg = `Status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) errMsg = errJson.message;
      } catch {}
      logError(path, errMsg);
      return { success: false, status: response.status, error: errMsg };
    }
  } catch (error) {
    stats.requestsFailed++;
    const duration = Date.now() - startTime;
    stats.latencies.push(duration);
    logError(path, error.message);
    return { success: false, error: error.message };
  }
}

// Simulated User Workflow
async function runUserWorkflow(vuId) {
  const rand = Math.floor(Math.random() * 1000000);
  const email = `vu_${Date.now()}_${rand}@example.com`;
  const password = 'SecurePassword123!';
  let token = null;
  let userObjectId = null;

  try {
    // 1. Register User
    const regRes = await makeRequest('POST', '/api/auth/register', {
      firstname: `Virtual`,
      lastname: `User${vuId}`,
      email: email,
      password: password,
      gender: 'male'
    });

    if (!regRes.success || !regRes.data || !regRes.data.data || !regRes.data.data.user) {
      return;
    }
    
    userObjectId = regRes.data.data.user.id;
    
    // Activate the newly registered user in PostgreSQL directly so they can log in and call APIs
    if (pgPool) {
      await pgPool.query(
        'UPDATE "User" SET status = $1, "emailConfirm" = $2 WHERE LOWER(email) = $3',
        ['active', true, email.toLowerCase()]
      );
    }

    // 2. Login User to retrieve JWT Token
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: email,
      password: password
    });

    if (loginRes.success && loginRes.data && loginRes.data.data && loginRes.data.data.user) {
      // Extract token from set-cookie header returned during login
      token = loginRes.token;
      
      // Fallback if set-cookie header wasn't parsed correctly but login was successful
      if (!token && loginRes.data.data.user.isAuthenticated) {
        // Backend returns token in cookie, but let's check if we can get it from verify-token
        const verifyRes = await makeRequest('GET', '/api/auth/verify-token');
        if (verifyRes.success && verifyRes.token) {
          token = verifyRes.token;
        }
      }
    }

    // If login failed or token was not fetched, try using registration cookies/token
    if (!token && regRes.token) {
      token = regRes.token;
    }

    if (!token) {
      logError('WORKFLOW', 'Could not retrieve JWT auth token');
      return;
    }

    // 3. Create User Address
    const addressRes = await makeRequest('POST', '/api/addresses', {
      street: `${rand} LoadTest Way`,
      city: 'Jaipur',
      state: 'Rajasthan',
      location: {
        type: 'Point',
        coordinates: [75.7873, 26.9124]
      },
      landmark: 'Load Test Hub',
      postalCode: '302001',
      country: 'India',
      isDefault: true
    }, token);

    if (!addressRes.success || !addressRes.data || !addressRes.data.data || !addressRes.data.data._id) {
      return;
    }
    const addressId = addressRes.data.data._id;

    // 4. Create Post (Pet Listing)
    // Avoid "spam", "fake", "scam", "test" to bypass spam filters
    const postRes = await makeRequest('POST', '/api/posts', {
      title: `Charming Adoptable Golden Retriever Pup ${rand}`,
      discription: `This is a charming energetic pup looking for a loving home. Healthy, playful, and fully vaccinated.`,
      amount: 150,
      type: 'paid',
      category: 'golden-retriever',
      species: 'dog',
      isNegotiable: true,
      addressId: addressId,
      images: ['https://images.unsplash.com/photo-1552053831-71594a27632d'],
      age: {
        value: 4,
        unit: 'months'
      }
    }, token);

    // 5. Query Filtered Posts
    await makeRequest('GET', '/api/posts/filter?species=dog&breed=golden-retriever&type=paid');

    // 6. Get User's Own Posts (this registers immediately and fetches background-saved post if saved)
    await sleep(200); // Give background processing a tiny moment to save the post to DB
    const ownPostsRes = await makeRequest('GET', '/api/posts/user-posts', null, token);

    // 7. Get a single post by ID if we can retrieve one from the user's posts
    if (ownPostsRes.success && ownPostsRes.data && ownPostsRes.data.data && ownPostsRes.data.data.length > 0) {
      const postId = ownPostsRes.data.data[0]._id;
      await makeRequest('GET', `/api/posts/${postId}`);
    }

  } finally {
    // Cleanup database records for this user iteration to prevent DB bloat
    if (userObjectId && pgPool) {
      try {
        // onDelete: Cascade will clean up addresses and posts automatically
        await pgPool.query('DELETE FROM "User" WHERE id = $1', [userObjectId]);
      } catch (err) {
        // Silent catch for cleanup errors
      }
    }
  }
}

// Continuous safety check loop
let safetyTimer;
let testTerminated = false;
let terminateReason = '';

function startSafetyMonitor() {
  safetyTimer = setInterval(() => {
    updateSystemMetrics();

    const cpuExceeded = stats.cpuUsage > RESOURCE_LIMIT_PERCENT;
    const ramExceeded = stats.ramUsage > RESOURCE_LIMIT_PERCENT;

    if (cpuExceeded || ramExceeded) {
      stats.safetyViolations++;
      if (stats.safetyViolations >= 3) {
        testTerminated = true;
        terminateReason = `PC load exceeded ${RESOURCE_LIMIT_PERCENT}% threshold! (CPU: ${stats.cpuUsage.toFixed(1)}%, RAM: ${stats.ramUsage.toFixed(1)}%)`;
        clearInterval(safetyTimer);
      }
    } else {
      stats.safetyViolations = Math.max(0, stats.safetyViolations - 1);
    }
  }, 1000);
}

// Print status dashboard to console
function printStatus(activeVUs) {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  const rps = (stats.requestsSent / (elapsed || 1)).toFixed(1);
  
  // Calculate average latency
  let avgLatency = 0;
  if (stats.latencies.length > 0) {
    const sum = stats.latencies.reduce((a, b) => a + b, 0);
    avgLatency = (sum / stats.latencies.length).toFixed(1);
  }

  // Clear screen and draw dashboard
  console.clear();
  console.log(`====================================================`);
  console.log(`🔥 PICK MY PIT BACKEND LOAD TEST RUNNING 🔥`);
  console.log(`====================================================`);
  console.log(`Target URL:     ${TARGET_URL}`);
  console.log(`Active VUs:     ${activeVUs} / ${MAX_VUS}`);
  console.log(`Elapsed Time:   ${elapsed}s / ${DURATION_SEC}s`);
  console.log(`Requests Sent:  ${stats.requestsSent}`);
  console.log(`  - Success:    \x1b[32m${stats.requestsSuccess}\x1b[0m`);
  console.log(`  - Failed:     \x1b[31m${stats.requestsFailed}\x1b[0m`);
  console.log(`Current RPS:    ${rps} req/sec`);
  console.log(`Avg Latency:    ${avgLatency} ms`);
  console.log(`----------------------------------------------------`);
  console.log(`💻 SYSTEM RESOURCE MONITOR:`);
  console.log(`CPU Usage:      ${stats.cpuUsage.toFixed(1)}%`);
  console.log(`RAM Usage:      ${stats.ramUsage.toFixed(1)}%`);
  console.log(`Limit Config:   ${RESOURCE_LIMIT_PERCENT}%`);
  console.log(`Safety Buffer:  ${3 - stats.safetyViolations} ticks left before shutdown`);
  console.log(`====================================================`);
}

// Main execution function
async function main() {
  // Connect to database for user activation and cleanup
  const dbUri = process.env.DATABASE_URL;
  if (dbUri) {
    console.log(`Connecting to PostgreSQL for load-test support...`);
    pgPool = new Pool({ connectionString: dbUri });
    await pgPool.query('SELECT NOW()');
    console.log(`✅ Connected to PostgreSQL`);
  } else {
    console.warn(`⚠️ DATABASE_URL not found in .env. Test will run without user activation.`);
  }

  console.log(`Initializing system safety monitor...`);
  updateSystemMetrics();
  startSafetyMonitor();

  console.log(`Starting load test against ${TARGET_URL}`);
  console.log(`Configuration: ${MAX_VUS} VUs | ${DURATION_SEC}s duration | ${RESOURCE_LIMIT_PERCENT}% PC load safety limit`);
  
  let activeVUs = 0;
  const runnerPromises = [];

  const testEndTime = Date.now() + (DURATION_SEC * 1000);

  // Interval logger
  const logInterval = setInterval(() => {
    printStatus(activeVUs);
  }, 1000);

  // Spawn VU loops
  for (let i = 0; i < MAX_VUS; i++) {
    const loopId = i + 1;
    
    const vuLoop = async () => {
      activeVUs++;
      while (Date.now() < testEndTime && !testTerminated) {
        try {
          await runUserWorkflow(loopId);
        } catch (e) {
          logError('VU_LOOP', e.message);
        }
        // Brief pacing pause between operations to avoid instant throttling
        await sleep(100);
      }
      activeVUs--;
    };

    runnerPromises.push(vuLoop());
    // Stagger VU start dynamically (spawn all VUs over ~1-2 seconds)
    await sleep(Math.max(1, Math.floor(1000 / MAX_VUS)));
  }

  // Wait for duration or safety shutdown
  while (Date.now() < testEndTime && !testTerminated) {
    await sleep(500);
  }

  clearInterval(logInterval);
  clearInterval(safetyTimer);

  // Wait for active VUs to finish current cycle
  await Promise.all(runnerPromises);

  // Close PostgreSQL connection
  if (pgPool) {
    await pgPool.end();
  }

  // Print Final Summary
  console.clear();
  console.log(`====================================================`);
  if (testTerminated) {
    console.log(`🚨 SAFETY SHUTDOWN TRIGGERED! 🚨`);
    console.log(`Reason: ${terminateReason}`);
  } else {
    console.log(`✅ LOAD TEST COMPLETE ✅`);
  }
  console.log(`====================================================`);
  
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  const rps = (stats.requestsSent / (elapsed || 1)).toFixed(1);
  
  let minLat = 0, maxLat = 0, avgLatency = 0;
  if (stats.latencies.length > 0) {
    minLat = Math.min(...stats.latencies);
    maxLat = Math.max(...stats.latencies);
    const sum = stats.latencies.reduce((a, b) => a + b, 0);
    avgLatency = (sum / stats.latencies.length).toFixed(1);
  }

  console.log(`Total Run Time:   ${elapsed}s`);
  console.log(`Total Requests:   ${stats.requestsSent}`);
  console.log(`  - Success:      \x1b[32m${stats.requestsSuccess}\x1b[0m`);
  console.log(`  - Failed:       \x1b[31m${stats.requestsFailed}\x1b[0m`);
  console.log(`Average RPS:      ${rps} req/sec`);
  console.log(`Latencies:`);
  console.log(`  - Min:          ${minLat} ms`);
  console.log(`  - Max:          ${maxLat} ms`);
  console.log(`  - Avg:          ${avgLatency} ms`);
  
  if (Object.keys(stats.errors).length > 0) {
    console.log("----------------------------------------------------");
    console.log(`❌ ERROR DISTRIBUTION:`);
    for (const [key, count] of Object.entries(stats.errors)) {
      console.log(`  - [${count}x] ${key}`);
    }
  }
  
  console.log(`====================================================`);
  
  if (testTerminated) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
