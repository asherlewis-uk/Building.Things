import type { TerminalOutputLine, TerminalResponse } from "@/lib/types";
import {
  directoryExists,
  findFileByVirtualPath,
  listVirtualDirectory,
  normalizeVirtualPath,
  resolveVirtualPath,
} from "@/lib/virtual-fs";

interface TerminalFileRecord {
  name: string;
  path: string;
  content: string;
}

interface ExecuteTerminalCommandOptions {
  command: string;
  cwd?: string;
  sessionKey?: string;
  files: TerminalFileRecord[];
}

const workingDirectories = new Map<string, string>();

function line(type: TerminalOutputLine["type"], text: string): TerminalOutputLine {
  return { type, text };
}

function getSessionKey(sessionKey?: string) {
  return sessionKey?.trim() || "global";
}

function getCurrentDirectory(sessionKey?: string, fallbackCwd?: string) {
  const normalizedFallback = normalizeVirtualPath(fallbackCwd || "/");
  return workingDirectories.get(getSessionKey(sessionKey)) || normalizedFallback;
}

function setCurrentDirectory(sessionKey: string | undefined, cwd: string) {
  workingDirectories.set(getSessionKey(sessionKey), normalizeVirtualPath(cwd));
}

export function executeTerminalCommand(
  options: ExecuteTerminalCommandOptions,
): TerminalResponse {
  const currentCwd = getCurrentDirectory(options.sessionKey, options.cwd);
  const trimmedCommand = options.command.trim();
  const [rawCommand] = trimmedCommand.split(/\s+/, 1);
  const command = rawCommand.toLowerCase();
  const rawArgs = trimmedCommand.slice(rawCommand.length).trim();
  const lines: TerminalOutputLine[] = [];
  let nextCwd = currentCwd;
  let cleared = false;

  switch (command) {
    case "help": {
      lines.push(line("info", "Available commands: help, pwd, ls, dir, cd, cat, type, clear, echo"));
      lines.push(line("info", "This terminal is virtual and scoped to the local IDE shell."));
      break;
    }
    case "pwd": {
      lines.push(line("stdout", currentCwd));
      break;
    }
    case "clear": {
      cleared = true;
      break;
    }
    case "echo": {
      lines.push(line("stdout", rawArgs));
      break;
    }
    case "ls":
    case "dir": {
      const targetPath = rawArgs ? resolveVirtualPath(currentCwd, rawArgs) : currentCwd;
      const targetFile = findFileByVirtualPath(options.files, targetPath);

      if (targetFile) {
        lines.push(line("stdout", targetFile.name));
        break;
      }

      if (!directoryExists(options.files, targetPath)) {
        lines.push(line("stderr", `${command}: ${rawArgs || targetPath}: No such directory`));
        break;
      }

      const entries = listVirtualDirectory(options.files, targetPath);

      if (entries.length === 0) {
        lines.push(line("info", "Directory is empty."));
        break;
      }

      lines.push(
        ...entries.map((entry) =>
          line(
            "stdout",
            entry.type === "directory" ? `${entry.name}/` : entry.name,
          ),
        ),
      );
      break;
    }
    case "cd": {
      const targetPath = rawArgs ? resolveVirtualPath(currentCwd, rawArgs) : "/";
      const targetFile = findFileByVirtualPath(options.files, targetPath);

      if (targetFile) {
        lines.push(line("stderr", `cd: ${rawArgs}: Not a directory`));
        break;
      }

      if (!directoryExists(options.files, targetPath)) {
        lines.push(line("stderr", `cd: ${rawArgs}: No such file or directory`));
        break;
      }

      nextCwd = normalizeVirtualPath(targetPath);
      setCurrentDirectory(options.sessionKey, nextCwd);
      break;
    }
    case "cat":
    case "type": {
      if (!rawArgs) {
        lines.push(line("stderr", `Usage: ${command} <path>`));
        break;
      }

      const targetPath = resolveVirtualPath(currentCwd, rawArgs);
      const file = findFileByVirtualPath(options.files, targetPath);

      if (!file) {
        if (directoryExists(options.files, targetPath)) {
          lines.push(line("stderr", `${command}: ${rawArgs}: Is a directory`));
        } else {
          lines.push(line("stderr", `${command}: ${rawArgs}: No such file or directory`));
        }
        break;
      }

      lines.push(line("stdout", file.content));
      break;
    }
    default: {
      lines.push(line("stderr", `Unknown command: ${rawCommand}. Try 'help'.`));
      break;
    }
  }

  if (!workingDirectories.has(getSessionKey(options.sessionKey))) {
    setCurrentDirectory(options.sessionKey, nextCwd);
  }

  return {
    cwd: nextCwd,
    cleared,
    lines,
  };
}
