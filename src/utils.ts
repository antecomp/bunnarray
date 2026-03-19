/**
 * Selects a random element from an array of items.
 *
 * @template T - The type of elements in the array.
 * @param items - An array of items to pick a random element from.
 * @returns A randomly selected element from the provided array.
 * @throws Will throw an error if the array is empty.
 */
export default function pickRandom<T>(items: T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}