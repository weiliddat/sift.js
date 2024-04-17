import sift from ".";

const query = { "groups.name": { $ne: null } };
// const docs = [{ groups: [{ name: "bob" }] }, { groups: [] }, { other: [] }]
// const expected = [{ groups: [{ name: "bob" }] }]

const filter = sift(query);

console.log(filter({ groups: [{ name: "bob" }] }));

console.log(filter({ groups: [] }));

console.log(filter({ groups: [{ name: null }] }));

console.log(filter({ groups: null }));
