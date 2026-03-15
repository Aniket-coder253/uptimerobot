// ping.js — UptimeRobot-style URL pinger
// Usage: node ping.js
// Requirements: Node.js 18+ (uses built-in fetch)

// ─── CONFIG ───────────────────────────────────────────────────────────────────


const MONITORS = [
  { name: "GreenHand", url: "https://greenhand-pr391.onrender.com" },
  { name: "Ecommerce", url: "https://mern-stack-e-commerce-i8zk.onrender.com" },
  { name: "Aniket Portfolio Chatbot", url: "https://aniket-chatbot-api.onrender.com"},
  { name: "GreenHand_ML", url: "https://greenhand-ml-api.onrender.com"},
  // Add as many URLs as you want:
  // { name: "Google",       url: "https://google.com" },
];

const INTERVAL_MS  = 5 * 60 * 1000; 
const TIMEOUT_MS   = 10_000;       
const HISTORY_SIZE = 100;             

const state = {};

for (const m of MONITORS) {
  state[m.url] = {
    name:        m.name,
    url:         m.url,
    history:     [],  
    totalUp:     0,
    totalDown:   0,
    lastStatus:  null,
    lastLatency: null,
    lastChecked: null,
  };
}

async function pingUrl(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method:  "GET",
      signal:  AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "UptimeBot/1.0" },
    });
    const latency = Date.now() - start;
    return {
      status:     res.ok ? "up" : "down",
      httpStatus: res.status,
      latency,
      checkedAt:  new Date(),
    };
  } catch (err) {
    return {
      status:    "down",
      latency:   Date.now() - start,
      checkedAt: new Date(),
      error:     err.message,
    };
  }
}

function log(monitor, result) {
  const ts      = result.checkedAt.toLocaleTimeString();
  const uptime  = uptimePercent(monitor);
  const icon    = result.status === "up" ? "✅" : "❌";
  const latency = `${result.latency}ms`.padStart(7);
  const http    = result.httpStatus ? ` [${result.httpStatus}]` : result.error ? ` [${result.error.slice(0, 40)}]` : "";

  console.log(
    `${icon}  ${ts}  ${monitor.name.padEnd(20)}  ${result.status.toUpperCase().padEnd(5)}  ${latency}${http}  (uptime: ${uptime}%)`
  );
}

function uptimePercent(monitor) {
  const h = monitor.history;
  if (!h.length) return "—";
  const up = h.filter((r) => r.status === "up").length;
  return ((up / h.length) * 100).toFixed(1);
}

function record(url, result) {
  const m = state[url];
  m.history.push(result);
  if (m.history.length > HISTORY_SIZE) m.history.shift();

  if (result.status === "up")   m.totalUp++;
  else                          m.totalDown++;

  const wasDown = m.lastStatus === "down";
  const isDown  = result.status === "down";

  m.lastStatus  = result.status;
  m.lastLatency = result.latency;
  m.lastChecked = result.checkedAt;

  log(m, result);

  if (!wasDown && isDown) {
    console.log(`🚨  ALERT: ${m.name} went DOWN at ${result.checkedAt.toLocaleTimeString()}`);
  }
  if (wasDown && result.status === "up") {
    console.log(`🟢  RECOVERED: ${m.name} is back UP at ${result.checkedAt.toLocaleTimeString()}`);
  }
}

function printSummary() {
  console.log("\n" + "─".repeat(70));
  console.log("  SUMMARY");
  console.log("─".repeat(70));
  for (const m of Object.values(state)) {
    const uptime = uptimePercent(m);
    const last   = m.lastStatus ? m.lastStatus.toUpperCase() : "PENDING";
    const latency = m.lastLatency ? `${m.lastLatency}ms` : "—";
    console.log(`  ${m.name.padEnd(22)}  ${last.padEnd(6)}  uptime: ${String(uptime + "%").padEnd(8)}  last latency: ${latency}`);
  }
  console.log("─".repeat(70) + "\n");
}

async function pingAll() {
  const results = await Promise.allSettled(
    MONITORS.map(async ({ url }) => {
      const result = await pingUrl(url);
      record(url, result);
      return result;
    })
  );
  return results;
}


console.log("─".repeat(70));
console.log("  🔍  UptimeBot started");
console.log(`  Monitoring ${MONITORS.length} URL(s) every ${INTERVAL_MS / 1000}s`);
MONITORS.forEach((m) => console.log(`  → ${m.name}: ${m.url}`));
console.log("─".repeat(70) + "\n");

pingAll();

setInterval(async () => {
  await pingAll();
  printSummary();
}, INTERVAL_MS);

setInterval(printSummary, 60 * 60 * 1000);

process.on("SIGINT", () => {
  printSummary();
  console.log("\nShutting down. Goodbye 👋");
  process.exit(0);
});
