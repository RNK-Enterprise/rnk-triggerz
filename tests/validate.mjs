import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const moduleJson = readJson("module.json");
const packageJson = readJson("package.json");

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function collectFiles(directory, matcher = () => true) {
  const base = path.join(root, directory);
  const found = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectFiles(relative, matcher));
    } else if (matcher(relative)) {
      found.push(relative);
    }
  }
  return found;
}

const requiredFiles = [
  "module.json",
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "main.js",
  "src/hooks.js",
  "src/RNKTriggerz.js",
  "src/DataManager.js",
  "src/UIManager.js",
  "src/SocketHandler.js",
  "lang/en.json",
  "styles/rnk-triggerz.css",
  "templates/gm-hub.hbs",
  ...moduleJson.esmodules,
  ...moduleJson.styles,
  ...moduleJson.languages.map((language) => language.path)
];

for (const file of new Set(requiredFiles)) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}

if (moduleJson.id !== "rnk-triggerz") throw new Error(`Unexpected module id: ${moduleJson.id}`);
if (moduleJson.version !== packageJson.version) throw new Error("module.json and package.json versions differ");
if (moduleJson.compatibility.minimum < 13) throw new Error("Foundry minimum compatibility must stay at 13 or higher");
if (moduleJson.compatibility.verified < 14) throw new Error("Foundry verified compatibility must stay at 14 or higher");
if (!moduleJson.esmodules.includes("main.js")) throw new Error("main.js must remain the module entry point");
if (moduleJson.esmodules.includes("scripts/main.js")) throw new Error("scripts/main.js is not a Bible-compliant entry point");
if (packageJson.main !== "main.js") throw new Error("package.json main must be main.js");

const gmHubTemplate = readText("templates/gm-hub.hbs");
const hubCss = readText("styles/rnk-triggerz.css");
const constantsSource = readText("src/constants.js");
if (!constantsSource.includes(`MODULE_VERSION = "${moduleJson.version}"`)) {
  throw new Error("src/constants.js MODULE_VERSION must match module.json version");
}
if (!moduleJson.download.includes(`/v${moduleJson.version}/`)) {
  throw new Error("module.json download URL must match module version");
}
if (!/<details class="rnk-triggerz-effect-builder">/.test(gmHubTemplate)) {
  throw new Error("Homebrew effect changes must stay collapsed by default");
}
if (/\{\{#each \(array/.test(gmHubTemplate)) {
  throw new Error("GM hub template must not depend on a custom array helper");
}
if (!/::placeholder/.test(hubCss)) {
  throw new Error("GM hub placeholders must use muted styling");
}
if (/repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(hubCss)) {
  throw new Error("GM hub grids must not force two squished columns");
}
if (!/repeat\(auto-fit,\s*minmax/.test(hubCss)) {
  throw new Error("GM hub grids must use responsive auto-fit columns");
}

const visibleSourceFiles = [
  "README.md",
  "CHANGELOG.md",
  "module.json",
  "package.json",
  ...collectFiles("src", (file) => file.endsWith(".js")),
  ...collectFiles("templates", (file) => file.endsWith(".hbs")),
  ...collectFiles("lang", (file) => file.endsWith(".json"))
];

const blockedReleaseTerms = [
  ["A", "I"].join(""),
  ["artificial", "intelligence"].join(" "),
  ["Open", ["A", "I"].join("")].join(""),
  ["Chat", "G" + "PT"].join(""),
  "G" + "PT",
  "L" + "LM",
  ["machine", "learning"].join(" ")
];

for (const file of visibleSourceFiles) {
  const text = readText(file);
  if (/\bdnd5e\b|d&d5e/i.test(text)) {
    throw new Error(`System-specific D&D5E label found in visible source: ${file}`);
  }
  if (/\.render\(true\)/.test(text)) {
    throw new Error(`ApplicationV2 render(true) found in source: ${file}`);
  }
  for (const term of blockedReleaseTerms) {
    if (new RegExp(`\\b${term}\\b`, "i").test(text)) {
      throw new Error(`Prohibited release wording found in source: ${file}`);
    }
  }
}

console.log("Validation passed.");
