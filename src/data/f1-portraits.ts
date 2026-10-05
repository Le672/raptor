import type { F1Driver } from "@/lib/f1";

const PORTRAITS_2026 = [
  {"driverId":"russell","fullName":"George Russell","asset":"/f1/portraits/2026/george-russell.webp"},
  {"driverId":"antonelli","fullName":"Kimi Antonelli","asset":"/f1/portraits/2026/kimi-antonelli.webp"},
  {"driverId":"leclerc","fullName":"Charles Leclerc","asset":"/f1/portraits/2026/charles-leclerc.webp"},
  {"driverId":"hamilton","fullName":"Lewis Hamilton","asset":"/f1/portraits/2026/lewis-hamilton.webp"},
  {"driverId":"norris","fullName":"Lando Norris","asset":"/f1/portraits/2026/lando-norris.webp"},
  {"driverId":"piastri","fullName":"Oscar Piastri","asset":"/f1/portraits/2026/oscar-piastri.webp"},
  {"driverId":"max_verstappen","fullName":"Max Verstappen","asset":"/f1/portraits/2026/max-verstappen.webp"},
  {"driverId":"hadjar","fullName":"Isack Hadjar","asset":"/f1/portraits/2026/isack-hadjar.webp"},
  {"driverId":"lawson","fullName":"Liam Lawson","asset":"/f1/portraits/2026/liam-lawson.webp"},
  {"driverId":"lindblad","fullName":"Arvid Lindblad","asset":"/f1/portraits/2026/arvid-lindblad.webp"},
  {"driverId":"gasly","fullName":"Pierre Gasly","asset":"/f1/portraits/2026/pierre-gasly.webp"},
  {"driverId":"colapinto","fullName":"Franco Colapinto","asset":"/f1/portraits/2026/franco-colapinto.webp"},
  {"driverId":"ocon","fullName":"Esteban Ocon","asset":"/f1/portraits/2026/esteban-ocon.webp"},
  {"driverId":"bearman","fullName":"Oliver Bearman","asset":"/f1/portraits/2026/oliver-bearman.webp"},
  {"driverId":"hulkenberg","fullName":"Nico Hulkenberg","asset":"/f1/portraits/2026/nico-hulkenberg.webp"},
  {"driverId":"bortoleto","fullName":"Gabriel Bortoleto","asset":"/f1/portraits/2026/gabriel-bortoleto.webp"},
  {"driverId":"sainz","fullName":"Carlos Sainz","asset":"/f1/portraits/2026/carlos-sainz.webp"},
  {"driverId":"albon","fullName":"Alexander Albon","asset":"/f1/portraits/2026/alexander-albon.webp"},
  {"driverId":"alonso","fullName":"Fernando Alonso","asset":"/f1/portraits/2026/fernando-alonso.webp"},
  {"driverId":"stroll","fullName":"Lance Stroll","asset":"/f1/portraits/2026/lance-stroll.webp"},
  {"driverId":"perez","fullName":"Sergio Perez","asset":"/f1/portraits/2026/sergio-perez.webp"},
  {"driverId":"bottas","fullName":"Valtteri Bottas","asset":"/f1/portraits/2026/valtteri-bottas.webp"},
];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/^andrea kimi\b/, "kimi");

export function driverPortrait(year: number, driver?: Pick<F1Driver, "driverId" | "givenName" | "familyName">, fullName?: string) {
  if (year !== 2026) return undefined;
  const name = normalize(driver ? driver.givenName + " " + driver.familyName : fullName || "");
  return (driver ? PORTRAITS_2026.find(entry => entry.driverId === driver.driverId) : PORTRAITS_2026.find(entry => normalize(entry.fullName) === name))?.asset;
}
