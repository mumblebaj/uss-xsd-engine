export function createDiagnostic({
  severity = "error",
  stage = "unknown",
  code = "ENGINE_ERROR",
  message = "Unknown engine error",
  cause = null,
  location = null
} = {}) {
  return {
    severity,
    stage,
    code,
    message,
    cause,
    location
  };
}

export function createEngineErrorResult(stage, message, error = null, extra = {}) {
  return {
    ok: false,
    success: false,
    diagnostics: [
      createDiagnostic({
        severity: "error",
        stage,
        code: "ENGINE_ERROR",
        message,
        cause: error ? String(error.message || error) : null
      })
    ],
    meta: {
      stage,
      ...extra
    }
  };
}