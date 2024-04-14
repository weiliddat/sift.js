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
  describe("$in operator", function () {
    const testCases = [
      {
        filter: { foo: { $in: ["bar", "baz"] } },
        input: [
          { foo: "bar" },
          { foo: "baz" },
          { foo: ["bar"] },
          {},
          { foo: { foo: "bar" } },
        ],
        expected: [{ foo: "bar" }, { foo: "baz" }, { foo: ["bar"] }],
      },
      {
        filter: { "foo.bar": { $in: ["baz"] } },
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
        filter: { "foo.bar": { $in: [null] } },
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
        filter: { foo: { $in: [{ bar: "baz" }] } },
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
        filter: { foo: { $in: [{ bar: null }] } },
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

  describe.skip("$nin operator", function () {
    const testCases = [
      {
        filter: { foo: { $nin: ["bar", "baz"] } },
        input: [
          { foo: "bar" },
          { foo: "baz" },
          { foo: ["bar"] },
          {},
          { foo: { foo: "bar" } },
        ],
        expected: [{}, { foo: { foo: "bar" } }],
      },
      {
        filter: { "foo.bar": { $nin: ["baz"] } },
        input: [
          { foo: "bar" },
          {},
          { foo: { bar: ["baz"] } },
          { foo: { bar: "baz" } },
          { foo: { bar: null } },
          { foo: null },
        ],
        expected: [{ foo: "bar" }, {}, { foo: { bar: null } }, { foo: null }],
      },
      {
        filter: { "foo.bar": { $nin: [null] } },
        input: [
          { foo: { bar: 1 } },
          { foo: "bar" },
          {},
          { foo: { bar: null } },
          { foo: { bar: [null] } },
          { foo: null },
          { foo: {} },
        ],
        expected: [{ foo: { bar: 1 } }],
      },
      /**
       * objects as filter value are a special case
       * https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/#match-an-embedded-nested-document
       */
      {
        filter: { foo: { $nin: [{ bar: "baz" }] } },
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
        filter: { foo: { $nin: [{ bar: null }] } },
        input: [
          { foo: "bar" },
          {},
          { foo: null },
          { foo: {} },
          { foo: { bar: null } },
        ],
        expected: [{ foo: "bar" }, {}, { foo: null }, { foo: {} }],
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
});
