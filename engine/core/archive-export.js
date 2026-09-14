import {archiveEnglish,archiveImage,archiveCaptureProfile} from './field-archive.js';
const number=v=>Number.isFinite(Number(v))?Number(v):null;
// Whitelist exported fields: no UI HTML, remote URLs or unobserved images.
export function createArchiveExport({stations=[],records=[],seed=null},now=new Date()){
  const captured=new Map(records.map(record=>[record.id,record]));
  const fields=stations.map(station=>{
    const record=captured.get(station.id),capture=archiveCaptureProfile(record??station);
    return {
      id:String(station.id),planet:archiveEnglish(station.planet),world:archiveEnglish(station.world),
      label:archiveEnglish(station.label),x:number(station.x),z:number(station.z),
      status:record?'ACQUIRED':station.archiveRole==='potential'?'RESOLVED POTENTIAL':'UNRESOLVED',
      capture:record?{lens:capture.lens,viewpoint:capture.viewpoint,projection:capture.projection,aspect:capture.aspect,
        frame:number(record.frame),pageElapsedMs:number(record.capturedAt),image:archiveImage(record.image)}:null
    };
  });
  return {schema:'terra-incognita.field-archive',version:1,exportedAt:now.toISOString(),
    universeSeed:typeof seed==='string'&&/^[0-9a-f]{6}$/i.test(seed)?seed:null,
    coordinates:'FICTIONAL LOCAL X/Z; NOT CELESTIAL COORDINATES',
    captureTime:'Milliseconds since the capturing page initialized; not UTC.',
    count:fields.filter(field=>field.capture).length,stations:fields};
}
function csvCell(value){
  let text=String(value??'');
  if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function archiveCSV(data){
  const rows=[['ID','PLANET','WORLD','LABEL','X','Z','STATUS','LENS','VIEWPOINT','FRAME','PAGE_ELAPSED_MS','HAS_IMAGE']];
  for(const field of data.stations)rows.push([field.id,field.planet,field.world,field.label,field.x,field.z,field.status,
    field.capture?.lens,field.capture?.viewpoint,field.capture?.frame,field.capture?.pageElapsedMs,field.capture?.image?'YES':'NO']);
  return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
