function isIntegerString(value) {
  return /^[-+]?\d+$/.test(value);
}

function isDecimalString(value) {
  return /^[-+]?(?:\d+|\d*\.\d+)$/.test(value);
}

function isBooleanString(value) {
  return value === "true" || value === "false" || value === "1" || value === "0";
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isDateTimeString(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value);
}

function isTimeString(value) {
  return /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value);
}

export function validateBuiltinType(localTypeName, value) {
  const text = String(value ?? "");

  switch (localTypeName) {
    case "string":
    case "normalizedString":
    case "token":
    case "language":
    case "Name":
    case "NCName":
    case "ID":
    case "IDREF":
    case "ENTITY":
    case "NMTOKEN":
    case "anyURI":
    case "QName":
    case "NOTATION":
      return true;

    case "boolean":
      return isBooleanString(text);

    case "decimal":
    case "float":
    case "double":
      return isDecimalString(text);

    case "integer":
    case "nonPositiveInteger":
    case "negativeInteger":
    case "long":
    case "int":
    case "short":
    case "byte":
    case "nonNegativeInteger":
    case "unsignedLong":
    case "unsignedInt":
    case "unsignedShort":
    case "unsignedByte":
    case "positiveInteger":
      return isIntegerString(text);

    case "date":
      return isDateString(text);

    case "dateTime":
      return isDateTimeString(text);

    case "time":
      return isTimeString(text);

    default:
      return true;
  }
}