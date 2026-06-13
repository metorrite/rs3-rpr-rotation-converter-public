const fs = require("fs");
const cp = require("child_process");
const path = require("path");

const configPath = path.resolve(__dirname, "local-run-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

function run(command, args) {
    const child = cp.spawn(command, args, {
        stdio: "inherit",
        shell: false
    });

    child.on("exit", (code) => {
        process.exit(code ?? 0);
    });
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

if (config.useGui) {
    const build = cp.spawnSync(npmCmd, ["run", "build"], { stdio: "inherit" });
    if (build.status !== 0) {
        process.exit(build.status ?? 1);
    }

    run(npxCmd, ["electron", "dist/electron/main.js"]);
} else {
    run(npmCmd, ["run", "dev"]);
}