/*
  Fernanda Andrade Guanoquiza
  Assignment 1 (SAT) - Static Program Analysis and Constraint Solving
  2022-10-03
*/

import { BoolCreation, init } from "z3-solver";
import type { Solver, Bool as BoolZ3 } from "z3-solver";
import { groupBy } from "./utils";

/////////////////////////// OPTIONS AND FORMALIZATION ///////////////////////////

// Menu options
const OPTIONS = ["undo", "copy", "mod"];

/* FORMALIZATION

Let's consider options "undo", "copy", "mod" which can be written as:

Uu1, Un1, Ud1, Uo1
Uc2, Uo2, Up2, Uy2
Um3, Uo3, Ud3

1. Each option must have a mnemonic:

∧_{i=1}^{n} ∨_{c ∈ Chars(i)} Uc,i

Example:
Uu1 v Un1 v Ud1 v Uo1
Uc2 v Uo2 v Up2 v Uy2
Um3 v Uo3 v Udt3

2. An option cannot have more than one mnemonic:

∧_{i=1}^n ∧_{c∈Chars(i)} (Uc,i ⟹ ∧_{t∈Chars(i)−c} ¬Ut,i)

Example:
Uu1 -> ¬Un1 ∧ ¬Ud1 ∧ ¬Uo1
Un1 -> ¬Uu1 ∧ ¬Ud1 ∧ ¬Uo1
Ud1 -> ¬Uu1 ∧ ¬Un1 ∧ ¬Uo1
Uo1 -> ¬Uu1 ∧ ¬Un1 ∧ ¬Ud1

Uc2 -> ¬Uo2 ∧ ¬Up2 ∧ ¬Uy2
Uo2 -> ¬Uc2 ∧ ¬Uo2 ∧ ¬Uy2
Up2 -> ¬Uc2 ∧ ¬Uo2 ∧ ¬Uy2
Uy2 -> ¬Uc2 ∧ ¬Up2 ∧ ¬Up2

Um3 -> ¬Uo3 ∧ ¬Ud3
Uo3 -> ¬Um3 ∧ ¬Ud3
Ud3 -> ¬Um3 ∧ ¬Uo3

3. A given character cannot be a mnemonic of two different options:

∧_{i=1}^n ∧_{c∈Chars(i)} (Uc,i⟹∧_{∧1≤j≤n ∧ i≠j c∈Chars(j)}^n ¬Uc,j)

Example:
Ud1 -> ¬Ud3
Ud3 -> ¬Ud1

Uo1 -> ¬Uo2 ^ ¬Uo3
Uo2 -> ¬Uo1 ^ ¬Uo3
Uo3 -> ¬Uo1 ^ ¬Uo2

*/

///////////////////////////////// IMPLEMENTATION ////////////////////////////////

interface Mnemonic {
  character: string;
  position: { i: number; j: number };
  value: BoolZ3<"main">;
}

/**
 * Transform an option from the menu into a vector of boolean constants [Uc,i...].
 *
 * @param options - The list of options. Example: ["undo", "copy"]
 * @param Bool - The Bool structure from Z3
 * @returns array of boolean constants from Z3. Example: [[Uu0, Un0, Ud0, Uo0], [Uc1, Uo1, Up1, Uy1]]
 *
 */
function parseOptions(
  options: string[],
  Bool: BoolCreation<"main">
): Mnemonic[][] {
  // Remove repeated chars in option
  const newOptions = options.map((option) => Array.from(new Set([...option])));
  return newOptions.map((option: string[], positionInMenu: number) => {
    return option.map((character, positionInOption: number) => ({
      character: character,
      position: { i: positionInMenu, j: positionInOption },
      value: Bool.const(`U${character}${positionInMenu}`),
    }));
  });
}

/**
 * Add mnemonic keyboard constraint.
 *
 * @param options - The array of boolean constants from Z3. Example: [[Uu0, Un0, Ud0, Uo0], [Uc1, Uo1, Up1, Uy1]]
 * @param solver - The solver structure from Z3
 * @returns The solver structure from Z3
 *
 */
function addConstraints(
  options: Mnemonic[][],
  solver: Solver<"main">
): Solver<"main"> {
  // Each option must have a mnemonic
  // Example:
  // Uu0 v Un0 v Ud0 v Uo0
  options.forEach((option: Mnemonic[]) => {
    const arrayOption = new solver.ctx.AstVector<BoolZ3>();
    option.forEach((nm) => arrayOption.push(nm.value));
    solver.add(solver.ctx.Or(arrayOption));
  });

  // An option cannot have more than one mnemonic
  // Example:
  // Uu0 -> ¬Un0 ^ ¬Ud0 ^ ¬Uo0
  // Un0 -> ¬Uu0 ^ ¬Ud0 ^ ¬Uo0
  // Ud0 -> ¬Uu0 ^ ¬Un0 ^ ¬Uo0
  // Uo0 -> ¬Uu0 ^ ¬Un0 ^ ¬Ud0
  options.forEach((option: Mnemonic[]) => {
    option.forEach((_, index) => {
      const first = option[index];
      const tail = [
        ...option.slice(0, index),
        ...option.slice(index + 1, option.length),
      ];

      const arrayOption = new solver.ctx.AstVector<BoolZ3>();
      tail.forEach((nm) => arrayOption.push(solver.ctx.Not(nm.value)));
      solver.add(solver.ctx.Implies(first.value, solver.ctx.And(arrayOption)));
    });
  });

  return solver;
}

/*
 * Add character constraint: Add mnemonic keyboard constraint: A given character cannot be a mnemonic of
 * two different options.
 *
 * @param options - The array of boolean constants. Example: [[Uu0, Un0, Ud0, Uo0], [Uc1, Uo1, Up1, Uy1]]
 * @param solver - The solver structure from Z3
 * @returns The solver structure from Z3
 *
 */
function addCharacterConstraint(options: Mnemonic[][], solver: Solver<"main">) {
  // Search for repeated chars in order to defined the prepositions.
  // Example:
  // Set(13) {
  //   { character: 'd', position: { i: 0, j: 2 }, value: ... },
  //   { character: 'd', position: { i: 2, j: 2 }, value: ... },
  //   { character: 'o',  position: { i: 0, j: 3 }, value: ...},
  //   { character: 'o', position: { i: 1, j: 1 }, value: ... },
  //   { character: 'o', position: { i: 2, j: 1 },  value: ...
  //   }
  // }
  let arrayChar: (Mnemonic | null)[] = options.flat();
  const repeatedChars = new Set();
  for (let i = 0; i < arrayChar.length - 1; i++) {
    const currentValue = arrayChar[i];
    if (currentValue !== null) {
      for (let j = i + 1; j < arrayChar.length; j++) {
        if (
          arrayChar[j] !== null &&
          currentValue.character === arrayChar[j]?.character
        ) {
          repeatedChars.add(currentValue);
          repeatedChars.add(arrayChar[j]);
          arrayChar[j] = null;
        }
      }
    }
  }

  // Group repeated constants by character
  // Example:
  // [
  //   [
  //     { character: 'd', position: { i: 0, j: 2 }, value: [BoolImpl] },
  //     { character: 'd', position: { i: 2, j: 2 }, value: [BoolImpl] }
  //   ],
  //   [
  //     { character: 'o', position: { i: 0, j: 3 }, value: [BoolImpl] },
  //     { character: 'o', position: { i: 1, j: 1 }, value: [BoolImpl] },
  //     { character: 'o', position: { i: 2, j: 1 }, value: [BoolImpl] }
  //   ]
  // ]
  const grouped = Object.values(
    groupBy(Array.from(repeatedChars), "character")
  ) as Mnemonic[][];

  // A given character cannot be mnemonic of two different options
  // Example:
  // Uo1 -> ¬Uo2 ^ ¬Uo3
  // Uo2 -> ¬Uo1 ^ ¬Uo3
  // Uo3 -> ¬Uo1 ^ ¬Uo2
  grouped.forEach((mnemonics: Mnemonic[]) => {
    mnemonics.forEach((_, index) => {
      const first = mnemonics[index];
      const tail = [
        ...mnemonics.slice(0, index),
        ...mnemonics.slice(index + 1, mnemonics.length),
      ];
      const arrayOption = new solver.ctx.AstVector<BoolZ3>();
      tail.forEach((nm) => arrayOption.push(solver.ctx.Not(nm.value)));
      solver.add(solver.ctx.Implies(first.value, solver.ctx.And(arrayOption)));
    });
  });

  return solver;
}

/**
 * Solve using Z3 API
 */
(async () => {
  let { Context, em } = await init();
  const Z3 = Context("main");
  const optionList: Mnemonic[][] = parseOptions(OPTIONS, Z3.Bool);

  let solver = new Z3.Solver();
  addConstraints(optionList, solver);
  addCharacterConstraint(optionList, solver);
  let start = Date.now();
  console.log("Starting...");
  let check = await solver.check();
  console.log(
    `Problem was determined to be ${check} in ${Date.now() - start} ms`
  );
  if (check === "sat") {
    let model = solver.model();

    // Print option + mnemonic
    console.log("---- Result: option [mnemonic] ----");
    optionList.forEach((option: Mnemonic[], index: number) => {
      const resultArray = option.map((mn) =>
        Boolean(model.eval(mn.value).toString() === "true")
      );
      const mnemonic: number = resultArray.findIndex((v) => v);
      console.log(`${OPTIONS[index]} ${[...OPTIONS[index]][mnemonic]}`);
    });
  }

  em.PThread.terminateAllThreads();
})().catch((e) => {
  console.error("error", e);
});
