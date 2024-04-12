const operators = new Set([
  "$in",
  "$nin",
  "$exists",
  "$gte",
  "$gt",
  "$lte",
  "$lt",
  "$eq",
  "$ne",
  "$mod",
  "$all",
  "$and",
  "$or",
  "$nor",
  "$not",
  "$size",
  "$type",
  "$regex",
  "$where",
  "$elemMatch",
]);

type Check = (doc: any) => Boolean;

export function compileFilter(filter: Record<string, any>): Check {
  const fn = parseToFnString(filter);

  console.log(fn);

  const wrapped = "try {" + fn + " } catch { return false; } return false;";

  return new Function("doc", wrapped) as Check;
}

enum Mode {
  Eq,
  Ne,
  Gt,
}

function parseToFnString(
  filter: Record<string, any>,
  prefix = "",
  mode = Mode.Eq,
): string {
  let str = "";

  for (const k in filter) {
    const v = filter[k];

    const safePrefix = prefix ? prefix.replace(/\./g, "?.") : "";
    const safeKeys = (prefix ? safePrefix + "?." : "") + k.replace(/\./g, "?.");

    if (operators.has(k)) {
      if (k === "$eq") {
        str += parseToFnString({ [prefix]: v });
      }
      if (k === "$ne") {
        str += parseToFnString({ [prefix]: v }, "", Mode.Ne);
      }
      if (k === "$gt") {
        str += parseToFnString({ [prefix]: v }, "", Mode.Gt);
      }
    } else if (typeof v === "function") {
      console.error("Unsupported function");
    } else if (typeof v !== "object") {
      if (mode === Mode.Eq) {
        str += `if (Array.isArray(doc?.${safeKeys}) && doc?.${safeKeys}.includes(${stringify(v)})) { return true; } `;
        str += `if (doc?.${safeKeys} === ${stringify(v)}) { return true; } `;
      }
      if (mode === Mode.Ne) {
        str += `if (doc?.${safeKeys} !== ${stringify(v)}) { return true; } `;
      }
      if (mode === Mode.Gt) {
        str += `if (doc?.${safeKeys} > ${stringify(v)}) { return true; } `;
      }
    } else if (v == null) {
      if (mode === Mode.Eq) {
        str += `if (doc?.${safeKeys} == null) { return true; } `;
      }
      if (mode === Mode.Ne) {
        str += `if (doc?.${safeKeys} != null) { return true; } `;
      }
    } else if (typeof v === "object") {
      const hasOperators = Object.keys(v).some((k) => operators.has(k));

      if (hasOperators) {
        str += parseToFnString(v, k);
      } else {
        if (mode === Mode.Eq) {
          str += `if (JSON.stringify(doc?.${safeKeys}) === ${stringify(JSON.stringify(v))}) { return true; } `;
        }
        if (mode === Mode.Ne) {
          str += `if (JSON.stringify(doc?.${safeKeys}) !== ${stringify(JSON.stringify(v))}) { return true; } `;
        }
      }
    }
  }
  return str;
}

function stringify(v: string) {
  return JSON.stringify(v)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
