async function main() {
  const { loadRepoEnv } = await import("@acme/env/load");
  loadRepoEnv();
  await import("./cli.js");
}

void main();
