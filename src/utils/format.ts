// Zahlen auf einer deutschen Seite mit Komma. Das Bierkompendium gab die
// Spannen direkt aus dem Datensatz aus und schrieb damit "4.4 – 5.2 % vol"
// und "11 – 12.5 °P", waehrend dieselben Werte auf der Sortenseite als
// "4,4 bis 5,2 % vol" standen.
export const de = (value: number): string => value.toLocaleString('de-DE');
