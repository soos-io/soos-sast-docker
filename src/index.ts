#!/usr/bin/env node
import { exit } from "process";
import { version } from "../package.json";
import { spawn } from "child_process";
import {
  IBaseScanArguments,
  IntegrationName,
  IntegrationType,
  LogLevel,
  ScanType,
  soosLogger,
} from "@soos-io/api-client";
import AnalysisArgumentParser from "@soos-io/api-client/dist/services/AnalysisArgumentParser";
import { obfuscateProperties, isNil } from "@soos-io/api-client/dist/utilities";
import { SOOS_SAST_Docker_CONSTANTS } from "./constants";

interface ISOOSSASTDockerAnalysisArgs extends IBaseScanArguments {
  semgrepConfigs: Array<string>;
}

const runCommand = (command: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    soosLogger.debug(`Running command: ${command}`);
    const [cmd, ...args] = command.split(" ");
    const proc = spawn(cmd, args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} failed with exit code ${code}`));
      }
    });
    proc.on("error", (err) => reject(err));
  });
};

const mapToSoosCliArguments = (parameters: ISOOSSASTDockerAnalysisArgs): string => {
  return Object.entries(parameters)
    .filter(([, value]) => !isNil(value))
    .map(([key, value]) => {
      if (typeof value === "boolean") {
        return value ? `--${key}` : "";
      } else {
        return `--${key}="${value}"`;
      }
    })
    .join(" ");
};

const parseArgs = (): ISOOSSASTDockerAnalysisArgs => {
  const analysisArgumentParser = AnalysisArgumentParser.create(
    IntegrationName.SoosSast,
    IntegrationType.Plugin,
    ScanType.SAST,
    version,
  );

  analysisArgumentParser.addArgument(
    "semgrepConfigs",
    "Comma separated list of semgrep configs to run e.g. 'p/owasp-top-ten, p/cwe-top-25, p/typescript'",
    {
      argParser: (value: string) => {
        return value.split(",").map((config) => config.trim());
      },
      defaultValue: [],
    },
  );

  return analysisArgumentParser.parseArguments();
};

(async () => {
  try {
    const args = parseArgs();
    soosLogger.setMinLogLevel(args.logLevel);
    soosLogger.always("Starting SOOS SAST Docker Analysis");
    soosLogger.debug(
      JSON.stringify(
        obfuscateProperties(args as unknown as Record<string, unknown>, ["apiKey"]),
        null,
        2,
      ),
    );

    // add --pattern for file matching? and --lang
    if (args.semgrepConfigs.length > 0) {
      const configArgs = args.semgrepConfigs.map((c) => `--config=${c}`).join(" ");
      const verboseArg = args.logLevel == LogLevel.DEBUG ? " --verbose" : "";
      await runCommand(
        `/home/soos/.local/pipx/venvs/semgrep/bin/semgrep scan${verboseArg} --max-log-list-entries=1000 --metrics=off ${configArgs} --sarif --sarif-output=${SOOS_SAST_Docker_CONSTANTS.OutputDirectory}/semgrep.sarif.json ${SOOS_SAST_Docker_CONSTANTS.WorkingDirectory}`,
      );
    }

    const soosCliArgs = mapToSoosCliArguments(args);
    soosLogger.info(soosCliArgs);

    await runCommand(
      `node ./node_modules/@soos-io/soos-sast/bin/index.js ${args} ${SOOS_SAST_Docker_CONSTANTS.OutputDirectory}/semgrep.sarif.json`,
    );
  } catch (error) {
    soosLogger.error(`Error: ${error}`);
    soosLogger.always(`Error: ${error} - exit 1`);
    exit(1);
  }
})();
