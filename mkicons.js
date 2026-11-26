const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();const svg=require('fs').readFileSync(process.argv[2]+'/icon.svg','utf8');
for(const s of [180,192,512]){await p.setViewportSize({width:s,height:s});await p.setContent(`<html><body style="margin:0;background:#5b5fc7">${svg.replace('<svg ','<svg width="'+s+'" height="'+s+'" ').replace('rx="14"','rx="0"')}</body></html>`);await p.screenshot({path:process.argv[2]+'/icon-'+s+'.png'});}
await b.close();})();
