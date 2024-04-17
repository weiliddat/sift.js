import { before, describe, test } from "mocha";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Collection, MongoClient } from "mongodb";
import { deepStrictEqual } from "node:assert";
import { compile } from "./compiled";

let mongod: MongoMemoryServer;
let mongo: MongoClient;
let collection: Collection;

before(async function () {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  mongo = new MongoClient(uri, {
    forceServerObjectId: true,
  });
  await mongo.connect();

  const db = mongo.db("test");
  collection = db.collection("test");
});

beforeEach(async function () {
  await collection.deleteMany({});
});

after(async function () {
  await mongo.close();
  await mongod.stop();
});

describe("compileFilter", function () {
  describe("key value equality", function () {
    const testCases = [
      {
        filter: { foo: "bar" },
        input: [
          { foo: "bar" },
          {},
          { foo: "baz" },
          { foo: { foo: "bar" } },
          { foo: ["bar", "baz"] },
          { foo: ["baz"] },
        ],
        expected: [{ foo: "bar" }, { foo: ["bar", "baz"] }],
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
      /**
       * Implicit array access
       */
      {
        skip: true,
        filter: { "foo.items.name": "bar" },
        input: [
          { foo: { items: { name: "bar" } } },
          { foo: { items: [{ name: "bar" }] } },
        ],
        expected: [
          { foo: { items: { name: "bar" } } },
          { foo: { items: [{ name: "bar" }] } },
        ],
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
      {
        filter: { foo: [1, 2] },
        input: [
          { foo: [1, 2] },
          {
            foo: [
              [1, 2],
              [2, 3],
            ],
          },
          { foo: [2, 1] },
          {
            foo: [
              [2, 1],
              [2, 3],
            ],
          },
          {},
          { foo: [] },
          { foo: 1 },
          { foo: null },
        ],
        expected: [
          { foo: [1, 2] },
          {
            foo: [
              [1, 2],
              [2, 3],
            ],
          },
        ],
      },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      test(i.toString(), async function () {
        const filterFn = compile(testCase.filter);
        const actual = testCase.input.filter(filterFn);

        await collection.insertMany(testCase.input);
        const mongoExpected = await collection
          .find(testCase.filter, { projection: { _id: 0 } })
          .toArray();

        deepStrictEqual(actual, mongoExpected);
        deepStrictEqual(actual, testCase.expected);
      });
    }
  });

  describe("$eq operator", function () {
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
      test(i.toString(), async function () {
        const filterFn = compile(testCase.filter);
        const actual = testCase.input.filter(filterFn);

        await collection.insertMany(testCase.input);
        const mongoExpected = await collection
          .find(testCase.filter, { projection: { _id: 0 } })
          .toArray();

        deepStrictEqual(actual, mongoExpected);
        deepStrictEqual(actual, testCase.expected);
      });
    }
  });

  describe("$ne operator", function () {
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
      test(i.toString(), async function () {
        const filterFn = compile(testCase.filter);
        const actual = testCase.input.filter(filterFn);

        await collection.insertMany(testCase.input);
        const mongoExpected = await collection
          .find(testCase.filter, { projection: { _id: 0 } })
          .toArray();

        deepStrictEqual(actual, mongoExpected);
        deepStrictEqual(actual, testCase.expected);
      });
    }
  });
});
