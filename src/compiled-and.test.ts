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
  describe("$and operator", function () {
    const testCases = [
      {
        filter: { $and: [{ foo: "bar" }, { baz: { $gt: 1 } }] },
        input: [
          { foo: "bar", baz: 2 },
          { foo: ["bar"], baz: [0, 2] },
          { baz: 2 },
          { foo: "bar" },
          { foo: null },
          { baz: null },
          { baz: null },
        ],
        expected: [
          { foo: "bar", baz: 2 },
          { foo: ["bar"], baz: [0, 2] },
        ],
      },
      /** Implicit $and */
      {
        filter: { foo: "bar", baz: { $gt: 1 } },
        input: [
          { foo: "bar", baz: 2 },
          { foo: ["bar"], baz: [0, 2] },
          { baz: 2 },
          { foo: "bar" },
          { foo: null },
          { baz: null },
          { baz: null },
        ],
        expected: [
          { foo: "bar", baz: 2 },
          { foo: ["bar"], baz: [0, 2] },
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
