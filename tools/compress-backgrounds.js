'use strict';
// Original art lives outside app/ so only the optimised WebP files enter the APK.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=path.join(root,'design/backgrounds'),output=path.join(root,'app/images');
const manifestFile=path.join(source,'compression.json');
const names=['coastal-sky','forest-mist','future-horizon','starry-shore','summer-mist','summer-scroll','sunset-glow'];
const options={quality:95,effort:6,smartSubsample:true};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

async function main(){
  if(process.argv.includes('--check')){
    const m=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
    assert.deepEqual(m.images.map(x=>x.name),names);
    for(const item of m.images){
      const original=fs.readFileSync(path.join(source,item.name+'.png')),packed=fs.readFileSync(path.join(output,item.name+'.webp'));
      assert.equal(sha(original),item.original.sha256,item.name+' original');
      assert.equal(sha(packed),item.webp.sha256,item.name+' webp');
      assert.equal(packed.length,item.webp.bytes);assert.equal(original.length,item.original.bytes);
      assert(!fs.existsSync(path.join(output,item.name+'.png')),'Original PNG must stay outside app/: '+item.name);
    }
    console.log('Verified '+m.images.length+' original / WebP pairs and recorded hashes.');return;
  }
  if(process.argv.length>2)throw Error('Usage: node tools/compress-backgrounds.js [--check]');
  let sharp;
  try{sharp=require('sharp');}catch{
    try{sharp=require(path.join(root,'build/image-tools/node_modules/sharp'));}
    catch{throw Error('Image export requires sharp: npm install --prefix build/image-tools --no-save sharp@0.35.5');}
  }
  const images=[];
  for(const name of names){
    const input=path.join(source,name+'.png'),file=path.join(output,name+'.webp');
    const meta=await sharp(input).metadata();
    // Keep dimensions and framing. Always encode from the PNG, never from an earlier lossy output.
    await sharp(input).webp(options).toFile(file);
    const encoded=await sharp(file).metadata();assert.equal(encoded.width,meta.width);assert.equal(encoded.height,meta.height);
    const original=fs.readFileSync(input),packed=fs.readFileSync(file);
    images.push({name,width:meta.width,height:meta.height,original:{bytes:original.length,sha256:sha(original)},webp:{bytes:packed.length,sha256:sha(packed)}});
  }
  const manifest={format:1,encoder:{sharp:sharp.versions.sharp,libwebp:sharp.versions.webp},options,images};
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({images:images.length,originalBytes:images.reduce((n,x)=>n+x.original.bytes,0),webpBytes:images.reduce((n,x)=>n+x.webp.bytes,0)}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
