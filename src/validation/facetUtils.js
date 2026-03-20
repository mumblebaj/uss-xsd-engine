function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function countDigits(value) {
  const normalized = String(value).replace(/^[-+]/, "").replace(".", "");
  return normalized.replace(/\D/g, "").length;
}

function countFractionDigits(value) {
  const text = String(value);
  const idx = text.indexOf(".");
  if (idx < 0) return 0;
  return text.slice(idx + 1).replace(/\D/g, "").length;
}

function testPatterns(patterns, value) {
  for (const pattern of patterns || []) {
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(String(value))) {
        return {
          ok: false,
          code: "XML_PATTERN_MISMATCH",
          message: `Value '${value}' does not match required pattern '${pattern}'.`
        };
      }
    }
    catch {
      return {
        ok: false,
        code: "XML_PATTERN_MISMATCH",
        message: `Value '${value}' could not be validated against pattern '${pattern}'.`
      };
    }
  }

  return { ok: true, code: null, message: null };
}

export function validateLengthFacets(value, facets = {}) {
  const text = String(value ?? "");
  const len = text.length;

  if (typeof facets.length === "number" && len !== facets.length) {
    return {
      ok: false,
      code: "XML_LENGTH_MISMATCH",
      message: `Value '${value}' must have length ${facets.length}.`
    };
  }

  if (typeof facets.minLength === "number" && len < facets.minLength) {
    return {
      ok: false,
      code: "XML_MIN_LENGTH_VIOLATION",
      message: `Value '${value}' is shorter than minLength ${facets.minLength}.`
    };
  }

  if (typeof facets.maxLength === "number" && len > facets.maxLength) {
    return {
      ok: false,
      code: "XML_MAX_LENGTH_VIOLATION",
      message: `Value '${value}' is longer than maxLength ${facets.maxLength}.`
    };
  }

  return { ok: true, code: null, message: null };
}

export function validateNumericFacets(value, facets = {}) {
  const num = toNumber(value);
  if (num == null) {
    return { ok: true, code: null, message: null };
  }

  if (facets.minInclusive != null) {
    const min = toNumber(facets.minInclusive);
    if (min != null && num < min) {
      return {
        ok: false,
        code: "XML_MIN_INCLUSIVE_VIOLATION",
        message: `Value '${value}' is less than minInclusive ${facets.minInclusive}.`
      };
    }
  }

  if (facets.maxInclusive != null) {
    const max = toNumber(facets.maxInclusive);
    if (max != null && num > max) {
      return {
        ok: false,
        code: "XML_MAX_INCLUSIVE_VIOLATION",
        message: `Value '${value}' is greater than maxInclusive ${facets.maxInclusive}.`
      };
    }
  }

  if (facets.minExclusive != null) {
    const min = toNumber(facets.minExclusive);
    if (min != null && num <= min) {
      return {
        ok: false,
        code: "XML_MIN_EXCLUSIVE_VIOLATION",
        message: `Value '${value}' must be greater than minExclusive ${facets.minExclusive}.`
      };
    }
  }

  if (facets.maxExclusive != null) {
    const max = toNumber(facets.maxExclusive);
    if (max != null && num >= max) {
      return {
        ok: false,
        code: "XML_MAX_EXCLUSIVE_VIOLATION",
        message: `Value '${value}' must be less than maxExclusive ${facets.maxExclusive}.`
      };
    }
  }

  return { ok: true, code: null, message: null };
}

export function validateDigitFacets(value, facets = {}) {
  const text = String(value ?? "");

  if (typeof facets.totalDigits === "number") {
    const total = countDigits(text);
    if (total > facets.totalDigits) {
      return {
        ok: false,
        code: "XML_TOTAL_DIGITS_VIOLATION",
        message: `Value '${value}' exceeds totalDigits ${facets.totalDigits}.`
      };
    }
  }

  if (typeof facets.fractionDigits === "number") {
    const fraction = countFractionDigits(text);
    if (fraction > facets.fractionDigits) {
      return {
        ok: false,
        code: "XML_FRACTION_DIGITS_VIOLATION",
        message: `Value '${value}' exceeds fractionDigits ${facets.fractionDigits}.`
      };
    }
  }

  return { ok: true, code: null, message: null };
}

export function validatePatternFacets(value, facets = {}) {
  if (!facets.pattern?.length) {
    return { ok: true, code: null, message: null };
  }

  return testPatterns(facets.pattern, value);
}

export function validateFacets(value, facets = {}) {
  const checks = [
    validateLengthFacets(value, facets),
    validateNumericFacets(value, facets),
    validateDigitFacets(value, facets),
    validatePatternFacets(value, facets)
  ];

  return checks.find((item) => !item.ok) || { ok: true, code: null, message: null };
}