#!/usr/bin/env node
import { exit } from "process";
import { version } from "../package.json";
import { spawn } from "child_process";
import {
  AttributionFileTypeEnum,
  AttributionFormatEnum,
  ContributingDeveloperSource,
  IBaseScanArguments,
  IntegrationName,
  IntegrationType,
  LogLevel,
  OnFailure,
  ScanType,
  soosLogger,
} from "@soos-io/api-client";
import AnalysisArgumentParser from "@soos-io/api-client/dist/services/AnalysisArgumentParser";
import { obfuscateProperties, ensureValue } from "@soos-io/api-client/dist/utilities";
import { SOOS_SAST_Docker_CONSTANTS } from "./constants";

interface ISASTDockerAnalysisArgs extends IBaseScanArguments {
  semgrepConfigs: Array<string>;
}

// NOTE: these are the underlying args for SOOS SAST
interface ISASTAnalysisArgs extends IBaseScanArguments {
  directoriesToExclude: Array<string>;
  filesToExclude: Array<string>;
  sourceCodePath: string;
  outputDirectory: string;
}

const splitCommand = (input: string): string[] => {
  const regex = /[^\s"]+|"([^"]*)"/g;
  const result: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    result.push(match[1] ?? match[0]);
  }

  return result;
};

const runCommand = (command: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    soosLogger.debug(`Running command: ${command}`);
    const [cmd, ...args] = splitCommand(command);
    soosLogger.always("args", args);
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

const mapToSoosSastCliArgs = (
  args: ISASTDockerAnalysisArgs,
  overrides: Partial<ISASTAnalysisArgs>,
): string => {
  const soosSastArgs: ISASTAnalysisArgs = {
    apiKey: overrides.apiKey ?? args.apiKey,
    apiURL: overrides.apiURL ?? args.apiURL,
    appVersion: overrides.appVersion ?? args.appVersion,
    branchName: overrides.branchName ?? args.branchName,
    branchURI: overrides.branchURI ?? args.branchURI,
    buildURI: overrides.buildURI ?? args.buildURI,
    buildVersion: overrides.buildVersion ?? args.buildVersion,
    clientId: overrides.clientId ?? args.clientId,
    commitHash: overrides.commitHash ?? args.commitHash,
    contributingDeveloperId: overrides.contributingDeveloperId ?? args.contributingDeveloperId,
    contributingDeveloperSource:
      overrides.contributingDeveloperSource ?? args.contributingDeveloperSource,
    contributingDeveloperSourceName:
      overrides.contributingDeveloperSourceName ?? args.contributingDeveloperSourceName,
    directoriesToExclude: ensureValue(
      overrides.directoriesToExclude,
      "overrides.directoriesToExclude",
    ),
    exportFileType: overrides.exportFileType ?? args.exportFileType,
    exportFormat: overrides.exportFormat ?? args.exportFormat,
    filesToExclude: ensureValue(overrides.filesToExclude, "overrides.filesToExclude"),
    integrationName: overrides.integrationName ?? args.integrationName,
    integrationType: overrides.integrationType ?? args.integrationType,
    logLevel: overrides.logLevel ?? args.logLevel,
    onFailure: overrides.onFailure ?? args.onFailure,
    operatingEnvironment: overrides.operatingEnvironment ?? args.operatingEnvironment,
    outputDirectory: ensureValue(overrides.outputDirectory, "overrides.outputDirectory"),
    projectName: overrides.projectName ?? args.projectName,
    scanType: overrides.scanType ?? args.scanType,
    scriptVersion: overrides.scriptVersion ?? args.scriptVersion,
    sourceCodePath: ensureValue(overrides.sourceCodePath, "overrides.sourceCodePath"),
  };

  const enumProps: Partial<Record<keyof ISASTAnalysisArgs, unknown>> = {
    integrationName: IntegrationName,
    integrationType: IntegrationType,
    logLevel: LogLevel,
    exportFormat: AttributionFormatEnum,
    exportFileType: AttributionFileTypeEnum,
    contributingDeveloperSource: ContributingDeveloperSource,
    onFailure: OnFailure,
  };

  return Object.entries(soosSastArgs)
    .map(([key, value]) => {
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        return null;
      }

      if (enumProps[key as keyof ISASTAnalysisArgs]) {
        return value === "Unknown"
          ? null
          : Array.isArray(value)
            ? `--${key} ${value.join(",")}`
            : `--${key} ${value}`;
      }

      if (typeof value === "boolean") {
        return `--${key}`;
      }

      return Array.isArray(value)
        ? `--${key} ${value.map((v) => `"${v}"`).join(",")}`
        : `--${key} "${value}"`;
    })
    .filter((a) => a !== null)
    .join(" ");
};

const parseArgs = (): ISASTDockerAnalysisArgs => {
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
    soosLogger.always("Starting SOOS SAST Analysis via Docker");
    soosLogger.debug(
      JSON.stringify(
        obfuscateProperties(args as unknown as Record<string, unknown>, ["apiKey"]),
        null,
        2,
      ),
    );

    const sarifOutFile = `${SOOS_SAST_Docker_CONSTANTS.OutputDirectory}/semgrep.sarif.json`;
    const outputDirectory = SOOS_SAST_Docker_CONSTANTS.OutputDirectory;

    if (args.semgrepConfigs.length > 0) {
      const semgrepBin = "/home/soos/.local/pipx/venvs/semgrep/bin/semgrep";
      const configArgs = args.semgrepConfigs.map((c) => `--config=${c}`).join(" ");
      const verboseArg = args.logLevel == LogLevel.DEBUG ? " --verbose" : "";
      // TODO add --pattern for file matching? and --lang for limiting targets?
      await runCommand(
        `${semgrepBin} scan${verboseArg} --max-log-list-entries=1000 --metrics=off ${configArgs} --sarif --sarif-output=${sarifOutFile} ${SOOS_SAST_Docker_CONSTANTS.WorkingDirectory}`,
      );
    }

    const soosCliArgs = mapToSoosSastCliArgs(args, {
      outputDirectory,
      filesToExclude: [],
      directoriesToExclude: [],
      sourceCodePath: sarifOutFile,
    });
    await runCommand(`node ./node_modules/@soos-io/soos-sast/bin/index.js ${soosCliArgs}`);
  } catch (error) {
    soosLogger.error(`Error: ${error}`);
    soosLogger.always(`Error: ${error} - exit 1`);
    exit(1);
  }
})();
