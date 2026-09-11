import dns from "node:dns/promises";
import net from "node:net";

const raw = process.env.SUPABASE_DB_URL;
if (!raw) throw new Error("SUPABASE_DB_URL is missing");
const url = new URL(raw);
const hostname = url.hostname;
const port = Number(url.port || (url.protocol === "postgres:" ? 5432 : 5432));

const addresses = await dns.lookup(hostname, { all: true });
console.log(JSON.stringify({ protocol: url.protocol, hostname, port, addresses: addresses.map(({ address, family }) => ({ address, family })) }));

await new Promise((resolve, reject) => {
  const socket = net.createConnection({ host: hostname, port, timeout: 7000 });
  socket.once("connect", () => {
    console.log(JSON.stringify({ tcp: "reachable" }));
    socket.destroy();
    resolve();
  });
  socket.once("timeout", () => {
    socket.destroy();
    reject(new Error("TCP connection timed out"));
  });
  socket.once("error", reject);
});
