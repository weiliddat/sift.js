"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const mongodb_1 = require("mongodb");
const node_assert_1 = require("node:assert");
const compiled_1 = require("./compiled");
let mongod;
let mongo;
let collection;
(0, mocha_1.before)(function () {
  return __awaiter(this, void 0, void 0, function* () {
    mongod = yield mongodb_memory_server_1.MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongo = new mongodb_1.MongoClient(uri, {
      forceServerObjectId: true,
    });
    yield mongo.connect();
    const db = mongo.db("test");
    collection = db.collection("test");
  });
});
beforeEach(function () {
  return __awaiter(this, void 0, void 0, function* () {
    yield collection.deleteMany({});
  });
});
after(function () {
  return __awaiter(this, void 0, void 0, function* () {
    yield mongo.close();
    yield mongod.stop();
  });
});
(0, mocha_1.describe)("compileFilter", function () {
  (0, mocha_1.describe)("key value equality", function () {
    const testCases = [
      {
        filter: { foo: "bar" },
        input: [{ foo: "bar" }, {}, { foo: "baz" }, { foo: { foo: "bar" } }],
        expected: [{ foo: "bar" }],
      },
      {
        filter: { "foo.bar": "baz" },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { bar: "baz" } },
          { foo: { bar: null } },
          { foo: null },
        ],
        expected: [{ foo: { bar: "baz" } }],
      },
      {
        filter: { "foo.bar": null },
        input: [
          { foo: "bar" },
          {},
          { foo: { bar: null } },
          { foo: null },
          { foo: {} },
        ],
        expected: [
          { foo: "bar" },
          {},
          { foo: { bar: null } },
          { foo: null },
          { foo: {} },
        ],
      },
      {
        filter: { foo: null },
        input: [
          { foo: "bar" },
          {},
          { foo: 0 },
          { foo: 1 },
          { foo: null },
          { foo: {} },
        ],
        expected: [{}, { foo: null }],
      },
      /**
       * objects as filter value are a special case
       * https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/#match-an-embedded-nested-document
       */
      {
        filter: { foo: { bar: "baz" } },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { bar: "baz" } },
          { foo: { bar: null } },
          { foo: null },
        ],
        expected: [{ foo: { bar: "baz" } }],
      },
      {
        filter: { foo: { bar: null } },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { bar: null } },
          { foo: null },
          { foo: {} },
        ],
        expected: [{ foo: { bar: null } }],
      },
    ];
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      (0, mocha_1.test)(i.toString(), function () {
        return __awaiter(this, void 0, void 0, function* () {
          const filterFn = (0, compiled_1.compileFilter)(testCase.filter);
          const actual = testCase.input.filter(filterFn);
          yield collection.insertMany(testCase.input);
          const mongoExpected = yield collection
            .find(testCase.filter, { projection: { _id: 0 } })
            .toArray();
          (0, node_assert_1.deepStrictEqual)(actual, mongoExpected);
          (0, node_assert_1.deepStrictEqual)(actual, testCase.expected);
        });
      });
    }
  });
  (0, mocha_1.describe)("$eq operator", function () {
    const testCases = [
      {
        filter: { foo: { $eq: "bar" } },
        input: [{ foo: "bar" }, {}, { foo: "baz" }, { foo: { foo: "bar" } }],
        expected: [{ foo: "bar" }],
      },
      {
        filter: { "foo.bar": { $eq: "baz" } },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { bar: "baz" } },
          { foo: { bar: null } },
          { foo: null },
        ],
        expected: [{ foo: { bar: "baz" } }],
      },
      {
        filter: { "foo.bar": { $eq: null } },
        input: [
          { foo: "bar" },
          {},
          { foo: { bar: null } },
          { foo: null },
          { foo: {} },
        ],
        expected: [
          { foo: "bar" },
          {},
          { foo: { bar: null } },
          { foo: null },
          { foo: {} },
        ],
      },
      /**
       * objects as filter value are a special case
       * https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/#match-an-embedded-nested-document
       */
      {
        filter: { foo: { $eq: { bar: "baz" } } },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { bar: "baz" } },
          { foo: { bar: null } },
          { foo: null },
        ],
        expected: [{ foo: { bar: "baz" } }],
      },
      {
        filter: { foo: { $eq: { bar: null } } },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { bar: null } },
          { foo: null },
          { foo: {} },
        ],
        expected: [{ foo: { bar: null } }],
      },
      {
        filter: { "foo.bar": { $eq: { baz: "qux" } } },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { bar: { baz: "qux" } } },
          { foo: { bar: null } },
          { foo: null },
          { foo: {} },
        ],
        expected: [{ foo: { bar: { baz: "qux" } } }],
      },
      {
        filter: { "foo.bar": { $eq: { baz: null } } },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { bar: { baz: null } } },
          { foo: { bar: null } },
          { foo: null },
          { foo: {} },
        ],
        expected: [{ foo: { bar: { baz: null } } }],
      },
    ];
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      (0, mocha_1.test)(i.toString(), function () {
        return __awaiter(this, void 0, void 0, function* () {
          const filterFn = (0, compiled_1.compileFilter)(testCase.filter);
          const actual = testCase.input.filter(filterFn);
          yield collection.insertMany(testCase.input);
          const mongoExpected = yield collection
            .find(testCase.filter, { projection: { _id: 0 } })
            .toArray();
          (0, node_assert_1.deepStrictEqual)(actual, mongoExpected);
          (0, node_assert_1.deepStrictEqual)(actual, testCase.expected);
        });
      });
    }
  });
  (0, mocha_1.describe)("$ne operator", function () {
    const testCases = [
      {
        filter: { foo: { $ne: "bar" } },
        input: [{ foo: "bar" }, {}, { foo: "baz" }, { foo: { foo: "bar" } }],
        expected: [{}, { foo: "baz" }, { foo: { foo: "bar" } }],
      },
      {
        filter: { "foo.foo": { $ne: "bar" } },
        input: [{ foo: "bar" }, {}, { foo: "baz" }, { foo: { foo: "bar" } }],
        expected: [{ foo: "bar" }, {}, { foo: "baz" }],
      },
      {
        filter: { "foo.foo": { $ne: null } },
        input: [
          { foo: "bar" },
          {},
          { foo: { foo: "bar" } },
          { foo: null },
          { foo: {} },
          { foo: { foo: null } },
        ],
        expected: [{ foo: { foo: "bar" } }],
      },
      {
        filter: { foo: { $ne: { foo: "bar" } } },
        input: [
          { foo: "bar" },
          {},
          { foo: { foo: "bar" } },
          { foo: null },
          { foo: {} },
          { foo: { foo: null } },
        ],
        expected: [
          { foo: "bar" },
          {},
          { foo: null },
          { foo: {} },
          { foo: { foo: null } },
        ],
      },
    ];
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      (0, mocha_1.test)(i.toString(), function () {
        return __awaiter(this, void 0, void 0, function* () {
          const filterFn = (0, compiled_1.compileFilter)(testCase.filter);
          const actual = testCase.input.filter(filterFn);
          yield collection.insertMany(testCase.input);
          const mongoExpected = yield collection
            .find(testCase.filter, { projection: { _id: 0 } })
            .toArray();
          (0, node_assert_1.deepStrictEqual)(actual, mongoExpected);
          (0, node_assert_1.deepStrictEqual)(actual, testCase.expected);
        });
      });
    }
  });
  (0, mocha_1.describe)("$gt operator", function () {
    const testCases = [
      {
        filter: { foo: { $gt: 1 } },
        input: [
          { foo: 0 },
          { foo: 1 },
          { foo: 2 },
          { foo: { foo: "bar" } },
          {},
          { foo: null },
        ],
        expected: [{ foo: 2 }],
      },
      {
        filter: { "foo.foo": { $gt: 1 } },
        input: [
          { foo: { foo: 0 } },
          { foo: { foo: 1 } },
          { foo: { foo: 2 } },
          { foo: "bar" },
          {},
          { foo: { foo: "bar" } },
          { foo: { foo: null } },
          { foo: null },
        ],
        expected: [{ foo: { foo: 2 } }],
      },
      {
        filter: { "foo.foo": { $gt: null } },
        input: [
          { foo: "bar" },
          {},
          { foo: { foo: "bar" } },
          { foo: null },
          { foo: {} },
          { foo: { foo: null } },
        ],
        expected: [],
      },
      {
        // cannot yet compare objects, like in OG sift
        // https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/#objects
        skip: true,
        filter: { foo: { $gt: { foo: "bar" } } },
        input: [
          { foo: "bar" },
          {},
          { foo: { foo: "bar" } },
          { foo: { foo: "bar", bar: "baz" } },
          { foo: { foo: "baz" } },
          { foo: null },
          { foo: {} },
          { foo: { foo: null } },
        ],
        expected: [{ foo: { foo: "baz" } }],
      },
    ];
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      (0, mocha_1.test)(i.toString(), function () {
        return __awaiter(this, void 0, void 0, function* () {
          if (testCase.skip) this.skip();
          const filterFn = (0, compiled_1.compileFilter)(testCase.filter);
          const actual = testCase.input.filter(filterFn);
          yield collection.insertMany(testCase.input);
          const mongoExpected = yield collection
            .find(testCase.filter, { projection: { _id: 0 } })
            .toArray();
          (0, node_assert_1.deepStrictEqual)(actual, mongoExpected);
          (0, node_assert_1.deepStrictEqual)(actual, testCase.expected);
        });
      });
    }
  });
});
//# sourceMappingURL=compiled.test.js.map
