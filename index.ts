import { BoolCreation, init } from "z3-solver";
import type { Solver, Bool as BoolZ3 } from "z3-solver";
import { groupBy } from "./utils";

/////////////////////////// OPTIONS AND FORMALIZATION ///////////////////////////

// Menu options
const OPTIONS = ["cut", "copy", "cost"];

/* FORMALIZATION

1. Each option must have a mnemonic.
2. An option cannot have more than one mnemonic.
3. A given character cannot be a mnemonic of two different options.

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
  return options.map((option: string, positionInMenu: number) => {
    const charsFromOption = [...option];
    return charsFromOption.map((character, positionInOption: number) => ({
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
  // Uu0 v Un0 Ud0 Uo0
  options.forEach((option: Mnemonic[]) => {
    const arrayOption = new solver.ctx.AstVector<BoolZ3>();
    option.forEach((nm) => arrayOption.push(nm.value));
    solver.add(solver.ctx.Or(arrayOption));
  });

  // An option cannot have more than one mnemonic
  // Uu0 -> ¬Un0 ^ ¬Ud0 ^ ¬Uno0
  // Un0 -> ¬Uu0 ^ ¬Ud0 ^ ¬Uno0
  // Ud0 -> ¬Uu0 ^ ¬Un0 ^ ¬Uno0
  // Uo0 -> ¬Uu0 ^ ¬Un0 ^ ¬Und0
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
 * @param optionsString - The array of options as strings
 * @param options - The array of boolean constants. Example: [[Uu0, Un0, Ud0, Uo0], [Uc1, Uo1, Up1, Uy1]]
 * @param solver - The solver structure from Z3
 * @returns The solver structure from Z3
 *
 */
function addCharacterConstraint(options: Mnemonic[][], solver: Solver<"main">) {
  // Search for repeated chars in order to defined the prepositions.
  // Example:
  // Set(13) {
  //  { character: 'c', position: { i: 0, j: 0 }, value: BoolImpl { ptr: 14261556, ctx: [Object] } },
  //  { character: 'c', position: { i: 1, j: 0 }, value: BoolImpl { ptr: 14261628, ctx: [Object] } },
  //  { character: 'c', position: { i: 2, j: 0 }, value: BoolImpl { ptr: 14261724, ctx: [Object] } },
  //  { character: 't', position: { i: 0, j: 2 }, value: BoolImpl { ptr: 14261604, ctx: [Object] } },
  //  { character: 't', position: { i: 2, j: 3 },  value: BoolImpl { ptr: 14261796, ctx: [Object] } },
  //  { character: 't', position: { i: 3, j: 4 }, value: BoolImpl { ptr: 14261844, ctx: [Object] }
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
  // {
  //  c: [
  //    { character: 'c', position: { i: 0, j: 0 }, value: [BoolImpl] },
  //    { character: 'c', position: { i: 1, j: 0 }, value: [BoolImpl] },
  //    { character: 'c', position: { i: 2, j: 0 }, value: [BoolImpl] }
  //  ],
  //  t: [
  //    { character: 't', position: { i: 0, j: 2 }, value: [BoolImpl] },
  //    { character: 't', position: { i: 2, j: 3 }, value: [BoolImpl] },
  //    { character: 't', position: { i: 3, j: 4 }, value: [BoolImpl] }
  //  ]
  // }
  const grouped = Object.values(
    groupBy(Array.from(repeatedChars), "character")
  ) as Mnemonic[][];

  // A given character cannot be mnemonic of two different options
  // Example:
  // Uc0 -> ¬Uc1 ^ ¬Uc2
  // Uc1 -> ¬Uc0 ^ ¬Uc2
  // Uc2 -> ¬Uc0 ^ ¬Uc1
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
