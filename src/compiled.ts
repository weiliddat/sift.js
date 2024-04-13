const operators = new Set([
  "$eq",
  "$ne",
  "$in",
  "$nin",
  "$exists",
  "$gte",
  "$gt",
  "$lte",
  "$lt",
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
  Lt,
}

function parseToFnString(
  filter: Record<string, any>,
  prefix = "",
  mode = Mode.Eq,
): string {
  /** fn string */
  let str = "";

  for (const /** filter key */ fk in filter) {
    /** filter value */
    const fv = filter[fk];

    /** document path with optional chains */
    const dp = (prefix ? `doc.${prefix}.${fk}` : `doc.${fk}`).replace(
      /\./g,
      "?.",
    );

    if (operators.has(fk)) {
      if (fk === "$eq") {
        str += parseToFnString({ [prefix]: fv });
      }
      if (fk === "$ne") {
        str += parseToFnString({ [prefix]: fv }, "", Mode.Ne);
      }
      if (fk === "$gt") {
        str += parseToFnString({ [prefix]: fv }, "", Mode.Gt);
      }
      if (fk === "$lt") {
        str += parseToFnString({ [prefix]: fv }, "", Mode.Lt);
      }
    } else if (typeof fv === "function") {
      console.error("Unsupported function");
    } else if (typeof fv !== "object") {
      if (mode === Mode.Eq) {
        str += `if (Array.isArray(${dp}) && ${dp}.includes(${stringify(fv)})) { return true; } `;
        str += `if (${dp} === ${stringify(fv)}) { return true; } `;
      }
      if (mode === Mode.Ne) {
        str += `if (${dp} !== ${stringify(fv)}) { return true; } `;
      }
      if (mode === Mode.Gt) {
        str += `if (Array.isArray(${dp}) && ${dp}.some((dv) => dv > ${stringify(fv)})) { return true; } `;
        str += `if (${dp} > ${stringify(fv)}) { return true; } `;
      }
      if (mode === Mode.Lt) {
        str += `if (Array.isArray(${dp}) && ${dp}.some((dv) => dv < ${stringify(fv)})) { return true; } `;
        str += `if (${dp} < ${stringify(fv)}) { return true; } `;
      }
    } else if (fv == null) {
      if (mode === Mode.Eq) {
        str += `if (${dp} == null) { return true; } `;
      }
      if (mode === Mode.Ne) {
        str += `if (${dp} != null) { return true; } `;
      }
    } else if (typeof fv === "object") {
      const hasOperators = Object.keys(fv).some((k) => operators.has(k));

      if (hasOperators) {
        str += parseToFnString(fv, fk);
      } else {
        if (mode === Mode.Eq) {
          if (Array.isArray(fv)) {
            str += `if (Array.isArray(${dp}) && ${dp}.find((d) => JSON.stringify(d) === ${stringify(JSON.stringify(fv))})) { return true; } `;
          }
          str += `if (JSON.stringify(${dp}) === ${stringify(JSON.stringify(fv))}) { return true; } `;
        }
        if (mode === Mode.Ne) {
          str += `if (JSON.stringify(${dp}) !== ${stringify(JSON.stringify(fv))}) { return true; } `;
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
