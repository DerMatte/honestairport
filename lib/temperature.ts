/** Rounded Fahrenheit from Celsius (`F = C * 9/5 + 32`). */
export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}
