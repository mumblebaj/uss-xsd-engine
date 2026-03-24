import { ENGINE_VERSION } from "../version";

export function summarizeIssues(issues = []) {
  return issues.reduce(
    (acc, issue) => {
      if (issue.severity === "error") acc.errorCount += 1;
      else if (issue.severity === "warning") acc.warningCount += 1;
      else if (issue.severity === "info") acc.infoCount += 1;
      return acc;
    },
    { errorCount: 0, warningCount: 0, infoCount: 0 }
  );
}

export function hasErrors(issues = []) {
  return issues.some((issue) => issue.severity === "error");
}

export function makeResult({ data = null, issues = [] } = {}) {
  return {
    ok: !hasErrors(issues),
    data,
    issues,
    summary: summarizeIssues(issues),
    version: ENGINE_VERSION
  };
}