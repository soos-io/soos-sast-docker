#!/usr/bin/env node
import { exit } from "process";
import { version } from "../package.json";
import { spawn } from "child_process";
import {
  IBaseScanArguments,
  IntegrationName,
  IntegrationType,
  ScanType,
  soosLogger,
} from "@soos-io/api-client";
import AnalysisArgumentParser from "@soos-io/api-client/dist/services/AnalysisArgumentParser";
import { obfuscateProperties, isNil } from "@soos-io/api-client/dist/utilities";
import { SOOS_SAST_Docker_CONSTANTS } from "./constants";

interface ISOOSSASTDockerAnalysisArgs extends IBaseScanArguments {
  directoriesToExclude: Array<string>;
  filesToExclude: Array<string>;
  sourceCodePath: string;
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
    "directoriesToExclude",
    "Listing of directories or patterns to exclude from the search for manifest files. eg: **bin/start/**, **/start/**",
    {
      argParser: (value: string) => {
        return value.split(",").map((pattern) => pattern.trim());
      },
      defaultValue: [],
    },
  );

  analysisArgumentParser.addArgument(
    "filesToExclude",
    "Listing of files or patterns patterns to exclude from the search for manifest files. eg: **/sa**.sarif.json/, **/sast.sarif.json",
    {
      argParser: (value: string) => {
        return value.split(",").map((pattern) => pattern.trim());
      },
      defaultValue: [],
    },
  );

  analysisArgumentParser.addArgument(
    "sourceCodePath",
    "The path to start searching for SAST files.",
    {
      defaultValue: process.cwd(),
    },
  );

  analysisArgumentParser.addArgument(
    "outputDirectory",
    "Absolute path where SOOS will write exported reports and SBOMs. eg Correct: /out/sbom/ | Incorrect: ./out/sbom/",
    {
      defaultValue: process.cwd(),
    },
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

    if (args.semgrepConfigs.length > 0) {
      const configArgs = args.semgrepConfigs.map((c) => `--config=${c}`).join(" ");
      await runCommand(
        `semgrep scan --verbose --metrics=off ${configArgs} --sarif --sarif-output=semgrep.sarif.json ${SOOS_SAST_Docker_CONSTANTS.WorkingDirectory}`,
      );
    }

    const soosCliArgs = mapToSoosCliArguments(args);
    soosLogger.info(soosCliArgs);

    await runCommand(`node ./node_modules/@soos-io/soos-sast/bin/index.js ${args}`);
  } catch (error) {
    soosLogger.error(`Error: ${error}`);
    soosLogger.always(`Error: ${error} - exit 1`);
    exit(1);
  }
})();
