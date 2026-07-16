import fs from "node:fs";
import path from "node:path";

export type LogStage = "download" | "classify" | "removebg" | "pipeline";
export type LogLevel = "info" | "warn" | "error";

export interface StageLogEntry {
  timestamp: string;
  stage: LogStage;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const logsRoot = process.env.IMAGE_LOGS_ROOT ?? "logs";

export class PipelineLogger {
  private readonly dir: string;

  constructor(dir: string = path.join(logsRoot, "image")) {
    this.dir = dir;
  }

  log(stage: LogStage, level: LogLevel, message: string, data?: unknown): void {
    fs.mkdirSync(this.dir, { recursive: true });

    const entry: StageLogEntry = {
      timestamp: new Date().toISOString(),
      stage,
      level,
      message,
      data,
    };
    const file = path.join(this.dir, `${stage}.log`);
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
  }

  info(stage: LogStage, message: string, data?: unknown): void {
    this.log(stage, "info", message, data);
  }

  warn(stage: LogStage, message: string, data?: unknown): void {
    this.log(stage, "warn", message, data);
  }

  error(stage: LogStage, message: string, data?: unknown): void {
    this.log(stage, "error", message, data);
  }
}

export const pipelineLogger = new PipelineLogger();
