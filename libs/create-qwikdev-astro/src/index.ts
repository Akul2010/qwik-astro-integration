import { type ChildProcess, exec, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path, { join, resolve, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  select,
  spinner,
  text
} from "@clack/prompts";
import {
  bgBlue,
  bgMagenta,
  bold,
  cyan,
  gray,
  green,
  magenta,
  red,
  reset,
  white
} from "kleur/colors";
import detectPackageManager from "which-pm-runs";
import yargs from "yargs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function isHome(dir: string): boolean {
  return dir.startsWith("~/");
}

export function resolveAbsoluteDir(dir: string) {
  return isHome(dir) ? resolve(os.homedir(), dir) : resolve(process.cwd(), dir);
}

export function resolveRelativeDir(dir: string) {
  return isHome(dir) ? relative(os.homedir(), dir) : relative(process.cwd(), dir);
}

export function $(cmd: string, args: string[], cwd: string) {
  let child: ChildProcess;

  const install = new Promise<boolean>((resolve) => {
    try {
      child = spawn(cmd, args, {
        cwd,
        stdio: "ignore"
      });

      child.on("error", (e) => {
        if (e) {
          log.error(`${red(String(e.message || e))}\n\n`);
        }
        resolve(false);
      });

      child.on("close", (code) => {
        resolve(code === 0);
      });
    } catch (e) {
      resolve(false);
    }
  });

  const abort = async () => {
    if (child) {
      child.kill("SIGINT");
    }
  };

  return { abort, install };
}

export function getPackageManager() {
  return detectPackageManager()?.name || "npm";
}

export const isPackageManagerInstalled = (packageManager: string) => {
  return new Promise((resolve) => {
    exec(`${packageManager} --version`, (error, _, stderr) => {
      resolve(!(error || stderr));
    });
  });
};

// Used from https://github.com/sindresorhus/is-unicode-supported/blob/main/index.js
export function isUnicodeSupported() {
  if (process.platform !== "win32") {
    return process.env.TERM !== "linux"; // Linux console (kernel)
  }

  return (
    Boolean(process.env.CI) ||
    Boolean(process.env.WT_SESSION) || // Windows Terminal
    Boolean(process.env.TERMINUS_SUBLIME) || // Terminus (<0.2.27)
    process.env.ConEmuTask === "{cmd::Cmder}" || // ConEmu and cmder
    process.env.TERM_PROGRAM === "Terminus-Sublime" ||
    process.env.TERM_PROGRAM === "vscode" ||
    process.env.TERM === "xterm-256color" ||
    process.env.TERM === "alacritty" ||
    process.env.TERMINAL_EMULATOR === "JetBrains-JediTerm"
  );
}

// Used from https://github.com/natemoo-re/clack/blob/main/packages/prompts/src/index.ts
const unicode = isUnicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);
const S_BAR = s("│", "|");
const S_BAR_H = s("─", "-");
const S_CORNER_TOP_RIGHT = s("╮", "+");
const S_CONNECT_LEFT = s("├", "+");
const S_CORNER_BOTTOM_RIGHT = s("╯", "+");
const S_STEP_SUBMIT = s("◇", "o");

function ansiRegex() {
  const pattern = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"
  ].join("|");

  return new RegExp(pattern, "g");
}

// Used from https://github.com/QwikDev/qwik/blob/main/packages/qwik/src/cli/utils/utils.ts
const strip = (str: string) => str.replace(ansiRegex(), "");
export const note = (message = "", title = "") => {
  const lines = `\n${message}\n`.split("\n");
  const titleLen = strip(title).length;
  const len =
    Math.max(
      lines.reduce((sum, ln) => {
        ln = strip(ln);
        return ln.length > sum ? ln.length : sum;
      }, 0),
      titleLen
    ) + 2;
  const msg = lines
    .map(
      (ln) =>
        `${gray(S_BAR)}  ${white(ln)}${" ".repeat(len - strip(ln).length)}${gray(S_BAR)}`
    )
    .join("\n");
  process.stdout.write(
    `${gray(S_BAR)}\n${green(S_STEP_SUBMIT)}  ${reset(title)} ${gray(
      S_BAR_H.repeat(Math.max(len - titleLen - 1, 1)) + S_CORNER_TOP_RIGHT
    )}\n${msg}\n${gray(
      S_CONNECT_LEFT + S_BAR_H.repeat(len + 2) + S_CORNER_BOTTOM_RIGHT
    )}\n`
  );
};

// Used from https://github.com/QwikDev/qwik/blob/main/packages/qwik/src/cli/utils/utils.ts
export function panic(msg: string) {
  console.error(`\n❌ ${red(msg)}\n`);
  process.exit(1);
}

// Used from https://github.com/QwikDev/qwik/blob/main/packages/create-qwik/src/helpers/clearDir.ts
export const clearDir = async (dir: string) => {
  const files = await fs.promises.readdir(dir);

  return await Promise.all(
    files.map((pathToFile) => fs.promises.rm(join(dir, pathToFile), { recursive: true }))
  );
};

export function panicCanceled() {
  panic("Operation canceled.");
}

export const $pm = async (
  args: string | string[],
  cwd = process.cwd(),
  env = process.env
) => {
  const packageManager = getPackageManager();
  args = Array.isArray(args) ? args : [args];

  return new Promise((resolve, reject) => {
    const child = spawn(packageManager, args, {
      cwd,
      stdio: "inherit",
      env
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject({ command: `${packageManager} ${args.join(" ")}` });
        return;
      }
      resolve(true);
    });
  });
};

export const installDependencies = async (cwd: string) => {
  await $pm("install", cwd);
};

export type Args = {
  outDir: string;
  adapter?: "deno" | "node";
  install: boolean;
  force: boolean;
  biome: boolean;
  git: boolean;
  ci: boolean;
  yes: boolean;
  no: boolean;
  it: boolean;
  dryRun: boolean;
};

export function parseArgs(args: string[]): Args {
  const parsedArgs = yargs(args)
    .strict()
    .command(
      "* <outDir> [adapter]",
      "Create a new project powered by QwikDev/astro",
      (yargs) => {
        return yargs
          .positional("adapter", {
            type: "string",
            desc: "Server adapter",
            choices: ["deno", "node"]
          })
          .positional("outDir", {
            type: "string",
            desc: "Directory of the project"
          })
          .option("force", {
            alias: "f",
            type: "boolean",
            default: false,
            desc: "Overwrite target directory if it exists"
          })
          .option("install", {
            alias: "i",
            default: false,
            type: "boolean",
            desc: "Install dependencies"
          })
          .option("biome", {
            default: false,
            type: "boolean",
            desc: "Prefer Biome to ESLint/Prettier"
          })
          .option("git", {
            default: false,
            type: "boolean",
            desc: "Initialize Git repository"
          })
          .option("ci", {
            default: false,
            type: "boolean",
            desc: "Add CI workflow"
          })
          .option("yes", {
            alias: "y",
            default: false,
            type: "boolean",
            desc: "Skip all prompts by accepting defaults"
          })
          .option("no", {
            alias: "n",
            default: false,
            type: "boolean",
            desc: "Skip all prompts by declining defaults"
          })
          .option("it", {
            default: false,
            type: "boolean",
            desc: "Execute actions interactively"
          })
          .option("dryRun", {
            default: false,
            type: "boolean",
            desc: "Walk through steps without executing"
          })
          .usage("npm create @qwikdev/astro@latest node ./my-project <options>");
      }
    ).argv as unknown as Args;

  return parsedArgs;
}

const createProject = async (args: string[]) => {
  try {
    const defaultProjectName = "./qwik-astro-app";

    const argv = parseArgs(args.length ? args : [defaultProjectName]);

    const it = argv.it || args.length === 0;

    const dryRun = argv.dryRun;

    intro(`Let's create a ${bgBlue(" QwikDev/astro App ")} ✨`);

    const packageManager = getPackageManager();

    const projectNameAnswer =
      argv.outDir !== defaultProjectName || argv.yes || !it
        ? argv.outDir
        : (await text({
            message: `Where would you like to create your new project? ${gray(
              `(Use '.' or './' for current directory)`
            )}`,
            placeholder: defaultProjectName
          })) || defaultProjectName;

    if (
      typeof projectNameAnswer === "symbol" ||
      isCancel([projectNameAnswer, packageManager])
    ) {
      panicCanceled();
    }

    const adapter =
      (argv.no ? "deno" : argv.yes || !it ? "node" : argv.adapter) ||
      (await select({
        message: "Which adapter do you prefer?",
        options: [
          {
            value: "node",
            label: "Node"
          },
          {
            value: "deno",
            label: "Deno"
          }
        ]
      }));

    if (typeof adapter === "symbol" || isCancel(adapter)) {
      panicCanceled();
    }

    const preferBiome =
      argv.biome || argv.no
        ? "1"
        : argv.yes || !it
          ? "0"
          : await select({
              message: "What is your favorite linter/formatter?",
              options: [
                {
                  value: "0",
                  label: "ESLint/Prettier"
                },
                {
                  value: "1",
                  label: "Biome"
                }
              ]
            });

    if (typeof preferBiome === "symbol" || isCancel(preferBiome)) {
      panicCanceled();
    }

    const kit = `${adapter as string}-${
      preferBiome === "0" ? "eslint+prettier" : "biome"
    }`;
    const templatePath = path.join(__dirname, "..", "stubs", "templates", kit);
    const outDir: string = resolveAbsoluteDir((projectNameAnswer as string).trim());

    log.step(`Creating new project in ${bgBlue(` ${outDir} `)} ... 🐇`);

    if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
      const force = argv.no
        ? false
        : argv.force ||
          argv.yes ||
          (it &&
            (await confirm({
              message: `Directory "./${resolveRelativeDir(
                outDir
              )}" already exists and is not empty. What would you like to overwrite it?`,
              initialValue: true
            })));
      if (force) {
        if (!dryRun) {
          await clearDir(outDir);
        }
      } else {
        log.error(`Directory "${outDir}" already exists.`);
        log.info(
          `Please either remove this directory, choose another location or run the command again with '--force | -f' flag.`
        );
        cancel();
        process.exit(1);
      }
    }

    if (!dryRun) {
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }
      cpSync(templatePath, outDir, { recursive: true });
    }

    const addCIWorkflow = argv.no
      ? false
      : argv.ci ||
        argv.yes ||
        (it &&
          (await confirm({
            message: "Would you like to add CI workflow?",
            initialValue: true
          })));

    if (addCIWorkflow && !dryRun) {
      const starterCIPath = join(
        __dirname,
        "..",
        "stubs",
        ".github",
        "workflows",
        "ci.yml"
      );
      const projectCIPath = join(outDir, ".github", "workflows", "ci.yml");
      cpSync(starterCIPath, projectCIPath, { force: true });
    }

    const runInstall = argv.no
      ? false
      : argv.install ||
        argv.yes ||
        (it &&
          (await confirm({
            message: `Would you like to install ${packageManager} dependencies?`,
            initialValue: true
          })));

    let ranInstall = false;
    if (typeof runInstall !== "symbol" && runInstall) {
      log.step("Installing dependencies...");
      if (!dryRun) {
        await installDependencies(projectNameAnswer as string);
      }
      ranInstall = true;
    }

    const initGit = argv.no
      ? false
      : argv.git ||
        argv.yes ||
        (it &&
          (await confirm({
            message: "Initialize a new git repository?",
            initialValue: true
          })));

    if (initGit) {
      const s = spinner();

      if (fs.existsSync(join(outDir, ".git"))) {
        log.info("Git has already been initialized before. Skipping...");
      } else {
        s.start("Git initializing...");

        try {
          if (!dryRun) {
            const res = [];
            res.push(await $("git", ["init"], outDir).install);
            res.push(await $("git", ["add", "-A"], outDir).install);
            res.push(
              await $("git", ["commit", "-m", "Initial commit 🎉"], outDir).install
            );

            if (res.some((r) => r === false)) {
              throw "";
            }
          }

          s.stop("Git initialized 🎲");
        } catch (e) {
          s.stop("Git failed to initialize");
          log.error(
            red("Git failed to initialize. You can do this manually by running: git init")
          );
        }
      }
    }

    const isCwdDir = process.cwd() === outDir;
    const relativeProjectPath = resolveRelativeDir(outDir);
    const outString = [];

    if (isCwdDir) {
      outString.push(`🦄 ${bgMagenta(" Success! ")}`);
    } else {
      outString.push(
        `🦄 ${bgMagenta(" Success! ")} ${cyan("Project created in")} ${bold(
          magenta(relativeProjectPath)
        )} ${cyan("directory")}`
      );
    }
    outString.push("");

    outString.push(`🐰 ${cyan("Next steps:")}`);
    if (!isCwdDir) {
      outString.push(`   cd ${relativeProjectPath}`);
    }
    if (!ranInstall) {
      outString.push(`   ${packageManager} install`);
    }
    outString.push(`   ${packageManager} start`);

    note(outString.join("\n"), "Ready to start 🚀");

    outro("Happy coding! 💻🎉");
  } catch (err) {
    console.error("An error occurred during QwikDev/astro project creation:", err);
    process.exit(1);
  }
};

export default async function () {
  try {
    const args = process.argv.slice(2);
    await createProject(args);
  } catch (err: any) {
    panic(err.message || err);
  }
}
