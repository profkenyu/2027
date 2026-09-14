import {PLANET_PAGES, readCheckpoint, clearCheckpoint} from '../../engine/core/checkpoint.js';
export const planetPages = PLANET_PAGES;
export const entryPlanet = Object.entries(planetPages).find(([, path]) => location.pathname.endsWith('/' + path))?.[0] ?? 'terra';
const key = 'terra-incognita:last-planet';
if(new URLSearchParams(location.search).get('fresh')==='1'){
  clearCheckpoint();
  try { for(const name of ['terra-incognita:mission-memory:v3','terra-incognita:field-archive:v4','terra-incognita:field-archive:v3','terra-incognita:field-archive:v2'])sessionStorage.removeItem(name); }catch{}
  const clean=new URL(location.href);clean.searchParams.delete('fresh');history.replaceState(history.state,'',clean.href);
}
export const entryCheckpoint = readCheckpoint();
if (entryCheckpoint?.world === entryPlanet) {
  window.UNIVERSE_SEED = entryCheckpoint.seed;
  try { sessionStorage.setItem('universe_seed', entryCheckpoint.seed); } catch {}
}
try { sessionStorage.setItem(key, planetPages[entryPlanet]); } catch {}
export function travelToPlanet(planet, memory) {
  clearCheckpoint();
  memory.persist();
  const url = new URL(planetPages[planet], location.href);
  url.search = location.search;
  location.assign(url.href);
  // Freeze the old simulation while the destination page initializes.
  return new Promise(() => {});
}
