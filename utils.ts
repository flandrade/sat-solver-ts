/**
 * Groups the elements of the calling array according to the string values returned by a
 * provided testing function.
 *
 * @param items - The object list
 * @param key - testing function
 * @returns grouped array
 *
 */
export const groupBy = (items, key) =>
  items.reduce(
    (result, item) => ({
      ...result,
      [item[key]]: [...(result[item[key]] || []), item],
    }),
    {}
  );
