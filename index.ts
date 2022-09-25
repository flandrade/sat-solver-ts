import { BoolCreation, init } from "z3-solver";
import type { Solver, Arith, Bool as BoolZ3 } from "z3-solver";

// Menu options
const OPTIONS = ["cut", "copy", "cost", "sssst"];

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
): BoolZ3<"main">[][] {
  return options.map((option: string, position: number) => {
    const charsFromOption = [...option];
    return charsFromOption.map((character) =>
      Bool.const(`U${character}${position + 1}`)
    );
  });
}

/**
 * Add mnemonic keyboard constraints
 *
 * @param options - The array of boolean constants from Z3. Example: [[Uu1, Un1, Ud1, Uo1],[Uc2, Uo2, Up2, Uy2]]
 * @param solver - The solver structure from Z3
 * @returns The solver structure from Z3
 *
 */
function addConstraints(
  options: BoolZ3<"main">[][],
  solver: Solver<"main">
): Solver<"main"> {
  // each option must have a mnemonic
  options.forEach((option: BoolZ3<"main">[]) => {
    const arrayOption = new solver.ctx.AstVector<BoolZ3>();
    option.forEach((nm) => arrayOption.push(nm));
    solver.add(solver.ctx.Or(arrayOption));
  });

  // An option cannot have more than one mnemonic
  options.forEach((option: BoolZ3<"main">[]) => {
    const [first, ...tail] = option;
    const arrayOption = new solver.ctx.AstVector<BoolZ3>();
    tail.forEach((nm) => arrayOption.push(solver.ctx.Not(nm)));
    solver.add(solver.ctx.Implies(first, solver.ctx.And(arrayOption)));
  });

  // A given letter cannot be a mnemonic of two different options
  return solver;
}

(async () => {
  let { Context, em } = await init();
  const Z3 = Context("main");
  const optionList: BoolZ3<"main">[][] = parseOptions(OPTIONS, Z3.Bool);

  let solver = new Z3.Solver();
  addConstraints(optionList, solver);
  let start = Date.now();
  console.log("Starting...");
  let check = await solver.check();
  console.log(
    `Problem was determined to be ${check} in ${Date.now() - start} ms`
  );
  if (check === "sat") {
    let model = solver.model();

    optionList.forEach((option: BoolZ3<"main">[], index: number) => {
      const resultArray = option.map((mn) =>
        Boolean(model.eval(mn).toString() === "true")
      );
      const mnemonic: number = resultArray.findIndex((v) => v);
      console.log(`${OPTIONS[index]} ${[...OPTIONS[index]][mnemonic]}`);
    });
  }

  em.PThread.terminateAllThreads();
})().catch((e) => {
  console.error("error", e);
});
