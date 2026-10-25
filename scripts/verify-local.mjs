import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:5173';
const response=await fetch(origin+'/api/studio');
assert.equal(response.status,200,'Local CRM should work without ChatGPT login');
const state=await response.json();assert.ok(state.shop.products.length);
console.log('PASS: Local CRM loads without sign-in.');
const forbidden=await fetch(origin+'/api/studio',{method:'POST',headers:{origin:'https://example.com','Content-Type':'application/json'},body:'{}'});
assert.equal(forbidden.status,403);console.log('PASS: Cross-origin writes are blocked.');
const status=await (await fetch(origin+'/api/try-on')).json();console.log('Hosted model:',JSON.stringify(status));
if(!process.argv.includes('--generate'))process.exit(0);
// Both images come from our AI-generated catalogue, never the user's photos.
const campaign=await readFile('public/campaign.png');const meta=await sharp(campaign).metadata();
const person=await sharp(campaign).extract({left:0,top:0,width:Math.round(meta.width/3),height:meta.height}).png().toBuffer();
const post=await fetch(origin+'/api/try-on',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({photo:'data:image/png;base64,'+person.toString('base64'),product:'sage',size:'M',consent:true})});
const submitted=await post.json();assert.equal(post.status,202,JSON.stringify(submitted));console.log('Hosted job submitted:',submitted.jobId);
let previous='';
for(let i=0;i<160;i++){
 await new Promise(r=>setTimeout(r,2000));const result=await (await fetch(origin+'/api/try-on/'+submitted.jobId)).json();
 const message=result.status+': '+(result.message||result.error||'');if(message!==previous){console.log(message);previous=message;}
 if(result.status==='failed'){console.error('HOSTED GENERATION FAILED:',result.error);process.exit(2);}
 if(result.status==='completed'){assert.ok(result.imageUrl.startsWith('data:image/png;base64,'));await mkdir('outputs',{recursive:true});await writeFile('outputs/hosted-try-on-test.png',Buffer.from(result.imageUrl.split(',')[1],'base64'));console.log('PASS: Actual hosted AI result saved to outputs/hosted-try-on-test.png.');process.exit(0);}
}
throw Error('Timed out waiting for hosted AI.');
