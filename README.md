# [SOOS SAST via Docker](https://soos.io/products/sast)

SOOS is an independent software security company, located in Winooski, VT USA, building security software for your team. [SOOS, Software security, simplified](https://soos.io).

Use SOOS to scan your software for [vulnerabilities](https://app.soos.io/research/vulnerabilities) and [open source license](https://app.soos.io/research/licenses) issues with [SOOS Core SCA](https://soos.io/products/sca). [Generate and ingest SBOMs](https://soos.io/products/sbom-manager). [Export reports](https://kb.soos.io/project-exports-and-reports) to industry standards. Govern your open source dependencies. Run the [SOOS DAST vulnerability scanner](https://soos.io/products/dast) against your web apps or APIs. [Scan your Docker containers](https://soos.io/products/containers) for vulnerabilities. Check your source code for issues with [SAST Analysis](https://soos.io/products/sast).

[Demo SOOS](https://app.soos.io/demo) or [Register for a Free Trial](https://app.soos.io/register).

If you maintain an Open Source project, sign up for the Free as in Beer [SOOS Community Edition](https://soos.io/products/community-edition).

## Requirements
- [Docker](https://www.docker.com/get-started)

## How to Use
The `soosio/sast` docker image supports a number of various SAST scans. Below are a few examples of usage.

Before usage, be sure your image is up to date by running:
``` shell
docker pull soosio/sast:latest
```

### Sarif 2.1 File(s)
If you have Sarif 2.1 files, you can point soosio/sast to the directory containing the files via a Docker mount:
``` shell
docker run -u soos -v c:/my-sarif-folder:/home/soos/wrk/:rw -it --rm soosio/sast --sarifGenerator file --apiKey xxxx --clientId xxxx --projectName xxxx
```

### Semgrep
To run Semgrep against your source code:
``` shell
docker run -u soos -v c:/my-source-code:/home/soos/wrk/:rw -it --rm soosio/sast --sarifGenerator semgrep --apiKey xxxx --clientId xxxx --projectName xxxx
```

To customize the Semgrep execution, you can pass in `--otherOptions`, e.g.
``` shell
docker run -u soos -v c:/my-source-code:/home/soos/wrk/:rw -it --rm soosio/sast --sarifGenerator semgrep --otherOptions "--metrics=off --config p/owasp-top-ten --config p/cwe-top-25 --config p/typescript" --apiKey xxxx --clientId xxxx --projectName xxxx
```

### Gitleaks
To run Gitleaks:
``` shell
docker run -u soos -v c:/my-source-code:/home/soos/wrk/:rw -it --rm soosio/sast --sarifGenerator gitleaks --apiKey xxxx --clientId xxxx --projectName xxxx
```

To customize the Gitleaks execution, you can pass in `--otherOptions`, e.g.
``` shell
docker run -u soos -v c:/my-source-code:/home/soos/wrk/:rw -it --rm soosio/sast --sarifGenerator gitleaks --otherOptions "--max-archive-depth 1 --max-target-megabytes 10" --apiKey xxxx --clientId xxxx --projectName xxxx
```

### SonarQube
If you are using SonarQube, you can export your issues from your instance:
``` shell
docker run -u soos -v c:/my-source-code:/home/soos/wrk/:rw -it --rm soosio/sast --sarifGenerator sonarqube --otherOptions "--url zzzz --token zzzz" --apiKey xxxx --clientId xxxx --projectName xxxx
```

The `--otherOptions` parameter allows you to pass in available options for the [Sonar findings export tool](https://github.com/okorach/sonar-tools?tab=readme-ov-file#sonar-findings-export)
