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

  const wrapped = "try {" + fn + " } catch { return false; } return true;";

  return new Function("doc", wrapped) as Check;
}

function parseToFnString(filter: Record<string, any>, prefix = ""): string {
  let str = "";

  for (const k in filter) {
    const v = filter[k];

    const predot = prefix ? `${prefix}?.` : "";
    const safeKeys = predot + k.replace(/\./g, "?.");

    if (operators.has(k)) {
      if (k === "$eq") {
        str += parseToFnString({ [prefix]: v });
      }
    } else if (typeof v === "function") {
      console.error("Unsupported function");
    } else if (typeof v !== "object") {
      str += `if (doc?.${safeKeys} !== ${stringify(v)}) { return false; } `;
    } else if (v == null) {
      str += `if (doc?.${safeKeys} != null) { return false; } `;
    } else if (typeof v === "object") {
      const hasOperators = Object.keys(v).some((k) => operators.has(k));
      if (hasOperators) {
        str += parseToFnString(v, k);
      } else {
        str += `if (JSON.stringify(doc?.${safeKeys}) !== ${stringify(JSON.stringify(v))}) { return false; } `;
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
