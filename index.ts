import { BoolCreation, init } from "z3-solver";
import type { Solver, Arith, Bool as BoolZ3 } from "z3-solver";

// Menu options
const OPTIONS = ["cut", "copy", "cost", "sssst"];

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
 * @returns array of boolean constants from Z3. Example: [[Uu1, Un1, Ud1, Uo1],[Uc2, Uo2, Up2, Uy2]]
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
 * Add mnemonic keyboard constraint
 *
 * @param options - The array of boolean constants from Z3. Example: [[Uu1, Un1, Ud1, Uo1],[Uc2, Uo2, Up2, Uy2]]
 * @param solver - The solver structure from Z3
 * @returns The solver structure from Z3
 *
 */
function addConstraints(
  options: Mnemonic[][],
  solver: Solver<"main">
): Solver<"main"> {
  // each option must have a mnemonic
  options.forEach((option: Mnemonic[]) => {
    const arrayOption = new solver.ctx.AstVector<BoolZ3>();
    option.forEach((nm) => arrayOption.push(nm.value));
    solver.add(solver.ctx.Or(arrayOption));
  });

  // An option cannot have more than one mnemonic
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
 * Add character constraint: Add mnemonic keyboard constraint: A given character cannot be a mnemonic of two different options
 *
 * @param optionsString - The array of options as strings
 * @param options - The array of boolean constants.. Example: [[Uu1, Un1, Ud1, Uo1],[Uc2, Uo2, Up2, Uy2]]
 * @param solver - The solver structure from Z3
 * @returns The solver structure from Z3
 *
 */
function addCharacterConstraint(options: Mnemonic[][], solver: Solver<"main">) {
  //return solver;
}

(async () => {
  let { Context, em } = await init();
  const Z3 = Context("main");
  const optionList: Mnemonic[][] = parseOptions(OPTIONS, Z3.Bool);

  let solver = new Z3.Solver();
  addConstraints(optionList, solver);
  //addLetterConstraint(optionList, solver);
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
