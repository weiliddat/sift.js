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
  describe("$gt operator", function () {
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
          { foo: [1] },
          { foo: [2] },
          { foo: [0, 2] },
          { foo: [] },
        ],
        expected: [{ foo: 2 }, { foo: [2] }, { foo: [0, 2] }],
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
          { foo: { foo: [1] } },
          { foo: { foo: [2] } },
          { foo: { foo: [0, 2] } },
          { foo: { foo: [] } },
        ],
        expected: [
          { foo: { foo: 2 } },
          { foo: { foo: [2] } },
          { foo: { foo: [0, 2] } },
        ],
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
          { foo: { foo: [] } },
          { foo: { foo: [1] } },
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
      test(i.toString(), async function () {
        if (testCase.skip) this.skip();

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

  describe("$lt operator", function () {
    const testCases = [
      {
        filter: { foo: { $lt: 1 } },
        input: [
          { foo: 0 },
          { foo: 1 },
          { foo: 2 },
          { foo: { foo: "bar" } },
          {},
          { foo: null },
          { foo: [1] },
          { foo: [2] },
          { foo: [0, 2] },
          { foo: [] },
        ],
        expected: [{ foo: 2 }, { foo: [2] }, { foo: [0, 2] }],
      },
      {
        filter: { "foo.foo": { $lt: 1 } },
        input: [
          { foo: { foo: 0 } },
          { foo: { foo: 1 } },
          { foo: { foo: 2 } },
          { foo: "bar" },
          {},
          { foo: { foo: "bar" } },
          { foo: { foo: null } },
          { foo: null },
          { foo: { foo: [1] } },
          { foo: { foo: [2] } },
          { foo: { foo: [0, 2] } },
          { foo: { foo: [] } },
        ],
        expected: [
          { foo: { foo: 2 } },
          { foo: { foo: [2] } },
          { foo: { foo: [0, 2] } },
        ],
      },
      {
        filter: { "foo.foo": { $lt: null } },
        input: [
          { foo: "bar" },
          {},
          { foo: { foo: "bar" } },
          { foo: null },
          { foo: {} },
          { foo: { foo: null } },
          { foo: { foo: [] } },
          { foo: { foo: [1] } },
        ],
        expected: [],
      },
      {
        // cannot yet compare objects, like in OG sift
        // https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/#objects
        skip: true,
        filter: { foo: { $lt: { foo: "bar" } } },
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
      test(i.toString(), async function () {
        if (testCase.skip) this.skip();

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
