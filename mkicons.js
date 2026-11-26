// iconen uit icon.svg. 180 (apple-touch-icon): vierkant, iOS rondt zelf af (transparante hoeken worden daar zwart).
// 192/512 (manifest, o.a. Windows/Android): afgeronde hoeken met transparante achtergrond.
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();const svg=require('fs').readFileSync(process.argv[2]+'/icon.svg','utf8');
for(const s of [180,192,512]){const vierkant=s===180;await p.setViewportSize({width:s,height:s});await p.setContent(`<html><body style="margin:0;background:${vierkant?'#5b5fc7':'transparent'}">${svg.replace('<svg ','<svg style="display:block" width="'+s+'" height="'+s+'" ').replace('rx="14"',vierkant?'rx="0"':'rx="14"')}</body></html>`);await p.screenshot({path:process.argv[2]+'/icon-'+s+'.png',omitBackground:!vierkant});}
await b.close();})();
