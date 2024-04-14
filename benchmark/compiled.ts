import { faker } from "@faker-js/faker";
import { set } from "lodash";
import { createHistogram, performance } from "node:perf_hooks";
import { compile } from "../src/compiled";

const BENCHMARK_ROUNDS = 1000;

const deepKey =
  "relationships.sister.relationships.husband.relationships.mother.legal.citizenship";

const persons = Array(1000)
  .fill(0)
  .map(() => {
    const person = {
      name: {
        first: faker.person.firstName(),
        last: faker.person.lastName(),
      },
      account: {
        iban: faker.finance.iban(),
        currency: faker.finance.currencyCode(),
      },
      legal: {
        citizenship: faker.location.countryCode(),
      },
    } as any;

    set(person, deepKey, faker.location.countryCode());

    return person;
  });

const filter = {
  "legal.citizenship": "US",
  [deepKey]: "US",
};

const compileHistogram = createHistogram();
const compilerWrapped = performance.timerify(compile, {
  histogram: compileHistogram,
});

const filterFn = compile(filter);

const filterHistogram = createHistogram();
const filterWrapped = performance.timerify(() => persons.filter(filterFn), {
  histogram: filterHistogram,
});

for (let i = 0; i < BENCHMARK_ROUNDS; i++) {
  compilerWrapped(filter);
  filterWrapped();
}

console.log({ compileHistogram, filterHistogram });
