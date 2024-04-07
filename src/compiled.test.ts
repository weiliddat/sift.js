import { before, describe, test } from "mocha";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Collection, MongoClient } from "mongodb";
import { deepStrictEqual } from "node:assert";
import { compileFilter } from "./compiled";

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
      test(i.toString(), async function () {
        const filterFn = compileFilter(testCase.filter);
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
      test(i.toString(), function () {
        const filterFn = compileFilter(testCase.filter);
        const actual = testCase.input.filter(filterFn);
        deepStrictEqual(actual, testCase.expected);
      });
    }
  });
});
