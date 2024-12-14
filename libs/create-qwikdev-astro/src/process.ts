import { type ChildProcess, exec, spawn } from "node:child_process";
import ansiRegex from "ansi-regex";
import which from "which";
import { logError } from "./console";
import { getPackageManager } from "./utils";

export const isPackageManagerInstalled = (packageManager: string) => {
  return new Promise((resolve) => {
    exec(`${packageManager} --version`, (error, _, stderr) => {
      resolve(!(error || stderr));
    });
  });
};
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
          logError(String(e.message || e));
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

export const $pm = async (
  args: string | string[],
  cwd = process.cwd(),
  env = process.env
) => {
  const packageManager = getPackageManager();
  args = Array.isArray(args) ? args : [args];
  if (["exec", "dlx"].includes(args[0])) {
    switch (packageManager) {
      case "pnpm":
      case "yarn":
        break;
      case "bun":
      case "npm": {
        args = ["x", ...args.slice(1)];
        break;
      }
      default: {
        args = ["run", ...args.slice(1)];
        break;
      }
    }
  }

  const packageManagerPath = await which(packageManager);
  const command = `${packageManagerPath} ${args.join(" ")}`;

  return new Promise((resolve, reject) => {
    const child = spawn(packageManagerPath, args, {
      cwd,
      stdio: "inherit",
      env
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject({ command });
        return;
      }
      resolve(true);
    });
  });
};

export const $pmInstall = async (cwd: string) => {
  await $pm("install", cwd);
};

export const $pmRun = async (script: string, cwd: string) => {
  await $pm(["run", ...script.split(/\s+/)], cwd);
};

export const $pmExec = async (command: string, cwd: string) => {
  await $pm(["exec", ...command.split(/\s+/)], cwd);
};

export const $pmDlx = async (binary: string, cwd: string) => {
  await $pm(["dlx", ...binary.split(/\s+/)], cwd);
};

export const $pmX = async (executable: string, cwd: string) => {
  if (["pnpm", "yarn"].includes(getPackageManager())) {
    try {
      await $pmExec(executable, cwd);
    } catch (e: any) {
      await $pmDlx(executable, cwd);
    }
  } else {
    await $pmDlx(executable, cwd);
  }
};

export function $it(
  command: string,
  args: string[] = [],
  interactions: Record<string, string> = {},
  options: { cwd?: string } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "inherit"],
      ...options
    });

    const cleanOutput = (data: string) => data.replace(ansiRegex(), "");

    let output = "";
    let buffer = "";
    const prompts = Object.entries(interactions);
    const promptsCount = prompts.length;
    let promptIndex = 0;

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      buffer += cleanOutput(chunk);
      output += chunk;

      while (promptIndex < promptsCount) {
        const [prompt, input] = prompts[promptIndex];
        if (buffer.includes(prompt)) {
          child.stdin.write(`${input}\n`);
          buffer = buffer.slice(buffer.indexOf(prompt) + prompt.length);
          promptIndex++;
        } else {
          break;
        }
      }
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.stdin.end();

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve(output);
      }
    });
  });
}
