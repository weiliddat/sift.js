const cmpOps = new Set([
  "$eq",
  "$gt",
  "$gte",
  "$in",
  "$lt",
  "$lte",
  "$ne",
  "$nin",
]);

const logOps = new Set(["$and", "$not", "$nor", "$or"]);

const elmOps = new Set(["$exists", "$type"]);

const evlOps = new Set(["$mod", "$regex", "$where"]);

const arrOps = new Set(["$all", "$elemMatch", "$size"]);

const allOps = new Set([
  ...cmpOps.values(),
  ...logOps.values(),
  ...elmOps.values(),
  ...evlOps.values(),
  ...arrOps.values(),
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
  Gte,
  Lte,
  In,
  Nin,
  And,
}

let symbolCount = 1;
const nextSym = () => `sym_${symbolCount++}`;

function parseToFnString(
  filter: Record<string, any>,
  prefix = "",
  mode = Mode.Eq,
): string {
  /** fn string */
  let str = "";

  const cmpFns = [];
  for (const /** filter key */ fk in filter) {
    /** filter value */
    const fv = filter[fk];

    const cmpSym = nextSym();
    cmpFns.push(cmpSym);
    str += `function ${cmpSym} () {`;

    /** document path with optional chains */
    const dp = (prefix ? `doc.${prefix}.${fk}` : `doc.${fk}`).replace(
      /\./g,
      "?.",
    );

    if (allOps.has(fk)) {
      if (fk === "$eq") {
        str += parseToFnString({ [prefix]: fv }, "", Mode.Eq);
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
      if (fk === "$gte") {
        str += parseToFnString({ [prefix]: fv }, "", Mode.Gte);
      }
      if (fk === "$lte") {
        str += parseToFnString({ [prefix]: fv }, "", Mode.Lte);
      }
      if (fk === "$in") {
        str += parseToFnString({ [prefix]: fv }, "", Mode.In);
      }
      if (fk === "$nin") {
        str += parseToFnString({ [prefix]: fv }, "", Mode.Nin);
      }
      if (fk === "$and") {
        if (Array.isArray(fv)) {
          console.log("$and");
          console.log({ prefix, fk, fv, dp });

          const cmpFns = [];
          for (const av of fv) {
            const cmpSym = nextSym();
            cmpFns.push(cmpSym);
            str += `function ${cmpSym} () {`;
            str += parseToFnString(av);
            str += `} `;
          }

          const andCnd = cmpFns.map((sym) => `${sym}()`).join(" && ");
          str += `if (${andCnd}) { return true; } `;
        } else {
          console.warn("$and needs an array as input");
        }
      }
    } else if (typeof fv === "function") {
      console.error("Unsupported function");
    } else if (typeof fv !== "object") {
      const fvs = stringify(fv);
      if (mode === Mode.Eq) {
        str += `if (Array.isArray(${dp}) && ${dp}.includes(${fvs})) { return true; } `;
        str += `if (${dp} === ${fvs}) { return true; } `;
      }
      if (mode === Mode.Ne) {
        str += `if (${dp} !== ${fvs}) { return true; } `;
      }
      if (mode === Mode.Gt) {
        str += `if (${dp} == null) { return false; } `;
        str += `if (Array.isArray(${dp}) && ${dp}.length === 0) { return false; } `;
        str += `if (Array.isArray(${dp}) && ${dp}.some((dv) => dv > ${fvs})) { return true; } `;
        str += `if (${dp} > ${fvs}) { return true; } `;
      }
      if (mode === Mode.Lt) {
        str += `if (${dp} == null) { return false; } `;
        str += `if (Array.isArray(${dp}) && ${dp}.length === 0) { return false; } `;
        str += `if (Array.isArray(${dp}) && ${dp}.some((dv) => dv < ${fvs})) { return true; } `;
        str += `if (${dp} < ${fvs}) { return true; } `;
      }
      if (mode === Mode.Gte) {
        str += `if (${dp} == null) { return false; } `;
        str += `if (Array.isArray(${dp}) && ${dp}.length === 0) { return false; } `;
        str += `if (Array.isArray(${dp}) && ${dp}.some((dv) => dv >= ${fvs})) { return true; } `;
        str += `if (${dp} >= ${fvs}) { return true; } `;
      }
      if (mode === Mode.Lte) {
        str += `if (${dp} == null) { return false; } `;
        str += `if (Array.isArray(${dp}) && ${dp}.length === 0) { return false; } `;
        str += `if (Array.isArray(${dp}) && ${dp}.some((dv) => dv <= ${fvs})) { return true; } `;
        str += `if (${dp} <= ${fvs}) { return true; } `;
      }
      if (mode === Mode.In) {
        console.warn("$in needs an array as input");
      }
      if (mode === Mode.Nin) {
        console.warn("$nin needs an array as input");
      }
    } else if (fv == null) {
      if (mode === Mode.Eq || mode === Mode.Gte || mode === Mode.Lte) {
        str += `if (${dp} == null) { return true; } `;
      }
      if (mode === Mode.Ne) {
        str += `if (${dp} != null) { return true; } `;
      }
    } else if (typeof fv === "object") {
      const hasOperators = Object.keys(fv).some((k) => allOps.has(k));

      if (hasOperators) {
        str += parseToFnString(fv, fk);
      } else {
        if (mode === Mode.Eq) {
          const fvs = stringify(JSON.stringify(fv));
          if (Array.isArray(fv)) {
            str += `if (Array.isArray(${dp}) && ${dp}.find((d) => JSON.stringify(d) === ${fvs})) { return true; } `;
          }
          str += `if (JSON.stringify(${dp}) === ${fvs}) { return true; } `;
        }
        if (mode === Mode.Ne) {
          const fvs = stringify(JSON.stringify(fv));
          str += `if (JSON.stringify(${dp}) !== ${fvs}) { return true; } `;
        }
        if (mode === Mode.In) {
          if (Array.isArray(fv)) {
            for (const iv of fv) {
              str += parseToFnString({ [fk]: iv }, prefix, Mode.Eq);
            }
          } else {
            console.warn("$in needs an array as input");
          }
        }

        /** TODO needs $and */
        if (mode === Mode.Nin) {
          if (Array.isArray(fv)) {
            for (const iv of fv) {
              str += parseToFnString({ [fk]: iv }, prefix, Mode.Ne);
            }
          } else {
            console.warn("$nin needs an array as input");
          }
        }
      }
    }

    str += `} `;
  }

  const andCnd = cmpFns.map((sym) => `${sym}()`).join(" && ");
  str += `if (${andCnd}) { return true; } `;

  return str;
}

function stringify(v: string) {
  return JSON.stringify(v)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
