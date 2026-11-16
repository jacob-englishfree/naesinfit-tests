const path=require('path');
function fp(folder){ for(const t of ['단어','워크북','퀴즈']){try{return require(path.join(__dirname,folder,t+'.prompt.json')).fullPassage;}catch(e){}} }
function pos(text,word){ return text.toLowerCase().search(new RegExp('\\b'+word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b')); }
for(const f of process.argv.slice(2)){
  const r=require(path.join(__dirname,f));
  const folder=f.split('/')[0];
  const passage=fp(folder);
  console.log('\n===== '+f+' =====');
  for(const d of r.decisions){
    if(d.overlay && d.overlay.markers){
      const e=Object.entries(d.overlay.markers).map(([k,v])=>[k,(typeof v==='object')?v.find:v]).map(([k,w])=>k+':'+w+'@'+pos(passage,w));
      console.log('Q'+d.id+' ['+d.type+'] ans='+d.ans+' | '+e.join('  '));
    }
    if(d.overlay && d.overlay.abc){
      const e=Object.entries(d.overlay.abc).map(([k,v])=>k+':'+v[0]+'@'+pos(passage,v[0]));
      console.log('Q'+d.id+' [ABC] ans='+d.ans+' | '+e.join('  '));
    }
  }
}
