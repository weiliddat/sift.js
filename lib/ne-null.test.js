"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
const query = { "groups.name": { $ne: null } };
// const docs = [{ groups: [{ name: "bob" }] }, { groups: [] }, { other: [] }]
// const expected = [{ groups: [{ name: "bob" }] }]
const filter = (0, _1.default)(query);
console.log(filter({ groups: [{ name: "bob" }] }));
console.log(filter({ groups: [] }));
console.log(filter({ groups: [{ name: null }] }));
console.log(filter({ groups: null }));
//# sourceMappingURL=ne-null.test.js.map
