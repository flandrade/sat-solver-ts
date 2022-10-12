# Keyboard Mnemonics: SAT problem with Z3 (TypeScript)

Assign keyboard mnemonics to a list of options. Given a set of options in a menu, we want to assign
a mnemonic to every option such that there are not two options with the same mnemonic. The solution
has to meet the following constraints:

1. Each option must have a mnemonic.
2. An option cannot have more than one mnemonic.
3. A given character cannot be a mnemonic of two different options.

The problem can be reduced to a SAT. This implementation uses Z3's bindings in TypeScript.

## Formalization

1. Each option must have a mnemonic.

$$
  \land_{i = 1}^n \lor_{c \in Chars(i)} U_{c,i}
$$

2. An option cannot have more than one mnemonic.

$$
  \land_{i = 1}^n \land_{c \in Chars(i)} (U_{c,i} \implies \land_{t \in \{Chars(i) - c\}} \lnot U_{t,i})
$$

3. A given character cannot be a mnemonic of two different options.

$$
  \land_{i = 1}^n \land_{c \in Chars(i)} (U_{c,i} \implies \land_{1\leq j \leq n \land i \neq j c \in Chars(j)} \lnot U_{c,j})
$$

## Installation

OS X & Linux:

Install Node with [asdf](https://github.com/asdf-vm/asdf-nodejs) (version manager):

```
asdf install
```

Install dependencies:

```sh
npm install
```

## Usage example

Define options in index.ts:

```ts
// Menu options
const OPTIONS = ["cut", "copy", "cost"];
```

Run program:

```sh
npm start
```

The program will print the answers:

```
Starting...
Problem was determined to be sat in 252 ms
---- Result: option [mnemonic] ----
cut u
copy y
cost t
```

## Acknowledgment

Assignment from "Static Program Analysis and Constraint Solving" at Universidad Complutense de Madrid. Prof. Manuel Montenegro.
